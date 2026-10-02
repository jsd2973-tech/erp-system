import type { SupabaseClient } from "@supabase/supabase-js";
import {
  maintenancePurchaseLinkKey,
  numericValue,
  toMaintenancePurchaseLink,
} from "../purchase/purchaseModel";
import type { MaintenancePurchaseLink } from "../purchase/purchaseTypes";

type MaintenanceLinkSupabaseClient = Pick<SupabaseClient, "from" | "rpc">;

const toDatabaseLink = (link: MaintenancePurchaseLink, maintenanceId = link.maintenance_id) => {
  const row: Record<string, unknown> = {
    maintenance_id: maintenanceId,
    maintenance_row_id: link.maintenance_row_id,
    purchase_id: link.purchase_id,
    purchase_row_id: link.purchase_row_id,
    item_name: link.item_name,
    spec: link.spec,
    used_qty: numericValue(link.used_qty),
    unit_price_snapshot: numericValue(link.unit_price_snapshot),
    purchase_date_snapshot: link.purchase_date_snapshot,
    vendor_snapshot: link.vendor_snapshot,
    maintenance_date_snapshot: link.maintenance_date_snapshot,
    maintenance_equipment_snapshot: link.maintenance_equipment_snapshot,
    maintenance_title_snapshot: link.maintenance_title_snapshot,
  };
  if (link.id) row.id = link.id;
  if (link.created_by) row.created_by = link.created_by;
  if (link.created_at) row.created_at = link.created_at;
  return row;
};

const toRestoreLink = (link: MaintenancePurchaseLink, maintenanceId = link.maintenance_id) => ({
  id: link.id,
  maintenance_id: maintenanceId,
  maintenance_row_id: link.maintenance_row_id,
  purchase_id: link.purchase_id,
  purchase_row_id: link.purchase_row_id,
  item_name: link.item_name,
  spec: link.spec,
  used_qty: link.used_qty,
  unit_price_snapshot: link.unit_price_snapshot,
  purchase_date_snapshot: link.purchase_date_snapshot,
  vendor_snapshot: link.vendor_snapshot,
  maintenance_date_snapshot: link.maintenance_date_snapshot,
  maintenance_equipment_snapshot: link.maintenance_equipment_snapshot,
  maintenance_title_snapshot: link.maintenance_title_snapshot,
  created_by: link.created_by,
  created_at: link.created_at,
});

export const getMaintenancePurchaseLinkChanges = (
  previousLinks: MaintenancePurchaseLink[],
  nextLinks: MaintenancePurchaseLink[],
) => {
  const signature = (link: MaintenancePurchaseLink) =>
    maintenancePurchaseLinkKey(link) + ":" + link.used_qty;
  const previousSignatures = previousLinks.map(signature).sort();
  const nextSignatures = nextLinks.map(signature).sort();
  const previousKeys = new Set(previousSignatures);
  const nextKeys = new Set(nextSignatures);
  return {
    changed: previousSignatures.join("|") !== nextSignatures.join("|"),
    added: nextLinks.filter((link) => !previousKeys.has(signature(link))),
    removed: previousLinks.filter((link) => !nextKeys.has(signature(link))),
  };
};

export const createMaintenancePurchaseLinkService = (supabase: MaintenanceLinkSupabaseClient) => ({
  fetchForMaintenance: (maintenanceId: string) =>
    supabase.from("maintenance_purchase_links").select("*").eq("maintenance_id", maintenanceId),

  deleteForMaintenance: (maintenanceId: string) =>
    supabase.from("maintenance_purchase_links").delete().eq("maintenance_id", maintenanceId),

  restoreRawLinks: (rows: unknown[]) =>
    supabase.from("maintenance_purchase_links").insert(rows),

  restoreMaintenanceLinks: (maintenanceId: string, links: MaintenancePurchaseLink[]) =>
    supabase.from("maintenance_purchase_links").insert(links.map((link) => toRestoreLink(link, maintenanceId))),

  replaceForMaintenance: async (
    maintenanceId: string,
    nextLinks: MaintenancePurchaseLink[],
    previousLinks: MaintenancePurchaseLink[],
  ) => {
    const validLinkRows = nextLinks.map((link) => toDatabaseLink(link, maintenanceId));
    const { data, error } = await supabase.rpc("replace_maintenance_purchase_links", {
      p_maintenance_id: maintenanceId,
      p_links: validLinkRows,
    });

    if (error) {
      return { savedLinks: [], error, stage: "atomic" as const };
    }

    const savedLinks = ((data || []) as unknown[]).map(toMaintenancePurchaseLink);
    return {
      savedLinks,
      error: null,
      stage: null,
      ...getMaintenancePurchaseLinkChanges(previousLinks, savedLinks),
    };
  },
});
