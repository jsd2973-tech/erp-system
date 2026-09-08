import { useEffect, useMemo, useState } from "react";
import type { DispatchOrderForm, DispatchOrderWithVehicles, DispatchReferenceOption, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { calculateEstimatedTrips, emptyDispatchOrderForm } from "./dispatchUtils";

type DispatchRegisterProps = {
  vendors: DispatchReferenceOption[];
  items: DispatchReferenceOption[];
  vehicles: DispatchVehicle[];
  editingOrder: DispatchOrderWithVehicles | null;
  saving: boolean;
  onSave: (form: DispatchOrderForm) => Promise<boolean>;
  onCancelEdit: () => void;
};

export default function DispatchRegister({ vendors, items, vehicles, editingOrder, saving, onSave, onCancelEdit }: DispatchRegisterProps) {
  const [form, setForm] = useState<DispatchOrderForm>(emptyDispatchOrderForm);
  const [error, setError] = useState("");
  const estimatedTrips = calculateEstimatedTrips(form.total_volume, form.volume_per_trip);
  const selectableVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.active || form.vehicle_ids.includes(vehicle.id)), [vehicles, form.vehicle_ids]);

  useEffect(() => {
    if (!editingOrder) return setForm(emptyDispatchOrderForm());
    setForm({
      id: editingOrder.id,
      dispatch_date: editingOrder.dispatch_date,
      vendor_id: editingOrder.vendor_id || "",
      loading_location: editingOrder.loading_location,
      unloading_location: editingOrder.unloading_location,
      item_id: editingOrder.item_id || "",
      total_volume: String(editingOrder.total_volume),
      volume_per_trip: String(editingOrder.volume_per_trip),
      status: editingOrder.status,
      memo: editingOrder.memo,
      vehicle_ids: [...editingOrder.vehicle_ids],
    });
    setError("");
  }, [editingOrder]);

  const toggleVehicle = (id: string) => setForm((current) => ({ ...current, vehicle_ids: current.vehicle_ids.includes(id) ? current.vehicle_ids.filter((vehicleId) => vehicleId !== id) : [...current.vehicle_ids, id] }));

  const submit = async () => {
    if (!form.dispatch_date) return setError("배차 날짜를 선택하세요.");
    if (!form.vendor_id) return setError("거래처를 선택하세요.");
    if (!form.loading_location.trim()) return setError("상차지를 입력하세요.");
    if (!form.unloading_location.trim()) return setError("하차지를 입력하세요.");
    if (!form.item_id) return setError("품목을 선택하세요.");
    if (!estimatedTrips) return setError("총 물량과 1대 기준 물량을 확인하세요.");
    setError("");
    const saved = await onSave(form);
    if (saved) setForm(emptyDispatchOrderForm());
  };

  return (
    <section className="dispatch-panel">
      <div className="dispatch-section-head"><div><h2>{form.id ? "배차 수정" : "신규 배차등록"}</h2><p>25.5톤 덤프 기준 배차를 등록합니다.</p></div>{form.id && <span className="dispatch-editing-pill">수정 중</span>}</div>
      <div className="dispatch-form-grid order-form-grid">
        <label><span>날짜 *</span><input type="date" value={form.dispatch_date} onChange={(event) => setForm({ ...form, dispatch_date: event.target.value })} /></label>
        <label><span>거래처 *</span><select value={form.vendor_id} onChange={(event) => setForm({ ...form, vendor_id: event.target.value })}><option value="">거래처 선택</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.code ? ` · ${vendor.code}` : ""}</option>)}</select></label>
        <label><span>품목 *</span><select value={form.item_id} onChange={(event) => setForm({ ...form, item_id: event.target.value })}><option value="">품목 선택</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.spec ? ` · ${item.spec}` : ""}</option>)}</select></label>
        <label><span>상차지 *</span><input value={form.loading_location} onChange={(event) => setForm({ ...form, loading_location: event.target.value })} placeholder="상차지 입력" /></label>
        <label><span>하차지 *</span><input value={form.unloading_location} onChange={(event) => setForm({ ...form, unloading_location: event.target.value })} placeholder="하차지 입력" /></label>
        <label><span>총 물량(루베) *</span><input inputMode="decimal" value={form.total_volume} onChange={(event) => setForm({ ...form, total_volume: event.target.value })} placeholder="340" /></label>
        <label><span>1대 기준(루베) *</span><input inputMode="decimal" value={form.volume_per_trip} onChange={(event) => setForm({ ...form, volume_per_trip: event.target.value })} placeholder="17" /></label>
        <label><span>예상 운행대수</span><input value={estimatedTrips ? `${estimatedTrips}대` : "-"} readOnly /></label>
        <label><span>상태</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DispatchOrderForm["status"] })}>{DISPATCH_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="dispatch-wide"><span>메모</span><input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="배차 관련 메모" /></label>
      </div>

      <div className="dispatch-vehicle-picker">
        <div><strong>차량 배정</strong><span>선택 {form.vehicle_ids.length}대 / 예상 {estimatedTrips}대</span></div>
        <div className="dispatch-vehicle-options">
          {!selectableVehicles.length ? <p className="dispatch-empty">사용 가능한 차량이 없습니다. 차량관리에서 먼저 등록하세요.</p> : selectableVehicles.map((vehicle) => (
            <label key={vehicle.id} className={form.vehicle_ids.includes(vehicle.id) ? "selected" : ""}><input type="checkbox" checked={form.vehicle_ids.includes(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} /><b>{vehicle.vehicle_number}</b>{!vehicle.active && <small>미사용</small>}</label>
          ))}
        </div>
      </div>
      {error && <p className="dispatch-error">{error}</p>}
      <div className="dispatch-actions">
        {form.id && <button type="button" onClick={() => { onCancelEdit(); setForm(emptyDispatchOrderForm()); }}>수정 취소</button>}
        <button type="button" className="dispatch-primary" disabled={saving} onClick={submit}>{saving ? "저장 중..." : form.id ? "배차 수정 저장" : "배차 등록"}</button>
      </div>
    </section>
  );
}
