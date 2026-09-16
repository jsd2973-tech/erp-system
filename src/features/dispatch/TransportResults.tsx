import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchVehicle } from "./dispatchTypes";
import { formatVolume } from "./dispatchUtils";
import {
  groupResults,
  groupResultsByDay,
  periodBounds,
  periodForPreset,
  summarizeResults,
  sumVolume,
  type ResultGroup,
  type ResultOrder,
  type ResultPeriodPreset,
  type ResultRow,
  type ResultTrip,
} from "./transportResults";
import "./transportResults.css";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const countText = (value: number) => value.toLocaleString("ko-KR");
const volumeValue = (value: number) => formatVolume(value).replace(/루베$/, "");
const percentText = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "%";
const dayText = (day: string) => {
  const date = new Date(day + "T00:00:00+09:00");
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : day;
};
const timeText = (stamp: string | null) => {
  if (!stamp) return "-";
  const date = new Date(stamp);
  return Number.isFinite(date.getTime()) ? timeFormatter.format(date) : "-";
};

const sortTripRows = (rows: ResultRow[]) => [...rows].sort((a, b) =>
  a.reportDay.localeCompare(b.reportDay)
  || Number(a.trip.trip_no || 0) - Number(b.trip.trip_no || 0)
  || (a.trip.unloading_completed_at || "").localeCompare(b.trip.unloading_completed_at || "")
  || a.trip.id.localeCompare(b.trip.id));

const groupTripRowsByDay = (rows: ResultRow[]) => {
  const groups = new Map<string, ResultRow[]>();
  sortTripRows(rows).forEach(row => groups.set(row.reportDay, [...(groups.get(row.reportDay) || []), row]));
  return [...groups.entries()].map(([day, dayRows]) => ({ day, rows: dayRows }));
};

const displayTripTime = (row: ResultRow) => row.trip.unloading_completed_at
  ? timeText(row.trip.unloading_completed_at) + " · " + row.trip.trip_no + "회차"
  : dayText(row.reportDay) + " 배차일 · " + row.trip.trip_no + "회차";

const presetLabels: Array<{ key: Exclude<ResultPeriodPreset, "custom">; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번주" },
  { key: "month", label: "이번달" },
];

export default function TransportResults({ supabase, vehicles }: { supabase: SupabaseClient; vehicles: DispatchVehicle[] }) {
  const initialRange = periodForPreset("today");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<ResultPeriodPreset>("today");
  const [period, setPeriod] = useState({ ...initialRange, preset: "today" as ResultPeriodPreset, refresh: 0 });
  const [by, setBy] = useState<"item" | "vendor">("vendor");
  const [data, setData] = useState<{ trips: ResultTrip[]; orders: ResultOrder[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      setData(null);
      try {
        const bounds = periodBounds(period.from, period.to);
        const collectPrimaryTrips = async () => {
          const collected: ResultTrip[] = [];
          let cursor = "";
          while (true) {
            let query = supabase
              .from("dispatch_trips")
              .select("id,dispatch_order_id,vehicle_id,trip_no,status,actual_volume,unloading_completed_at")
              .eq("status", "완료")
              .gte("unloading_completed_at", bounds.start)
              .lt("unloading_completed_at", bounds.end)
              .order("id")
              .limit(500)
              .abortSignal(controller.signal);
            if (cursor) query = query.gt("id", cursor);
            const result = await query;
            if (result.error) throw result.error;
            const page = (result.data || []) as ResultTrip[];
            if (!page.length) break;
            collected.push(...page);
            cursor = page[page.length - 1].id;
          }
          return collected;
        };
        const collectFallbackOrderIds = async () => {
          const collected: string[] = [];
          let cursor = "";
          while (true) {
            let query = supabase
              .from("dispatch_orders")
              .select("id")
              .gte("dispatch_date", period.from)
              .lte("dispatch_date", period.to)
              .order("id")
              .limit(500)
              .abortSignal(controller.signal);
            if (cursor) query = query.gt("id", cursor);
            const result = await query;
            if (result.error) throw result.error;
            const page = (result.data || []) as Array<{ id: string }>;
            if (!page.length) break;
            collected.push(...page.map(row => String(row.id)));
            cursor = String(page[page.length - 1].id);
          }
          return collected;
        };
        const collectFallbackTrips = async (orderIds: string[]) => {
          const collected: ResultTrip[] = [];
          for (let i = 0; i < orderIds.length; i += 100) {
            let cursor = "";
            while (true) {
              let query = supabase
                .from("dispatch_trips")
                .select("id,dispatch_order_id,vehicle_id,trip_no,status,actual_volume,unloading_completed_at")
                .eq("status", "완료")
                .is("unloading_completed_at", null)
                .in("dispatch_order_id", orderIds.slice(i, i + 100))
                .order("id")
                .limit(500)
                .abortSignal(controller.signal);
              if (cursor) query = query.gt("id", cursor);
              const result = await query;
              if (result.error) throw result.error;
              const page = (result.data || []) as ResultTrip[];
              if (!page.length) break;
              collected.push(...page);
              cursor = page[page.length - 1].id;
            }
          }
          return collected;
        };

        const [primaryTrips, fallbackOrderIds] = await Promise.all([collectPrimaryTrips(), collectFallbackOrderIds()]);
        const fallbackTrips = fallbackOrderIds.length ? await collectFallbackTrips(fallbackOrderIds) : [];
        const trips = [...primaryTrips, ...fallbackTrips];
        const ids = [...new Set(trips.map(trip => trip.dispatch_order_id))];
        const orders: ResultOrder[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          let cursor = "";
          while (true) {
            let query = supabase
              .from("dispatch_orders")
              .select("id,dispatch_date,vendor_id,vendor_name,item_id,item_name")
              .in("id", ids.slice(i, i + 100))
              .order("id")
              .limit(100)
              .abortSignal(controller.signal);
            if (cursor) query = query.gt("id", cursor);
            const result = await query;
            if (result.error) throw result.error;
            const page = (result.data || []) as ResultOrder[];
            if (!page.length) break;
            orders.push(...page);
            cursor = page[page.length - 1].id;
          }
        }
        if (!controller.signal.aborted) setData({ trips, orders });
      } catch (cause) {
        if (!controller.signal.aborted) setError("실적을 불러오지 못했습니다. " + (cause instanceof Error ? cause.message : "잠시 후 다시 조회해 주세요."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [supabase, period.from, period.to, period.refresh]);

  const result = useMemo(
    () => data ? summarizeResults(data.trips, data.orders, period.from, period.to) : null,
    [data, period.from, period.to],
  );
  const groups = useMemo(() => result ? groupResults(result.rows, by, result.volume) : [], [result, by]);
  const vehicleNames = useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle.vehicle_number])), [vehicles]);

  const setRange = (nextFrom: string, nextTo: string, nextPreset: ResultPeriodPreset) => {
    try {
      periodBounds(nextFrom, nextTo);
      setFrom(nextFrom);
      setTo(nextTo);
      setPreset(nextPreset);
      setError("");
      setPeriod(current => ({ from: nextFrom, to: nextTo, preset: nextPreset, refresh: current.refresh + 1 }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "조회 시작일과 종료일을 확인하세요.");
    }
  };

  const choosePreset = (nextPreset: Exclude<ResultPeriodPreset, "custom">) => {
    const range = periodForPreset(nextPreset);
    setRange(range.from, range.to, nextPreset);
  };

  const updateDate = (field: "from" | "to", value: string) => {
    const nextFrom = field === "from" ? value : from;
    const nextTo = field === "to" ? value : to;
    setFrom(nextFrom);
    setTo(nextTo);
    setPreset("custom");
    try {
      periodBounds(nextFrom, nextTo);
      setError("");
      setPeriod(current => ({ from: nextFrom, to: nextTo, preset: "custom", refresh: current.refresh + 1 }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "조회 시작일과 종료일을 확인하세요.");
    }
  };

  return <section className="transport-results" aria-label="운송실적">
    <header className="transport-results-header">
      <div><span className="transport-eyebrow">TRANSPORT REPORT</span><h2>운송실적</h2><p>완료 운행 기준 · 하차완료 시각으로 집계합니다.</p></div>
      <span className="transport-results-note">한국시간(Asia/Seoul)</span>
    </header>

    <div className="transport-period-picker">
      <div className="transport-quick-filters" role="group" aria-label="빠른 기간 선택">
        {presetLabels.map(option => <button key={option.key} type="button" className={preset === option.key ? "active" : ""} aria-pressed={preset === option.key} onClick={() => choosePreset(option.key)}>{option.label}</button>)}
        <button type="button" className={preset === "custom" ? "active" : ""} aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>직접선택</button>
      </div>
      <div className="transport-date-filters">
        <label>시작일<input type="date" value={from} onChange={event => updateDate("from", event.target.value)} /></label>
        <label>종료일<input type="date" value={to} onChange={event => updateDate("to", event.target.value)} /></label>
        <button type="button" onClick={() => setPeriod(current => ({ ...current, refresh: current.refresh + 1 }))}>{loading ? "조회 중…" : "새로고침"}</button>
      </div>
    </div>

    {error && <p role="alert" className="transport-warning">{error}</p>}
    {loading ? <p role="status" className="transport-loading">실적을 집계하고 있습니다…</p> : result && <>
      <p className="transport-period">{dayText(period.from)} ~ {dayText(period.to)} · 하차완료 기준{period.preset === "week" && " · 월요일~일요일"}</p>
      <div className="transport-kpis" aria-label="운송실적 핵심지표">
        {[
          ["총 운송량", result.rows.length ? volumeValue(result.volume) : "—", "루베", "primary"],
          ["완료 운행", result.rows.length ? countText(result.rows.length) : "—", "회", ""],
          ["거래처 수", result.rows.length ? countText(result.vendors) : "—", "곳", ""],
          ["품목 수", result.rows.length ? countText(result.items) : "—", "종", ""],
          ["평균 1회", result.rows.length ? volumeValue(result.averageVolume) : "—", "루베", ""],
          ["투입 차량", result.rows.length ? countText(result.vehicles) : "—", "대", "secondary"],
        ].map(([label, value, unit, tone]) => <article key={label} className={tone}><span>{label}</span><strong>{value}<small>{value === "—" ? "" : unit}</small></strong></article>)}
      </div>
      <p className="transport-help">완료된 trip의 실제 <code>actual_volume</code> 합계입니다. 같은 차량의 여러 회차는 완료 운행으로 각각 계산합니다.</p>
      {result.fallback > 0 && <p className="transport-info">하차완료 시각이 없는 {countText(result.fallback)}건은 배차일을 기준으로 보완했습니다.</p>}
      {(result.invalid > 0 || result.unlinked > 0) && <p className="transport-warning">{result.invalid > 0 && "날짜 또는 물량 확인이 필요한 " + countText(result.invalid) + "건은 집계에서 제외했습니다. "}{result.unlinked > 0 && "배차 연결을 확인할 " + countText(result.unlinked) + "건은 ‘확인 필요’로 표시합니다."}</p>}

      <nav className="transport-tabs" aria-label="실적 분류">
        <button type="button" aria-pressed={by === "vendor"} onClick={() => setBy("vendor")}>거래처별</button>
        <button type="button" aria-pressed={by === "item"} onClick={() => setBy("item")}>품목별</button>
      </nav>

      {!groups.length ? <div className="transport-empty"><strong>선택한 기간의 완료 운송실적이 없습니다.</strong><span>완료된 trip이 있는 기간을 선택하면 거래처·품목별 실적이 표시됩니다.</span></div> : <div className="transport-groups">
        <div className="transport-columns"><span>{by === "item" ? "품목" : "거래처"}</span><span>완료 운행</span><span>운송량</span><span>비중</span></div>
        {groups.map(group => <ResultGroupDetails key={by + ":" + group.key} group={group} by={by} vehicleNames={vehicleNames} />)}
      </div>}
    </>}
  </section>;
}

function ResultGroupDetails({ group, by, vehicleNames }: { group: ResultGroup; by: "item" | "vendor"; vehicleNames: Map<string, string> }) {
  const subGroups = groupResults(group.rows, by === "vendor" ? "item" : "vendor", group.volume);
  const dayGroups = groupResultsByDay(group.rows);
  const vehicleIds = [...new Set(group.rows.map(row => row.trip.vehicle_id).filter(Boolean))]
    .sort((a, b) => (vehicleNames.get(a) || "").localeCompare(vehicleNames.get(b) || "", "ko-KR", { numeric: true, sensitivity: "base" }));

  return <details className="transport-group">
    <summary>
      <span className="transport-group-main"><strong>{group.name}</strong><small>전체의 {percentText(group.percentage)}</small><i aria-hidden="true"><b style={{ width: String(Math.min(100, Math.max(0, group.percentage))) + "%" }} /></i></span>
      <span className="transport-group-stats"><span><em>완료</em>{countText(group.tripCount)}회</span><b><em>운송량</em>{volumeValue(group.volume)}루베</b><span><em>차량</em>{countText(group.vehicles)}대</span></span>
    </summary>
    <div className="transport-breakdown">
      <div className="transport-detail-kpis"><span>완료 운행 <b>{countText(group.tripCount)}회</b></span><span>총 운송량 <b>{volumeValue(group.volume)}루베</b></span><span>전체 비중 <b>{percentText(group.percentage)}</b></span></div>
      <h3>날짜별 실적</h3>
      <div className="transport-breakdown-list transport-day-list">{dayGroups.map(day => <div key={day.day}><strong>{dayText(day.day)}</strong><span>{countText(day.tripCount)}회 · {volumeValue(day.volume)}루베</span></div>)}</div>
      <h3>{by === "vendor" ? "품목별 상세" : "거래처별 상세"}</h3>
      <div className="transport-breakdown-list">{subGroups.map(sub => <div key={sub.key}><strong>{sub.name}</strong><span>{countText(sub.tripCount)}회 · {volumeValue(sub.volume)}루베</span></div>)}</div>
      <h3>차량별 운행기록</h3>
      {vehicleIds.map(id => {
        const rows = group.rows.filter(row => row.trip.vehicle_id === id);
        const days = groupTripRowsByDay(rows);
        return <details key={id} className="transport-vehicle-detail"><summary>{vehicleNames.get(id) || "차량 확인 필요"} · {countText(rows.length)}회 · {volumeValue(sumVolume(rows))}루베</summary>{days.map(day => <section key={day.day} className="transport-trip-day"><h4>{dayText(day.day)}</h4><ul>{day.rows.map(row => <li key={row.trip.id}><span>{displayTripTime(row)}<br />{row.vendor} · {row.item}{row.dateBasis === "dispatch" && <small> · 배차일 보완</small>}</span><b>{volumeValue(row.volume)}루베</b></li>)}</ul></section>)}</details>;
      })}
    </div>
  </details>;
}
