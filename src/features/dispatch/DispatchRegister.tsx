import { useEffect, useMemo, useState } from "react";
import DispatchCombobox from "./DispatchCombobox";
import type { DispatchAssignmentForm, DispatchCustomer, DispatchDriver, DispatchItem, DispatchLocation, DispatchOrderForm, DispatchOrderWithVehicles, DispatchVehicle } from "./dispatchTypes";
import { DISPATCH_STATUSES } from "./dispatchTypes";
import { calculateEstimatedTrips, emptyDispatchOrderForm, normalizeCompanyName } from "./dispatchUtils";

type DispatchRegisterProps = {
  customers: DispatchCustomer[];
  locations: DispatchLocation[];
  items: DispatchItem[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  editingOrder: DispatchOrderWithVehicles | null;
  saving: boolean;
  onSave: (form: DispatchOrderForm) => Promise<boolean>;
  onCancelEdit: () => void;
};

const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const emptyAssignment = (): DispatchAssignmentForm => ({ company_name: "", vehicle_id: "", driver_id: "" });

export default function DispatchRegister({ customers, locations, items, vehicles, drivers, editingOrder, saving, onSave, onCancelEdit }: DispatchRegisterProps) {
  const [form, setForm] = useState<DispatchOrderForm>(emptyDispatchOrderForm);
  const [error, setError] = useState("");
  const estimatedTrips = calculateEstimatedTrips(form.total_volume, form.volume_per_trip);
  const customerOptions = useMemo(() => customers.filter((customer) => customer.active || customer.id === form.vendor_id).map((customer) => ({ id: customer.id, name: customer.name, detail: customer.memo })), [customers, form.vendor_id]);
  const loadingOptions = useMemo(() => locations.filter((location) => location.active && (location.location_type === "상차지" || location.location_type === "공용")).map((location) => ({ id: location.id, name: location.name, detail: location.location_type })), [locations]);
  const unloadingOptions = useMemo(() => locations.filter((location) => location.active && (location.location_type === "하차지" || location.location_type === "공용")).map((location) => ({ id: location.id, name: location.name, detail: location.location_type })), [locations]);
  const itemOptions = useMemo(() => items.filter((item) => item.active || item.id === form.item_id).map((item) => ({ id: item.id, name: item.name, detail: item.memo })), [items, form.item_id]);
  const companyOptions = useMemo(() => [...new Set([...vehicles, ...drivers].map((item) => normalizeCompanyName(item.company_name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko-KR")), [vehicles, drivers]);
  const isNewCustomer = !!form.vendor_name.trim() && !customers.some((customer) => normalizedName(customer.name) === normalizedName(form.vendor_name));
  const isNewLoadingLocation = !!form.loading_location.trim() && !locations.some((location) => normalizedName(location.name) === normalizedName(form.loading_location));
  const isNewUnloadingLocation = !!form.unloading_location.trim() && !locations.some((location) => normalizedName(location.name) === normalizedName(form.unloading_location));
  const isNewItem = !!form.item_name.trim() && !items.some((item) => normalizedName(item.name) === normalizedName(form.item_name));

  useEffect(() => {
    if (!editingOrder) return setForm(emptyDispatchOrderForm());
    const assignments = editingOrder.assignments?.length
      ? editingOrder.assignments.map((assignment) => {
        const vehicle = vehicles.find((item) => item.id === assignment.vehicle_id);
        const legacyDriver = assignment.driver_id ? null : drivers.find((item) => item.assigned_vehicle_id === assignment.vehicle_id && item.active);
        const driver = drivers.find((item) => item.id === assignment.driver_id) || legacyDriver;
        return { company_name: normalizeCompanyName(vehicle?.company_name || driver?.company_name || ""), vehicle_id: assignment.vehicle_id, driver_id: driver?.id || "" };
      })
      : editingOrder.vehicle_ids.map((vehicleId) => {
        const vehicle = vehicles.find((item) => item.id === vehicleId);
        const driver = drivers.find((item) => item.assigned_vehicle_id === vehicleId && item.active);
        return { company_name: normalizeCompanyName(vehicle?.company_name || driver?.company_name || ""), vehicle_id: vehicleId, driver_id: driver?.id || "" };
      });
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
      vehicle_ids: assignments.map((assignment) => assignment.vehicle_id).filter(Boolean),
      assignments,
    });
    setError("");
  }, [editingOrder, vehicles, drivers]);

  const updateAssignments = (nextAssignments: DispatchAssignmentForm[]) => setForm((current) => ({ ...current, assignments: nextAssignments, vehicle_ids: nextAssignments.map((assignment) => assignment.vehicle_id).filter(Boolean) }));

  const updateAssignment = (index: number, patch: Partial<DispatchAssignmentForm>) => {
    const next = form.assignments.map((assignment, assignmentIndex) => {
      if (assignmentIndex !== index) return assignment;
      const updated = { ...assignment, ...patch };
      if (patch.company_name !== undefined) {
        updated.vehicle_id = "";
        updated.driver_id = "";
      }
      if (patch.vehicle_id !== undefined) {
        const vehicle = vehicles.find((item) => item.id === patch.vehicle_id);
        if (vehicle?.company_name) {
          updated.company_name = normalizeCompanyName(vehicle.company_name);
          const driver = drivers.find((item) => item.id === updated.driver_id);
          if (driver && normalizeCompanyName(driver.company_name) !== updated.company_name) updated.driver_id = "";
        }
      }
      if (patch.driver_id !== undefined) {
        const driver = drivers.find((item) => item.id === patch.driver_id);
        if (driver?.company_name) {
          updated.company_name = normalizeCompanyName(driver.company_name);
          const vehicle = vehicles.find((item) => item.id === updated.vehicle_id);
          if (vehicle && normalizeCompanyName(vehicle.company_name) !== updated.company_name) updated.vehicle_id = "";
        }
      }
      return updated;
    });
    updateAssignments(next);
  };

  const vehicleOptionsForCompany = (company: string, currentId: string) => {
    const normalizedCompany = normalizeCompanyName(company);
    return vehicles.filter((vehicle) => (vehicle.active || vehicle.id === currentId) && (!normalizedCompany || normalizeCompanyName(vehicle.company_name) === normalizedCompany));
  };

  const driverOptionsForCompany = (company: string, currentId: string) => {
    const normalizedCompany = normalizeCompanyName(company);
    return drivers.filter((driver) => (driver.active || driver.id === currentId) && (!normalizedCompany || normalizeCompanyName(driver.company_name) === normalizedCompany));
  };

  const submit = async () => {
    if (!form.dispatch_date) return setError("배차 날짜를 선택하세요.");
    if (!form.vendor_name.trim()) return setError("거래처를 입력하세요.");
    if (!form.loading_location.trim()) return setError("상차지를 입력하세요.");
    if (!form.unloading_location.trim()) return setError("하차지를 입력하세요.");
    if (!form.item_name.trim()) return setError("품목을 입력하세요.");
    if (!estimatedTrips) return setError("총 물량과 1회 기준 물량을 확인하세요.");
    if (!form.assignments.length) return setError("업체·차량·기사를 최소 1건 선택하세요.");
    const seenVehicles = new Set<string>();
    for (const assignment of form.assignments) {
      if (!assignment.company_name || !assignment.vehicle_id || !assignment.driver_id) return setError("업체·차량·기사를 모두 선택하세요.");
      if (seenVehicles.has(assignment.vehicle_id)) return setError("같은 차량을 한 배차에 중복 배정할 수 없습니다.");
      seenVehicles.add(assignment.vehicle_id);
      const vehicle = vehicles.find((item) => item.id === assignment.vehicle_id);
      const driver = drivers.find((item) => item.id === assignment.driver_id);
      if (!vehicle || !driver) return setError("선택한 차량 또는 기사를 다시 확인하세요.");
      const vehicleCompany = normalizeCompanyName(vehicle.company_name);
      const driverCompany = normalizeCompanyName(driver.company_name);
      if ((vehicleCompany || driverCompany) && vehicleCompany !== driverCompany) return setError("같은 업체의 차량과 기사만 배정할 수 있습니다.");
    }
    setError("");
    const saved = await onSave({ ...form, vehicle_ids: form.assignments.map((assignment) => assignment.vehicle_id) });
    if (saved) setForm(emptyDispatchOrderForm());
  };

  return (
    <section className="dispatch-panel">
      <div className="dispatch-section-head"><div><h2>{form.id ? "배차 수정" : "신규 배차등록"}</h2><p>업체를 먼저 선택하면 같은 업체의 차량과 기사만 표시됩니다.</p></div>{form.id && <span className="dispatch-editing-pill">수정 중</span>}</div>
      <div className="dispatch-form-grid order-form-grid">
        <label className="dispatch-field-date"><span>날짜 *</span><input type="date" value={form.dispatch_date} onChange={(event) => setForm({ ...form, dispatch_date: event.target.value })} /></label>
        <div className="dispatch-combobox-field dispatch-field-customer"><DispatchCombobox label="거래처" required value={form.vendor_name} options={customerOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, vendor_name: value, vendor_id: selectedId || "", save_vendor: selectedId ? false : form.save_vendor })} />{isNewCustomer && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_vendor} onChange={(event) => setForm({ ...form, save_vendor: event.target.checked })} />신규 거래처로 저장</label>}</div>
        <div className="dispatch-combobox-field dispatch-field-item"><DispatchCombobox label="품목" required value={form.item_name} options={itemOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, item_name: value, item_id: selectedId || "", save_item: selectedId ? false : form.save_item })} />{isNewItem && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_item} onChange={(event) => setForm({ ...form, save_item: event.target.checked })} />신규 품목으로 저장</label>}</div>
        <div className="dispatch-combobox-field dispatch-field-loading"><DispatchCombobox label="상차지" required value={form.loading_location} options={loadingOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, loading_location: value, save_loading_location: selectedId ? false : form.save_loading_location })} />{isNewLoadingLocation && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_loading_location} onChange={(event) => setForm({ ...form, save_loading_location: event.target.checked })} />상차지 목록에 저장</label>}</div>
        <div className="dispatch-combobox-field dispatch-field-unloading"><DispatchCombobox label="하차지" required value={form.unloading_location} options={unloadingOptions} placeholder="검색 또는 직접 입력" onChange={(value, selectedId) => setForm({ ...form, unloading_location: value, save_unloading_location: selectedId ? false : form.save_unloading_location })} />{isNewUnloadingLocation && <label className="dispatch-save-master"><input type="checkbox" checked={form.save_unloading_location} onChange={(event) => setForm({ ...form, save_unloading_location: event.target.checked })} />하차지 목록에 저장</label>}</div>
        <label className="dispatch-field-total"><span>총 물량(루베) *</span><input inputMode="decimal" value={form.total_volume} onChange={(event) => setForm({ ...form, total_volume: event.target.value })} placeholder="총 물량 입력" /></label>
        <label className="dispatch-field-per-trip"><span>1회 기준(루베) *</span><input inputMode="decimal" value={form.volume_per_trip} onChange={(event) => setForm({ ...form, volume_per_trip: event.target.value })} placeholder="17" /></label>
        <label className="dispatch-field-estimated"><span>예정 총 회차</span><input value={estimatedTrips ? `${estimatedTrips}회` : "-"} readOnly /></label>
        <label className="dispatch-field-status"><span>상태</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DispatchOrderForm["status"] })}>{DISPATCH_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="dispatch-wide dispatch-field-memo"><span>메모</span><input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="배차 관련 메모" /></label>
      </div>

      <div className="dispatch-assignment-picker">
        <div className="dispatch-assignment-picker-head"><div><strong>차량·기사 배정</strong><span>배정 {form.assignments.length}대 / 예정 총 {estimatedTrips}회 · 같은 업체끼리만 선택됩니다.</span></div><button type="button" className="dispatch-outline-button" onClick={() => updateAssignments([...form.assignments, emptyAssignment()])}>+ 배정 추가</button></div>
        {!form.assignments.length ? <p className="dispatch-empty">배차에 사용할 업체·차량·기사를 추가하세요.</p> : <div className="dispatch-assignment-rows">{form.assignments.map((assignment, index) => {
          const vehicleOptions = vehicleOptionsForCompany(assignment.company_name, assignment.vehicle_id);
          const driverOptions = driverOptionsForCompany(assignment.company_name, assignment.driver_id);
          return <div className="dispatch-assignment-row" key={`${index}-${assignment.vehicle_id}-${assignment.driver_id}`}>
            <label><span>업체</span><select value={assignment.company_name} onChange={(event) => updateAssignment(index, { company_name: event.target.value })}><option value="">업체 선택</option>{assignment.company_name && !companyOptions.includes(assignment.company_name) && <option value={assignment.company_name}>{assignment.company_name}</option>}{companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}</select></label>
            <label><span>차량번호</span><select value={assignment.vehicle_id} onChange={(event) => updateAssignment(index, { vehicle_id: event.target.value })} disabled={!assignment.company_name}><option value="">차량 선택</option>{vehicleOptions.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}{vehicle.active ? "" : " (미사용)"}</option>)}</select></label>
            <label><span>기사</span><select value={assignment.driver_id} onChange={(event) => updateAssignment(index, { driver_id: event.target.value })} disabled={!assignment.company_name}><option value="">기사 선택</option>{driverOptions.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.active ? "" : " (미사용)"}</option>)}</select></label>
            <button type="button" className="dispatch-assignment-remove" aria-label="배정 삭제" onClick={() => updateAssignments(form.assignments.filter((_, itemIndex) => itemIndex !== index))}>삭제</button>
          </div>;
        })}</div>}
      </div>
      {error && <p className="dispatch-error">{error}</p>}
      <div className="dispatch-actions">{form.id && <button type="button" onClick={() => { onCancelEdit(); setForm(emptyDispatchOrderForm()); }}>수정 취소</button>}<button type="button" className="dispatch-primary" disabled={saving} onClick={submit}>{saving ? "저장 중..." : form.id ? "배차 수정 저장" : "배차 등록"}</button></div>
    </section>
  );
}
