export type PurchaseRow = {
  id: string;
  item: string;
  spec: string;
  qty: string | number;
  price: string | number;
  supply: number;
  vat: number;
  total: number;
};

export type PurchasePaymentStatus = "unpaid" | "paid";

export type Purchase = {
  id: string;
  managementNo?: string;
  date: string;
  vendor: string;
  warehouse: string;
  rows: PurchaseRow[];
  supplyTotal: number;
  vatTotal: number;
  total: number;
  itemSummary: string;
  taxInvoiceReceived?: boolean;
  paymentStatus?: PurchasePaymentStatus;
  paidDate?: string;
  image_urls?: string[];
  image_url?: string;
};

export type PurchaseSearch = {
  from: string;
  to: string;
  vendor: string;
  warehouse: string;
  item: string;
  taxInvoice: string;
  paymentStatus?: string;
};

export type MaintenancePurchaseLink = {
  id: string;
  maintenance_id: string;
  maintenance_row_id: string;
  purchase_id: string;
  purchase_row_id: string;
  item_name: string;
  spec: string;
  used_qty: number;
  unit_price_snapshot: number;
  purchase_date_snapshot: string;
  vendor_snapshot: string;
  maintenance_date_snapshot: string;
  maintenance_equipment_snapshot: string;
  maintenance_title_snapshot: string;
  created_by?: string;
  created_at?: string;
};

export type BulkTransferRow = {
  id: string;
  vendor: string;
  amount: number;
  purchaseIds: string[];
  bank_code: string;
  bank_name: string;
  account_name: string;
  customer_display_name: string;
  account_number: string;
  memo: string;
  matched: boolean;
};
