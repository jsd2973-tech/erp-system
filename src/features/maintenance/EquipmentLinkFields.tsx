import type { Dispatch, SetStateAction } from "react";
import { EQUIPMENT_WORK_TYPES } from "./equipmentModel";
import type { EquipmentItem, EquipmentWorkType } from "./equipmentTypes";
import type { MaintenanceForm } from "./maintenanceTypes";
import "./equipment.css";

export type EquipmentLinkCatalog = { items: EquipmentItem[]; loading: boolean; error: string };

export function EquipmentLinkFields({ form, setForm, catalog }: {
  form: MaintenanceForm; setForm: Dispatch<SetStateAction<MaintenanceForm>>; catalog: EquipmentLinkCatalog;
}) {
  const item = catalog.items.find(row => row.id === form.equipment_item_id);
  const kind = form.equipment_work_type || "repair";
  const canCalculate = !!item && item.cycle_method !== "none" && kind !== "inspection";
  return <div className="equipment-link-fields subcard">
    <div className="between"><strong>설비현황 연결</strong><span className="equipment-help">연결한 항목의 총괄표와 작업이력에 함께 반영됩니다.</span></div>
    <div className="equipment-form-grid">
      <label>관리 항목
        <select data-testid="maintenance-equipment-item" aria-label="설비현황 연결 항목" value={form.equipment_item_id || ""} disabled={catalog.loading || !!catalog.error}
          onChange={event => setForm(previous => ({ ...previous, equipment_item_id: event.target.value || null, equipment_cycle_included: false }))}>
          <option value="">연결하지 않음</option>
          {!!form.equipment_item_id && !item && <option value={form.equipment_item_id}>기존 연결 항목 (확인 필요)</option>}
          {catalog.items.map(row => <option key={row.id} value={row.id}>{row.category} / {row.name}</option>)}
        </select>
      </label>
      {!!form.equipment_item_id && <>
        <label>작업 구분
          <select data-testid="maintenance-equipment-type" value={kind} onChange={event => {
            const value = event.target.value as EquipmentWorkType;
            setForm(previous => ({ ...previous, equipment_work_type: value, equipment_cycle_included: value === "replacement" && !!item && item.cycle_method !== "none" }));
          }}>{EQUIPMENT_WORK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
        </label>
        <label>작업업체<input data-testid="maintenance-equipment-vendor" value={form.equipment_vendor || ""} placeholder="업체명 또는 현장 자체작업" onChange={event => setForm(previous => ({ ...previous, equipment_vendor: event.target.value }))} /></label>
        <label className="equipment-checkbox"><input data-testid="maintenance-equipment-cycle" type="checkbox" disabled={!canCalculate} checked={canCalculate && form.equipment_cycle_included === true} onChange={event => setForm(previous => ({ ...previous, equipment_cycle_included: event.target.checked }))} />교체주기 계산에 포함</label>
      </>}
    </div>
    {catalog.loading && <p className="equipment-help" role="status">설비 항목을 불러오는 중입니다.</p>}
    {catalog.error && <p className="equipment-error" role="alert">설비 항목을 불러오지 못했습니다: {catalog.error}</p>}
    {item && <p className="equipment-help">{item.spec || "규격 미기재"} · 점검·부분수리는 주기 반영을 해제하면 기존 교체주기를 유지합니다.</p>}
  </div>;
}
