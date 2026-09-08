import { useEffect, useMemo, useState } from "react";
import DispatchCombobox from "./DispatchCombobox";
import type { DispatchCustomer, DispatchItem, DispatchLocation, DispatchOrderForm, DispatchOrderWithVehicles, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { calculateEstimatedTrips, emptyDispatchOrderForm } from "./dispatchUtils";

type DispatchRegisterProps = {
  customers: DispatchCustomer[];
  locations: DispatchLocation[];
  items: DispatchItem[];
  vehicles: DispatchVehicle[];
  editingOrder: DispatchOrderWithVehicles | null;
  saving: boolean;
  onSave: (form: DispatchOrderForm) => Promise<boolean>;
  onCancelEdit: () => void;
};

const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

export default function DispatchRegister({ customers, locations, items, vehicles, editingOrder, saving, onSave, onCancelEdit }: DispatchRegisterProps) {
  const [form, setForm] = useState<DispatchOrderForm>(emptyDispatchOrderForm);
  const [error, setError] = useState("");
  const estimatedTrips = calculateEstimatedTrips(form.total_volume, form.volume_per_trip);
  const selectableVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.active || form.vehicle_ids.includes(vehicle.id)), [vehicles, form.vehicle_ids]);
  const customerOptions = useMemo(() => customers.filter((customer) => customer.active || customer.id === form.vendor_id).map((customer) => ({ id: customer.id, name: customer.name, detail: customer.memo })), [customers, form.vendor_id]);
  const loadingOptions = useMemo(() => locations.filter((location) => location.active && (location.location_type === "상차지" || location.location_type === "공용")).map((location) => ({ id: location.id, name: location.name, detail: location.location_type })), [locations]);
  const unloadingOptions = useMemo(() => locations.filter((location) => location.active && (location.location_type === "하차지" || location.location_type === "공용")).map((location) => ({ id: location.id, name: location.name, detail: location.location_type })), [locations]);
  const itemOptions = useMemo(() => items.filter((item) => item.active || item.id === form.item_id).map((item) => ({ id: item.id, name: item.name, detail: item.memo })), [items, form.item_id]);
  const isNewCustomer = !!form.vendor_name.trim() && !customers.some((customer) => normalizedName(customer.name) === normalizedName(form.vendor_name));
  const isNewLoadingLocation = !!form.loading_location.trim() && !locations.some((location) => normalizedName(location.name) === normalizedName(form.loading_location));
  const isNewUnloadingLocation = !!form.unloading_location.trim() && !locations.some((location) => normalizedName(location.name) === normalizedName(form.unloading_location));
  const isNewItem = !!form.item_name.trim() && !items.some((item) => normalizedName(item.name) === normalizedName(form.item_name));

  useEffect(() => {
    if (!editingOrder) return setForm(emptyDispatchOrderForm());
    setForm({
      id: editingOrder.id,
      dispatch_date: editingOrder.dispatch_date,
      vendor_id: editingOrder.vendor_id || "",
      vendor_name: editingOrder.vendor_name,
      save_vendor: false,
      loading_location: editingOrder.loading_location,
      save_loading_location: false,
      unloading_location: editingOrder.unloading_location,
      save_unloading_location: false,
      item_id: editingOrder.item_id || "",
      item_name: editingOrder.item_name,
      save_item: false,
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
    if (!form.vendor_name.trim()) return setError("거래처를 입력하세요.");
    if (!form.loading_location.trim()) return setError("상차지를 입력하세요.");
    if (!form.unloading_location.trim()) return setError("하차지를 입력하세요.");
    if (!form.item_name.trim()) return setError("품목을 입력하세요.");
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
        <div className="dispatch-combobox-field">
          <DispatchCombobox label="거래처" required value={form.vendor_name} options={customerOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, vendor_name: value, vendor_id: selectedId || "", save_vendor: selectedId ? false : form.save_vendor })} />
          {isNewCustomer && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_vendor} onChange={(event) => setForm({ ...form, save_vendor: event.target.checked })} />신규 거래처로 저장</label>}
        </div>
        <div className="dispatch-combobox-field">
          <DispatchCombobox label="품목" required value={form.item_name} options={itemOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, item_name: value, item_id: selectedId || "", save_item: selectedId ? false : form.save_item })} />
          {isNewItem && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_item} onChange={(event) => setForm({ ...form, save_item: event.target.checked })} />신규 품목으로 저장</label>}
        </div>
        <div className="dispatch-combobox-field">
          <DispatchCombobox label="상차지" required value={form.loading_location} options={loadingOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, loading_location: value, save_loading_location: selectedId ? false : form.save_loading_location })} />
          {isNewLoadingLocation && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_loading_location} onChange={(event) => setForm({ ...form, save_loading_location: event.target.checked })} />상차지 목록에 저장</label>}
        </div>
        <div className="dispatch-combobox-field">
          <DispatchCombobox label="하차지" required value={form.unloading_location} options={unloadingOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, unloading_location: value, save_unloading_location: selectedId ? false : form.save_unloading_location })} />
          {isNewUnloadingLocation && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_unloading_location} onChange={(event) => setForm({ ...form, save_unloading_location: event.target.checked })} />하차지 목록에 저장</label>}
        </div>
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
