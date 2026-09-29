import XLSX from "xlsx-js-style";
import { cleanVendorImportText, nextItemCode, nextVendorCode } from "./masterDataModel";
import type { EcountVendorImportRow, MasterItem, Vendor } from "./masterDataTypes";

export type ImportRecord = Record<string, unknown>;

const pickImportValue = (record: ImportRecord, keys: string[]) => {
  const foundKey = Object.keys(record).find((key) => keys.some((needle) => key.includes(needle)));
  return foundKey ? record[foundKey] : "";
};

export const parseEcountVendorSheets = (sheets: Array<{ name: string; rows: unknown[][] }>): EcountVendorImportRow[] | null => {
  const rows: EcountVendorImportRow[] = [];
  let foundEcountHeader = false;

  sheets.forEach(({ name: sourceSheet, rows: matrix }) => {
    const headerIndex = matrix.findIndex((row) => {
      const headers = row.map(cleanVendorImportText);
      return headers.includes("거래처코드") && (headers.includes("거래처명") || headers.includes("상호"));
    });
    if (headerIndex < 0) return;

    foundEcountHeader = true;
    const headers = matrix[headerIndex].map(cleanVendorImportText);
    const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const codeColumn = findColumn("거래처코드");
    const nameColumn = findColumn("거래처명", "상호");
    const ownerColumn = findColumn("대표자명", "대표자");
    const phoneColumn = findColumn("전화", "전화번호", "연락처");
    const mobileColumn = findColumn("모바일", "휴대폰", "휴대전화");
    const addressColumn = findColumn("주소1", "주소", "사업장주소", "소재지");
    const emailColumn = findColumn("Email", "이메일");
    const faxColumn = findColumn("Fax", "팩스");
    const getCell = (row: unknown[], column: number) => (column >= 0 ? cleanVendorImportText(row[column]) : "");

    matrix.slice(headerIndex + 1).forEach((row, index) => {
      const code = getCell(row, codeColumn);
      const vendorName = getCell(row, nameColumn);
      const owner = getCell(row, ownerColumn);
      const phone = getCell(row, phoneColumn);
      const mobile = getCell(row, mobileColumn);
      const address = getCell(row, addressColumn);
      const email = getCell(row, emailColumn);
      const fax = getCell(row, faxColumn);
      const hasMappedValue = [code, vendorName, owner, phone, mobile, address, email, fax].some(Boolean);

      if (!hasMappedValue) return;
      if (!vendorName && /^20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/.test(code) && ![owner, phone, mobile, address, email, fax].some(Boolean)) return;

      rows.push({
        sourceSheet,
        sourceRow: headerIndex + index + 2,
        code,
        name: vendorName,
        owner,
        phone,
        mobile,
        address,
      });
    });
  });

  return foundEcountHeader ? rows : null;
};

export const readEcountVendorRows = async (file: File): Promise<EcountVendorImportRow[] | null> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: true });
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][],
  }));
  return parseEcountVendorSheets(sheets);
};

export const readMasterDataRows = async (file: File): Promise<ImportRecord[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ImportRecord>(worksheet, { defval: "" });
};

export const mapVendorImportRows = (
  rows: ImportRecord[],
  existingVendors: Vendor[],
  createId: () => string,
) => {
  const importedCodes: { code?: string }[] = [...existingVendors];
  return rows
    .map((row) => {
      const code = String(pickImportValue(row, ["거래처코드", "코드", "사업자번호"]) || "").trim() || nextVendorCode(importedCodes);
      importedCodes.push({ code });
      return {
        id: createId(),
        code,
        name: String(pickImportValue(row, ["거래처명", "상호"]) || "").trim(),
        owner: String(pickImportValue(row, ["대표자", "대표자명"]) || "").trim(),
        phone: String(pickImportValue(row, ["전화", "전화번호", "연락처"]) || "").trim(),
        mobile: String(pickImportValue(row, ["모바일", "휴대폰", "휴대전화"]) || "").trim(),
        address: String(pickImportValue(row, ["주소", "사업장주소", "소재지"]) || "").trim(),
        address_detail: String(pickImportValue(row, ["상세주소", "주소상세", "상세 주소"]) || "").trim(),
      };
    })
    .filter((vendor) => vendor.name);
};

export const mergeVendorImportRows = (vendors: Vendor[], imported: Vendor[]) => {
  const merged = [...vendors];
  imported.forEach((row) => {
    const index = merged.findIndex((vendor) => vendor.code === row.code || vendor.name === row.name);
    if (index >= 0) merged[index] = { ...merged[index], ...row, id: merged[index].id };
    else merged.push(row);
  });
  return merged;
};

export const mapItemImportRows = (
  rows: ImportRecord[],
  existingItems: MasterItem[],
  createId: () => string,
) => {
  const temporaryCodes: { code?: string }[] = [];
  return rows
    .map((row) => {
      const rawCode = String(pickImportValue(row, ["품목코드", "코드"]) || "").trim();
      const name = String(pickImportValue(row, ["품목명", "품명"]) || "").trim();
      const spec = String(pickImportValue(row, ["규격정보", "규격"]) || "").trim();
      const unit = String(pickImportValue(row, ["단위"]) || "").trim();
      const price = Number(pickImportValue(row, ["단가", "입고단가", "매입단가"]) || 0);
      const code = rawCode || nextItemCode([...existingItems, ...temporaryCodes]);
      temporaryCodes.push({ code });
      return { id: createId(), code, name, spec, unit, price };
    })
    .filter((item) => item.name || item.code);
};

export const mergeItemImportRows = (items: MasterItem[], imported: MasterItem[]) => {
  const merged = [...items];
  imported.forEach((row) => {
    const index = merged.findIndex((item) => row.code && item.code === row.code);
    if (index >= 0) merged[index] = { ...merged[index], ...row, id: merged[index].id };
    else merged.push(row);
  });
  return merged;
};
