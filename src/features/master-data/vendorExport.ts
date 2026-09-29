import type { Vendor } from "./masterDataTypes";

export const buildVendorExportRows = (vendors: Vendor[]) => vendors.map((vendor) => ({
  거래처코드: String(vendor.code || ""),
  상호: String(vendor.name || ""),
  대표자: String(vendor.owner || ""),
  전화번호: String(vendor.phone || ""),
  모바일: String(vendor.mobile || ""),
  기본주소: String(vendor.address || ""),
  상세주소: String(vendor.address_detail || ""),
}));

export const vendorExportFileName = (todayKey: string) => `거래처목록_${todayKey}`;
