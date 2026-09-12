import MobileEditor from "./MobileEditor";
import { useState } from "react";
import type { DispatchVehicle } from "./dispatchTypes";
import { normalizeVehicleNumber } from "./dispatchUtils";

type VehicleManagementProps = {
  vehicles: DispatchVehicle[];
  saving: boolean;
  onSave: (vehicle: DispatchVehicle) => Promise<boolean>;
};

const emptyVehicle = (): DispatchVehicle => ({ id: "", vehicle_number: "", active: true, memo: "" });

export default function VehicleManagement({ vehicles, saving, onSave }: VehicleManagementProps) {
  const [form, setForm] = useState<DispatchVehicle>(emptyVehicle);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const submit = async () => {
    const vehicleNumber = normalizeVehicleNumber(form.vehicle_number);
    if (!vehicleNumber) return setError("차량번호를 입력하세요.");
    const duplicated = vehicles.some(
      (vehicle) => vehicle.id !== form.id && normalizeVehicleNumber(vehicle.vehicle_number).toLowerCase() === vehicleNumber.toLowerCase(),
    );
    if (duplicated) return setError("이미 등록된 차량번호입니다.");

    setError("");
    const saved = await onSave({ ...form, vehicle_number: vehicleNumber });
    if (saved) setForm(emptyVehicle());
  };

  return (
    <section className="dispatch-panel">
      <div className="dispatch-section-head">
        <div><h2>차량관리</h2><p>25.5톤 덤프트럭을 등록하고 사용 여부를 관리합니다.</p></div>
        <span className="dispatch-count">사용 {vehicles.filter((vehicle) => vehicle.active).length}대</span>
      </div>

      <MobileEditor open={editorOpen} onToggle={() => setEditorOpen(value => !value)} title={form.id ? "차량 상세·수정" : "차량 등록"}>
      <div className="dispatch-form-grid vehicle-form-grid">
        <label><span>차량번호 *</span><input value={form.vehicle_number} onChange={(event) => setForm({ ...form, vehicle_number: event.target.value })} placeholder="110가1234" /></label>
        <label><span>상태</span><select value={form.active ? "active" : "inactive"} onChange={(event) => setForm({ ...form, active: event.target.value === "active" })}><option value="active">사용</option><option value="inactive">미사용</option></select></label>
        <label className="dispatch-wide"><span>메모</span><input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="차량 관련 메모" /></label>
      </div>
      {error && <p className="dispatch-error">{error}</p>}
      <div className="dispatch-actions">
        {form.id && <button type="button" onClick={() => { setForm(emptyVehicle()); setError(""); }}>수정 취소</button>}
        <button type="button" className="dispatch-primary" disabled={saving} onClick={submit}>{saving ? "저장 중..." : form.id ? "수정 저장" : "차량 등록"}</button>
      </div>

      </MobileEditor>
      <div className="dispatch-table-wrap">
        <table className="dispatch-record-table dispatch-table">
          <thead><tr><th>차량번호</th><th>차종</th><th>상태</th><th>메모</th><th>관리</th></tr></thead>
          <tbody>
            {!vehicles.length ? <tr><td colSpan={5} className="dispatch-empty">등록된 차량이 없습니다.</td></tr> : vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td data-label="차량번호" className="dispatch-strong">{vehicle.vehicle_number}</td><td data-label="차종">25.5톤 덤프</td>
                <td data-label="상태"><span className={`dispatch-active-pill ${vehicle.active ? "on" : "off"}`}>{vehicle.active ? "사용" : "미사용"}</span></td>
                <td data-label="메모">{vehicle.memo || "-"}</td>
                <td data-label="관리"><button type="button" onClick={() => { setEditorOpen(true); setForm({ ...vehicle }); setError(""); }}>수정</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

