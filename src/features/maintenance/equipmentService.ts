import type { SupabaseClient } from "@supabase/supabase-js";
import type { EquipmentHistoryDraft, EquipmentImportedHistory, EquipmentItem, EquipmentItemDraft, EquipmentSettings } from "./equipmentTypes";

type Client = Pick<SupabaseClient, "from" | "rpc">;
const conflict = { message: "다른 사용자가 수정한 기록입니다. 새로고침 후 다시 수정해주세요.", code: "40001" };

export const createEquipmentService = (client: Client) => {
  const fetchPages = async (table: string, orders: { column: string; ascending: boolean }[], linkedOnly = false, pageSize = 1000) => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = client.from(table).select("*");
      if (linkedOnly) query = query.not("equipment_item_id", "is", null);
      for (const order of orders) query = query.order(order.column, { ascending: order.ascending, nullsFirst: false });
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) return { data: null, error };
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) return { data: rows, error: null };
    }
  };
  return {
    fetchItems: () => fetchPages("maintenance_equipment_items", [{ column: "sort_order", ascending: true }, { column: "id", ascending: true }]),
    fetchImportedHistory: () => fetchPages("maintenance_equipment_history", [{ column: "work_date", ascending: false }, { column: "source_rank", ascending: true }, { column: "id", ascending: true }]),
    fetchLinkedMaintenances: () => fetchPages("maints", [{ column: "date", ascending: false }, { column: "id", ascending: false }], true),
    fetchSettings: () => client.from("maintenance_equipment_settings").select("*").eq("id", "crusher").single(),
    createItem: (draft: EquipmentItemDraft, sortOrder: number) => client.from("maintenance_equipment_items").insert({ ...draft, sort_order: sortOrder }).select("*").single(),
    updateItem: (item: EquipmentItem, draft: EquipmentItemDraft) => client.rpc("save_maintenance_equipment_item", {
      p_id: item.id, p_expected_updated_at: item.updated_at, p_values: draft,
    }),
    updateImportedHistory: async (record: EquipmentImportedHistory, draft: EquipmentHistoryDraft) => {
      const result = await client.from("maintenance_equipment_history").update(draft).eq("id", record.id).eq("updated_at", record.updated_at).select("*").maybeSingle();
      return result.error || result.data ? result : { ...result, error: conflict };
    },
    updateSettings: async (settings: EquipmentSettings, title: string, commonNote: string) => {
      const result = await client.from("maintenance_equipment_settings").update({ title, common_note: commonNote }).eq("id", "crusher").eq("updated_at", settings.updated_at).select("*").maybeSingle();
      return result.error || result.data ? result : { ...result, error: conflict };
    },
  };
};
