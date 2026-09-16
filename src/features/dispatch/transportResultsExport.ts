import * as XLSX from "xlsx-js-style";
import { groupResults, groupResultsByDay, type ResultRow, type TransportResultSummary } from "./transportResults";

type StyledWorksheet = XLSX.WorkSheet & {
  "!merges"?: XLSX.Range[];
  "!cols"?: Array<{ wch: number }>;
  "!rows"?: Array<{ hpt: number }>;
  "!freeze"?: { xSplit?: number; ySplit?: number };
};

export type TransportResultsExportOptions = {
  from: string;
  to: string;
  preset: "today" | "week" | "month" | "custom";
  activeBy: "vendor" | "item";
  vehicleNames: Map<string, string>;
  driverNames: Map<string, string>;
};

const palette = {
  navy: "12324A",
  blue: "1F4E78",
  lightBlue: "EAF3FB",
  paleBlue: "F5F8FC",
  total: "DDEBF7",
  text: "263746",
  muted: "52677A",
  white: "FFFFFF",
};

const thinBorder = { style: "thin", color: { rgb: "D6E0EA" } } as const;
const mediumBorder = { style: "medium", color: { rgb: "8EA9C1" } } as const;
const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeText = (stamp: string | null) => {
  if (!stamp) return "-";
  const date = new Date(stamp);
  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : "-";
};

const sortRows = (rows: ResultRow[]) => [...rows].sort((a, b) =>
  a.reportDay.localeCompare(b.reportDay)
  || Number(a.trip.trip_no || 0) - Number(b.trip.trip_no || 0)
  || (a.trip.unloading_completed_at || "").localeCompare(b.trip.unloading_completed_at || "")
  || a.trip.id.localeCompare(b.trip.id));

const ensureCell = (ws: StyledWorksheet, row: number, col: number) => {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[address]) ws[address] = { t: "s", v: "" };
  return ws[address];
};

const mergeCells = (ws: StyledWorksheet, startRow: number, startCol: number, endRow: number, endCol: number) => {
  ws["!merges"] = [...(ws["!merges"] || []), { s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } }];
};

const titleStyle = {
  font: { name: "맑은 고딕", sz: 16, bold: true, color: { rgb: palette.white } },
  fill: { patternType: "solid", fgColor: { rgb: palette.navy } },
  alignment: { horizontal: "center", vertical: "center" },
};

const headerStyle = {
  font: { name: "맑은 고딕", sz: 10, bold: true, color: { rgb: palette.white } },
  fill: { patternType: "solid", fgColor: { rgb: palette.blue } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
};

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

const styleTable = (ws: StyledWorksheet, headerRow: number, lastRow: number, lastCol: number, numericColumns: Set<number>, percentColumns: Set<number>, totalRow?: number) => {
  for (let row = headerRow; row <= lastRow; row += 1) {
    for (let col = 0; col <= lastCol; col += 1) {
      const cell = ensureCell(ws, row, col);
      const isHeader = row === headerRow;
      const isTotal = totalRow === row;
      cell.s = isHeader ? headerStyle : isTotal ? totalStyle(numericColumns.has(col)) : bodyStyle(row, numericColumns.has(col));
      if (!isHeader && numericColumns.has(col) && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = percentColumns.has(col) ? "0.0%" : "#,##0.###";
      }
    }
  }
  ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}` };
  ws["!freeze"] = { xSplit: 0, ySplit: headerRow + 1 };
  ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, row) => ({ hpt: row === headerRow ? 27 : 21 }));
};

const applyTitleAndInfo = (ws: StyledWorksheet, lastCol: number) => {
  for (let col = 0; col <= lastCol; col += 1) ensureCell(ws, 0, col).s = titleStyle;
  mergeCells(ws, 0, 0, 0, lastCol);
  for (const row of [1]) {
    ensureCell(ws, row, 0).s = infoLabelStyle;
    for (let col = 1; col <= lastCol; col += 1) ensureCell(ws, row, col).s = infoValueStyle;
    mergeCells(ws, row, 1, row, lastCol);
  }
  (ws["!rows"] ||= [])[0] = { hpt: 32 };
};

const infoRows = (from: string, to: string, lastCol: number) => [
  ["조회 기간", `${from} ~ ${to}`, ...Array(lastCol - 1).fill("")],
];

const tableSheet = (title: string, from: string, to: string, headers: string[], body: unknown[][], widths: number[], numericColumns: Set<number>, percentColumns = new Set<number>(), totalRow?: number) => {
  const lastCol = headers.length - 1;
  const rows: unknown[][] = [
    [title, ...Array(lastCol).fill("")],
    ...infoRows(from, to, lastCol),
    Array(headers.length).fill(""),
    headers,
    ...body,
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows) as StyledWorksheet;
  ws["!cols"] = widths.map((wch) => ({ wch }));
  applyTitleAndInfo(ws, lastCol);
  const headerRow = 3;
  const bodyLastRow = rows.length - 1;
  const translatedTotalRow = totalRow == null ? undefined : headerRow + 1 + totalRow;
  styleTable(ws, headerRow, bodyLastRow, lastCol, numericColumns, percentColumns, translatedTotalRow);
  return ws;
};

const summarySheet = (report: TransportResultSummary, options: TransportResultsExportOptions) => {
  const groups = groupResults(report.rows, options.activeBy, report.volume);
  const activeLabel = options.activeBy === "vendor" ? "거래처별 요약" : "품목별 요약";
  const groupRows = groups.length
    ? groups.map((group) => [group.name, group.tripCount, group.volume, group.tripCount ? group.volume / group.tripCount : 0, report.volume > 0 ? group.volume / report.volume : 0])
    : [["선택 기간의 완료 운송실적 없음", "", "", "", ""]];
  const totalRowIndex = groups.length ? groups.length : undefined;
  const rows: unknown[][] = [
    ["운송실적 요약", "", "", "", ""],
    ["조회 기간", `${options.from} ~ ${options.to}`, "", "", ""],
    ["총 운송량", report.volume, "루베", "", ""],
    ["완료 운행", report.rows.length, "회", "", ""],
    ["거래처 수", report.vendors, "곳", "", ""],
    ["품목 수", report.items, "종", "", ""],
    ["평균 1회 운송량", report.averageVolume, "루베", "", ""],
    ["", "", "", "", ""],
    [activeLabel, "완료 회차", "총 운송량 (루베)", "평균 1회 (루베)", "전체 대비 비율"],
    ...groupRows,
    ...(groups.length ? [["합계", report.rows.length, report.volume, report.averageVolume, 1]] : []),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows) as StyledWorksheet;
  ws["!cols"] = [28, 14, 19, 19, 18].map((wch) => ({ wch }));
  for (let col = 0; col <= 4; col += 1) ensureCell(ws, 0, col).s = titleStyle;
  mergeCells(ws, 0, 0, 0, 4);
  for (const row of [1]) {
    ensureCell(ws, row, 0).s = infoLabelStyle;
    for (let col = 1; col <= 4; col += 1) ensureCell(ws, row, col).s = infoValueStyle;
    mergeCells(ws, row, 1, row, 4);
  }
  for (let row = 2; row <= 6; row += 1) {
    ensureCell(ws, row, 0).s = infoLabelStyle;
    ensureCell(ws, row, 1).s = totalStyle(true);
    ensureCell(ws, row, 2).s = infoValueStyle;
    for (let col = 3; col <= 4; col += 1) ensureCell(ws, row, col).s = infoValueStyle;
    const valueCell = ensureCell(ws, row, 1);
    if (typeof valueCell.v === "number") {
      valueCell.t = "n";
      valueCell.z = "#,##0.###";
    }
  }
  const headerRow = 8;
  const lastRow = rows.length - 1;
  styleTable(ws, headerRow, lastRow, 4, new Set([1, 2, 3, 4]), new Set([4]), totalRowIndex == null ? undefined : headerRow + 1 + totalRowIndex);
  (ws["!rows"] ||= [])[0] = { hpt: 32 };
  return ws;
};

const vendorSheet = (report: TransportResultSummary, options: TransportResultsExportOptions) => {
  const groups = groupResults(report.rows, "vendor", report.volume);
  const body = groups.map((group) => [group.name, group.tripCount, group.volume, group.tripCount ? group.volume / group.tripCount : 0, report.volume > 0 ? group.volume / report.volume : 0]);
  body.push(["합계", report.rows.length, report.volume, report.averageVolume, 1]);
  return tableSheet("거래처별 운송실적", options.from, options.to, ["거래처명", "완료 회차", "총 운송량 (루베)", "평균 1회 (루베)", "전체 대비 비율"], body, [28, 14, 19, 19, 18], new Set([1, 2, 3, 4]), new Set([4]), body.length - 1);
};

const itemSheet = (report: TransportResultSummary, options: TransportResultsExportOptions) => {
  const groups = groupResults(report.rows, "item", report.volume);
  const body = groups.map((group) => [group.name, group.tripCount, group.volume, group.tripCount ? group.volume / group.tripCount : 0, report.volume > 0 ? group.volume / report.volume : 0]);
  body.push(["합계", report.rows.length, report.volume, report.averageVolume, 1]);
  return tableSheet("품목별 운송실적", options.from, options.to, ["품목명", "완료 회차", "총 운송량 (루베)", "평균 1회 (루베)", "전체 대비 비율"], body, [28, 14, 19, 19, 18], new Set([1, 2, 3, 4]), new Set([4]), body.length - 1);
};

const daySheet = (report: TransportResultSummary, options: TransportResultsExportOptions) => {
  const days = groupResultsByDay(report.rows).sort((a, b) => a.day.localeCompare(b.day));
  const body = days.map((day) => [
    day.day,
    day.tripCount,
    day.volume,
    new Set(day.rows.filter((row) => row.vendorKey !== "unknown").map((row) => row.vendorKey)).size,
    new Set(day.rows.filter((row) => row.itemKey !== "unknown").map((row) => row.itemKey)).size,
  ]);
  body.push(["합계", report.rows.length, report.volume, report.vendors, report.items]);
  return tableSheet("일자별 운송실적", options.from, options.to, ["날짜", "완료 회차", "총 운송량 (루베)", "거래처 수", "품목 수"], body, [16, 14, 20, 14, 14], new Set([1, 2, 3, 4]), new Set(), body.length - 1);
};

const detailSheet = (report: TransportResultSummary, options: TransportResultsExportOptions) => {
  const rows = sortRows(report.rows);
  const body = rows.map((row) => [
    row.reportDay,
    row.vendor,
    row.item,
    options.vehicleNames.get(row.trip.vehicle_id) || "차량 확인 필요",
    options.driverNames.get(row.trip.driver_id) || "기사 확인 필요",
    Number(row.trip.trip_no || 0),
    numberValue(row.volume),
    dateTimeText(row.trip.created_at),
    dateTimeText(row.trip.loading_completed_at),
    dateTimeText(row.trip.unloading_completed_at),
  ]);
  body.push(["합계", "", "", "", "", report.rows.length, report.volume, "", "", ""]);
  return tableSheet("상세 운행내역", options.from, options.to, ["날짜", "거래처", "품목", "차량번호", "기사명", "회차", "실제 운송량 (루베)", "운행 시작", "상차완료", "하차완료"], body, [14, 24, 18, 17, 14, 10, 20, 21, 21, 21], new Set([5, 6]), new Set(), body.length - 1);
};

export function buildTransportResultsWorkbook(report: TransportResultSummary, options: TransportResultsExportOptions) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `운송실적_${options.from}_${options.to}`,
    Subject: "태명산업개발 운송실적 분석",
    Author: "태명산업개발",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(workbook, summarySheet(report, options), "요약");
  XLSX.utils.book_append_sheet(workbook, vendorSheet(report, options), "거래처별");
  XLSX.utils.book_append_sheet(workbook, itemSheet(report, options), "품목별");
  XLSX.utils.book_append_sheet(workbook, daySheet(report, options), "일자별");
  XLSX.utils.book_append_sheet(workbook, detailSheet(report, options), "상세 운행내역");
  return workbook;
}

export function downloadTransportResultsWorkbook(report: TransportResultSummary, options: TransportResultsExportOptions) {
  const workbook = buildTransportResultsWorkbook(report, options);
  XLSX.writeFile(workbook, `운송실적_${options.from}_${options.to}.xlsx`, { bookType: "xlsx", cellStyles: true });
}
