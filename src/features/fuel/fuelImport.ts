import * as XLSX from "xlsx-js-style";
import type { ParsedFuelRow } from "./fuelTypes";
import {
  asFuelNumber,
  fingerprintFuelSource,
  normalizeFuelHeader,
  normalizeFuelText,
  resolveFuelImportSite,
} from "./fuelModel";

const text = normalizeFuelText;

const parseFuelImportDate = (value: unknown, fallbackYear: number, fallbackMonth: number) => {
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

export async function parseFuelFile(file: File, fallbackMonth: string): Promise<ParsedFuelRow[]> {
  const { rows, sourceText } = await readFuelGrid(file);
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeFuelHeader);
    return normalized.includes("차량번호") && normalized.includes("일자") && normalized.some((header) => header.includes("제품명"));
  });
  if (headerIndex < 0) throw new Error("제품명·차량번호·일자 헤더를 찾지 못했습니다.");

  const headers = rows[headerIndex].map(normalizeFuelHeader);
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
    const sourceSite = text(valueAt(columns.site)) || lastSite;
    const product = text(valueAt(columns.product)) || lastProduct;
    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;
    if (text(valueAt(columns.site))) lastSite = sourceSite;
    if (text(valueAt(columns.product))) lastProduct = product;
    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;

    const fuelDate = parseFuelImportDate(valueAt(columns.date), year, month);
    if (!fuelDate || !vehicle) return;

    const quantity = asFuelNumber(valueAt(columns.quantity));
    const unitPrice = asFuelNumber(valueAt(columns.unitPrice));
    const supply = asFuelNumber(valueAt(columns.supply));
    const vat = asFuelNumber(valueAt(columns.vat));
    const total = asFuelNumber(valueAt(columns.total));
    if (!quantity && !total) return;

    const usageCount = Math.max(Math.round(asFuelNumber(valueAt(columns.count))) || 1, 1);
    const lineAmount = asFuelNumber(valueAt(columns.lineAmount)) || supply;
    const resolvedSite = resolveFuelImportSite(sourceSite, hasSiteColumn, vehicle);
    const rawFingerprint = [stationName, fuelDate, resolvedSite.fingerprintSite, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");
    parsed.push({
      fuel_date: fuelDate,
      site_name: resolvedSite.siteName,
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
      source_fingerprint: fingerprintFuelSource(rawFingerprint),
      memo: resolvedSite.memo,
    });
  });

  if (!parsed.length) throw new Error("가져올 주유내역이 없습니다.");
  return parsed;
}
