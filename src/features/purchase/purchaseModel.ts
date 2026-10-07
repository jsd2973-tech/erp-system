import type { MaintenancePurchaseLink, Purchase, PurchaseReceiptStatus, PurchaseRow, PurchaseSearch } from "./purchaseTypes";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" ? value as UnknownRecord : {};

export const normalizePurchaseReceiptStatus = (value: unknown): PurchaseReceiptStatus =>
  value === "received" || value === "unreceived" ? value : "unknown";

// 신규 등록은 미수취, 수정·재업로드는 미확인/수취완료를 포함한 기존 값을 보존합니다.
export const getPurchaseReceiptFields = (existing?: Purchase) => {
  const receiptStatus = existing ? normalizePurchaseReceiptStatus(existing.receiptStatus) : "unreceived";
  return { receiptStatus, receivedDate: receiptStatus === "received" ? existing?.receivedDate || "" : "" };
};

export const buildPurchaseReceiptUpdate = (status: Exclude<PurchaseReceiptStatus, "unknown">, today: string) => ({
  receipt_status: status,
  received_date: status === "received" ? today : null,
});

// 저장 전에 시작된 조회가 늦게 완료돼도 방금 저장한 수취 필드만 보존합니다.
export const createPurchaseReceiptReconciler = () => {
  let revision = 0;
  const updates = new Map<string, { revision: number; receiptStatus: PurchaseReceiptStatus; receivedDate: string }>();
  return {
    getRevision: () => revision,
    record: (id: string, receiptStatus: PurchaseReceiptStatus, receivedDate: string) => {
      updates.set(id, { revision: ++revision, receiptStatus, receivedDate });
    },
    reconcile: (rows: Purchase[], loadRevision: number) => rows.map((row) => {
      const update = updates.get(row.id);
      return update && update.revision > loadRevision
        ? { ...row, receiptStatus: update.receiptStatus, receivedDate: update.receivedDate }
        : row;
    }),
  };
};

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
    receiptStatus: normalizePurchaseReceiptStatus(p.receipt_status ?? p.receiptStatus),
    receivedDate: normalizePurchaseReceiptStatus(p.receipt_status ?? p.receiptStatus) === "received"
      ? String(p.received_date ?? p.receivedDate ?? "") : "",
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
  receipt_status: normalizePurchaseReceiptStatus(purchase.receiptStatus),
  received_date: purchase.receiptStatus === "received" ? purchase.receivedDate || null : null,
  image_url: (purchase.image_urls || [])[0] || purchase.image_url || "",
  image_urls: purchase.image_urls || (purchase.image_url ? [purchase.image_url] : []),
});

export const isPurchasePaid = (purchase: Purchase) => purchase.paymentStatus === "paid";

export const createEmptyPurchaseSearch = (): PurchaseSearch => ({
  from: "",
  to: "",
  vendor: "",
  warehouse: "",
  item: "",
  taxInvoice: "",
  paymentStatus: "",
  receiptStatus: "",
});

export const buildPurchaseNumberMap = (purchases: Purchase[]): Map<string, string> => {
  const orderedByOldest = [...purchases].sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  const running = new Map<string, number>();
  const map = new Map<string, string>();
  orderedByOldest.forEach((purchase) => {
    const date = purchase.date || "날짜없음";
    const nextNo = (running.get(date) || 0) + 1;
    running.set(date, nextNo);
    map.set(purchase.id, `${date}-${String(nextNo).padStart(2, "0")}`);
  });
  return map;
};

export const filterPurchases = (purchases: Purchase[], search: PurchaseSearch) => {
  const numberMap = buildPurchaseNumberMap(purchases);
  return purchases
    .filter(
      (purchase) =>
        (!search.from || (purchase.date || "") >= search.from) &&
        (!search.to || (purchase.date || "") <= search.to) &&
        (!search.vendor || purchase.vendor.includes(search.vendor)) &&
        (!search.warehouse || purchase.warehouse.includes(search.warehouse)) &&
        (!search.item || purchase.rows.some((row) => row.item.includes(search.item))) &&
        (!search.taxInvoice || (search.taxInvoice === "received" ? Boolean(purchase.taxInvoiceReceived) : !purchase.taxInvoiceReceived)) &&
        (!search.paymentStatus || (search.paymentStatus === "paid" ? isPurchasePaid(purchase) : !isPurchasePaid(purchase))) &&
        (!search.receiptStatus || normalizePurchaseReceiptStatus(purchase.receiptStatus) === search.receiptStatus)
    )
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    })
    .map((purchase) => ({ ...purchase, managementNo: numberMap.get(purchase.id) || "" }));
};

export const numericValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim() || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
