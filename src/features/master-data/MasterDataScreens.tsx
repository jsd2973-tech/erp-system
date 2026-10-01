import type { ComponentType, ReactNode } from "react";
import { Download, Pencil, Trash2, Upload, X } from "lucide-react";
import { cleanVendorImportText } from "./masterDataModel";
import type { MasterDataModule } from "./useMasterDataModule";
import "./masterData.css";

type SearchSelectProps = {
  label?: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
};
type ScreenAccess = { isAdmin: boolean; canEditDeleteRecords: boolean };
type SaveControls = {
  isSaving: (key: string) => boolean;
  runSave: (key: string, action: () => Promise<unknown> | unknown) => Promise<unknown>;
};

function Field({ label, children, required = false, className = "" }: {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return <div className={"field " + className.trim()}><label>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</label>{children}</div>;
}

function ScrollTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"scroll-table " + className.trim()}>{children}</div>;
}

const money = (value: number | string | undefined) => Number(value || 0).toLocaleString("ko-KR");

function SimpleVendorTable({ model, access }: {
  model: MasterDataModule["vendorScreen"];
  access: ScreenAccess;
}) {
  const { vendors, filteredVendors, onDelete, onEdit } = model;
  return (
    <>
    <ScrollTable className="basic-table-scroll">
      <table className="basic-vendor-table">
        <thead><tr><th>코드</th><th>상호</th><th>대표자</th><th>전화번호</th><th>모바일</th><th>주소</th><th>관리</th></tr></thead>
        <tbody>
          {filteredVendors.length ? filteredVendors.map((vendor) => (
            <tr key={vendor.id}>
              <td>{vendor.code}</td><td>{vendor.name}</td><td>{vendor.owner || "-"}</td>
              <td>{vendor.phone || "-"}</td><td>{vendor.mobile || "-"}</td>
              <td>{[vendor.address, vendor.address_detail].filter(Boolean).join(" ") || "-"}</td>
              <td>{access.canEditDeleteRecords ? <><button className="icon" onClick={() => onEdit(vendor)}><Pencil size={16} /></button><button className="icon" onClick={() => onDelete(vendor.id)}><Trash2 size={16} /></button></> : "-"}</td>
            </tr>
          )) : <tr><td colSpan={7} className="empty">{vendors.length ? "검색 결과가 없습니다." : "등록된 거래처가 없습니다."}</td></tr>}
        </tbody>
      </table>
    </ScrollTable>
    <div className="basic-mobile-list">
      {filteredVendors.length ? filteredVendors.map((vendor) => (
        <article className="basic-mobile-row basic-vendor-mobile-row" key={vendor.id}>
          <div className="basic-mobile-row-copy"><span>{vendor.code} · {vendor.owner || "대표자 미입력"}</span><strong>{vendor.name}</strong><small>{vendor.phone || vendor.mobile || "연락처 미입력"} · {[vendor.address, vendor.address_detail].filter(Boolean).join(" ") || "주소 미입력"}</small></div>
          {access.canEditDeleteRecords && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="거래처 수정" onClick={() => onEdit(vendor)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="거래처 삭제" onClick={() => onDelete(vendor.id)}><Trash2 size={16} /></button></div>}
        </article>
      )) : <div className="basic-mobile-empty">{vendors.length ? "검색 결과가 없습니다." : "등록된 거래처가 없습니다."}</div>}
    </div>
    </>
  );
}

export function VendorMasterScreen({ model, access, save }: {
  model: MasterDataModule["vendorScreen"];
  access: ScreenAccess;
  save: SaveControls;
}) {
  const { vendors, form, setForm, importMessage, editingId, search, setSearch, filteredVendors } = model;
  return (
    <section className="card basic-master-page basic-vendors-page">
      <header className="basic-page-header">
        <div className="basic-page-heading">
          <span className="basic-eyebrow">MASTER DATA</span>
          <h2>거래처등록</h2>
          <p>거래처 기본정보를 등록하고 관리합니다.</p>
        </div>
        <div className="basic-page-header-actions">
          <span className="basic-count-badge">{importMessage || (vendors.length + "개 거래처")}</span>
          <div className="vendor-import-actions">
            <div className="vendor-import-buttons">
              <button type="button" className="basic-download-button" onClick={model.onExport}><Download size={16} /> 거래처 엑셀 다운로드</button>
              <label className="upload basic-upload-button"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void model.onImport(file); }} /></label>
            </div>
            <small>이카운트는 상호로 연결하고, 코드·추가정보는 ERP 입력값을 우선합니다.</small>
          </div>
        </div>
      </header>

      <section className="basic-entry-panel">
        <div className="basic-panel-heading">
          <div><h3>{editingId ? "거래처 정보 수정" : "거래처 정보 입력"}</h3><p>코드와 상호를 입력한 뒤 필요한 추가정보를 함께 저장하세요.</p></div>
          {editingId && <span className="basic-edit-badge">수정 중</span>}
        </div>
        <div className="grid5 basic-form-grid vendor-register-grid">
          <Field label="거래처코드"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="거래처코드 직접 입력" /></Field>
          <Field label="상호"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="대표자"><input value={form.owner || ""} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></Field>
          <Field label="전화번호"><input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="모바일"><input value={form.mobile || ""} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></Field>
          <Field label="기본주소"><div className="vendor-address-input"><input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="주소 검색을 눌러 입력하세요" /><button type="button" onClick={model.onOpenAddressSearch}>주소 검색</button></div></Field>
          <Field label="상세주소"><input ref={model.addressDetailRef} value={form.address_detail || ""} onChange={(event) => setForm({ ...form, address_detail: event.target.value })} placeholder="건물명, 층, 호수 등" /></Field>
        </div>
        <div className="actions right-actions basic-form-actions">
          {access.isAdmin && <button className="primary" disabled={save.isSaving("vendor")} onClick={() => void save.runSave("vendor", model.onSave)}>{save.isSaving("vendor") ? "저장 중..." : editingId ? "수정 저장" : "저장"}</button>}
        </div>
      </section>

      <div className="basic-list-heading basic-vendors-list-heading">
        <div><h3>거래처 목록</h3><p>코드·상호·대표자·연락처·주소로 검색할 수 있습니다.</p></div>
        <div className="basic-list-controls">
          <div className="basic-search-input"><input placeholder="거래처코드 / 상호 / 대표자 / 연락처 / 주소 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <strong>{filteredVendors.length}건</strong>
        </div>
      </div>
      <SimpleVendorTable model={model} access={access} />
      {access.isAdmin && (
        <div className="basic-danger-zone">
          <div><strong>거래처 전체삭제</strong><span>등록된 거래처 {vendors.length}건을 모두 휴지통으로 이동합니다.</span></div>
          <button className="danger" disabled={save.isSaving("vendor") || !vendors.length} onClick={model.onClear}>전체삭제</button>
        </div>
      )}
    </section>
  );
}

export function WarehouseMasterScreen({ model, access, save, SearchSelect }: {
  model: MasterDataModule["warehouseScreen"];
  access: ScreenAccess;
  save: SaveControls;
  SearchSelect: ComponentType<SearchSelectProps>;
}) {
  const { groups, warehouses, groupForm, setGroupForm, warehouseForm, setWarehouseForm } = model;
  return (
    <section className="card basic-master-page basic-warehouse-page">
      <header className="basic-page-header">
        <div className="basic-page-heading">
          <span className="basic-eyebrow">MASTER DATA</span>
          <h2>창고등록</h2>
          <p>창고 대분류와 세부 창고를 한 곳에서 관리합니다.</p>
        </div>
        <span className="basic-count-badge">대분류 {groups.length}개 · 세부 {warehouses.length}개</span>
      </header>

      <div className="basic-split-grid">
        <section className="basic-entry-section">
          <div className="basic-panel-heading">
            <div><h3>대분류 창고</h3><p>창고의 상위 분류를 등록합니다.</p></div>
            {model.editingGroupId && <span className="basic-edit-badge">수정 중</span>}
          </div>
          <div className="basic-form-stack">
            <Field label="대분류 코드"><input value={groupForm.code} readOnly /></Field>
            <Field label="대분류 이름"><input value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /></Field>
            {access.isAdmin && <button className="primary basic-save-button" disabled={save.isSaving("group")} onClick={() => void save.runSave("group", model.onSaveGroup)}>{save.isSaving("group") ? "저장 중..." : model.editingGroupId ? "수정 저장" : "대분류 저장"}</button>}
          </div>
          <div className="basic-list-heading basic-list-heading-compact"><div><h4>대분류 목록</h4><p>등록된 상위 창고</p></div><strong>{groups.length}개</strong></div>
          <ScrollTable className="basic-table-scroll">
            <table><thead><tr><th>코드</th><th>이름</th><th>관리</th></tr></thead><tbody>
              {groups.length ? groups.map((group) => <tr key={group.id}><td>{group.code}</td><td>{group.name}</td><td>{access.isAdmin ? <><button className="icon" title="수정" aria-label="대분류 수정" onClick={() => model.onEditGroup(group)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="대분류 삭제" onClick={() => model.onDeleteGroup(group.id, group.name)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={3} className="empty">등록된 대분류가 없습니다.</td></tr>}
            </tbody></table>
          </ScrollTable>
          <div className="basic-mobile-list">
            {groups.length ? groups.map((group) => <article className="basic-mobile-row" key={group.id}><div className="basic-mobile-row-copy"><span>코드 {group.code}</span><strong>{group.name}</strong></div>{access.isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="대분류 수정" onClick={() => model.onEditGroup(group)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="대분류 삭제" onClick={() => model.onDeleteGroup(group.id, group.name)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">등록된 대분류가 없습니다.</div>}
          </div>
        </section>

        <section className="basic-entry-section">
          <div className="basic-panel-heading">
            <div><h3>세부 창고</h3><p>대분류에 연결할 실제 창고를 등록합니다.</p></div>
            {model.editingWarehouseId && <span className="basic-edit-badge">수정 중</span>}
          </div>
          <div className="basic-form-stack">
            <SearchSelect label="상위 분류" value={warehouseForm.group} options={groups.map((group) => group.name)} onChange={(value) => setWarehouseForm({ ...warehouseForm, group: value })} placeholder="크라샤 입력" />
            <Field label="세부 코드"><input value={warehouseForm.code} readOnly /></Field>
            <Field label="세부 이름"><input value={warehouseForm.name} onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })} /></Field>
            {access.isAdmin && <button className="primary basic-save-button" disabled={save.isSaving("warehouse")} onClick={() => void save.runSave("warehouse", model.onSaveWarehouse)}>{save.isSaving("warehouse") ? "저장 중..." : model.editingWarehouseId ? "수정 저장" : "세부 창고 저장"}</button>}
          </div>
          <div className="basic-list-heading basic-list-heading-compact"><div><h4>세부 창고 목록</h4><p>대분류별 실제 창고</p></div><strong>{warehouses.length}개</strong></div>
          <ScrollTable className="basic-table-scroll">
            <table><thead><tr><th>코드</th><th>대분류</th><th>창고명</th><th>관리</th></tr></thead><tbody>
              {warehouses.length ? warehouses.map((warehouse) => <tr key={warehouse.id}><td>{warehouse.code}</td><td>{warehouse.group}</td><td>{warehouse.name}</td><td>{access.isAdmin ? <><button className="icon" title="수정" aria-label="세부 창고 수정" onClick={() => model.onEditWarehouse(warehouse)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="세부 창고 삭제" onClick={() => model.onDeleteWarehouse(warehouse.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={4} className="empty">등록된 세부창고가 없습니다.</td></tr>}
            </tbody></table>
          </ScrollTable>
          <div className="basic-mobile-list">
            {warehouses.length ? warehouses.map((warehouse) => <article className="basic-mobile-row" key={warehouse.id}><div className="basic-mobile-row-copy"><span>{warehouse.group || "대분류 미지정"} · 코드 {warehouse.code}</span><strong>{warehouse.name}</strong></div>{access.isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="세부 창고 수정" onClick={() => model.onEditWarehouse(warehouse)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="세부 창고 삭제" onClick={() => model.onDeleteWarehouse(warehouse.id)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">등록된 세부 창고가 없습니다.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}

export function ItemMasterScreen({ model, access, save }: {
  model: MasterDataModule["itemScreen"];
  access: ScreenAccess;
  save: SaveControls;
}) {
  const { items, form, setForm, importMessage, editingId, search, setSearch, filteredItems } = model;
  return (
    <section className="card basic-master-page basic-items-page">
      <header className="basic-page-header">
        <div className="basic-page-heading">
          <span className="basic-eyebrow">MASTER DATA</span>
          <h2>품목등록</h2>
          <p>구매와 정비에서 사용할 품목·규격·단가를 관리합니다.</p>
        </div>
        <div className="basic-page-header-actions">
          <span className="basic-count-badge">{importMessage || (items.length + "개 품목")}</span>
          <label className="upload basic-upload-button"><Upload size={16} /> 품목 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void model.onImport(file); }} /></label>
        </div>
      </header>

      <section className="basic-entry-panel">
        <div className="basic-panel-heading">
          <div><h3>{editingId ? "품목 정보 수정" : "품목 정보 입력"}</h3><p>품목명과 단위, 입고단가를 입력해 등록하세요.</p></div>
          {editingId && <span className="basic-edit-badge">수정 중</span>}
        </div>
        <div className="grid5 basic-form-grid item-register-grid">
          <Field label="품목코드"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="품목명"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="규격정보"><input value={form.spec} onChange={(event) => setForm({ ...form, spec: event.target.value })} /></Field>
          <Field label="단위"><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field>
          <Field label="입고단가"><input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></Field>
        </div>
        <div className="actions right-actions basic-form-actions">
          {access.isAdmin && <button className="primary" disabled={save.isSaving("item")} onClick={() => void save.runSave("item", model.onSave)}>{save.isSaving("item") ? "저장 중..." : editingId ? "수정 저장" : "저장"}</button>}
        </div>
      </section>

      <div className="basic-list-heading basic-items-list-heading">
        <div><h3>품목 목록</h3><p>코드·품목명·규격·단위로 검색할 수 있습니다.</p></div>
        <div className="basic-list-controls"><div className="basic-search-input"><input placeholder="품목코드 / 품목명 / 규격 / 단위 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></div><strong>{filteredItems.length}건</strong></div>
      </div>
      <ScrollTable className="basic-table-scroll">
        <table><thead><tr><th>품목코드</th><th>품목명</th><th>규격정보</th><th>단위</th><th>입고단가</th><th>관리</th></tr></thead><tbody>
          {filteredItems.length ? filteredItems.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.spec || "-"}</td><td>{item.unit || "-"}</td><td className="right">{money(item.price)}</td><td>{access.isAdmin ? <><button className="icon" title="수정" aria-label="품목 수정" onClick={() => model.onEdit(item)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="품목 삭제" onClick={() => model.onDelete(item.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={6} className="empty">{search ? "검색 결과가 없습니다." : "등록된 품목이 없습니다."}</td></tr>}
        </tbody></table>
      </ScrollTable>
      <div className="basic-mobile-list">
        {filteredItems.length ? filteredItems.map((item) => <article className="basic-mobile-row basic-item-mobile-row" key={item.id}><div className="basic-mobile-row-copy"><span>{item.code} · {item.unit || "단위 미입력"}</span><strong>{item.name}</strong><small>{item.spec || "규격 없음"} · {money(item.price)}원</small></div>{access.isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="품목 수정" onClick={() => model.onEdit(item)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="품목 삭제" onClick={() => model.onDelete(item.id)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">{search ? "검색 결과가 없습니다." : "등록된 품목이 없습니다."}</div>}
      </div>
      {access.isAdmin && (
        <div className="basic-danger-zone">
          <div><strong>품목 전체삭제</strong><span>등록된 품목 {items.length}건을 모두 휴지통으로 이동합니다.</span></div>
          <button className="danger" disabled={save.isSaving("item") || !items.length} onClick={model.onClear}>전체삭제</button>
        </div>
      )}
    </section>
  );
}

export function MasterDataDialogs({ dialogs, save, placement = "root" }: {
  dialogs: MasterDataModule["dialogs"];
  save: SaveControls;
  placement?: "root" | "app";
}) {
  const addressSearch = dialogs.addressSearch;
  const ecountReview = dialogs.ecountReview;
  const newItem = dialogs.newItem;
  const review = ecountReview.value;
  const newItemOpen = newItem.state.open;

  return (
    <>
      {placement === "root" && addressSearch.open && (
        <div className="vendor-address-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) addressSearch.setOpen(false);
        }}>
          <div className="vendor-address-modal" role="dialog" aria-modal="true" aria-label="거래처 주소 검색">
            <div className="vendor-address-modal-head">
              <div><strong>주소 검색</strong><span>도로명 또는 지번주소를 검색하세요.</span></div>
              <button type="button" onClick={() => addressSearch.setOpen(false)} aria-label="주소 검색 닫기"><X size={18} /></button>
            </div>
            <div className="vendor-address-modal-body">
              {!addressSearch.ready && !addressSearch.error && <div className="vendor-address-modal-status">주소 검색 기능을 불러오는 중입니다...</div>}
              {addressSearch.error && (
                <div className="vendor-address-modal-status error">
                  <strong>주소 검색을 불러오지 못했습니다.</strong>
                  <span>{addressSearch.error}</span>
                  <button type="button" onClick={() => window.location.reload()}>다시 불러오기</button>
                </div>
              )}
              <div ref={addressSearch.containerRef} className={`vendor-address-embed${addressSearch.ready ? " ready" : ""}`} />
            </div>
          </div>
        </div>
      )}

      {placement === "app" && newItemOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h2>신규 품목 추가</h2>
            <div className="grid2">
              <Field label="품목코드" required><input value={newItem.form.code} onChange={(event) => newItem.setForm({ ...newItem.form, code: event.target.value })} autoFocus placeholder="예: 0001" /></Field>
              <Field label="품목명"><input value={newItem.form.name} onChange={(event) => newItem.setForm({ ...newItem.form, name: event.target.value })} /></Field>
              <Field label="규격정보"><input value={newItem.form.spec} onChange={(event) => newItem.setForm({ ...newItem.form, spec: event.target.value })} /></Field>
              <Field label="단위"><input value={newItem.form.unit} onChange={(event) => newItem.setForm({ ...newItem.form, unit: event.target.value })} placeholder="ea" /></Field>
              <Field label="입고단가"><input inputMode="decimal" value={newItem.form.price} onChange={(event) => newItem.setForm({ ...newItem.form, price: event.target.value })} placeholder="0" /></Field>
            </div>
            <div className="actions right-actions">
              <button disabled={save.isSaving("newItemModal")} onClick={newItem.onClose}>취소</button>
              <button className="primary" disabled={save.isSaving("newItemModal")} onClick={() => void save.runSave("newItemModal", newItem.onSave)}>{save.isSaving("newItemModal") ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {placement === "app" && review && (
        <div className="ecount-review-backdrop" onClick={() => { if (!ecountReview.importing) ecountReview.onDismiss(); }}>
          <div className="ecount-review-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ecount-review-head">
              <div>
                <span className="ecount-review-eyebrow">ECOUNT IMPORT</span>
                <h2>중복 거래처 선택</h2>
                <p>같은 상호가 여러 건입니다. 반영할 행에 체크하세요. 체크하지 않은 행은 이번 업로드에서 제외됩니다.</p>
              </div>
              <button type="button" onClick={ecountReview.onDismiss} disabled={ecountReview.importing}>닫기</button>
            </div>
            <div className="ecount-review-summary">
              <strong>{ecountReview.groupRowsByName(review.rows).length}개 중복 상호</strong>
              <span>ERP 코드와 일치하는 행이 자동 선택됩니다. 필요하면 선택을 바꿀 수 있습니다.</span>
            </div>
            <div className="ecount-review-list">
              {ecountReview.groupRowsByName(review.rows).map(([name, sameNameRows]) => {
                const nameMatches = review.currentVendors.filter((vendor) => cleanVendorImportText(vendor.name) === name);
                const erpVendor = nameMatches.length === 1 ? nameMatches[0] : null;
                return (
                  <div className="ecount-review-group" key={name}>
                    <div className="ecount-review-group-head">
                      <div><strong>{name}</strong><small>{erpVendor ? `ERP 코드 ${erpVendor.code} · ${erpVendor.owner || "대표자 미입력"}` : "ERP 거래처 없음 · 먼저 거래처등록 필요"}</small></div>
                      <span className={erpVendor ? "ecount-review-connected" : "ecount-review-unavailable"}>{erpVendor ? "ERP 연결됨" : "반영 불가"}</span>
                    </div>
                    <div className="ecount-review-choices">
                      {sameNameRows.map((row) => {
                        const rowKey = ecountReview.getRowKey(row);
                        const checked = ecountReview.selections[name] === rowKey;
                        const codeMatches = Boolean(erpVendor && cleanVendorImportText(row.code) === cleanVendorImportText(erpVendor.code));
                        return (
                          <label className={`ecount-review-row${checked ? " selected" : ""}${!erpVendor ? " unavailable" : ""}`} key={rowKey}>
                            <input type="checkbox" checked={checked} disabled={!erpVendor || ecountReview.importing} onChange={(event) => ecountReview.onSelect(name, rowKey, event.target.checked)} />
                            <span className="ecount-review-choice"><b>{row.code || "코드 없음"}</b><small>{[row.owner && `대표자 ${row.owner}`, row.address].filter(Boolean).join(" · ") || "추가정보 없음"}</small></span>
                            <em>{codeMatches ? "ERP 코드 일치" : erpVendor ? "코드 다름 · ERP 코드 유지" : "ERP 연결 불가"}</em>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ecount-review-actions">
              <span>체크 해제는 ERP 거래처 삭제가 아니라 이번 업로드에서 제외하는 것입니다.</span>
              <div>
                <button type="button" onClick={ecountReview.onDismiss} disabled={ecountReview.importing}>취소</button>
                <button type="button" className="primary" onClick={() => void ecountReview.onConfirm()} disabled={ecountReview.importing}>{ecountReview.importing ? "반영 중..." : "선택한 행 반영"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
