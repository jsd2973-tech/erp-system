export type EquipmentWorkType = "replacement" | "repair" | "inspection" | "installation" | "improvement";
export type EquipmentCycleMethod = "none" | "average" | "fixed";

export type EquipmentItem = {
  id: string;
  category: string;
  name: string;
  spec: string;
  dimensions: string;
  bearing: string;
  rollers: string;
  notes: string;
  shared_note_key: string | null;
  warehouse_id: string | null;
  sort_order: number;
  cycle_method: EquipmentCycleMethod;
  cycle_intervals: number;
  fixed_cycle_days: number | null;
  baseline_cycle_days: number | null;
  expected_override: string | null;
  updated_at: string;
};

export type EquipmentImportedHistory = {
  id: string;
  equipment_item_id: string;
  work_date: string | null;
  date_text: string;
  vendor_label: string;
  work_detail: string;
  work_type: EquipmentWorkType | "legacy";
  cost: number | null;
  cycle_included: boolean;
  source_rank: number;
  updated_at: string;
};

export type EquipmentSettings = { id: string; title: string; common_note: string; updated_at: string };

export type EquipmentWork = {
  id: string;
  source_id: string;
  equipment_item_id: string;
  origin: "import" | "maintenance";
  date: string;
  calendar_date: string | null;
  sort_date: string;
  vendor: string;
  title: string;
  detail: string;
  work_type: EquipmentWorkType | "legacy";
  cost: number | null;
  cycle_included: boolean;
  source_rank: number;
};

export type EquipmentOverviewRow = {
  item: EquipmentItem;
  history: EquipmentWork[];
  average_days: number | null;
  expected_date: string | null;
};

export type EquipmentItemDraft = Pick<EquipmentItem,
  "category" | "name" | "spec" | "dimensions" | "bearing" | "rollers" | "notes" | "warehouse_id" |
  "cycle_method" | "cycle_intervals" | "fixed_cycle_days" | "expected_override"
>;

export type EquipmentHistoryDraft = Pick<EquipmentImportedHistory,
  "work_date" | "date_text" | "vendor_label" | "work_detail" | "work_type" | "cost" | "cycle_included"
>;
