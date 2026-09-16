import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx-js-style";
import { Download, Eye, FileSpreadsheet, Fuel, Paperclip, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, Upload } from "lucide-react";
import { buildFuelStatementWorkbook, type FuelStatementParty, type FuelStatementRecord } from "./fuelStatementExport";
import "./fuelManagement.css";

type FuelRecord = FuelStatementRecord & {
  source_file?: string | null;
  source_fingerprint?: string | null;
  receipt_path?: string | null;
  receipt_name?: string | null;
  receipt_mime_type?: string | null;
  receipt_uploaded_at?: string | null;
  created_at?: string;
};

type ParsedFuelRow = Omit<FuelRecord, "id" | "created_at">;
type SummaryRow = { name: string; count: number; quantity: number; total: number };
type FuelMasterCategory = "vehicle" | "station" | "product" | "site";
type FuelMasterOption = { id: string; category: FuelMasterCategory; name: string; is_active: boolean; updated_at?: string };
type ViewMode = "records" | "vehicle" | "site" | "station" | "basics";

type Props = {
  supabase: SupabaseClient;
  vendors?: FuelStatementParty[];
};

const EMPTY_STATEMENT_PARTIES: FuelStatementParty[] = [];

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const currentMonth = () => todayKey().slice(0, 7);
const number = (value: number) => Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
const money = (value: number) => Math.round(Number(value || 0)).toLocaleString("ko-KR");
const natural = (a: string, b: string) => a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" });
const asNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeHeader = (value: unknown) => text(value).replace(/\s/g, "").replace(/[()（）]/g, "").toLowerCase();
const fingerprint = (raw: string) => {
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fuel-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const monthBounds = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(end).padStart(2, "0")}` };
};

const parseDate = (value: unknown, fallbackYear: number, fallbackMonth: number) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }
  if (typeof value === "number" && value > 20000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = text(value);
  if (!raw) return "";
  let match = raw.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
  match = raw.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (match) return `${fallbackYear}-${String(Number(match[1]) || fallbackMonth).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
  return "";
};

const htmlTableToGrid = (table: HTMLTableElement) => {
  const grid: string[][] = [];
  const rowSpans: Array<{ value: string; left: number } | undefined> = [];
  Array.from(table.rows).forEach((tr) => {
    const row: string[] = [];
    let col = 0;
    const consumeSpans = () => {
      while (rowSpans[col]?.left) {
        const span = rowSpans[col]!;
        row[col] = span.value;
        span.left -= 1;
        if (span.left <= 0) rowSpans[col] = undefined;
        col += 1;
      }
    };
    consumeSpans();
    Array.from(tr.cells).forEach((cell) => {
      consumeSpans();
      const value = text(cell.textContent);
      const colSpan = Math.max(cell.colSpan || 1, 1);
      const rowSpan = Math.max(cell.rowSpan || 1, 1);
      for (let offset = 0; offset < colSpan; offset += 1) {
        row[col + offset] = value;
        if (rowSpan > 1) rowSpans[col + offset] = { value, left: rowSpan - 1 };
      }
      col += colSpan;
      consumeSpans();
    });
    while (rowSpans[col]?.left) {
      const span = rowSpans[col]!;
      row[col] = span.value;
      span.left -= 1;
      if (span.left <= 0) rowSpans[col] = undefined;
      col += 1;
    }
    grid.push(row);
  });
  return grid;
};

async function readFuelGrid(file: File) {
  const buffer = await file.arrayBuffer();
  const decoded = new TextDecoder("utf-8").decode(buffer.slice(0, Math.min(buffer.byteLength, 4096))).replace(/^\uFEFF/, "").trimStart().toLowerCase();
  if (decoded.startsWith("<!doctype") || decoded.startsWith("<html") || decoded.includes("<table")) {
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    const table = tables.find((candidate) => {
      const candidateText = candidate.textContent || "";
      return candidateText.includes("차량번호") && candidateText.includes("합계금액") && (candidateText.includes("현장명") || candidateText.includes("제품명"));
    });
    if (!table) throw new Error("거래내역 표를 찾지 못했습니다.");
    return { rows: htmlTableToGrid(table as HTMLTableElement), sourceText: doc.body.textContent || "" };
  }

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
  return { rows, sourceText: rows.flat().map(text).join(" ") };
}

async function parseFuelFile(file: File, fallbackMonth: string): Promise<ParsedFuelRow[]> {
  const { rows, sourceText } = await readFuelGrid(file);
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes("차량번호") && normalized.includes("일자") && normalized.some((header) => header.includes("제품명"));
  });
  if (headerIndex < 0) throw new Error("제품명·차량번호·일자 헤더를 찾지 못했습니다.");

  const headers = rows[headerIndex].map(normalizeHeader);
  const findColumn = (...needles: string[]) => headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
  const columns = {
    site: findColumn("현장명"),
    product: findColumn("제품명/규격", "제품명"),
    vehicle: findColumn("차량번호"),
    date: findColumn("일자"),
    count: findColumn("횟수"),
    quantity: findColumn("수량"),
    lineAmount: headers.findIndex((header) => header.includes("단가원/대") || header === "단가원/대"),
    unitPrice: headers.findIndex((header) => header.includes("단가원/단위") || header === "단가원/단위"),
    supply: findColumn("공급가액"),
    vat: findColumn("부가세"),
    total: findColumn("합계금액"),
  };
  if ([columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {
    throw new Error("필수 열을 모두 찾지 못했습니다.");
  }

  const filenameMatch = file.name.match(/(20\d{2})년\s*(\d{1,2})월/);
  const periodMatch = sourceText.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]/);
  const [fallbackYearText, fallbackMonthText] = fallbackMonth.split("-");
  const year = Number(filenameMatch?.[1] || periodMatch?.[1] || fallbackYearText);
  const month = Number(filenameMatch?.[2] || periodMatch?.[2] || fallbackMonthText);
  const stationName = sourceText.includes("남세종농협주유소")
    ? "남세종농협주유소"
    : text(file.name.replace(/_?20\d{2}년.*$/i, "").replace(/\.[^.]+$/, "")) || "주유소";

  const hasSiteColumn = columns.site >= 0;
  let lastSite = hasSiteColumn ? "" : "미지정";
  let lastProduct = "";
  let lastVehicle = "";
  const parsed: ParsedFuelRow[] = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    const valueAt = (index: number) => index >= 0 ? row[index] : "";
    const site = text(valueAt(columns.site)) || lastSite;
    const product = text(valueAt(columns.product)) || lastProduct;
    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;
    if (text(valueAt(columns.site))) lastSite = site;
    if (text(valueAt(columns.product))) lastProduct = product;
    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;

    const fuelDate = parseDate(valueAt(columns.date), year, month);
    if (!fuelDate || !vehicle) return;

    const quantity = asNumber(valueAt(columns.quantity));
    const unitPrice = asNumber(valueAt(columns.unitPrice));
    const supply = asNumber(valueAt(columns.supply));
    const vat = asNumber(valueAt(columns.vat));
    const total = asNumber(valueAt(columns.total));
    if (!quantity && !total) return;

    const usageCount = Math.max(Math.round(asNumber(valueAt(columns.count))) || 1, 1);
    const lineAmount = asNumber(valueAt(columns.lineAmount)) || supply;
    const rawFingerprint = [stationName, fuelDate, site, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");
    parsed.push({
      fuel_date: fuelDate,
      site_name: site || "미지정",
      product_name: product || "경유",
      vehicle_number: vehicle,
      usage_count: usageCount,
      quantity,
      line_amount: lineAmount,
      unit_price: unitPrice,
      supply_amount: supply,
      vat_amount: vat,
      total_amount: total,
      station_name: stationName,
      source_file: file.name,
      source_fingerprint: fingerprint(rawFingerprint),
      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",
    });
  });

  if (!parsed.length) throw new Error("가져올 주유내역이 없습니다.");
  return parsed;
}

const emptyManual = () => ({
  fuel_date: todayKey(), site_name: "공장", product_name: "경유", vehicle_number: "", quantity: "", unit_price: "", station_name: "남세종농협주유소", memo: "",
});

export default function FuelManagement({ supabase, vendors = EMPTY_STATEMENT_PARTIES }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [referenceRecords, setReferenceRecords] = useState<FuelRecord[]>([]);
  const [masterOptions, setMasterOptions] = useState<FuelMasterOption[]>([]);
  const [masterInputs, setMasterInputs] = useState<Record<FuelMasterCategory, string>>({ vehicle: "", station: "", product: "", site: "" });
  const [masterDrafts, setMasterDrafts] = useState<Record<string, string>>({});
  const [masterSaving, setMasterSaving] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [product, setProduct] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [view, setView] = useState<ViewMode>("records");
  const [detailTarget, setDetailTarget] = useState<{ type: "vehicle" | "site" | "station"; name: string } | null>(null);
  const [preview, setPreview] = useState<ParsedFuelRow[]>([]);
  const [previewFile, setPreviewFile] = useState("");
  const [importing, setImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [quickVehicle, setQuickVehicle] = useState("");
  const [quickVehicleBackup, setQuickVehicleBackup] = useState<Pick<ReturnType<typeof emptyManual>, "vehicle_number" | "site_name" | "product_name" | "unit_price" | "station_name"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<FuelRecord | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    const bounds = monthBounds(month);
    const { data, error: loadError } = await supabase
      .from("fuel_records")
      .select("*")
      .gte("fuel_date", bounds.from)
      .lte("fuel_date", bounds.to)
      .order("fuel_date", { ascending: false })
      .order("vehicle_number", { ascending: true });
    if (loadError) {
      setError(`유류내역을 불러오지 못했습니다. (${loadError.message})`);
      setRecords([]);
    } else {
      setRecords((data || []).map((row) => ({
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
      })) as FuelRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [month]);
  const loadMasters = async () => {
    const { data, error: masterError } = await supabase.from("fuel_master_options").select("id,category,name,is_active,updated_at").order("category").order("name");
    if (masterError) {
      setError(`유류 기초등록을 불러오지 못했습니다. (${masterError.message})`);
      return;
    }
    const rows=(data || []).map((row)=>({ id:String(row.id), category:String(row.category) as FuelMasterCategory, name:String(row.name || ""), is_active:Boolean(row.is_active), updated_at:row.updated_at ? String(row.updated_at) : undefined }));
    setMasterOptions(rows);
    setMasterDrafts(Object.fromEntries(rows.map((row)=>[row.id,row.name])));
  };
  useEffect(() => { void loadMasters(); }, []);
  useEffect(() => {
    const loadReferences = async () => {
      const { data } = await supabase.from("fuel_records")
        .select("fuel_date,site_name,product_name,vehicle_number,unit_price,station_name,quantity,total_amount,usage_count,line_amount,supply_amount,vat_amount,id")
        .order("fuel_date", { ascending: false })
        .limit(2000);
      if (data) setReferenceRecords(data as FuelRecord[]);
    };
    void loadReferences();
  }, [supabase]);

  const sites = useMemo(() => [...new Set(records.map((record) => record.site_name).filter(Boolean))].sort(natural), [records]);
  const products = useMemo(() => [...new Set(records.map((record) => record.product_name).filter(Boolean))].sort(natural), [records]);
  const filtered = useMemo(() => records.filter((record) =>
    (!site || record.site_name === site)
    && (!product || record.product_name === product)
    && (!vehicleSearch.trim() || record.vehicle_number.toLowerCase().includes(vehicleSearch.trim().toLowerCase()))
  ).sort((a, b) => b.fuel_date.localeCompare(a.fuel_date) || natural(a.vehicle_number, b.vehicle_number) || a.product_name.localeCompare(b.product_name, "ko-KR")), [records, site, product, vehicleSearch]);

  const totals = useMemo(() => ({
    count: filtered.reduce((sum, record) => sum + Math.max(record.usage_count || 1, 1), 0),
    quantity: filtered.reduce((sum, record) => sum + record.quantity, 0),
    diesel: filtered.filter((record) => record.product_name.includes("경유")).reduce((sum, record) => sum + record.quantity, 0),
    urea: filtered.filter((record) => record.product_name.includes("요소")).reduce((sum, record) => sum + record.quantity, 0),
    total: filtered.reduce((sum, record) => sum + record.total_amount, 0),
  }), [filtered]);

  const summarize = (key: "vehicle_number" | "site_name" | "station_name") => {
    const map = new Map<string, SummaryRow>();
    filtered.forEach((record) => {
      const name = record[key] || "미지정";
      const current = map.get(name) || { name, count: 0, quantity: 0, total: 0 };
      current.count += Math.max(record.usage_count || 1, 1);
      current.quantity += record.quantity;
      current.total += record.total_amount;
      map.set(name, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || natural(a.name, b.name));
  };
  const vehicleSummary = useMemo(() => summarize("vehicle_number"), [filtered]);
  const siteSummary = useMemo(() => summarize("site_name"), [filtered]);
  const stationSummary = useMemo(() => summarize("station_name"), [filtered]);
  const detailRows = useMemo(() => {
    if (!detailTarget) return [];
    return filtered.filter((record) => detailTarget.type === "vehicle" ? record.vehicle_number === detailTarget.name : detailTarget.type === "site" ? record.site_name === detailTarget.name : record.station_name === detailTarget.name)
      .sort((a, b) => b.fuel_date.localeCompare(a.fuel_date) || natural(a.vehicle_number, b.vehicle_number) || a.product_name.localeCompare(b.product_name, "ko-KR"));
  }, [detailTarget, filtered]);
  const detailTotals = useMemo(() => ({
    count: detailRows.reduce((sum, row) => sum + Math.max(row.usage_count || 1, 1), 0),
    quantity: detailRows.reduce((sum, row) => sum + row.quantity, 0),
    total: detailRows.reduce((sum, row) => sum + row.total_amount, 0),
  }), [detailRows]);

  const vehicleProfiles = useMemo(() => {
    const map = new Map<string, FuelRecord>();
    referenceRecords.forEach((record) => {
      const key = String(record.vehicle_number || "").trim();
      if (key && !map.has(key)) map.set(key, record);
    });
    return [...map.entries()].sort((a, b) => natural(a[0], b[0]));
  }, [referenceRecords]);
  const managedOptions = (category: FuelMasterCategory, fallback: string[]) => {
    const rows=masterOptions.filter((row)=>row.category===category);
    const inactive=new Set(rows.filter((row)=>!row.is_active).map((row)=>row.name));
    return [...new Set([...rows.filter((row)=>row.is_active).map((row)=>row.name), ...fallback.filter((name)=>!inactive.has(name))])].filter(Boolean).sort(natural);
  };
  const vehicleOptions = useMemo(() => managedOptions("vehicle", vehicleProfiles.map(([vehicle])=>vehicle)), [masterOptions, vehicleProfiles]);
  const allSites = useMemo(() => managedOptions("site", referenceRecords.map((record)=>String(record.site_name || ""))), [masterOptions, referenceRecords]);
  const allProducts = useMemo(() => managedOptions("product", referenceRecords.map((record)=>String(record.product_name || ""))), [masterOptions, referenceRecords]);
  const allStations = useMemo(() => managedOptions("station", ["남세종농협주유소", "믿음주유소", ...referenceRecords.map((record)=>String(record.station_name || ""))]), [masterOptions, referenceRecords]);

  const applyVehicleProfile = (vehicle: string) => {
    const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
    setManual((current) => ({ ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name }));
  };
  const selectQuickVehicle = (vehicle: string) => {
    setManual((current) => {
      setQuickVehicleBackup({ vehicle_number: current.vehicle_number, site_name: current.site_name, product_name: current.product_name, unit_price: current.unit_price, station_name: current.station_name });
      const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
      return { ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name };
    });
    setQuickVehicle(vehicle);
  };
  const cancelQuickVehicle = () => {
    if (quickVehicleBackup) setManual((current) => ({ ...current, ...quickVehicleBackup }));
    setQuickVehicle("");
    setQuickVehicleBackup(null);
  };

  const addMasterOption = async (category: FuelMasterCategory) => {
    const name=masterInputs[category].trim();
    if (!name) return;
    setMasterSaving(`add-${category}`); setError("");
    const { error: addError }=await supabase.from("fuel_master_options").insert({ category, name, is_active:true });
    setMasterSaving("");
    if (addError) { setError(addError.code === "23505" ? "이미 등록된 항목입니다." : `기초항목을 추가하지 못했습니다. (${addError.message})`); return; }
    setMasterInputs((current)=>({ ...current, [category]:"" }));
    await loadMasters();
  };
  const saveMasterOption = async (row: FuelMasterOption) => {
    const name=(masterDrafts[row.id] ?? row.name).trim();
    if (!name) return;
    setMasterSaving(row.id); setError("");
    const { error: saveError }=await supabase.from("fuel_master_options").update({ name, updated_at:new Date().toISOString() }).eq("id",row.id);
    setMasterSaving("");
    if (saveError) { setError(saveError.code === "23505" ? "같은 분류에 이미 등록된 이름입니다." : `기초항목을 수정하지 못했습니다. (${saveError.message})`); return; }
    await loadMasters();
  };
  const toggleMasterOption = async (row: FuelMasterOption) => {
    setMasterSaving(row.id); setError("");
    const { error: toggleError }=await supabase.from("fuel_master_options").update({ is_active:!row.is_active, updated_at:new Date().toISOString() }).eq("id",row.id);
    setMasterSaving("");
    if (toggleError) { setError(`사용 상태를 바꾸지 못했습니다. (${toggleError.message})`); return; }
    await loadMasters();
  };
  const masterGroups: Array<{ category:FuelMasterCategory; title:string; placeholder:string }> = [
    { category:"vehicle", title:"차량·장비번호", placeholder:"예: 세종03가1166 / WA500-8" },
    { category:"station", title:"주유처", placeholder:"예: 믿음주유소" },
    { category:"product", title:"유종", placeholder:"예: 경유 / 요소수" },
    { category:"site", title:"현장", placeholder:"예: 공장 / 국회" },
  ];

  const applyModernSheetStyle = (ws: XLSX.WorkSheet, headerRow: number, lastRow: number, lastCol: number, totalRow?: number) => {
    const thin = { style: "thin", color: { rgb: "D7E0EA" } } as const;
    for (let row = headerRow; row <= lastRow; row += 1) {
      for (let col = 0; col <= lastCol; col += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) continue;
        const isHeader = row === headerRow;
        const isTotal = totalRow === row;
        const isAlt = !isHeader && !isTotal && (row - headerRow) % 2 === 0;
        cell.s = { font: { name: "맑은 고딕", sz: 10, bold: isHeader || isTotal, color: { rgb: isHeader ? "FFFFFF" : isTotal ? "12324A" : "263746" } }, fill: { patternType: "solid", fgColor: { rgb: isHeader ? "1F4E78" : isTotal ? "DDEBF7" : isAlt ? "F6F9FC" : "FFFFFF" } }, alignment: { vertical: "center", horizontal: isHeader ? "center" : col >= 4 ? "right" : "left", wrapText: true }, border: { top: thin, bottom: thin, left: thin, right: thin } };
      }
    }
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}` };
    ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, index) => ({ hpt: index === headerRow ? 24 : 20 }));
  };
  const exportGeneralExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const header=["일자","현장","유종","차량/장비번호","횟수","수량(L)","단가(원/L)","공급가액","부가세","합계금액","주유처","메모"];
    const ordered=[...filtered].sort((a,b)=>b.fuel_date.localeCompare(a.fuel_date)||natural(a.vehicle_number,b.vehicle_number));
    const body=ordered.map((record)=>[record.fuel_date,record.site_name,record.product_name,record.vehicle_number,record.usage_count,record.quantity,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount,record.station_name,record.memo||""]);
    const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
    const aoa=[[`${month.replace("-","년 ")}월 유류관리 내역`],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],["총 주유비",sums.total,"원","총 수량",sums.qty,"L","총 주유횟수",sums.count,"회"],[],header,...body,["합계","","","",sums.count,sums.qty,"",sums.supply,sums.vat,sums.total,"",""]];
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:11}}]; ws["!cols"]=[12,15,12,18,8,12,14,14,12,15,21,24].map((wch)=>({wch}));
    if(ws["A1"]) ws["A1"].s={font:{name:"맑은 고딕",sz:18,bold:true,color:{rgb:"FFFFFF"}},fill:{patternType:"solid",fgColor:{rgb:"12324A"}},alignment:{horizontal:"left",vertical:"center"}};
    ["A2","A3","D3","G3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"52677A"}},alignment:{vertical:"center"}}; });
    ["B2","B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].s={font:{name:"맑은 고딕",sz:10,bold:true,color:{rgb:"12324A"}},alignment:{vertical:"center"}}; });
    ["B3","E3","H3"].forEach((ref)=>{ if(ws[ref]) ws[ref].z="#,##0"; });
    const lastRow=aoa.length-1; applyModernSheetStyle(ws,4,lastRow,11,lastRow); for(let r=5;r<=lastRow;r+=1){ [5,6,7,8,9].forEach((c)=>{ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell) cell.z="#,##0"; }); } (ws["!rows"] ||= [])[0]={hpt:32};
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"유류내역"); XLSX.writeFile(wb,`유류내역_${month}.xlsx`);
  };
  const exportStatementExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const filterSummary = [
      site ? `현장: ${site}` : "전체 현장",
      product ? `유종: ${product}` : "전체 유종",
      vehicleSearch.trim() ? `차량/장비: ${vehicleSearch.trim()}` : "전체 차량/장비",
    ].join(" · ");
    const workbook = buildFuelStatementWorkbook(filtered, {
      month,
      issueDate: todayKey(),
      filterSummary,
      parties: vendors,
    });
    XLSX.writeFile(workbook, `유류거래명세서_${month}.xlsx`);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const rows = await parseFuelFile(file, month);
      setPreview(rows);
      setPreviewFile(file.name);
    } catch (cause) {
      setPreview([]);
      setPreviewFile("");
      setError(cause instanceof Error ? cause.message : "파일을 읽지 못했습니다.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const importPreview = async () => {
    if (!preview.length) return;
    setImporting(true);
    setError("");
    const payload = preview.map((row) => ({ ...row, source_file: previewFile || row.source_file }));
    const { error: importError } = await supabase.from("fuel_records").upsert(payload, { onConflict: "source_fingerprint", ignoreDuplicates: true });
    setImporting(false);
    if (importError) {
      setError(`파일 등록에 실패했습니다. (${importError.message})`);
      return;
    }
    const importedMonth = preview[0]?.fuel_date.slice(0, 7);
    setPreview([]);
    setPreviewFile("");
    if (importedMonth && importedMonth !== month) setMonth(importedMonth);
    else await load();
  };

  const saveManual = async () => {
    const quantity = asNumber(manual.quantity);
    const unitPrice = asNumber(manual.unit_price);
    if (!manual.fuel_date || !manual.vehicle_number.trim() || quantity <= 0 || unitPrice <= 0) {
      setError("일자, 차량/장비번호, 수량, 단가를 확인해 주세요.");
      return;
    }
    const supply = Math.round(quantity * unitPrice);
    const vat = Math.round(supply * 0.1);
    const payload = {
      fuel_date: manual.fuel_date,
      site_name: manual.site_name.trim() || "미지정",
      product_name: manual.product_name.trim() || "경유",
      vehicle_number: manual.vehicle_number.trim(),
      usage_count: 1,
      quantity,
      line_amount: supply,
      unit_price: unitPrice,
      supply_amount: supply,
      vat_amount: vat,
      total_amount: supply + vat,
      station_name: manual.station_name.trim() || "직접입력",
      source_file: null,
      source_fingerprint: `manual-${crypto.randomUUID()}`,
      memo: manual.memo.trim(),
    };
    setSaving(true);
    const { error: saveError } = await supabase.from("fuel_records").insert(payload);
    setSaving(false);
    if (saveError) {
      setError(`유류내역 저장에 실패했습니다. (${saveError.message})`);
      return;
    }
    setManual(emptyManual());
    setQuickVehicle("");
    setQuickVehicleBackup(null);
    setManualOpen(false);
    if (payload.fuel_date.slice(0, 7) !== month) setMonth(payload.fuel_date.slice(0, 7));
    else await load();
  };

  const saveEditedRecord = async () => {
    if (!editingRecord) return;
    if (!editingRecord.fuel_date || !editingRecord.vehicle_number.trim()) { setError("일자와 차량/장비번호를 확인해주세요."); return; }
    setEditSaving(true); setError("");
    const payload = {
      fuel_date: editingRecord.fuel_date,
      site_name: editingRecord.site_name.trim() || "미지정",
      product_name: editingRecord.product_name.trim() || "경유",
      vehicle_number: editingRecord.vehicle_number.trim(),
      station_name: editingRecord.station_name.trim() || "미지정 주유소",
      memo: String(editingRecord.memo || "").trim(),
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from("fuel_records").update(payload).eq("id", editingRecord.id);
    setEditSaving(false);
    if (updateError) { setError(`유류내역을 수정하지 못했습니다. (${updateError.message})`); return; }
    setEditingRecord(null);
    await load();
  };

  const removeRecord = async (record: FuelRecord) => {
    if (!window.confirm(`${record.fuel_date} / ${record.vehicle_number} / ${record.product_name} ${number(record.quantity)}L 내역을 삭제할까요?`)) return;
    const { error: deleteError } = await supabase.from("fuel_records").delete().eq("id", record.id);
    if (deleteError) return setError(`삭제하지 못했습니다. (${deleteError.message})`);
    if (record.receipt_path) await supabase.storage.from("fuel-receipts").remove([record.receipt_path]);
    if (receiptTarget?.id === record.id) setReceiptTarget(null);
    await load();
  };

  const uploadReceipt = async (file?: File) => {
    if (!receiptTarget || !file) return;
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
      setError("영수증은 사진 또는 PDF 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("영수증 파일은 10MB 이하만 올릴 수 있습니다.");
      return;
    }
    setReceiptBusy(true); setError("");
    const extension = (file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg")).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
    const nextPath = `fuel/${receiptTarget.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const previousPath = receiptTarget.receipt_path || "";
    const { error: uploadError } = await supabase.storage.from("fuel-receipts").upload(nextPath, file, { upsert: false, contentType: file.type || undefined });
    if (uploadError) {
      setReceiptBusy(false);
      setError(`영수증 업로드에 실패했습니다. (${uploadError.message})`);
      return;
    }
    const patch = { receipt_path: nextPath, receipt_name: file.name, receipt_mime_type: file.type || null, receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error: updateError } = await supabase.from("fuel_records").update(patch).eq("id", receiptTarget.id);
    if (updateError) {
      await supabase.storage.from("fuel-receipts").remove([nextPath]);
      setReceiptBusy(false);
      setError(`영수증 정보를 저장하지 못했습니다. (${updateError.message})`);
      return;
    }
    if (previousPath && previousPath !== nextPath) await supabase.storage.from("fuel-receipts").remove([previousPath]);
    setReceiptTarget({ ...receiptTarget, ...patch });
    if (receiptInput.current) receiptInput.current.value = "";
    setReceiptBusy(false);
    await load();
  };

  const viewReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    setReceiptBusy(true); setError("");
    const { data, error: signedError } = await supabase.storage.from("fuel-receipts").createSignedUrl(receiptTarget.receipt_path, 300);
    setReceiptBusy(false);
    if (signedError || !data?.signedUrl) { setError(`영수증을 열지 못했습니다. (${signedError?.message || "signed URL 생성 실패"})`); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteReceipt = async () => {
    if (!receiptTarget?.receipt_path) return;
    if (!window.confirm(`${receiptTarget.fuel_date} / ${receiptTarget.vehicle_number} 영수증을 삭제할까요?`)) return;
    const oldPath = receiptTarget.receipt_path;
    setReceiptBusy(true); setError("");
    const { error: updateError } = await supabase.from("fuel_records").update({ receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null, updated_at: new Date().toISOString() }).eq("id", receiptTarget.id);
    if (updateError) { setReceiptBusy(false); setError(`영수증 정보를 삭제하지 못했습니다. (${updateError.message})`); return; }
    const { error: removeError } = await supabase.storage.from("fuel-receipts").remove([oldPath]);
    setReceiptTarget({ ...receiptTarget, receipt_path: null, receipt_name: null, receipt_mime_type: null, receipt_uploaded_at: null });
    setReceiptBusy(false);
    if (removeError) setError(`영수증 정보는 삭제됐지만 파일 정리에 실패했습니다. (${removeError.message})`);
    await load();
  };

  const previewTotals = useMemo(() => ({ quantity: preview.reduce((sum, row) => sum + row.quantity, 0), total: preview.reduce((sum, row) => sum + row.total_amount, 0) }), [preview]);

  return <section className="fuel-management">
    <header className="fuel-head">
      <div><span className="fuel-eyebrow">EQUIPMENT FUEL CONTROL</span><h2><Fuel size={25} /> 유류관리</h2><p>장비·차량별 경유/요소수 사용량과 비용을 월별로 관리합니다.</p></div>
      <div className="fuel-head-actions">
        <input ref={fileInput} type="file" accept=".xls,.xlsx,.csv,.html" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()}><Upload size={16} /> 명세서 가져오기</button>
        <button type="button" onClick={() => setManualOpen((value) => !value)}><Plus size={16} /> 직접 입력</button>
        <button type="button" className={view === "basics" ? "fuel-basics-action is-active" : "fuel-basics-action"} onClick={() => { setView((current) => current === "basics" ? "records" : "basics"); setDetailTarget(null); }}><Settings2 size={16} /> {view === "basics" ? "주유내역 보기" : "기초등록"}</button>
        <span className="fuel-action-divider" aria-hidden="true" />
        <button type="button" onClick={exportStatementExcel}><Download size={16} /> 명세서 엑셀</button>
        <button type="button" onClick={exportGeneralExcel}><Download size={16} /> 목록 엑셀</button>
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCcw size={16} /> 새로고침</button>
      </div>
    </header>

    {error && <div className="fuel-error">{error}</div>}

    {preview.length > 0 && <section className="fuel-import-preview">
      <div className="fuel-preview-title"><div><FileSpreadsheet size={20} /><span><strong>{previewFile}</strong><small>{preview.length}건을 찾았습니다.</small></span></div><button type="button" onClick={() => { setPreview([]); setPreviewFile(""); }}>취소</button></div>
      <div className="fuel-preview-kpis"><span>수량 <b>{number(previewTotals.quantity)} L</b></span><span>합계 <b>{money(previewTotals.total)}원</b></span></div>
      <div className="fuel-preview-list">{preview.slice(0, 8).map((row, index) => <div key={`${row.source_fingerprint}-${index}`}><span>{row.fuel_date}</span><strong>{row.vehicle_number}</strong><span>{row.product_name}</span><span>{number(row.quantity)}L</span><b>{money(row.total_amount)}원</b></div>)}</div>
      {preview.length > 8 && <p>외 {preview.length - 8}건</p>}
      <button className="fuel-primary" type="button" disabled={importing} onClick={() => void importPreview()}>{importing ? "등록 중..." : `${preview.length}건 등록`}</button>
    </section>}

    {manualOpen && <section className="fuel-manual-panel">
      <div className="fuel-section-title"><div><h3>유류 직접 입력</h3><p>수량 × 단가로 공급가액·부가세·합계금액을 자동 계산합니다.</p></div></div>
      <div className="fuel-manual-grid">
        <label><span>일자 *</span><input type="date" value={manual.fuel_date} onChange={(event) => setManual({ ...manual, fuel_date: event.target.value })} /></label>
        <label><span>현장</span><input list="fuel-site-options" value={manual.site_name} onChange={(event) => setManual({ ...manual, site_name: event.target.value })} placeholder="공장" /><datalist id="fuel-site-options">{allSites.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>유종</span><input list="fuel-product-options" value={manual.product_name} onChange={(event) => setManual({ ...manual, product_name: event.target.value })} placeholder="경유" /><datalist id="fuel-product-options">{allProducts.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value=event.target.value; if (quickVehicle) { setQuickVehicle(""); setQuickVehicleBackup(null); } setManual({ ...manual, vehicle_number:value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>수량(L) *</span><input inputMode="decimal" value={manual.quantity} onChange={(event) => setManual({ ...manual, quantity: event.target.value })} placeholder="270" /></label>
        <label><span>단가(원/L) *</span><input inputMode="decimal" value={manual.unit_price} onChange={(event) => setManual({ ...manual, unit_price: event.target.value })} placeholder="1820" /></label>
        <label><span>주유처</span><input list="fuel-station-options" value={manual.station_name} onChange={(event) => setManual({ ...manual, station_name: event.target.value })} /><datalist id="fuel-station-options">{allStations.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>메모</span><input value={manual.memo} onChange={(event) => setManual({ ...manual, memo: event.target.value })} placeholder="필요 시 입력" /></label>
      </div>
      {vehicleOptions.length > 0 && !quickVehicle && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0,18).map((name)=><button type="button" key={name} onClick={() => selectQuickVehicle(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
      {quickVehicle && <div className="fuel-quick-selected"><div><span>빠른 선택 적용</span><strong>{quickVehicle}</strong><small>최근 현장·유종·단가·주유처가 입력되었습니다.</small></div><button type="button" onClick={cancelQuickVehicle}>선택 취소</button></div>}
      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.quantity && manual.unit_price ? `${money(Math.round(asNumber(manual.quantity) * asNumber(manual.unit_price) * 1.1))}원` : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { setManual(emptyManual()); setQuickVehicle(""); setQuickVehicleBackup(null); setManualOpen(false); }}>입력 닫기</button><button type="button" className="fuel-primary" disabled={saving} onClick={() => void saveManual()}>{saving ? "저장 중..." : "저장"}</button></div>
    </section>}

    {editingRecord && <section className="fuel-edit-panel">
      <div className="fuel-section-title"><div><h3>주유내역 수정</h3><p>현장·유종·차량/장비번호·주유처를 수정할 수 있습니다.</p></div></div>
      <div className="fuel-manual-grid">
        <label><span>일자 *</span><input type="date" value={editingRecord.fuel_date} onChange={(event)=>setEditingRecord({ ...editingRecord, fuel_date:event.target.value })}/></label>
        <label><span>현장</span><input list="fuel-edit-site-options" value={editingRecord.site_name} onChange={(event)=>setEditingRecord({ ...editingRecord, site_name:event.target.value })}/><datalist id="fuel-edit-site-options">{allSites.map((name)=><option key={name} value={name}/>)}</datalist></label>
        <label><span>유종</span><input list="fuel-edit-product-options" value={editingRecord.product_name} onChange={(event)=>setEditingRecord({ ...editingRecord, product_name:event.target.value })}/><datalist id="fuel-edit-product-options">{allProducts.map((name)=><option key={name} value={name}/>)}</datalist></label>
        <label><span>차량/장비번호 *</span><input list="fuel-edit-vehicle-options" value={editingRecord.vehicle_number} onChange={(event)=>setEditingRecord({ ...editingRecord, vehicle_number:event.target.value })}/><datalist id="fuel-edit-vehicle-options">{vehicleOptions.map((name)=><option key={name} value={name}/>)}</datalist></label>
        <label><span>주유처</span><input list="fuel-edit-station-options" value={editingRecord.station_name} onChange={(event)=>setEditingRecord({ ...editingRecord, station_name:event.target.value })}/><datalist id="fuel-edit-station-options">{allStations.map((name)=><option key={name} value={name}/>)}</datalist></label>
        <label><span>메모</span><input value={editingRecord.memo || ""} onChange={(event)=>setEditingRecord({ ...editingRecord, memo:event.target.value })}/></label>
      </div>
      <div className="fuel-form-actions"><button type="button" onClick={()=>setEditingRecord(null)}>취소</button><button type="button" className="fuel-primary" disabled={editSaving} onClick={()=>void saveEditedRecord()}>{editSaving ? "저장 중..." : "수정 저장"}</button></div>
    </section>}

    {receiptTarget && <section className="fuel-edit-panel">
      <div className="fuel-section-title"><div><h3>영수증 첨부</h3><p>{receiptTarget.fuel_date} · {receiptTarget.vehicle_number} · {money(receiptTarget.total_amount)}원</p></div></div>
      <input ref={receiptInput} type="file" accept="image/*,application/pdf" hidden onChange={(event) => void uploadReceipt(event.target.files?.[0])} />
      <div className="fuel-manual-total"><span>첨부 상태</span><strong>{receiptTarget.receipt_path ? receiptTarget.receipt_name || "영수증 첨부됨" : "첨부된 영수증 없음"}</strong></div>
      <div className="fuel-form-actions">
        <button type="button" disabled={receiptBusy} onClick={() => setReceiptTarget(null)}>닫기</button>
        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void viewReceipt()}><Eye size={15} /> 보기</button>}
        {receiptTarget.receipt_path && <button type="button" disabled={receiptBusy} onClick={() => void deleteReceipt()}><Trash2 size={15} /> 영수증 삭제</button>}
        <button type="button" className="fuel-primary" disabled={receiptBusy} onClick={() => receiptInput.current?.click()}><Upload size={15} /> {receiptTarget.receipt_path ? "영수증 교체" : "영수증 첨부"}</button>
      </div>
    </section>}

    {view !== "basics" && <>
      <div className="fuel-toolbar">
        <label><span>조회월</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        <label><span>현장</span><select value={site} onChange={(event) => setSite(event.target.value)}><option value="">전체 현장</option>{sites.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label><span>유종</span><select value={product} onChange={(event) => setProduct(event.target.value)}><option value="">전체 유종</option>{products.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="fuel-search"><span>차량/장비</span><div><Search size={15} /><input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="차량번호 검색" /></div></label>
      </div>

      <div className="fuel-kpis">
        <article><span>총 유류비</span><strong>{money(totals.total)}<small>원</small></strong></article>
        <article><span>전체 수량</span><strong>{number(totals.quantity)}<small>L</small></strong></article>
        <article><span>경유</span><strong>{number(totals.diesel)}<small>L</small></strong></article>
        <article><span>요소수</span><strong>{number(totals.urea)}<small>L</small></strong></article>
        <article><span>주유 횟수</span><strong>{number(totals.count)}<small>회</small></strong></article>
      </div>

      <nav className="fuel-tabs" aria-label="유류관리 보기">
        <button type="button" aria-pressed={view === "records"} onClick={() => { setView("records"); setDetailTarget(null); }}>주유내역</button>
        <button type="button" aria-pressed={view === "vehicle"} onClick={() => { setView("vehicle"); setDetailTarget(null); }}>차량·장비별</button>
        <button type="button" aria-pressed={view === "site"} onClick={() => { setView("site"); setDetailTarget(null); }}>현장별</button>
        <button type="button" aria-pressed={view === "station"} onClick={() => { setView("station"); setDetailTarget(null); }}>주유소별</button>
      </nav>
    </>}

    {view === "basics" ? <section className="fuel-master-grid">
      {masterGroups.map((group)=><article className="fuel-master-card" key={group.category}>
        <header><div><h3>{group.title}</h3><span>{masterOptions.filter((row)=>row.category===group.category && row.is_active).length}개 사용중</span></div></header>
        <div className="fuel-master-add"><input value={masterInputs[group.category]} onChange={(event)=>setMasterInputs((current)=>({ ...current, [group.category]:event.target.value }))} onKeyDown={(event)=>{ if(event.key==="Enter") void addMasterOption(group.category); }} placeholder={group.placeholder}/><button type="button" disabled={masterSaving===`add-${group.category}`} onClick={()=>void addMasterOption(group.category)}>추가</button></div>
        <div className="fuel-master-list">{masterOptions.filter((row)=>row.category===group.category).sort((a,b)=>Number(b.is_active)-Number(a.is_active)||natural(a.name,b.name)).map((row)=><div className={row.is_active ? "" : "is-inactive"} key={row.id}><input value={masterDrafts[row.id] ?? row.name} onChange={(event)=>setMasterDrafts((current)=>({ ...current, [row.id]:event.target.value }))}/><button type="button" disabled={masterSaving===row.id || (masterDrafts[row.id] ?? row.name).trim()===row.name} onClick={()=>void saveMasterOption(row)}>저장</button><button type="button" className="fuel-master-toggle" disabled={masterSaving===row.id} onClick={()=>void toggleMasterOption(row)}>{row.is_active ? "미사용" : "사용"}</button></div>)}</div>
      </article>)}
    </section> : loading ? <div className="fuel-empty">유류내역을 불러오는 중...</div> : view === "records" ? <>
      <div className="fuel-table-wrap">
        <table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th><th>주유처</th><th></th></tr></thead><tbody>
          {!filtered.length ? <tr><td colSpan={12} className="fuel-empty-cell">조건에 맞는 유류내역이 없습니다.</td></tr> : filtered.map((record) => <tr key={record.id}>
            <td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number">{money(record.supply_amount)}</td><td className="fuel-number">{money(record.vat_amount)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td><td><div className="fuel-row-actions"><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button><button className="fuel-icon-button" type="button" title="수정" onClick={() => setEditingRecord({ ...record })}><Pencil size={15} /></button><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></div></td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="fuel-mobile-list">{!filtered.length ? <div className="fuel-empty">조건에 맞는 유류내역이 없습니다.</div> : filtered.map((record) => <article key={record.id}>
        <header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header>
        <div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span></div>
        <footer><span>{record.station_name}</span><div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button><button type="button" onClick={() => setEditingRecord({ ...record })}><Pencil size={14} /> 수정</button><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></div></footer>
      </article>)}</div>
    </> : <>
      <div className="fuel-summary-list">
        {(view === "vehicle" ? vehicleSummary : view === "site" ? siteSummary : stationSummary).length ? (view === "vehicle" ? vehicleSummary : view === "site" ? siteSummary : stationSummary).map((row, index) => <article key={row.name} className="fuel-summary-clickable" role="button" tabIndex={0} onClick={() => setDetailTarget({ type: view === "vehicle" ? "vehicle" : view === "site" ? "site" : "station", name: row.name })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setDetailTarget({ type: view === "vehicle" ? "vehicle" : view === "site" ? "site" : "station", name: row.name }); }}>
          <span className="fuel-rank">{index + 1}</span><div><strong>{row.name}</strong><small>{number(row.quantity)} L · {row.count}회</small></div><b>{money(row.total)}원</b>
        </article>) : <div className="fuel-empty">집계할 내역이 없습니다.</div>}
      </div>
      {detailTarget && <section className="fuel-drilldown">
        <header><div><span>{detailTarget.type === "vehicle" ? "차량·장비 상세" : detailTarget.type === "site" ? "현장 상세" : "주유소 상세"}</span><h3>{detailTarget.name}</h3></div><button type="button" onClick={() => setDetailTarget(null)}>닫기</button></header>
        <div className="fuel-drilldown-kpis"><span>주유 <b>{detailTotals.count}회</b></span><span>수량 <b>{number(detailTotals.quantity)} L</b></span><span>합계 <b>{money(detailTotals.total)}원</b></span></div>
        <div className="fuel-table-wrap"><table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>합계금액</th><th>주유처</th><th>영수증</th></tr></thead><tbody>{detailRows.map((record) => <tr key={record.id}><td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td><td><button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button></td></tr>)}</tbody></table></div>
        <div className="fuel-mobile-list">{detailRows.map((record) => <article key={record.id}><header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header><div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span></div><footer><span>{record.station_name}</span><div className="fuel-mobile-actions"><button type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={14} /> {record.receipt_path ? "영수증" : "첨부"}</button></div></footer></article>)}</div>
      </section>}
    </>}
  </section>;
}
