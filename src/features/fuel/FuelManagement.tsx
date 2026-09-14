import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx-js-style";
import { Download, FileSpreadsheet, Fuel, Plus, RefreshCcw, Search, Trash2, Upload } from "lucide-react";
import "./fuelManagement.css";

type FuelRecord = {
  id: string;
  fuel_date: string;
  site_name: string;
  product_name: string;
  vehicle_number: string;
  usage_count: number;
  quantity: number;
  line_amount: number;
  unit_price: number;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  station_name: string;
  source_file?: string | null;
  source_fingerprint?: string | null;
  memo?: string | null;
  created_at?: string;
};

type ParsedFuelRow = Omit<FuelRecord, "id" | "created_at">;
type SummaryRow = { name: string; count: number; quantity: number; total: number };
type ViewMode = "records" | "vehicle" | "site";

type Props = {
  supabase: SupabaseClient;
};

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
      return candidateText.includes("차량번호") && candidateText.includes("합계금액") && candidateText.includes("현장명");
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
    return normalized.includes("현장명") && normalized.includes("차량번호") && normalized.includes("일자");
  });
  if (headerIndex < 0) throw new Error("현장명·차량번호·일자 헤더를 찾지 못했습니다.");

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
  if ([columns.site, columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {
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

  let lastSite = "";
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
      memo: "",
    });
  });

  if (!parsed.length) throw new Error("가져올 주유내역이 없습니다.");
  return parsed;
}

const emptyManual = () => ({
  fuel_date: todayKey(), site_name: "공장", product_name: "경유", vehicle_number: "", quantity: "", unit_price: "", station_name: "남세종농협주유소", memo: "",
});

export default function FuelManagement({ supabase }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [referenceRecords, setReferenceRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [product, setProduct] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [view, setView] = useState<ViewMode>("records");
  const [preview, setPreview] = useState<ParsedFuelRow[]>([]);
  const [previewFile, setPreviewFile] = useState("");
  const [importing, setImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  const summarize = (key: "vehicle_number" | "site_name") => {
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

  const vehicleProfiles = useMemo(() => {
    const map = new Map<string, FuelRecord>();
    referenceRecords.forEach((record) => {
      const key = String(record.vehicle_number || "").trim();
      if (key && !map.has(key)) map.set(key, record);
    });
    return [...map.entries()].sort((a, b) => natural(a[0], b[0]));
  }, [referenceRecords]);
  const vehicleOptions = useMemo(() => vehicleProfiles.map(([vehicle]) => vehicle), [vehicleProfiles]);
  const allSites = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.site_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);
  const allProducts = useMemo(() => [...new Set(referenceRecords.map((record) => String(record.product_name || "")).filter(Boolean))].sort(natural), [referenceRecords]);

  const applyVehicleProfile = (vehicle: string) => {
    const profile = vehicleProfiles.find(([name]) => name === vehicle)?.[1];
    setManual((current) => ({ ...current, vehicle_number: vehicle, site_name: profile?.site_name || current.site_name, product_name: profile?.product_name || current.product_name, unit_price: profile?.unit_price ? String(profile.unit_price) : current.unit_price, station_name: profile?.station_name || current.station_name }));
  };

  const exportGeneralExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const rows = filtered.map((record) => ({ 일자: record.fuel_date, 현장: record.site_name, 유종: record.product_name, "차량/장비번호": record.vehicle_number, 횟수: record.usage_count, "수량(L)": record.quantity, "단가(원/L)": record.unit_price, 공급가액: record.supply_amount, 부가세: record.vat_amount, 합계금액: record.total_amount, 주유처: record.station_name, 메모: record.memo || "" }));
    const ws = XLSX.utils.json_to_sheet(rows); ws["!cols"]=[12,14,12,18,8,11,13,14,12,14,20,20].map((wch)=>({wch}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"유류내역"); XLSX.writeFile(wb,`유류내역_${month}.xlsx`);
  };

  const exportStatementExcel = () => {
    if (!filtered.length) return setError("다운로드할 유류내역이 없습니다.");
    const ordered=[...filtered].sort((a,b)=>natural(a.site_name,b.site_name)||natural(a.product_name,b.product_name)||natural(a.vehicle_number,b.vehicle_number)||a.fuel_date.localeCompare(b.fuel_date));
    const header=["현장명","제품명/규격","차량번호","일자","횟수","수량","단가(원/대)","단가(원/단위)","공급가액","부가세","합계금액"];
    const body=ordered.map((record)=>[record.site_name,record.product_name,record.vehicle_number,record.fuel_date,record.usage_count,record.quantity,record.line_amount,record.unit_price,record.supply_amount,record.vat_amount,record.total_amount]);
    const sums=ordered.reduce((acc,record)=>({count:acc.count+record.usage_count,qty:acc.qty+record.quantity,supply:acc.supply+record.supply_amount,vat:acc.vat+record.vat_amount,total:acc.total+record.total_amount}),{count:0,qty:0,supply:0,vat:0,total:0});
    const aoa=[[`${month.replace("-","년 ")}월 유류 거래명세서`],["주유처",ordered[0]?.station_name||""],["조회기간",`${month}-01 ~ ${monthBounds(month).to}`],[],header,...body,["합계","","","",sums.count,sums.qty,"","",sums.supply,sums.vat,sums.total]];
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:10}}]; ws["!cols"]=[16,16,18,13,9,11,14,15,14,12,14].map((wch)=>({wch}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"거래명세서"); XLSX.writeFile(wb,`유류거래명세서_${month}.xlsx`);
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
    setManualOpen(false);
    if (payload.fuel_date.slice(0, 7) !== month) setMonth(payload.fuel_date.slice(0, 7));
    else await load();
  };

  const removeRecord = async (record: FuelRecord) => {
    if (!window.confirm(`${record.fuel_date} / ${record.vehicle_number} / ${record.product_name} ${number(record.quantity)}L 내역을 삭제할까요?`)) return;
    const { error: deleteError } = await supabase.from("fuel_records").delete().eq("id", record.id);
    if (deleteError) return setError(`삭제하지 못했습니다. (${deleteError.message})`);
    await load();
  };

  const previewTotals = useMemo(() => ({ quantity: preview.reduce((sum, row) => sum + row.quantity, 0), total: preview.reduce((sum, row) => sum + row.total_amount, 0) }), [preview]);

  return <section className="fuel-management">
    <header className="fuel-head">
      <div><span className="fuel-eyebrow">EQUIPMENT FUEL CONTROL</span><h2><Fuel size={25} /> 유류관리</h2><p>장비·차량별 경유/요소수 사용량과 비용을 월별로 관리합니다.</p></div>
      <div className="fuel-head-actions">
        <input ref={fileInput} type="file" accept=".xls,.xlsx,.csv,.html" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()}><Upload size={16} /> 명세서 가져오기</button>
        <button type="button" onClick={exportStatementExcel}><Download size={16} /> 명세서 엑셀</button>
        <button type="button" onClick={exportGeneralExcel}><Download size={16} /> 목록 엑셀</button>
        <button type="button" onClick={() => setManualOpen((value) => !value)}><Plus size={16} /> 직접 입력</button>
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
        <label className="fuel-vehicle-entry"><span>차량/장비번호 *</span><input list="fuel-vehicle-options" value={manual.vehicle_number} onChange={(event) => { const value=event.target.value; setManual({ ...manual, vehicle_number:value }); if (vehicleOptions.includes(value)) applyVehicleProfile(value); }} onBlur={() => { if (vehicleOptions.includes(manual.vehicle_number)) applyVehicleProfile(manual.vehicle_number); }} placeholder="번호 입력 또는 선택" /><datalist id="fuel-vehicle-options">{vehicleOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label><span>수량(L) *</span><input inputMode="decimal" value={manual.quantity} onChange={(event) => setManual({ ...manual, quantity: event.target.value })} placeholder="270" /></label>
        <label><span>단가(원/L) *</span><input inputMode="decimal" value={manual.unit_price} onChange={(event) => setManual({ ...manual, unit_price: event.target.value })} placeholder="1820" /></label>
        <label><span>주유처</span><input value={manual.station_name} onChange={(event) => setManual({ ...manual, station_name: event.target.value })} /></label>
        <label><span>메모</span><input value={manual.memo} onChange={(event) => setManual({ ...manual, memo: event.target.value })} placeholder="필요 시 입력" /></label>
      </div>
      {vehicleOptions.length > 0 && <div className="fuel-quick-vehicles"><span>차량·장비 빠른 선택</span><div>{vehicleOptions.filter((name) => !manual.vehicle_number.trim() || name.toLowerCase().includes(manual.vehicle_number.trim().toLowerCase())).slice(0,18).map((name)=><button type="button" key={name} onClick={() => applyVehicleProfile(name)}>{name}</button>)}</div><small>기존 명세서 기준으로 번호를 누르면 최근 현장·유종·단가·주유처를 자동 입력합니다.</small></div>}
      <div className="fuel-manual-total"><span>예상 합계</span><strong>{manual.quantity && manual.unit_price ? `${money(Math.round(asNumber(manual.quantity) * asNumber(manual.unit_price) * 1.1))}원` : "-"}</strong></div>
      <div className="fuel-form-actions"><button type="button" onClick={() => { setManual(emptyManual()); setManualOpen(false); }}>취소</button><button type="button" className="fuel-primary" disabled={saving} onClick={() => void saveManual()}>{saving ? "저장 중..." : "저장"}</button></div>
    </section>}

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
      <button type="button" aria-pressed={view === "records"} onClick={() => setView("records")}>주유내역</button>
      <button type="button" aria-pressed={view === "vehicle"} onClick={() => setView("vehicle")}>차량·장비별</button>
      <button type="button" aria-pressed={view === "site"} onClick={() => setView("site")}>현장별</button>
    </nav>

    {loading ? <div className="fuel-empty">유류내역을 불러오는 중...</div> : view === "records" ? <>
      <div className="fuel-table-wrap">
        <table className="fuel-table"><thead><tr><th>일자</th><th>현장</th><th>유종</th><th>차량/장비번호</th><th>횟수</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계금액</th><th>주유처</th><th></th></tr></thead><tbody>
          {!filtered.length ? <tr><td colSpan={12} className="fuel-empty-cell">조건에 맞는 유류내역이 없습니다.</td></tr> : filtered.map((record) => <tr key={record.id}>
            <td>{record.fuel_date}</td><td>{record.site_name}</td><td>{record.product_name}</td><td className="fuel-strong">{record.vehicle_number}</td><td>{record.usage_count}회</td><td className="fuel-number">{number(record.quantity)} L</td><td className="fuel-number">{money(record.unit_price)}</td><td className="fuel-number">{money(record.supply_amount)}</td><td className="fuel-number">{money(record.vat_amount)}</td><td className="fuel-number fuel-total">{money(record.total_amount)}</td><td>{record.station_name}</td><td><button className="fuel-icon-button" type="button" title="삭제" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button></td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="fuel-mobile-list">{!filtered.length ? <div className="fuel-empty">조건에 맞는 유류내역이 없습니다.</div> : filtered.map((record) => <article key={record.id}>
        <header><div><strong>{record.vehicle_number}</strong><span>{record.site_name} · {record.product_name}</span></div><b>{record.fuel_date}</b></header>
        <div><span>수량 <strong>{number(record.quantity)} L</strong></span><span>단가 <strong>{money(record.unit_price)}원</strong></span><span>횟수 <strong>{record.usage_count}회</strong></span><span>합계 <strong>{money(record.total_amount)}원</strong></span></div>
        <footer><span>{record.station_name}</span><button type="button" onClick={() => void removeRecord(record)}><Trash2 size={14} /> 삭제</button></footer>
      </article>)}</div>
    </> : <div className="fuel-summary-list">
      {(view === "vehicle" ? vehicleSummary : siteSummary).length ? (view === "vehicle" ? vehicleSummary : siteSummary).map((row, index) => <article key={row.name}>
        <span className="fuel-rank">{index + 1}</span><div><strong>{row.name}</strong><small>{number(row.quantity)} L · {row.count}회</small></div><b>{money(row.total)}원</b>
      </article>) : <div className="fuel-empty">집계할 내역이 없습니다.</div>}
    </div>}
  </section>;
}
