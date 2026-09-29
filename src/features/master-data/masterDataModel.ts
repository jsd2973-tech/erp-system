import type { EcountVendorImportRow, MasterItem, Vendor } from "./masterDataTypes";

export const nextNumericCode = (records: { code?: string }[], prefix = "", width = 4) => {
  const maxCode = (records || []).reduce((max, record) => {
    const raw = String(record.code || "").trim();
    const numericText = prefix && raw.toUpperCase().startsWith(prefix.toUpperCase()) ? raw.slice(prefix.length) : raw;
    const numericCode = /^\d+$/.test(numericText) ? Number(numericText) : 0;
    return Number.isFinite(numericCode) ? Math.max(max, numericCode) : max;
  }, 0);
  return `${prefix}${String(maxCode + 1).padStart(width, "0")}`;
};

export const nextVendorCode = (vendors: { code?: string }[]) => nextNumericCode(vendors, "V", 3);
export const nextWarehouseCode = (records: { code?: string }[]) => nextNumericCode(records, "", 4);
export const nextItemCode = (items: { code?: string }[]) => nextNumericCode(items, "", 4);

export const emptyVendorForm = (): Omit<Vendor, "id"> => ({
  code: "",
  name: "",
  owner: "",
  phone: "",
  mobile: "",
  address: "",
  address_detail: "",
});

export const filterMasterItems = (items: MasterItem[], query: string) => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return items;
  return items.filter((item) =>
    [item.code, item.name, item.spec, item.unit]
      .some((value) => String(value || "").toLowerCase().includes(keyword)),
  );
};

export const normalizeMasterItems = (items: Array<Record<string, unknown>>): MasterItem[] =>
  items.map((item) => ({ ...item, price: Number(item.price || 0) }) as MasterItem);

export const getEcountVendorRowKey = (row: EcountVendorImportRow) => `${row.sourceSheet}:${row.sourceRow}`;

export const groupEcountVendorRowsByName = (rows: EcountVendorImportRow[]) => {
  const groups = new Map<string, EcountVendorImportRow[]>();
  rows.forEach((row) => {
    const sameNameRows = groups.get(row.name) || [];
    sameNameRows.push(row);
    groups.set(row.name, sameNameRows);
  });
  return Array.from(groups.entries()).filter(([, sameNameRows]) => sameNameRows.length > 1);
};

export const cleanVendorImportText = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").trim();
