import type { MaintenancePurchaseLink, Purchase, PurchaseRow } from "./purchaseTypes";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" ? value as UnknownRecord : {};

export const toPurchase = (value: unknown): Purchase => {
  const p = asRecord(value);
  const imageUrl = p.image_url || "";

  return {
    id: p.id as string,
    date: (p.date || "") as string,
    vendor: (p.vendor || "") as string,
    warehouse: (p.warehouse || "") as string,
    rows: (p.rows || []) as PurchaseRow[],
    supplyTotal: Number(p.supplytotal ?? p.supplyTotal ?? 0),
    vatTotal: Number(p.vattotal ?? p.vatTotal ?? 0),
    total: Number(p.total || 0),
    itemSummary: (p.itemsummary ?? p.itemSummary ?? "") as string,
    taxInvoiceReceived: Boolean(p.tax_invoice_received ?? p.taxInvoiceReceived ?? false),
    paymentStatus: p.payment_status === "paid" || p.paymentStatus === "paid" ? "paid" : "unpaid",
    paidDate: (p.paid_date ?? p.paidDate ?? "") as string,
    image_url: imageUrl as string,
    image_urls: (p.image_urls || (imageUrl ? [imageUrl] : [])) as string[],
  };
};

export const fromPurchase = (purchase: Purchase) => ({
  id: purchase.id,
  date: purchase.date,
  vendor: purchase.vendor,
  warehouse: purchase.warehouse,
  rows: purchase.rows,
  supplytotal: purchase.supplyTotal,
  vattotal: purchase.vatTotal,
  total: purchase.total,
  itemsummary: purchase.itemSummary,
  tax_invoice_received: Boolean(purchase.taxInvoiceReceived),
  payment_status: purchase.paymentStatus === "paid" ? "paid" : "unpaid",
  paid_date: purchase.paymentStatus === "paid" ? purchase.paidDate || null : null,
  image_url: (purchase.image_urls || [])[0] || purchase.image_url || "",
  image_urls: purchase.image_urls || (purchase.image_url ? [purchase.image_url] : []),
});

export const isPurchasePaid = (purchase: Purchase) => purchase.paymentStatus === "paid";

export const toMaintenancePurchaseLink = (value: unknown): MaintenancePurchaseLink => {
  const row = asRecord(value);
  return {
    id: String(row.id || ""),
    maintenance_id: String(row.maintenance_id || ""),
    maintenance_row_id: String(row.maintenance_row_id || ""),
    purchase_id: String(row.purchase_id || ""),
    purchase_row_id: String(row.purchase_row_id || ""),
    item_name: String(row.item_name || ""),
    spec: String(row.spec || ""),
    used_qty: Number(row.used_qty || 0),
    unit_price_snapshot: Number(row.unit_price_snapshot || 0),
    purchase_date_snapshot: String(row.purchase_date_snapshot || ""),
    vendor_snapshot: String(row.vendor_snapshot || ""),
    maintenance_date_snapshot: String(row.maintenance_date_snapshot || ""),
    maintenance_equipment_snapshot: String(row.maintenance_equipment_snapshot || ""),
    maintenance_title_snapshot: String(row.maintenance_title_snapshot || ""),
    created_by: row.created_by ? String(row.created_by) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
};

export const maintenancePurchaseLinkKey = (
  link: Pick<MaintenancePurchaseLink, "maintenance_row_id" | "purchase_id" | "purchase_row_id">,
) => `${link.maintenance_row_id}\u001f${link.purchase_id}\u001f${link.purchase_row_id}`;

export const maintenancePurchaseLinkIdentity = (link: MaintenancePurchaseLink) =>
  link.id || maintenancePurchaseLinkKey(link);

export const getPurchaseItemSummary = (purchase: Pick<Purchase, "itemSummary" | "rows">) => {
  const itemNames = (purchase.rows || [])
    .map((row) => String(row.item || "").trim())
    .filter(Boolean);

  if (!itemNames.length) return purchase.itemSummary || "-";

  const firstItem = itemNames[0];
  const extraCount = itemNames.length - 1;

  return extraCount > 0 ? `${firstItem} 외 ${extraCount}건` : firstItem;
};

export const cleanAccountNumber = (value: string) => String(value || "").replace(/[^0-9]/g, "");
