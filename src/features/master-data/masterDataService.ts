import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MasterItem,
  Vendor,
  Warehouse,
  WarehouseGroup,
} from "./masterDataTypes";

export type MasterDataError = { message: string; code?: string };
export type MasterDataResult<T> = { data: T | null; error: MasterDataError | null };

type WarehouseGroupSaveResult =
  | { stage: "group-upsert"; error: MasterDataError }
  | { stage: "warehouse-rename"; error: MasterDataError; rollbackError: MasterDataError | null }
  | { stage: "saved"; updatedWarehouseIds: string[] };

const MASTER_DATA_PAGE_SIZE = 1000;
const MASTER_DATA_BATCH_SIZE = 500;

const fetchAllRows = async <T,>(
  supabase: SupabaseClient,
  table: "vendors" | "warehouse_groups" | "warehouses" | "items",
  orderColumn = "code",
  pageSize = MASTER_DATA_PAGE_SIZE,
): Promise<MasterDataResult<T[]>> => {
  let allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) return { data: allRows, error };

    const rows = (data || []) as T[];
    allRows = [...allRows, ...rows];
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { data: allRows, error: null };
};

const upsertInChunks = async (supabase: SupabaseClient, rows: MasterItem[], chunkSize = MASTER_DATA_BATCH_SIZE) => {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await supabase.from("items").upsert(rows.slice(index, index + chunkSize));
    if (error) return error;
  }
  return null;
};

export const createMasterDataService = (supabase: SupabaseClient) => ({
  fetchMasterData: async (): Promise<{
    vendors: MasterDataResult<Vendor[]>;
    groups: MasterDataResult<WarehouseGroup[]>;
    warehouses: MasterDataResult<Warehouse[]>;
    items: MasterDataResult<MasterItem[]>;
  }> => {
    const [vendors, groups, warehouses, items] = await Promise.all([
      fetchAllRows<Vendor>(supabase, "vendors"),
      fetchAllRows<WarehouseGroup>(supabase, "warehouse_groups"),
      fetchAllRows<Warehouse>(supabase, "warehouses"),
      fetchAllRows<MasterItem>(supabase, "items"),
    ]);
    return { vendors, groups, warehouses, items };
  },

  fetchVendors: () => fetchAllRows<Vendor>(supabase, "vendors"),
  fetchItems: () => fetchAllRows<MasterItem>(supabase, "items"),

  upsertVendor: (vendor: Vendor) => supabase.from("vendors").upsert(vendor),
  upsertVendors: (vendors: Vendor[]) => supabase.from("vendors").upsert(vendors),
  upsertVendorDetails: (vendors: Vendor[]) => supabase.from("vendors").upsert(vendors, { onConflict: "id" }),
  deleteVendor: (id: string) => supabase.from("vendors").delete().eq("id", id),
  deleteAllVendors: () => supabase.from("vendors").delete().neq("id", ""),

  saveWarehouseGroup: async (
    payload: WarehouseGroup,
    previousGroup: WarehouseGroup | undefined,
    warehouses: Warehouse[],
  ): Promise<WarehouseGroupSaveResult> => {
    const { error } = await supabase.from("warehouse_groups").upsert(payload);
    if (error) return { stage: "group-upsert", error };

    if (previousGroup && previousGroup.name.trim() !== payload.name) {
      const previousGroupName = previousGroup.name.trim();
      const linkedWarehouses = warehouses.filter((warehouse) => warehouse.group.trim() === previousGroupName);
      if (linkedWarehouses.length) {
        const linkedWarehouseIds = linkedWarehouses.map((warehouse) => warehouse.id);
        const { data: updatedWarehouses, error: warehouseError } = await supabase
          .from("warehouses")
          .update({ group: payload.name })
          .in("id", linkedWarehouseIds)
          .select("id, group");
        const updatedIds = new Set((updatedWarehouses || []).map((warehouse) => String(warehouse.id)));
        const allWarehousesUpdated = linkedWarehouseIds.every((id) => updatedIds.has(String(id)));

        if (warehouseError || !allWarehousesUpdated) {
          if (updatedIds.size) {
            await supabase.from("warehouses").update({ group: previousGroup.name }).in("id", Array.from(updatedIds));
          }
          const { error: rollbackError } = await supabase.from("warehouse_groups").upsert(previousGroup);
          return {
            stage: "warehouse-rename",
            error: warehouseError || { message: "일부 세부창고가 변경되지 않았습니다." },
            rollbackError,
          };
        }

        return { stage: "saved", updatedWarehouseIds: linkedWarehouseIds };
      }
    }

    return { stage: "saved", updatedWarehouseIds: [] };
  },

  upsertWarehouse: (warehouse: Warehouse) => supabase.from("warehouses").upsert(warehouse),
  deleteWarehouse: (id: string) => supabase.from("warehouses").delete().eq("id", id),
  deleteWarehousesInGroup: (name: string) => supabase.from("warehouses").delete().eq("group", name),
  deleteWarehouseGroup: (id: string) => supabase.from("warehouse_groups").delete().eq("id", id),

  upsertItem: (item: MasterItem) => supabase.from("items").upsert(item),
  insertItem: (item: MasterItem) => supabase.from("items").insert(item),
  upsertImportedItems: (items: MasterItem[]) => upsertInChunks(supabase, items),
  deleteItem: (id: string) => supabase.from("items").delete().eq("id", id),
  deleteAllItems: () => supabase.from("items").delete().neq("id", ""),
});

export type MasterDataService = ReturnType<typeof createMasterDataService>;
