import * as XLSX from "xlsx-js-style";
import type { BulkTransferRow } from "./purchaseTypes";
import { cleanAccountNumber } from "./purchaseModel";

export const buildBulkTransferWorkbook = (
  rows: BulkTransferRow[],
  transferMonth: string,
  todayKey: string,
): XLSX.WorkBook => {
  const header = ["*입금은행", "*입금계좌", "*입금액", "고객관리성명", "입금통장표시내용", "출금통장표시내용", "입금인코드", "비고", "업체사용key"];
  const dataRows = rows.map((row) => [
    String(row.bank_code || ""),
    cleanAccountNumber(row.account_number),
    Number(row.amount || 0),
    row.customer_display_name || row.account_name || row.vendor,
    "(주)태명산업개발",
    row.memo,
    "",
    "",
    "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 15 },
    { wch: 30 },
    { wch: 24 },
    { wch: 34 },
    { wch: 14 },
    { wch: 16 },
    { wch: 24 },
  ];

  worksheet["!rows"] = [
    { hpt: 22 },
    ...dataRows.map(() => ({ hpt: 22 })),
  ];

  worksheet["!autofilter"] = { ref: `A1:I${dataRows.length + 1}` };

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:I1");

  const border = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  };

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[addr] || { v: "", t: "s" };
      worksheet[addr] = cell;

      const isHeader = r === 0;

      cell.s = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: isHeader ? "B8CCE4" : "D9D9D9" },
        },
        font: {
          name: "Arial",
          sz: 12,
          bold: false,
          color: { rgb: "000000" },
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: false,
        },
        border,
      };

      if (c === 2 && r > 0) {
        cell.t = "n";
        cell.z = "#,##0";
      }

      if ((c === 0 || c === 1) && r > 0) {
        cell.t = "s";
        cell.z = "@";
        cell.v = String(cell.v || "");
      }

      if (c === 1 && r > 0) {
        cell.t = "s";
        cell.z = "@";
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `${transferMonth || todayKey.slice(0, 7)} 대량이체`,
    Subject: "태명산업개발 대량이체",
    Author: "태명산업개발",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, "대량이체 미입금분");
  return workbook;
};

export const getBulkTransferFileName = (transferMonth: string, todayKey: string) =>
  `${transferMonth || todayKey.slice(0, 7)}_대량이체.xlsx`;
