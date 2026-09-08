import { useState } from "react";
import type { DispatchCustomer, DispatchLocation, DispatchLocationType } from "./dispatchTypes";
import { DISPATCH_LOCATION_TYPES } from "./dispatchTypes";

type DispatchBasicsProps = {
  customers: DispatchCustomer[];
  locations: DispatchLocation[];
  saving: boolean;
  onSaveCustomer: (customer: DispatchCustomer) => Promise<boolean>;
  onSaveLocation: (location: DispatchLocation) => Promise<boolean>;
};

const emptyCustomer = (): DispatchCustomer => ({ id: "", name: "", active: true, memo: "" });
const emptyLocation = (): DispatchLocation => ({ id: "", name: "", location_type: "공용", active: true, memo: "" });

export default function DispatchBasics({ customers, locations, saving, onSaveCustomer, onSaveLocation }: DispatchBasicsProps) {
  const [tab, setTab] = useState<"customer" | "location">("customer");
  const [customerForm, setCustomerForm] = useState<DispatchCustomer>(emptyCustomer);
  const [locationForm, setLocationForm] = useState<DispatchLocation>(emptyLocation);
  const [error, setError] = useState("");

  const submitCustomer = async () => {
    const name = customerForm.name.trim();
    if (!name) return setError("거래처명을 입력하세요.");
    setError("");
    if (await onSaveCustomer({ ...customerForm, name, memo: customerForm.memo.trim() })) setCustomerForm(emptyCustomer());
  };

  const submitLocation = async () => {
    const name = locationForm.name.trim();
    if (!name) return setError("장소명을 입력하세요.");
    setError("");
    if (await onSaveLocation({ ...locationForm, name, memo: locationForm.memo.trim() })) setLocationForm(emptyLocation());
  };

  return (
    <section className="dispatch-panel">
      <div className="dispatch-section-head"><div><h2>배차 기초관리</h2><p>구매 거래처와 분리된 덤프 거래처 및 자주 쓰는 장소를 관리합니다.</p></div></div>
      <div className="dispatch-basic-tabs">
        <button type="button" className={tab === "customer" ? "active" : ""} onClick={() => { setTab("customer"); setError(""); }}>거래처</button>
        <button type="button" className={tab === "location" ? "active" : ""} onClick={() => { setTab("location"); setError(""); }}>장소</button>
      </div>

      {tab === "customer" ? (
        <>
          <div className="dispatch-form-grid dispatch-basic-form">
            <label><span>거래처명 *</span><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="예: 유진세종" /></label>
            <label><span>상태</span><select value={customerForm.active ? "active" : "inactive"} onChange={(event) => setCustomerForm({ ...customerForm, active: event.target.value === "active" })}><option value="active">사용</option><option value="inactive">미사용</option></select></label>
            <label className="dispatch-wide"><span>메모</span><input value={customerForm.memo} onChange={(event) => setCustomerForm({ ...customerForm, memo: event.target.value })} placeholder="거래처 관련 메모" /></label>
          </div>
          {error && <p className="dispatch-error">{error}</p>}
          <div className="dispatch-actions">{customerForm.id && <button type="button" onClick={() => setCustomerForm(emptyCustomer())}>수정 취소</button>}<button type="button" className="dispatch-primary" disabled={saving} onClick={submitCustomer}>{saving ? "저장 중..." : customerForm.id ? "수정 저장" : "거래처 등록"}</button></div>
          <div className="dispatch-table-wrap"><table className="dispatch-table"><thead><tr><th>거래처명</th><th>상태</th><th>메모</th><th>관리</th></tr></thead><tbody>
            {!customers.length ? <tr><td colSpan={4} className="dispatch-empty">등록된 배차 거래처가 없습니다.</td></tr> : customers.map((customer) => <tr key={customer.id}><td className="dispatch-strong">{customer.name}</td><td><span className={`dispatch-active-pill ${customer.active ? "on" : "off"}`}>{customer.active ? "사용" : "미사용"}</span></td><td>{customer.memo || "-"}</td><td><button type="button" onClick={() => { setCustomerForm({ ...customer }); setError(""); }}>수정</button></td></tr>)}
          </tbody></table></div>
        </>
      ) : (
        <>
          <div className="dispatch-form-grid dispatch-basic-form">
            <label><span>장소명 *</span><input value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} placeholder="예: 세종 야적장" /></label>
            <label><span>장소 구분</span><select value={locationForm.location_type} onChange={(event) => setLocationForm({ ...locationForm, location_type: event.target.value as DispatchLocationType })}>{DISPATCH_LOCATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label><span>상태</span><select value={locationForm.active ? "active" : "inactive"} onChange={(event) => setLocationForm({ ...locationForm, active: event.target.value === "active" })}><option value="active">사용</option><option value="inactive">미사용</option></select></label>
            <label><span>메모</span><input value={locationForm.memo} onChange={(event) => setLocationForm({ ...locationForm, memo: event.target.value })} placeholder="장소 관련 메모" /></label>
          </div>
          {error && <p className="dispatch-error">{error}</p>}
          <div className="dispatch-actions">{locationForm.id && <button type="button" onClick={() => setLocationForm(emptyLocation())}>수정 취소</button>}<button type="button" className="dispatch-primary" disabled={saving} onClick={submitLocation}>{saving ? "저장 중..." : locationForm.id ? "수정 저장" : "장소 등록"}</button></div>
          <div className="dispatch-table-wrap"><table className="dispatch-table"><thead><tr><th>장소명</th><th>구분</th><th>상태</th><th>메모</th><th>관리</th></tr></thead><tbody>
            {!locations.length ? <tr><td colSpan={5} className="dispatch-empty">등록된 배차 장소가 없습니다.</td></tr> : locations.map((location) => <tr key={location.id}><td className="dispatch-strong">{location.name}</td><td>{location.location_type}</td><td><span className={`dispatch-active-pill ${location.active ? "on" : "off"}`}>{location.active ? "사용" : "미사용"}</span></td><td>{location.memo || "-"}</td><td><button type="button" onClick={() => { setLocationForm({ ...location }); setError(""); }}>수정</button></td></tr>)}
          </tbody></table></div>
        </>
      )}
    </section>
  );
}
