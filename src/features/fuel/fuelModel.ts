import type {
  FuelDetailTarget,
  FuelMasterCategory,
  FuelMasterOption,
  FuelRecord,
  SummaryRow,
} from "./fuelTypes";

export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
export const currentFuelMonth = () => todayKey().slice(0, 7);
export const formatFuelNumber = (value: number) => Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
export const formatFuelMoney = (value: number) => Math.round(Number(value || 0)).toLocaleString("ko-KR");
export const compareFuelNames = (a: string, b: string) => a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" });

export const asFuelNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeFuelText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
export const normalizeFuelHeader = (value: unknown) => normalizeFuelText(value).replace(/\s/g, "").replace(/[()（）]/g, "").toLowerCase();

export const fingerprintFuelSource = (raw: string) => {
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fuel-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const fuelMonthBounds = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(end).padStart(2, "0")}` };
};

export const calculateFuelAmounts = (quantity: number, unitPrice: number) => {
  const supply = Math.round(quantity * unitPrice);
  const vat = Math.round(supply * 0.1);
  return { supply, vat, total: supply + vat };
};

const FACTORY_VEHICLE_SUFFIXES = new Set(["1166", "1184", "1237", "4761", "5907", "6086", "9366"]);
const ASSEMBLY_VEHICLE_SUFFIXES = new Set(["4676", "6148", "7151", "7844", "8288", "8408"]);

export const inferFuelSite = (vehicle: string) => {
  const digits = String(vehicle || "").replace(/\D/g, "");
  const suffix = digits.slice(-4);
  if (FACTORY_VEHICLE_SUFFIXES.has(suffix)) return "공장";
  if (ASSEMBLY_VEHICLE_SUFFIXES.has(suffix)) return "국회";
  return "";
};

export const resolveFuelImportSite = (sourceSite: string, hasSiteColumn: boolean, vehicle: string) => {
  const autoSite = hasSiteColumn ? "" : inferFuelSite(vehicle);
  const siteName = sourceSite && sourceSite !== "미지정" ? sourceSite : autoSite || sourceSite || "미지정";
  return {
    siteName,
    fingerprintSite: hasSiteColumn ? siteName : "미지정",
    autoSite,
    memo: hasSiteColumn
      ? ""
      : autoSite
        ? "원본 명세서에 현장명 없음 · 차량번호로 현장 자동지정"
        : "원본 명세서에 현장명 없음",
  };
};

export const normalizeFuelRecord = (row: Record<string, unknown>): FuelRecord => ({
  ...row,
  id: String(row.id),
  fuel_date: String(row.fuel_date || ""),
  site_name: String(row.site_name || ""),
  product_name: String(row.product_name || ""),
  vehicle_number: String(row.vehicle_number || ""),
  usage_count: Number(row.usage_count || 0),
  quantity: Number(row.quantity || 0),
  line_amount: Number(row.line_amount || 0),
  unit_price: Number(row.unit_price || 0),
  supply_amount: Number(row.supply_amount || 0),
  vat_amount: Number(row.vat_amount || 0),
  total_amount: Number(row.total_amount || 0),
  station_name: String(row.station_name || ""),
}) as FuelRecord;

export const filterFuelRecords = (
  records: FuelRecord[],
  filters: { site: string; product: string; vehicleSearch: string },
) => records.filter((record) =>
  (!filters.site || record.site_name === filters.site)
  && (!filters.product || record.product_name === filters.product)
  && (!filters.vehicleSearch.trim() || record.vehicle_number.toLowerCase().includes(filters.vehicleSearch.trim().toLowerCase()))
).sort((a, b) => b.fuel_date.localeCompare(a.fuel_date)
  || compareFuelNames(a.vehicle_number, b.vehicle_number)
  || a.product_name.localeCompare(b.product_name, "ko-KR"));

export const calculateFuelTotals = (records: FuelRecord[]) => ({
  count: records.reduce((sum, record) => sum + Math.max(record.usage_count || 1, 1), 0),
  quantity: records.reduce((sum, record) => sum + record.quantity, 0),
  diesel: records.filter((record) => record.product_name.includes("경유")).reduce((sum, record) => sum + record.quantity, 0),
  urea: records.filter((record) => record.product_name.includes("요소")).reduce((sum, record) => sum + record.quantity, 0),
  total: records.reduce((sum, record) => sum + record.total_amount, 0),
});

export const summarizeFuelRecords = (
  records: FuelRecord[],
  key: "vehicle_number" | "site_name" | "station_name",
): SummaryRow[] => {
  const map = new Map<string, SummaryRow>();
  records.forEach((record) => {
    const name = record[key] || "미지정";
    const current = map.get(name) || { name, count: 0, quantity: 0, total: 0 };
    current.count += Math.max(record.usage_count || 1, 1);
    current.quantity += record.quantity;
    current.total += record.total_amount;
    map.set(name, current);
  });
  return [...map.values()].sort((a, b) => b.total - a.total || compareFuelNames(a.name, b.name));
};

export const filterFuelDetailRecords = (records: FuelRecord[], target: FuelDetailTarget | null) => {
  if (!target) return [];
  return records.filter((record) => target.type === "vehicle"
    ? record.vehicle_number === target.name
    : target.type === "site"
      ? record.site_name === target.name
      : record.station_name === target.name)
    .sort((a, b) => b.fuel_date.localeCompare(a.fuel_date)
      || compareFuelNames(a.vehicle_number, b.vehicle_number)
      || a.product_name.localeCompare(b.product_name, "ko-KR"));
};

export const summarizeFuelDetailRecords = (records: FuelRecord[]) => ({
  count: records.reduce((sum, row) => sum + Math.max(row.usage_count || 1, 1), 0),
  quantity: records.reduce((sum, row) => sum + row.quantity, 0),
  total: records.reduce((sum, row) => sum + row.total_amount, 0),
});

export const buildFuelVehicleProfiles = (records: FuelRecord[]) => {
  const map = new Map<string, FuelRecord>();
  records.forEach((record) => {
    const key = String(record.vehicle_number || "").trim();
    if (key && !map.has(key)) map.set(key, record);
  });
  return [...map.entries()].sort((a, b) => compareFuelNames(a[0], b[0]));
};

export const getManagedFuelOptions = (category: FuelMasterCategory, rows: FuelMasterOption[], fallback: string[]) => {
  const categoryRows = rows.filter((row) => row.category === category);
  const inactive = new Set(categoryRows.filter((row) => !row.is_active).map((row) => row.name));
  return [...new Set([
    ...categoryRows.filter((row) => row.is_active).map((row) => row.name),
    ...fallback.filter((name) => !inactive.has(name)),
  ])].filter(Boolean).sort(compareFuelNames);
};

export const normalizeFuelMasterOptions = (rows: Array<Record<string, unknown>>): FuelMasterOption[] => rows.map((row) => ({
  id: String(row.id),
  category: String(row.category) as FuelMasterCategory,
  name: String(row.name || ""),
  is_active: Boolean(row.is_active),
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
}));
