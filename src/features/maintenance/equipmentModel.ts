import type { Maint, MaintenanceForm } from "./maintenanceTypes";
import type { EquipmentImportedHistory, EquipmentItem, EquipmentItemDraft, EquipmentOverviewRow, EquipmentSettings, EquipmentWork, EquipmentWorkType } from "./equipmentTypes";

export const EQUIPMENT_WORK_TYPES: { value: EquipmentWorkType; label: string }[] = [
  { value: "replacement", label: "교체" }, { value: "repair", label: "수리" },
  { value: "inspection", label: "점검" }, { value: "installation", label: "설치" },
  { value: "improvement", label: "개선공사" },
];
export const equipmentWorkLabel = (value: string) => EQUIPMENT_WORK_TYPES.find(type => type.value === value)?.label || "기존 기록";
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => value == null ? "" : String(value);
const nullableNumber = (value: unknown) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const nullableText = (value: unknown) => text(value) || null;
const workType = (value: unknown): EquipmentWorkType | "legacy" => EQUIPMENT_WORK_TYPES.some(type => type.value === value) ? value as EquipmentWorkType : "legacy";

export const normalizeEquipmentItem = (value: unknown): EquipmentItem => {
  const row = asObject(value);
  return {
    id: text(row.id), category: text(row.category), name: text(row.name), spec: text(row.spec),
    dimensions: text(row.dimensions), bearing: text(row.bearing), rollers: text(row.rollers), notes: text(row.notes),
    shared_note_key: nullableText(row.shared_note_key), warehouse_id: nullableText(row.warehouse_id),
    sort_order: Number(row.sort_order || 0),
    cycle_method: row.cycle_method === "fixed" || row.cycle_method === "average" ? row.cycle_method : "none",
    cycle_intervals: Number(row.cycle_intervals || 3), fixed_cycle_days: nullableNumber(row.fixed_cycle_days),
    baseline_cycle_days: nullableNumber(row.baseline_cycle_days), expected_override: nullableText(row.expected_override),
    updated_at: text(row.updated_at),
  };
};
export const normalizeEquipmentHistory = (value: unknown): EquipmentImportedHistory => {
  const row = asObject(value);
  return {
    id: text(row.id), equipment_item_id: text(row.equipment_item_id), work_date: nullableText(row.work_date),
    date_text: text(row.date_text), vendor_label: text(row.vendor_label), work_detail: text(row.work_detail),
    work_type: workType(row.work_type), cost: nullableNumber(row.cost), cycle_included: row.cycle_included === true,
    source_rank: Number(row.source_rank || 0), updated_at: text(row.updated_at),
  };
};
export const normalizeEquipmentSettings = (value: unknown): EquipmentSettings => {
  const row = asObject(value);
  return { id: text(row.id) || "crusher", title: text(row.title) || "크라샤 설비현황", common_note: text(row.common_note), updated_at: text(row.updated_at) };
};

export const validEquipmentDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const calendarDate = (value: string) => validEquipmentDate(value) ? value : null;
const sortDate = (value: string) => calendarDate(value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "") || "";
const dateMillis = (value: string) => Date.parse(value + "T00:00:00Z");

export const buildEquipmentHistory = (items: EquipmentItem[], imported: EquipmentImportedHistory[], maints: Maint[]): Map<string, EquipmentWork[]> => {
  const map = new Map(items.map(item => [item.id, [] as EquipmentWork[]]));
  for (const row of imported) {
    const date = row.work_date || row.date_text;
    map.get(row.equipment_item_id)?.push({
      id: "import:" + row.id, source_id: row.id, equipment_item_id: row.equipment_item_id, origin: "import",
      date, calendar_date: calendarDate(row.work_date || ""), sort_date: sortDate(date),
      vendor: row.vendor_label, title: "", detail: row.work_detail, work_type: row.work_type, cost: row.cost,
      cycle_included: row.cycle_included, source_rank: row.source_rank,
    });
  }
  for (const maint of maints) {
    if (!maint.equipment_item_id) continue;
    const type = workType(maint.equipment_work_type);
    map.get(maint.equipment_item_id)?.push({
      id: "maintenance:" + maint.id, source_id: maint.id, equipment_item_id: maint.equipment_item_id, origin: "maintenance",
      date: maint.date || "", calendar_date: calendarDate(maint.date || ""), sort_date: sortDate(maint.date || ""),
      vendor: maint.equipment_vendor || (maint.manager ? "작업자: " + maint.manager : ""), title: maint.title || "", detail: maint.detail || "",
      work_type: type === "legacy" ? "repair" : type,
      cost: Number(maint.total || maint.cost || (maint.items || []).reduce((sum, row) => sum + Number(row.total || 0), 0)),
      cycle_included: maint.equipment_cycle_included === true && type !== "inspection", source_rank: 0,
    });
  }
  for (const history of map.values()) history.sort((a, b) =>
    b.sort_date.localeCompare(a.sort_date) ||
    (a.origin === b.origin ? a.source_rank - b.source_rank : a.origin === "maintenance" ? -1 : 1) || b.id.localeCompare(a.id)
  );
  return map;
};

export const projectEquipmentCycle = (item: EquipmentItem, history: EquipmentWork[]) => {
  const dates = [...new Set(history.filter(row => row.cycle_included && row.calendar_date && row.work_type !== "inspection").map(row => row.calendar_date!))].sort().reverse();
  let days: number | null = null;
  if (item.cycle_method === "fixed") days = item.fixed_cycle_days;
  if (item.cycle_method === "average") {
    const intervals = Math.min(item.cycle_intervals, dates.length - 1);
    if (intervals > 0) days = (dateMillis(dates[0]) - dateMillis(dates[intervals])) / (86400000 * intervals);
    else days = item.baseline_cycle_days;
  }
  if (days !== null && (!Number.isFinite(days) || days <= 0)) days = null;
  const expected = dates.length && days !== null
    ? new Date(dateMillis(dates[0]) + days * 86400000).toISOString().slice(0, 10) : null;
  return { average_days: days, expected_date: item.expected_override || expected };
};

export const buildEquipmentOverview = (items: EquipmentItem[], imported: EquipmentImportedHistory[], maints: Maint[]): EquipmentOverviewRow[] => {
  const histories = buildEquipmentHistory(items, imported, maints);
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)).map(item => {
    const history = histories.get(item.id) || [];
    return { item, history, ...projectEquipmentCycle(item, history) };
  });
};

export const equipmentWorkDescription = (row: EquipmentWork) => row.work_type === "legacy"
  ? row.vendor || row.detail : [row.vendor, equipmentWorkLabel(row.work_type)].filter(Boolean).join(" · ");
export const equipmentPeriodText = (value: number | null) => value === null ? "—" : Number(value.toFixed(1)).toLocaleString("ko-KR") + "일";

export const emptyEquipmentItemDraft = (category = ""): EquipmentItemDraft => ({
  category, name: "", spec: "", dimensions: "", bearing: "", rollers: "", notes: "", warehouse_id: null,
  cycle_method: "none", cycle_intervals: 3, fixed_cycle_days: null, expected_override: null,
});
export const equipmentItemDraft = (item: EquipmentItem): EquipmentItemDraft => ({
  category: item.category, name: item.name, spec: item.spec, dimensions: item.dimensions, bearing: item.bearing,
  rollers: item.rollers, notes: item.notes, warehouse_id: item.warehouse_id,
  cycle_method: item.cycle_method, cycle_intervals: item.cycle_intervals, fixed_cycle_days: item.fixed_cycle_days,
  expected_override: item.expected_override,
});
export const validateEquipmentItemDraft = (draft: EquipmentItemDraft) => {
  if (!draft.category.trim() || !draft.name.trim()) return "대분류와 관리 항목명을 입력해주세요.";
  if (!Number.isInteger(draft.cycle_intervals) || draft.cycle_intervals < 1 || draft.cycle_intervals > 10) return "평균 계산 구간은 1~10회로 입력해주세요.";
  if (draft.cycle_method === "fixed" && (!draft.fixed_cycle_days || !Number.isFinite(draft.fixed_cycle_days) || draft.fixed_cycle_days <= 0)) return "고정 사용기간을 0보다 큰 일수로 입력해주세요.";
  if (draft.expected_override && !validEquipmentDate(draft.expected_override)) return "예상 교체일을 확인해주세요.";
  return "";
};

export const maintenanceEquipmentFields = (form: MaintenanceForm) => ({
  equipment_item_id: form.equipment_item_id || null,
  equipment_work_type: form.equipment_item_id ? form.equipment_work_type || "repair" : null,
  equipment_vendor: form.equipment_item_id ? String(form.equipment_vendor || "").trim() : "",
  equipment_cycle_included: Boolean(form.equipment_item_id && form.equipment_work_type !== "inspection" && form.equipment_cycle_included),
});

export const validateMaintenanceEquipment = (form: MaintenanceForm, items: EquipmentItem[], warehouses: { id: string; name: string; group?: string }[]) => {
  if (!form.equipment_item_id) return "";
  const item = items.find(row => row.id === form.equipment_item_id);
  if (!item) return "연결할 설비 항목을 찾지 못했습니다. 새로고침 후 다시 선택해주세요.";
  const warehouse = warehouses.find(row => row.id === item.warehouse_id);
  const warehouseLabel = warehouse?.group ? `${warehouse.group} / ${warehouse.name}` : warehouse?.name;
  if (warehouse && warehouse.name !== form.warehouse && warehouseLabel !== form.warehouse) return `선택한 설비 항목의 창고는 ‘${warehouseLabel}’입니다. 정비 창고와 연결 항목을 확인해주세요.`;
  if (form.equipment_cycle_included && item.cycle_method === "none") return "선택한 항목의 교체주기 기준을 먼저 설정해주세요.";
  return "";
};
