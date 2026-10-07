import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPurchaseReceiptUpdate, fromPurchase } from "./purchaseModel";
import type { MaintenancePurchaseLink, Purchase, PurchasePaymentStatus, PurchaseReceiptStatus } from "./purchaseTypes";

type PurchaseSupabaseClient = Pick<SupabaseClient, "from">;
type PurchaseLinkReference = Pick<
  MaintenancePurchaseLink,
  "id" | "maintenance_id" | "maintenance_row_id" | "used_qty"
>;

export const createPurchaseService = (supabase: PurchaseSupabaseClient) => ({
  fetchPurchases: async (ascending = false) => {
    let allRows: unknown[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("date", { ascending })
        .range(from, to);

      if (error) return { data: allRows, error };

      const rows = data || [];
      allRows = [...allRows, ...rows];
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  },

  fetchMaintenancePurchaseLinks: async () => {
    let allRows: unknown[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("maintenance_purchase_links")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) return { data: allRows, error };

      const rows = data || [];
      allRows = [...allRows, ...rows];
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  },

  upsertPurchasesInChunks: async (purchases: Purchase[], chunkSize = 500) => {
    const rows = purchases.map(fromPurchase);
    for (let index = 0; index < rows.length; index += chunkSize) {
      const { error } = await supabase.from("purchases").upsert(rows.slice(index, index + chunkSize));
      if (error) return error;
    }
    return null;
  },

  savePurchaseRecord: (purchase: Purchase) =>
    supabase.from("purchases").upsert(fromPurchase(purchase)),

  updatePurchaseImages: (purchaseId: string, imageUrls: string[]) =>
    supabase
      .from("purchases")
      .update({ image_urls: imageUrls, image_url: imageUrls[0] || "" })
      .eq("id", purchaseId),

  updatePurchaseTaxInvoice: (purchaseId: string, received: boolean) =>
    supabase.from("purchases").update({ tax_invoice_received: received }).eq("id", purchaseId),

  updatePurchasePayment: (
    purchaseId: string,
    status: PurchasePaymentStatus,
    paidDate: string | null,
  ) => supabase
    .from("purchases")
    .update({ payment_status: status, paid_date: paidDate })
    .eq("id", purchaseId),

  updatePurchasesPayment: (purchaseIds: string[], paidDate: string) =>
    supabase
      .from("purchases")
      .update({ payment_status: "paid", paid_date: paidDate })
      .in("id", purchaseIds),

  updatePurchaseReceipt: (purchaseId: string, status: Exclude<PurchaseReceiptStatus, "unknown">, today: string) =>
    supabase.from("purchases")
      .update(buildPurchaseReceiptUpdate(status, today))
      .select("receipt_status,received_date")
      .eq("id", purchaseId)
      .single(),

  fetchPurchaseLinkReferences: (purchaseId: string) =>
    supabase
      .from("maintenance_purchase_links")
      .select("id, maintenance_id, maintenance_row_id, used_qty")
      .eq("purchase_id", purchaseId)
      .returns<PurchaseLinkReference[]>(),

  deletePurchaseRecord: (purchaseId: string) =>
    supabase.from("purchases").delete().eq("id", purchaseId),
});
