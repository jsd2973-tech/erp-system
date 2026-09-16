import type { DispatchOrder, DispatchTrip } from "./dispatchTypes";
import { dispatchToday } from "./dispatchUtils";

export type ResultPeriodPreset = "today" | "week" | "month" | "custom";

export type ResultOrder = Pick<
  DispatchOrder,
  "id" | "dispatch_date" | "vendor_id" | "vendor_name" | "item_id" | "item_name"
>;

export type ResultTrip = Pick<
  DispatchTrip,
  "id" | "dispatch_order_id" | "vehicle_id" | "driver_id" | "trip_no" | "status" | "actual_volume"
  | "created_at" | "loading_completed_at" | "unloading_completed_at"
>;

export type ResultRow = {
  trip: ResultTrip;
  vendorKey: string;
  vendor: string;
  itemKey: string;
  item: string;
  volume: number;
  reportDay: string;
  dateBasis: "unloading" | "dispatch";
};

export type ResultGroup = {
  key: string;
  name: string;
  rows: ResultRow[];
  tripCount: number;
  volume: number;
  percentage: number;
  vehicles: number;
};

export type ResultDayGroup = {
  day: string;
  rows: ResultRow[];
  tripCount: number;
  volume: number;
};

export type TransportResultSummary = {
  rows: ResultRow[];
  invalid: number;
  unlinked: number;
  fallback: number;
  volume: number;
  averageVolume: number;
  vehicles: number;
  vendors: number;
  items: number;
};

const dateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("올바른 날짜를 선택하세요.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw Error("올바른 날짜를 선택하세요.");
  }
  return date;
};

const dateKey = (date: Date) => [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
  .map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0"))
  .join("-");

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export function periodForPreset(preset: Exclude<ResultPeriodPreset, "custom">, today = dispatchToday()) {
  const date = dateOnly(today);
  if (preset === "today") return { from: today, to: today };
  if (preset === "month") {
    return {
      from: dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))),
      to: dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))),
    };
  }
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return { from: dateKey(addDays(date, -mondayOffset)), to: dateKey(addDays(date, 6 - mondayOffset)) };
}

export function periodBounds(from: string, to: string) {
  dateOnly(from);
  dateOnly(to);
  if (from > to) throw Error("조회 시작일과 종료일을 확인하세요.");
  const start = new Date(from + "T00:00:00+09:00");
  const end = new Date(to + "T00:00:00+09:00");
  return { start: start.toISOString(), end: new Date(+end + 86400000).toISOString() };
}

export const koreaDay = (stamp: string) => {
  const date = new Date(stamp);
  return Number.isFinite(date.getTime()) ? dateKey(new Date(date.getTime() + 9 * 3600000)) : "";
};

export const sumVolume = (rows: ResultRow[]) => Math.round(rows.reduce((sum, row) => sum + row.volume, 0) * 1000000) / 1000000;

export const vehicleCount = (rows: ResultRow[]) => new Set(rows.map(row => row.trip.vehicle_id).filter(Boolean)).size;

export function summarizeResults(trips: ResultTrip[], orders: ResultOrder[], from: string, to: string): TransportResultSummary {
  periodBounds(from, to);
  const lookup = new Map(orders.map(order => [order.id, order]));
  const seen = new Set<string>();
  const rows: ResultRow[] = [];
  let invalid = 0;
  let unlinked = 0;
  let fallback = 0;

  for (const trip of trips) {
    if (seen.has(trip.id)) continue;
    seen.add(trip.id);
    if (trip.status !== "완료") continue;

    const order = lookup.get(trip.dispatch_order_id);
    const unloadingDay = trip.unloading_completed_at ? koreaDay(trip.unloading_completed_at) : "";
    const reportDay = unloadingDay || order?.dispatch_date || "";
    const dateBasis = unloadingDay ? "unloading" : "dispatch";
    if (!reportDay) {
      invalid += 1;
      continue;
    }
    if (reportDay < from || reportDay > to) continue;

    const volume = Number(trip.actual_volume);
    if (!Number.isFinite(volume) || volume < 0) {
      invalid += 1;
      continue;
    }

    if (dateBasis === "dispatch") fallback += 1;
    if (!order) unlinked += 1;
    const vendor = String(order?.vendor_name || "").trim() || "거래처 확인 필요";
    const item = String(order?.item_name || "").trim() || "품목 확인 필요";
    rows.push({
      trip,
      volume,
      vendor,
      item,
      reportDay,
      dateBasis,
      vendorKey: order ? (order.vendor_id ? "id:" + order.vendor_id : "name:" + vendor) : "unknown",
      itemKey: order ? (order.item_id ? "id:" + order.item_id : "name:" + item) : "unknown",
    });
  }

  const volume = sumVolume(rows);
  return {
    rows,
    invalid,
    unlinked,
    fallback,
    volume,
    averageVolume: rows.length ? volume / rows.length : 0,
    vehicles: vehicleCount(rows),
    vendors: new Set(rows.filter(row => row.vendorKey !== "unknown").map(row => row.vendorKey)).size,
    items: new Set(rows.filter(row => row.itemKey !== "unknown").map(row => row.itemKey)).size,
  };
}

export function groupResults(rows: ResultRow[], by: "item" | "vendor", totalVolume = sumVolume(rows)): ResultGroup[] {
  const groups = new Map<string, { key: string; name: string; rows: ResultRow[] }>();
  rows.forEach(row => {
    const key = by === "item" ? row.itemKey : row.vendorKey;
    const group = groups.get(key) || { key, name: row[by], rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  });
  return [...groups.values()]
    .map(group => {
      const volume = sumVolume(group.rows);
      return {
        ...group,
        tripCount: group.rows.length,
        volume,
        percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
        vehicles: vehicleCount(group.rows),
      };
    })
    .sort((a, b) => b.volume - a.volume || b.tripCount - a.tripCount || a.name.localeCompare(b.name, "ko-KR"));
}

export function groupResultsByDay(rows: ResultRow[]): ResultDayGroup[] {
  const groups = new Map<string, ResultRow[]>();
  rows.forEach(row => groups.set(row.reportDay, [...(groups.get(row.reportDay) || []), row]));
  return [...groups.entries()]
    .map(([day, dayRows]) => ({ day, rows: dayRows, tripCount: dayRows.length, volume: sumVolume(dayRows) }))
    .sort((a, b) => b.day.localeCompare(a.day));
}
