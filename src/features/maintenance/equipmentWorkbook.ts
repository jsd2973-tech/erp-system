import * as XLSX from "xlsx-js-style";
import { equipmentWorkDescription, equipmentWorkLabel, validEquipmentDate } from "./equipmentModel";
import type { EquipmentOverviewRow, EquipmentSettings, EquipmentWork } from "./equipmentTypes";

const excelDate = (value: string | null): number | string => value && validEquipmentDate(value)
  ? (Date.parse(value + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000 : value || "";
const workDate = (work: EquipmentWork | undefined) => work?.calendar_date ? excelDate(work.calendar_date) : work?.date || "";
const merge = (r: number, c: number, endRow: number, endColumn = c): XLSX.Range => ({ s: { r, c }, e: { r: endRow, c: endColumn } });

function applyStyles(sheet: XLSX.WorkSheet, headerRows: number, dateColumns: number[] = []) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const edge = { style: "thin", color: { rgb: "C5CDD7" } };
  for (let r = 0; r <= range.e.r; r++) for (let c = 0; c <= range.e.c; c++) {
    const address = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[address] || { t: "s", v: "" };
    sheet[address] = cell;
    cell.s = {
      font: { name: "맑은 고딕", sz: r === 0 && headerRows > 1 ? 16 : 11, bold: r < headerRows },
      fill: { patternType: "solid", fgColor: { rgb: r < headerRows ? "E7EDF5" : "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: edge, bottom: edge, left: edge, right: edge },
    };
    if (r >= headerRows && dateColumns.includes(c) && cell.t === "n") cell.z = "yyyy-mm-dd";
  }
  sheet["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
}

export const buildEquipmentWorkbook = (rows: EquipmentOverviewRow[], settings: EquipmentSettings, todayKey: string): XLSX.WorkBook => {
  const values: (string | number | null)[][] = [
    [settings.title], [settings.common_note], ["출력일", excelDate(todayKey)], [],
    ["구분", null, null, null, null, null, "작업현황", null, null, null, null, "예상 교체일자", "비고", "평균사용기간"],
    ["대분류", "소분류 명칭", null, null, null, null, "최신", "1차", "2차", "3차", "4차"],
    [null, "명칭", "규격", "길이-폭-두께", "베어링", "롤러(리턴/캐리어)", "업체", "업체", "업체", "업체", "업체"],
  ];
  const merges = [merge(0, 0, 0, 13), merge(1, 0, 1, 13), merge(4, 0, 4, 5), merge(4, 6, 4, 10), merge(5, 0, 6), merge(5, 1, 5, 5), ...[11, 12, 13].map(c => merge(4, c, 6))];
  let groupStart = 7;
  rows.forEach((row, index) => {
    const r = 7 + index * 2;
    const { item, history } = row;
    values.push([
      item.category, item.name, item.spec, item.dimensions, item.bearing, item.rollers,
      ...Array.from({ length: 5 }, (_, n) => workDate(history[n])),
      excelDate(row.expected_date), item.notes, row.average_days,
    ]);
    values.push([null, null, null, null, null, null, ...Array.from({ length: 5 }, (_, n) => history[n] ? equipmentWorkDescription(history[n]) : "")]);
    for (const c of [1, 2, 3, 4, 5, 11, 13]) merges.push(merge(r, c, r + 1));
    const previous = rows[index - 1]?.item;
    const continuingNote = !!item.shared_note_key && previous?.shared_note_key === item.shared_note_key && previous.notes === item.notes;
    if (!continuingNote) {
      let end = index;
      if (item.shared_note_key) while (end + 1 < rows.length && rows[end + 1].item.shared_note_key === item.shared_note_key && rows[end + 1].item.notes === item.notes) end++;
      merges.push(merge(r, 12, 7 + end * 2 + 1));
    }
    if (index === rows.length - 1 || rows[index + 1].item.category !== item.category) {
      merges.push(merge(groupStart, 0, r + 1));
      groupStart = r + 2;
    }
  });
  const summary = XLSX.utils.aoa_to_sheet(values);
  summary["!merges"] = merges;
  summary["!cols"] = [8, 18, 39, 21, 18, 21, 31, 27, 25, 25, 25, 17, 26, 16].map(wch => ({ wch }));
  summary["!rows"] = values.map((_, r) => ({ hpt: r === 0 ? 32 : r === 1 ? 25 : r >= 7 ? r % 2 ? 23 : 32 : 22 }));
  applyStyles(summary, 7, [6, 7, 8, 9, 10, 11]);
  if (summary.B3?.t === "n") summary.B3.z = "yyyy-mm-dd";
  rows.forEach((_, index) => {
    const address = XLSX.utils.encode_cell({ r: 7 + index * 2, c: 13 });
    if (summary[address]?.t === "n") summary[address].z = '0.0"일"';
  });

  const allValues: (string | number)[][] = [["대분류", "관리 항목", "작업일", "업체·작업표시", "작업 구분", "정비제목", "작업내용", "금액(원)", "교체주기 반영", "기록 구분"]];
  rows.forEach(row => row.history.forEach(work => allValues.push([
    row.item.category, row.item.name, workDate(work), work.vendor,
    equipmentWorkLabel(work.work_type), work.title, work.detail, work.cost ?? "",
    work.cycle_included ? "반영" : "", work.origin === "import" ? "기존 총괄표" : "ERP 정비",
  ])));
  const history = XLSX.utils.aoa_to_sheet(allValues);
  history["!cols"] = [12, 22, 28, 35, 13, 35, 60, 18, 16, 18].map(wch => ({ wch }));
  history["!rows"] = allValues.map(() => ({ hpt: 32 }));
  history["!autofilter"] = { ref: history["!ref"] || "A1:J1" };
  applyStyles(history, 1, [2]);
  for (let r = 1; r < allValues.length; r++) {
    const cell = history[XLSX.utils.encode_cell({ r, c: 7 })];
    if (cell?.t === "n") {
      cell.z = "#,##0.##";
      cell.s.alignment.horizontal = "right";
    }
  }
  const book = XLSX.utils.book_new();
  book.Props = { Title: settings.title, Subject: "설비현황 및 전체 정비이력" };
  XLSX.utils.book_append_sheet(book, summary, "크라샤");
  XLSX.utils.book_append_sheet(book, history, "전체 작업이력");
  return book;
};

export const downloadEquipmentWorkbook = (rows: EquipmentOverviewRow[], settings: EquipmentSettings, todayKey: string) => {
  XLSX.writeFile(buildEquipmentWorkbook(rows, settings, todayKey), `크라샤_설비현황_${todayKey}.xlsx`);
};
