import { useState } from "react";
import { toLoginEmail } from "../../authLogin";
import type { DispatchDriver, DispatchVehicle } from "./dispatchTypes";

type DriverManagementProps = {
  drivers: DispatchDriver[];
  vehicles: DispatchVehicle[];
  saving: boolean;
  onSave: (driver: DispatchDriver) => Promise<boolean>;
};

const emptyDriver = (): DispatchDriver => ({ id: "", name: "", phone: "", assigned_vehicle_id: null, auth_user_id: null, active: true, memo: "" });

export default function DriverManagement({ drivers, vehicles, saving, onSave }: DriverManagementProps) {
  const [form, setForm] = useState<DispatchDriver>(emptyDriver);
  const [error, setError] = useState("");
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const internalLoginEmail = form.name.trim() ? toLoginEmail(form.name) : "";

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return setError("기사 이름을 입력하세요.");
    if (form.auth_user_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(form.auth_user_id)) return setError("Supabase Auth User UUID 형식을 확인하세요.");
    const vehicleConflict = form.active && form.assigned_vehicle_id
      ? drivers.find((driver) => driver.id !== form.id && driver.active && driver.assigned_vehicle_id === form.assigned_vehicle_id)
      : null;
    if (vehicleConflict) return setError(`이 차량은 활성 기사 ${vehicleConflict.name}님에게 이미 연결되어 있습니다.`);
    setError("");
    const saved = await onSave({ ...form, name, phone: form.phone.trim(), memo: form.memo.trim() });
    if (saved) setForm(emptyDriver());
  };

  return (
    <section className="dispatch-panel">
      <div className="dispatch-section-head">
        <div><h2>기사관리</h2><p>기사 기본정보와 현재 담당 차량, 로그인 연결을 관리합니다.</p></div>
        <span className="dispatch-count">근무 {drivers.filter((driver) => driver.active).length}명</span>
      </div>

      <div className="dispatch-form-grid driver-form-grid">
        <label><span>기사명 *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="기사 이름" /></label>
        <label><span>연락처</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="010-0000-0000" /></label>
        <label><span>담당 차량</span><select value={form.assigned_vehicle_id || ""} onChange={(event) => setForm({ ...form, assigned_vehicle_id: event.target.value || null })}><option value="">미지정</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}{vehicle.active ? "" : " (미사용)"}</option>)}</select></label>
        <label><span>Supabase 내부 로그인 계정</span><input value={internalLoginEmail} readOnly placeholder="기사명을 입력하면 자동 생성" /></label>
        <label><span>기사 로그인 User UUID</span><input value={form.auth_user_id || ""} onChange={(event) => setForm({ ...form, auth_user_id: event.target.value.trim() || null })} placeholder="Supabase Auth 사용자 UUID" /></label>
        <label><span>상태</span><select value={form.active ? "active" : "inactive"} onChange={(event) => setForm({ ...form, active: event.target.value === "active" })}><option value="active">사용</option><option value="inactive">미사용</option></select></label>
        <label className="dispatch-wide"><span>메모</span><input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="기사 관련 메모" /></label>
      </div>
      {form.name.trim() && <p className="permission-id-help">기사님은 로그인 화면에서 <b>{form.name.trim()}</b> 이름 그대로 입력합니다. 위 내부 계정은 Supabase Auth 계정 생성용입니다.</p>}
      {error && <p className="dispatch-error">{error}</p>}
      <div className="dispatch-actions">
        {form.id && <button type="button" onClick={() => { setForm(emptyDriver()); setError(""); }}>수정 취소</button>}
        <button type="button" className="dispatch-primary" disabled={saving} onClick={submit}>{saving ? "저장 중..." : form.id ? "수정 저장" : "기사 등록"}</button>
      </div>

      <div className="dispatch-table-wrap">
        <table className="dispatch-table">
          <thead><tr><th>기사명</th><th>연락처</th><th>담당 차량</th><th>로그인 연결</th><th>상태</th><th>메모</th><th>관리</th></tr></thead>
          <tbody>
            {!drivers.length ? <tr><td colSpan={7} className="dispatch-empty">등록된 기사가 없습니다.</td></tr> : drivers.map((driver) => (
              <tr key={driver.id}>
                <td className="dispatch-strong">{driver.name}</td><td>{driver.phone || "-"}</td><td>{driver.assigned_vehicle_id ? vehicleById.get(driver.assigned_vehicle_id)?.vehicle_number || "연결 차량 확인 필요" : "미지정"}</td>
                <td>{driver.auth_user_id ? <span className="dispatch-active-pill on">연결됨</span> : <span className="dispatch-active-pill off">미연결</span>}</td>
                <td><span className={`dispatch-active-pill ${driver.active ? "on" : "off"}`}>{driver.active ? "사용" : "미사용"}</span></td><td>{driver.memo || "-"}</td>
                <td><button type="button" onClick={() => { setForm({ ...driver }); setError(""); }}>수정</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}