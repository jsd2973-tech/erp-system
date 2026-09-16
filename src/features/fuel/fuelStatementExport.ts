import * as XLSX from "xlsx-js-style";

export type FuelStatementRecord = {
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
  memo?: string | null;
};

export type FuelStatementParty = {
  code?: string | null;
  name?: string | null;
  owner?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  address_detail?: string | null;
};

export type FuelStatementExportOptions = {
  month: string;
  issueDate: string;
  filterSummary?: string;
  parties?: FuelStatementParty[];
};

type StatementTotals = {
  count: number;
  quantity: number;
  supply: number;
  vat: number;
  total: number;
};

type StationGroup = {
  name: string;
  rows: FuelStatementRecord[];
  totals: StatementTotals;
  party: FuelStatementParty;
};

type DetailGroup = {
  site: string;
  product: string;
  rows: FuelStatementRecord[];
  totals: StatementTotals;
};

type StyledWorksheet = XLSX.WorkSheet & {
  "!merges"?: XLSX.Range[];
  "!cols"?: Array<{ wch: number }>;
  "!rows"?: Array<{ hpt: number }>;
};

const COLUMN_COUNT = 12;
const thinBorder = { style: "thin", color: { rgb: "D6E0EA" } } as const;
const mediumBorder = { style: "medium", color: { rgb: "8EA9C1" } } as const;
const palette = {
  navy: "12324A",
  blue: "1F4E78",
  lightBlue: "EAF3FB",
  paleBlue: "F4F8FC",
  total: "DDEBF7",
  text: "263746",
  muted: "52677A",
  white: "FFFFFF",
};

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const natural = (a: string, b: string) => a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" });
const compact = (value: unknown) => text(value).toLocaleLowerCase("ko-KR").replace(/[\s().\-_/]/g, "");
const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const countOf = (record: FuelStatementRecord) => Math.max(Math.round(finite(record.usage_count)) || 1, 1);
const dateText = (value: string) => text(value).replace(/-/g, ".");

const emptyTotals = (): StatementTotals => ({ count: 0, quantity: 0, supply: 0, vat: 0, total: 0 });

const addToTotals = (totals: StatementTotals, record: FuelStatementRecord) => {
  totals.count += countOf(record);
  totals.quantity += finite(record.quantity);
  totals.supply += finite(record.supply_amount);
  totals.vat += finite(record.vat_amount);
  totals.total += finite(record.total_amount);
};

const sumTotals = (rows: FuelStatementRecord[]) => {
  const totals = emptyTotals();
  rows.forEach((record) => addToTotals(totals, record));
  return totals;
};

const averageLineAmount = (totals: StatementTotals) => totals.count ? totals.supply / totals.count : 0;
const averageUnitPrice = (totals: StatementTotals) => totals.quantity ? totals.supply / totals.quantity : 0;

const partyAddress = (party: FuelStatementParty) => [party.address, party.address_detail].map(text).filter(Boolean).join(" ") || "-";
const partyPhone = (party: FuelStatementParty) => [text(party.phone), text(party.mobile)].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" · ") || "-";
const partyField = (value: unknown) => text(value) || "-";
const partyCompleteness = (party: FuelStatementParty) => [party.code, party.owner, party.phone, party.mobile, party.address, party.address_detail].filter((value) => Boolean(text(value))).length;

const resolveParty = (name: string, parties: FuelStatementParty[], displayName: string): FuelStatementParty => {
  const target = compact(name);
  const match = parties
    .map((party) => ({ party, candidate: compact(party.name) }))
    .filter(({ candidate }) => Boolean(candidate) && (candidate === target || candidate.includes(target) || target.includes(candidate)))
    .sort((left, right) => {
      const exactMatch = Number(right.candidate === target) - Number(left.candidate === target);
      if (exactMatch !== 0) return exactMatch;
      const nameLength = right.candidate.length - left.candidate.length;
      if (nameLength !== 0) return nameLength;
      return partyCompleteness(right.party) - partyCompleteness(left.party);
    })[0]?.party;
  return {
    ...(match || {}),
    name: displayName,
  };
};

const monthBounds = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(endDay).padStart(2, "0")}` };
};

const periodText = (month: string) => {
  const bounds = monthBounds(month);
  return `${dateText(bounds.from)} ~ ${dateText(bounds.to)}`;
};

const ensureCell = (ws: StyledWorksheet, row: number, col: number) => {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[address]) ws[address] = { t: "s", v: "" };
  return ws[address];
};

const setStyle = (ws: StyledWorksheet, row: number, col: number, style: Record<string, unknown>) => {
  ensureCell(ws, row, col).s = style;
};

const mergeCells = (ws: StyledWorksheet, startRow: number, startCol: number, endRow: number, endCol: number) => {
  ws["!merges"] = [...(ws["!merges"] || []), { s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } }];
};

const titleStyle = {
  font: { name: "맑은 고딕", sz: 18, bold: true, color: { rgb: palette.white } },
  fill: { patternType: "solid", fgColor: { rgb: palette.navy } },
  alignment: { horizontal: "center", vertical: "center" },
};

const tableHeaderStyle = {
  font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: palette.white } },
  fill: { patternType: "solid", fgColor: { rgb: palette.blue } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
};

const bodyStyle = (row: number, numeric: boolean) => ({
  font: { name: "맑은 고딕", sz: 10, color: { rgb: palette.text } },
  fill: { patternType: "solid", fgColor: { rgb: row % 2 === 0 ? palette.paleBlue : palette.white } },
  alignment: { horizontal: numeric ? "right" : "left", vertical: "center", wrapText: true },
  border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
});

const totalStyle = (numeric: boolean) => ({
  font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: palette.navy } },
  fill: { patternType: "solid", fgColor: { rgb: palette.total } },
  alignment: { horizontal: numeric ? "right" : "left", vertical: "center", wrapText: true },
  border: { top: mediumBorder, bottom: mediumBorder, left: thinBorder, right: thinBorder },
});

const infoLabelStyle = {
  font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: palette.muted } },
  fill: { patternType: "solid", fgColor: { rgb: palette.paleBlue } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
};

const infoValueStyle = {
  font: { name: "맑은 고딕", sz: 10, color: { rgb: palette.text } },
  fill: { patternType: "solid", fgColor: { rgb: palette.white } },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
};

const styleTable = (ws: StyledWorksheet, headerRow: number, lastRow: number, lastCol: number, numericColumns: Set<number>, totalRows: Set<number> = new Set()) => {
  for (let row = headerRow; row <= lastRow; row += 1) {
    for (let col = 0; col <= lastCol; col += 1) {
      const style = row === headerRow
        ? tableHeaderStyle
        : totalRows.has(row)
          ? totalStyle(numericColumns.has(col))
          : bodyStyle(row, numericColumns.has(col));
      setStyle(ws, row, col, style);
    }
  }
  ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}` };
  ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, row) => ({ hpt: row === headerRow ? 28 : 21 }));
};

const styleTitle = (ws: StyledWorksheet, lastCol: number) => {
  for (let col = 0; col <= lastCol; col += 1) setStyle(ws, 0, col, titleStyle);
  ws["!rows"] = [{ hpt: 34 }];
};

const normalizeRecords = (records: FuelStatementRecord[]) => records.map((record) => ({
  ...record,
  fuel_date: text(record.fuel_date),
  site_name: text(record.site_name) || "미지정",
  product_name: text(record.product_name) || "미지정",
  vehicle_number: text(record.vehicle_number) || "미지정",
  station_name: text(record.station_name) || "미지정 주유소",
  memo: text(record.memo),
}));

const groupDetails = (rows: FuelStatementRecord[]) => {
  const groups = new Map<string, DetailGroup>();
  rows.forEach((record) => {
    const site = text(record.site_name) || "미지정";
    const product = text(record.product_name) || "미지정";
    const key = `${site}\u0000${product}`;
    const group = groups.get(key) || { site, product, rows: [], totals: emptyTotals() };
    group.rows.push(record);
    addToTotals(group.totals, record);
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => natural(a.site, b.site) || natural(a.product, b.product));
};

const sortDetailRows = (rows: FuelStatementRecord[]) => [...rows].sort((a, b) =>
  a.fuel_date.localeCompare(b.fuel_date)
  || natural(a.vehicle_number, b.vehicle_number)
  || natural(a.product_name, b.product_name)
  || a.id.localeCompare(b.id));

const detailDataRow = (record: FuelStatementRecord, showGroup: boolean) => {
  const count = countOf(record);
  const quantity = finite(record.quantity);
  const supply = finite(record.supply_amount);
  return [
    showGroup ? text(record.site_name) || "미지정" : "",
    showGroup ? text(record.product_name) || "미지정" : "",
    text(record.vehicle_number) || "미지정",
    dateText(record.fuel_date),
    count,
    quantity,
    finite(record.line_amount) || (count ? supply / count : 0),
    finite(record.unit_price) || (quantity ? supply / quantity : 0),
    supply,
    finite(record.vat_amount),
    finite(record.total_amount),
    text(record.memo),
  ];
};

const subtotalRow = (group: DetailGroup) => [
  `${group.site} · ${group.product} 소계`,
  "",
  "",
  "",
  group.totals.count,
  group.totals.quantity,
  averageLineAmount(group.totals),
  averageUnitPrice(group.totals),
  group.totals.supply,
  group.totals.vat,
  group.totals.total,
  "",
];

const statementHeader = [
  "현장명",
  "제품명/규격",
  "차량/장비번호",
  "일자",
  "횟수 (회)",
  "수량 (L)",
  "단가 (원/회)",
  "단가 (원/L)",
  "공급가액 (원)",
  "부가세 (원)",
  "합계금액 (원)",
  "비고",
];

const stationSheet = (station: StationGroup, buyer: FuelStatementParty, options: FuelStatementExportOptions) => {
  const supplier = station.party;
  const rows: unknown[][] = [
    ["거래명세서 (매입)", ...Array(COLUMN_COUNT - 1).fill("")],
    Array(COLUMN_COUNT).fill(""),
    ["발급일자", dateText(options.issueDate), ...Array(COLUMN_COUNT - 2).fill("")],
    ["거래기간", periodText(options.month), ...Array(COLUMN_COUNT - 2).fill("")],
    ["적용필터", text(options.filterSummary) || "전체 유류내역", ...Array(COLUMN_COUNT - 2).fill("")],
    ["공급자", "", "", "", "", "", "공급받는자", "", "", "", "", ""],
    ["상호", partyField(supplier.name), "", "", "", "", "상호", partyField(buyer.name), "", "", "", ""],
    ["대표자", partyField(supplier.owner), "", "", "", "", "대표자", partyField(buyer.owner), "", "", "", ""],
    ["등록번호/코드", partyField(supplier.code), "", "", "", "", "등록번호/코드", partyField(buyer.code), "", "", "", ""],
    ["주소", partyAddress(supplier), "", "", "", "", "주소", partyAddress(buyer), "", "", "", ""],
    ["연락처", partyPhone(supplier), "", "", "", "", "연락처", partyPhone(buyer), "", "", "", ""],
    Array(COLUMN_COUNT).fill(""),
    ["총 합계", station.totals.total, "원", "총 수량", station.totals.quantity, "L", "주유횟수", station.totals.count, "회", "공급가액", station.totals.supply, "원"],
    Array(COLUMN_COUNT).fill(""),
    statementHeader,
  ];

  const detailGroups = groupDetails(station.rows);
  detailGroups.forEach((group) => {
    sortDetailRows(group.rows).forEach((record, index) => rows.push(detailDataRow(record, index === 0)));
    rows.push(subtotalRow(group));
  });
  const grandTotalRow = rows.length;
  rows.push([
    "합계",
    "",
    "",
    "",
    station.totals.count,
    station.totals.quantity,
    averageLineAmount(station.totals),
    averageUnitPrice(station.totals),
    station.totals.supply,
    station.totals.vat,
    station.totals.total,
    "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows) as StyledWorksheet;
  ws["!cols"] = [18, 17, 18, 13, 10, 12, 15, 15, 16, 14, 16, 24].map((wch) => ({ wch }));
  styleTitle(ws, COLUMN_COUNT - 1);
  mergeCells(ws, 0, 0, 0, COLUMN_COUNT - 1);
  mergeCells(ws, 2, 1, 2, COLUMN_COUNT - 1);
  mergeCells(ws, 3, 1, 3, COLUMN_COUNT - 1);
  mergeCells(ws, 4, 1, 4, COLUMN_COUNT - 1);
  mergeCells(ws, 5, 0, 5, 4);
  mergeCells(ws, 5, 6, 5, COLUMN_COUNT - 1);
  [6, 7, 8, 9, 10].forEach((row) => {
    mergeCells(ws, row, 1, row, 4);
    mergeCells(ws, row, 7, row, COLUMN_COUNT - 1);
  });

  [2, 3, 4].forEach((row) => {
    setStyle(ws, row, 0, infoLabelStyle);
    for (let col = 1; col < COLUMN_COUNT; col += 1) setStyle(ws, row, col, infoValueStyle);
  });
  for (let row = 5; row <= 10; row += 1) {
    setStyle(ws, row, 0, row === 5 ? tableHeaderStyle : infoLabelStyle);
    setStyle(ws, row, 6, row === 5 ? tableHeaderStyle : infoLabelStyle);
    for (let col = 1; col <= 4; col += 1) setStyle(ws, row, col, row === 5 ? tableHeaderStyle : infoValueStyle);
    for (let col = 7; col < COLUMN_COUNT; col += 1) setStyle(ws, row, col, row === 5 ? tableHeaderStyle : infoValueStyle);
  }
  for (let col = 0; col < COLUMN_COUNT; col += 1) setStyle(ws, 12, col, totalStyle([1, 4, 7, 10].includes(col)));
  const headerRow = 14;
  const totalRows = new Set<number>([grandTotalRow]);
  detailGroups.forEach((group) => {
    const subtotalIndex = rows.findIndex((row, index) => index > headerRow && row[0] === `${group.site} · ${group.product} 소계`);
    if (subtotalIndex >= 0) totalRows.add(subtotalIndex);
  });
  styleTable(ws, headerRow, rows.length - 1, COLUMN_COUNT - 1, new Set([4, 5, 6, 7, 8, 9, 10]), totalRows);
  [5, 6, 7, 8, 9, 10].forEach((col) => {
    for (let row = headerRow + 1; row < rows.length; row += 1) {
      const cell = ensureCell(ws, row, col);
      cell.z = col === 5 ? "#,##0.###" : "#,##0";
    }
  });
  [1, 4, 10].forEach((col) => {
    const cell = ensureCell(ws, 12, col);
    cell.z = col === 4 ? "#,##0.###" : "#,##0";
  });
  (ws["!rows"] ||= [])[0] = { hpt: 34 };
  return ws;
};

const summarySheet = (stations: StationGroup[], totals: StatementTotals, buyer: FuelStatementParty, options: FuelStatementExportOptions) => {
  const rows: unknown[][] = [
    ["유류 거래명세서 요약", ...Array(COLUMN_COUNT - 1).fill("")],
    ["발급일자", dateText(options.issueDate), "", "거래기간", periodText(options.month), "", "공급받는자", partyField(buyer.name), ...Array(COLUMN_COUNT - 8).fill("")],
    ["적용필터", text(options.filterSummary) || "전체 유류내역", ...Array(COLUMN_COUNT - 2).fill("")],
    ["전체 합계", "", "", "", "", "", "", "", "", "", "", ""],
    ["총 합계", totals.total, "원", "총 주유횟수", totals.count, "회", "총 수량", totals.quantity, "L", "주유처", stations.length, "곳"],
    ["공급가액", totals.supply, "원", "부가세", totals.vat, "원", "평균 단가", averageUnitPrice(totals), "원/L", "적용 시트", stations.length, "개"],
    Array(COLUMN_COUNT).fill(""),
    ["주유처별 업체·금액 상세", ...Array(COLUMN_COUNT - 1).fill("")],
    ["주유처", "등록번호/코드", "대표자", "연락처", "주소", "주유 건수", "주유 횟수", "수량 (L)", "공급가액 (원)", "부가세 (원)", "합계금액 (원)", "상세 시트"],
  ];
  stations.forEach((station) => rows.push([
    station.name,
    partyField(station.party.code),
    partyField(station.party.owner),
    partyPhone(station.party),
    partyAddress(station.party),
    station.rows.length,
    station.totals.count,
    station.totals.quantity,
    station.totals.supply,
    station.totals.vat,
    station.totals.total,
    station.name,
  ]));
  const totalRow = rows.length;
  rows.push(["합계", "", "", "", "", stations.reduce((sum, station) => sum + station.rows.length, 0), totals.count, totals.quantity, totals.supply, totals.vat, totals.total, ""]);
  rows.push(Array(COLUMN_COUNT).fill(""));
  rows.push(["※ 업체 정보는 현재 거래처등록에 저장된 값 기준이며, 등록되지 않은 항목은 '-'로 표시됩니다.", ...Array(COLUMN_COUNT - 1).fill("")]);

  const ws = XLSX.utils.aoa_to_sheet(rows) as StyledWorksheet;
  ws["!cols"] = [21, 18, 13, 17, 35, 12, 12, 14, 17, 14, 17, 21].map((wch) => ({ wch }));
  styleTitle(ws, COLUMN_COUNT - 1);
  mergeCells(ws, 0, 0, 0, COLUMN_COUNT - 1);
  mergeCells(ws, 1, 7, 1, COLUMN_COUNT - 1);
  mergeCells(ws, 2, 1, 2, COLUMN_COUNT - 1);
  mergeCells(ws, 3, 0, 3, COLUMN_COUNT - 1);
  mergeCells(ws, 7, 0, 7, COLUMN_COUNT - 1);
  mergeCells(ws, rows.length - 1, 0, rows.length - 1, COLUMN_COUNT - 1);
  [1, 2].forEach((row) => {
    setStyle(ws, row, 0, infoLabelStyle);
    for (let col = 1; col < COLUMN_COUNT; col += 1) setStyle(ws, row, col, infoValueStyle);
  });
  for (let col = 0; col < COLUMN_COUNT; col += 1) setStyle(ws, 3, col, { ...tableHeaderStyle, alignment: { horizontal: "left", vertical: "center" } });
  for (let col = 0; col < COLUMN_COUNT; col += 1) {
    setStyle(ws, 4, col, totalStyle([1, 4, 7, 10].includes(col)));
    setStyle(ws, 5, col, bodyStyle(5, [1, 4, 7].includes(col)));
  }
  for (let col = 0; col < COLUMN_COUNT; col += 1) setStyle(ws, 7, col, { ...tableHeaderStyle, alignment: { horizontal: "left", vertical: "center" } });
  styleTable(ws, 8, totalRow, COLUMN_COUNT - 1, new Set([5, 6, 7, 8, 9, 10]), new Set([totalRow]));
  [7, 8, 9, 10].forEach((col) => {
    for (let row = 9; row <= totalRow; row += 1) ensureCell(ws, row, col).z = col === 7 ? "#,##0.###" : "#,##0";
  });
  for (let col = 0; col < COLUMN_COUNT; col += 1) setStyle(ws, rows.length - 1, col, { ...infoValueStyle, font: { name: "맑은 고딕", sz: 9, color: { rgb: palette.muted } } });
  (ws["!rows"] ||= [])[0] = { hpt: 34 };
  return ws;
};

const safeSheetName = (name: string, used: Set<string>, index: number) => {
  const invalidSheetCharacters = new Set(["\\", "/", "?", "*", "[", "]", ":"]);
  const base = (text(name).split("").map((character) => invalidSheetCharacters.has(character) ? " " : character).join("").trim() || `주유처${index + 1}`).slice(0, 31);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const suffixText = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

export function buildFuelStatementWorkbook(records: FuelStatementRecord[], options: FuelStatementExportOptions) {
  const normalized = normalizeRecords(records);
  const parties = options.parties || [];
  const buyer = resolveParty("태명산업개발", parties, "(주)태명산업개발");
  const stationMap = new Map<string, FuelStatementRecord[]>();
  normalized.forEach((record) => stationMap.set(record.station_name, [...(stationMap.get(record.station_name) || []), record]));
  const stations: StationGroup[] = [...stationMap.entries()]
    .sort(([a], [b]) => natural(a, b))
    .map(([name, rows]) => ({
      name,
      rows,
      totals: sumTotals(rows),
      party: resolveParty(name, parties, name),
    }));
  const totals = sumTotals(normalized);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet(stations, totals, buyer, options), "요약");
  const usedSheetNames = new Set(["요약"]);
  stations.forEach((station, index) => {
    XLSX.utils.book_append_sheet(workbook, stationSheet(station, buyer, options), safeSheetName(station.name, usedSheetNames, index));
  });
  return workbook;
}
