from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
app = APP_PATH.read_text(encoding="utf-8")

MARKER = "/* ===== Basic Master Data: Clean Layout ===== */"
if MARKER in app:
    print("기초등록 공통 디자인 패치가 이미 적용되어 있습니다.")
    raise SystemExit(0)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label} 앵커를 정확히 1개 찾지 못했습니다: {count}개")
    return source.replace(old, new, 1)


def replace_menu_block(source: str, tab: str, next_tab: str, replacement: str) -> str:
    pattern = re.compile(
        rf'        \{{menuTab === "{re.escape(tab)}" && \(\n.*?\n        \)\}}(?P<next>\n\n        \{{menuTab === "{re.escape(next_tab)}" && \()',
        re.S,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise RuntimeError(f"{tab} 화면 블록을 정확히 1개 찾지 못했습니다: {len(matches)}개")
    return pattern.sub(lambda match: replacement + match.group("next"), source, count=1)


sections = r"""        {menuTab === "card_stats" && <CardUseStats cardUses={cardUses} />}

        {menuTab === "vendors" && (
          <section className="card basic-master-page basic-vendors-page">
            <header className="basic-page-header">
              <div className="basic-page-heading">
                <span className="basic-eyebrow">MASTER DATA</span>
                <h2>거래처등록</h2>
                <p>거래처 기본정보를 등록하고 관리합니다.</p>
              </div>
              <div className="basic-page-header-actions">
                <span className="basic-count-badge">{vendorImportMessage || `${vendors.length}개 거래처`}</span>
                <label className="upload basic-upload-button"><Upload size={16} /> 거래처 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])} /></label>
              </div>
            </header>

            <section className="basic-entry-panel">
              <div className="basic-panel-heading">
                <div>
                  <h3>{editingVendorId ? "거래처 정보 수정" : "거래처 정보 입력"}</h3>
                  <p>코드와 상호를 입력한 뒤 필요한 추가정보를 함께 저장하세요.</p>
                </div>
                {editingVendorId && <span className="basic-edit-badge">수정 중</span>}
              </div>
              <div className="grid5 basic-form-grid vendor-register-grid">
                <Field label="거래처코드"><input value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} placeholder="거래처코드 직접 입력" /></Field>
                <Field label="상호"><input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field>
                <Field label="대표자"><input value={vendorForm.owner} onChange={(e) => setVendorForm({ ...vendorForm, owner: e.target.value })} /></Field>
                <Field label="전화번호"><input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field>
                <Field label="모바일"><input value={vendorForm.mobile} onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} /></Field>
                <Field label="기본주소"><div className="vendor-address-input"><input value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} placeholder="주소 검색을 눌러 입력하세요" /><button type="button" onClick={openVendorAddressSearch}>주소 검색</button></div></Field>
                <Field label="상세주소"><input ref={vendorAddressDetailRef} value={vendorForm.address_detail} onChange={(e) => setVendorForm({ ...vendorForm, address_detail: e.target.value })} placeholder="건물명, 층, 호수 등" /></Field>
              </div>
              <div className="actions right-actions basic-form-actions">
                {isAdmin && <button disabled={isAuxiliarySaving("vendor")} onClick={clearVendors}>전체삭제</button>}
                {isAdmin && <button className="primary" disabled={isAuxiliarySaving("vendor")} onClick={() => runAuxiliarySave("vendor", saveVendor)}>{isAuxiliarySaving("vendor") ? "저장 중..." : editingVendorId ? "수정 저장" : "저장"}</button>}
              </div>
            </section>

            <div className="basic-list-heading">
              <div><h3>거래처 목록</h3><p>등록된 거래처의 코드와 연락처를 확인할 수 있습니다.</p></div>
              <strong>{vendors.length}개</strong>
            </div>
            <SimpleVendorTable vendors={vendors} deleteVendor={deleteVendor} editVendor={editVendor} isAdmin={canEditDeleteRecords} />
          </section>
        )}

        {menuTab === "warehouse_groups" && (
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
                  {editingGroupId && <span className="basic-edit-badge">수정 중</span>}
                </div>
                <div className="basic-form-stack">
                  <Field label="대분류 코드"><input value={groupForm.code} readOnly /></Field>
                  <Field label="대분류 이름"><input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></Field>
                  {isAdmin && <button className="primary basic-save-button" disabled={isAuxiliarySaving("group")} onClick={() => runAuxiliarySave("group", saveGroup)}>{isAuxiliarySaving("group") ? "저장 중..." : editingGroupId ? "수정 저장" : "대분류 저장"}</button>}
                </div>
                <div className="basic-list-heading basic-list-heading-compact"><div><h4>대분류 목록</h4><p>등록된 상위 창고</p></div><strong>{groups.length}개</strong></div>
                <ScrollTable className="basic-table-scroll">
                  <table><thead><tr><th>코드</th><th>이름</th><th>관리</th></tr></thead><tbody>
                    {groups.length ? groups.map((g) => <tr key={g.id}><td>{g.code}</td><td>{g.name}</td><td>{isAdmin ? <><button className="icon" title="수정" aria-label="대분류 수정" onClick={() => editGroup(g)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="대분류 삭제" onClick={() => deleteGroup(g.id, g.name)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={3} className="empty">등록된 대분류가 없습니다.</td></tr>}
                  </tbody></table>
                </ScrollTable>
                <div className="basic-mobile-list">
                  {groups.length ? groups.map((g) => <article className="basic-mobile-row" key={g.id}><div className="basic-mobile-row-copy"><span>코드 {g.code}</span><strong>{g.name}</strong></div>{isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="대분류 수정" onClick={() => editGroup(g)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="대분류 삭제" onClick={() => deleteGroup(g.id, g.name)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">등록된 대분류가 없습니다.</div>}
                </div>
              </section>

              <section className="basic-entry-section">
                <div className="basic-panel-heading">
                  <div><h3>세부 창고</h3><p>대분류에 연결할 실제 창고를 등록합니다.</p></div>
                  {editingWarehouseId && <span className="basic-edit-badge">수정 중</span>}
                </div>
                <div className="basic-form-stack">
                  <SearchSelect label="상위 분류" value={warehouseForm.group} options={groups.map((g) => g.name)} onChange={(v) => setWarehouseForm({ ...warehouseForm, group: v })} placeholder="크라샤 입력" />
                  <Field label="세부 코드"><input value={warehouseForm.code} readOnly /></Field>
                  <Field label="세부 이름"><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} /></Field>
                  {isAdmin && <button className="primary basic-save-button" disabled={isAuxiliarySaving("warehouse")} onClick={() => runAuxiliarySave("warehouse", saveWarehouse)}>{isAuxiliarySaving("warehouse") ? "저장 중..." : editingWarehouseId ? "수정 저장" : "세부 창고 저장"}</button>}
                </div>
                <div className="basic-list-heading basic-list-heading-compact"><div><h4>세부 창고 목록</h4><p>대분류별 실제 창고</p></div><strong>{warehouses.length}개</strong></div>
                <ScrollTable className="basic-table-scroll">
                  <table><thead><tr><th>코드</th><th>대분류</th><th>창고명</th><th>관리</th></tr></thead><tbody>
                    {warehouses.length ? warehouses.map((w) => <tr key={w.id}><td>{w.code}</td><td>{w.group}</td><td>{w.name}</td><td>{isAdmin ? <><button className="icon" title="수정" aria-label="세부 창고 수정" onClick={() => editWarehouse(w)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="세부 창고 삭제" onClick={() => deleteWarehouse(w.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={4} className="empty">등록된 세부 창고가 없습니다.</td></tr>}
                  </tbody></table>
                </ScrollTable>
                <div className="basic-mobile-list">
                  {warehouses.length ? warehouses.map((w) => <article className="basic-mobile-row" key={w.id}><div className="basic-mobile-row-copy"><span>{w.group || "대분류 미지정"} · 코드 {w.code}</span><strong>{w.name}</strong></div>{isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="세부 창고 수정" onClick={() => editWarehouse(w)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="세부 창고 삭제" onClick={() => deleteWarehouse(w.id)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">등록된 세부 창고가 없습니다.</div>}
                </div>
              </section>
            </div>
          </section>
        )}

        {menuTab === "items" && (
          <section className="card basic-master-page basic-items-page">
            <header className="basic-page-header">
              <div className="basic-page-heading">
                <span className="basic-eyebrow">MASTER DATA</span>
                <h2>품목등록</h2>
                <p>구매와 정비에서 사용할 품목·규격·단가를 관리합니다.</p>
              </div>
              <div className="basic-page-header-actions">
                <span className="basic-count-badge">{itemImportMessage || `${items.length}개 품목`}</span>
                <label className="upload basic-upload-button"><Upload size={16} /> 품목 엑셀 업로드<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && importItems(e.target.files[0])} /></label>
              </div>
            </header>

            <section className="basic-entry-panel">
              <div className="basic-panel-heading">
                <div>
                  <h3>{editingItemId ? "품목 정보 수정" : "품목 정보 입력"}</h3>
                  <p>품목명과 단위, 입고단가를 입력해 등록하세요.</p>
                </div>
                {editingItemId && <span className="basic-edit-badge">수정 중</span>}
              </div>
              <div className="grid5 basic-form-grid item-register-grid">
                <Field label="품목코드"><input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} /></Field>
                <Field label="품목명"><input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></Field>
                <Field label="규격정보"><input value={itemForm.spec} onChange={(e) => setItemForm({ ...itemForm, spec: e.target.value })} /></Field>
                <Field label="단위"><input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></Field>
                <Field label="입고단가"><input inputMode="decimal" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></Field>
              </div>
              <div className="actions right-actions basic-form-actions">
                {isAdmin && <button disabled={isAuxiliarySaving("item")} onClick={clearItems}>전체삭제</button>}
                {isAdmin && <button className="primary" disabled={isAuxiliarySaving("item")} onClick={() => runAuxiliarySave("item", saveItem)}>{isAuxiliarySaving("item") ? "저장 중..." : editingItemId ? "수정 저장" : "저장"}</button>}
              </div>
            </section>

            <div className="basic-list-heading basic-items-list-heading">
              <div><h3>품목 목록</h3><p>코드·품목명·규격·단위로 검색할 수 있습니다.</p></div>
              <div className="basic-list-controls"><div className="basic-search-input"><input placeholder="품목코드 / 품목명 / 규격 / 단위 검색" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /></div><strong>{filteredItems.length}건</strong></div>
            </div>
            <ScrollTable className="basic-table-scroll">
              <table><thead><tr><th>품목코드</th><th>품목명</th><th>규격정보</th><th>단위</th><th>입고단가</th><th>관리</th></tr></thead><tbody>
                {filteredItems.length ? filteredItems.map((it) => <tr key={it.id}><td>{it.code}</td><td>{it.name}</td><td>{it.spec || "-"}</td><td>{it.unit || "-"}</td><td className="right">{money(it.price)}</td><td>{isAdmin ? <><button className="icon" title="수정" aria-label="품목 수정" onClick={() => editItem(it)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="품목 삭제" onClick={() => deleteItem(it.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={6} className="empty">{itemSearch ? "검색 결과가 없습니다." : "등록된 품목이 없습니다."}</td></tr>}
              </tbody></table>
            </ScrollTable>
            <div className="basic-mobile-list">
              {filteredItems.length ? filteredItems.map((it) => <article className="basic-mobile-row basic-item-mobile-row" key={it.id}><div className="basic-mobile-row-copy"><span>{it.code} · {it.unit || "단위 미입력"}</span><strong>{it.name}</strong><small>{it.spec || "규격 없음"} · {money(it.price)}원</small></div>{isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="품목 수정" onClick={() => editItem(it)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="품목 삭제" onClick={() => deleteItem(it.id)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">{itemSearch ? "검색 결과가 없습니다." : "등록된 품목이 없습니다."}</div>}
            </div>
          </section>
        )}

        {menuTab === "maint_new" && (
          <section className="card">
            <div className="between">
              <h2>{editingMaintId ? "정비 수정" : "정비 등록"}</h2>
              <button onClick={() => setMaintTemplateOpen((value) => !value)}>이전 작업 불러오기</button>
            </div>

            {maintTemplateOpen && (
"""
section_marks = [
    '        {menuTab === "vendors" && (',
    '        {menuTab === "warehouse_groups" && (',
    '        {menuTab === "items" && (',
    '        {menuTab === "maint_new" && (',
]
section_positions = [sections.index(mark) for mark in section_marks]
vendor_block = sections[section_positions[0]:section_positions[1]].strip()
warehouse_block = sections[section_positions[1]:section_positions[2]].strip()
item_block = sections[section_positions[2]:section_positions[3]].strip()

# The Ecount patch runs immediately before this script and exposes the safe
# handler used below. Keep its review/import behavior while restyling only the
# surrounding basic-registration screen.
vendor_block = vendor_block.replace(
    'onChange={(e) => e.target.files?.[0] && importVendors(e.target.files[0])}',
    'onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void handleVendorExcelImport(file); }}',
    1,
)
vendor_block = vendor_block.replace(
    '<span className="basic-count-badge">{vendorImportMessage || `${vendors.length}개 거래처`}</span>\n                <label className="upload basic-upload-button">',
    '<span className="basic-count-badge">{vendorImportMessage || `${vendors.length}개 거래처`}</span>\n                <div className="vendor-import-actions">\n                  <label className="upload basic-upload-button">',
    1,
)
vendor_block = vendor_block.replace(
    '</label>\n              </div>\n            </header>\n\n            <section className="basic-entry-panel">',
    '</label>\n                  <small>이카운트는 상호로 연결하고, 코드·추가정보는 ERP 입력값을 우선합니다.</small>\n                </div>\n              </div>\n            </header>\n\n            <section className="basic-entry-panel">',
    1,
)

app = replace_menu_block(app, "vendors", "warehouse_groups", vendor_block)
app = replace_menu_block(app, "warehouse_groups", "items", warehouse_block)
app = replace_menu_block(app, "items", "maint_new", item_block)

home_start = """  return (
    <section className="card">
      <div className="between">
        <h2>생산라인 구성도</h2>"""
home_start_replacement = """  return (
    <section className="card basic-master-page basic-layout-page">
      <header className="basic-page-header basic-layout-header">
        <div className="basic-page-heading">
          <span className="basic-eyebrow">MASTER DATA</span>
          <h2>생산라인 구성도</h2>
          <p>생산라인별 정비 이력을 확인하고 클릭 영역을 관리합니다.</p>
        </div>"""
app = replace_once(app, home_start, home_start_replacement, "생산라인 시작 태그")

home_end = """        )}
      </div>

      {editLayout && ("""
home_end_replacement = """        )}
      </header>

      {editLayout && ("""
app = replace_once(app, home_end, home_end_replacement, "생산라인 종료 태그")

scroll_table_old = """function ScrollTable({ children }: { children: any }) {
  return <div className="scroll-table">{children}</div>;
}"""
scroll_table_new = """function ScrollTable({ children, className = "" }: { children: any; className?: string }) {
  return <div className={""" + chr(96) + """scroll-table ${className}""" + chr(96) + """.trim()}>{children}</div>;
}"""
app = replace_once(app, scroll_table_old, scroll_table_new, "공통 테이블 컴포넌트")

simple_vendor = r"""function SimpleVendorTable({ vendors, deleteVendor, editVendor, isAdmin }: any) {
  return (
    <>
      <ScrollTable className="basic-table-scroll">
        <table className="basic-vendor-table"><thead><tr><th>코드</th><th>상호</th><th>대표자</th><th>전화번호</th><th>모바일</th><th>주소</th><th>관리</th></tr></thead><tbody>
          {vendors.length ? vendors.map((v: Vendor) => <tr key={v.id}><td>{v.code}</td><td>{v.name}</td><td>{v.owner || "-"}</td><td>{v.phone || "-"}</td><td>{v.mobile || "-"}</td><td>{[v.address, v.address_detail].filter(Boolean).join(" ") || "-"}</td><td>{isAdmin ? <><button className="icon" title="수정" aria-label="거래처 수정" onClick={() => editVendor(v)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="거래처 삭제" onClick={() => deleteVendor(v.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>) : <tr><td colSpan={7} className="empty">등록된 거래처가 없습니다.</td></tr>}
        </tbody></table>
      </ScrollTable>
      <div className="basic-mobile-list">
        {vendors.length ? vendors.map((v: Vendor) => <article className="basic-mobile-row basic-vendor-mobile-row" key={v.id}><div className="basic-mobile-row-copy"><span>{v.code} · {v.owner || "대표자 미입력"}</span><strong>{v.name}</strong><small>{v.phone || v.mobile || "연락처 미입력"} · {[v.address, v.address_detail].filter(Boolean).join(" ") || "주소 미입력"}</small></div>{isAdmin && <div className="basic-mobile-row-actions"><button className="icon" title="수정" aria-label="거래처 수정" onClick={() => editVendor(v)}><Pencil size={16} /></button><button className="icon" title="삭제" aria-label="거래처 삭제" onClick={() => deleteVendor(v.id)}><Trash2 size={16} /></button></div>}</article>) : <div className="basic-mobile-empty">등록된 거래처가 없습니다.</div>}
      </div>
    </>
  );
}"""
simple_vendor_pattern = re.compile(r'function SimpleVendorTable\([\s\S]*?\n}\n\n/\*')
simple_vendor_matches = list(simple_vendor_pattern.finditer(app))
if len(simple_vendor_matches) != 1:
    raise RuntimeError(f"거래처 목록 컴포넌트를 정확히 1개 찾지 못했습니다: {len(simple_vendor_matches)}개")
app = simple_vendor_pattern.sub(lambda match: simple_vendor + "\n\n/*", app, count=1)

basic_css = r"""/* ===== Basic Master Data: Clean Layout ===== */
.app .basic-master-page{
  display:grid;
  gap:0;
  width:min(100%,1600px) !important;
  margin-left:auto !important;
  margin-right:auto !important;
  padding:28px 30px 32px !important;
  border:1px solid #dfe7f0;
  border-radius:20px !important;
  background:#fff !important;
  box-shadow:0 10px 32px rgba(15,23,42,.055);
}
.app .basic-page-header{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:20px;
  min-width:0;
  padding-bottom:19px;
  border-bottom:1px solid #e8edf3;
}
.app .basic-page-heading{min-width:0}
.app .basic-eyebrow{
  display:block;
  margin-bottom:6px;
  color:#5e7896;
  font-size:10px;
  font-weight:950;
  letter-spacing:.13em;
}
.app .basic-page-heading h2{
  margin:0 !important;
  color:#172b40;
  font-size:26px !important;
  line-height:1.2;
  letter-spacing:-.7px;
  text-align:left !important;
}
.app .basic-page-heading p{
  margin:6px 0 0;
  color:#6d7c8d;
  font-size:13px;
  line-height:1.45;
}
.app .basic-page-header-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  flex-wrap:wrap;
  gap:9px;
  min-width:0;
}
.app .basic-count-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:38px;
  padding:0 12px;
  border:1px solid #dbe5ef;
  border-radius:10px;
  background:#f8fafc;
  color:#536176;
  font-size:12px;
  font-weight:850;
  white-space:nowrap;
}
.app .basic-upload-button{
  min-height:40px;
  margin:0;
  border-color:#cfe0f5;
  background:#eff6ff;
  color:#1d4ed8;
  font-size:12px;
  font-weight:900;
  white-space:nowrap;
}
.app .basic-entry-panel{
  margin-top:20px;
  padding:18px 19px 17px;
  border:1px solid #e1e8f0;
  border-radius:16px;
  background:#f8fafc;
}
.app .basic-panel-heading{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  min-width:0;
  margin-bottom:15px;
}
.app .basic-panel-heading>div{min-width:0}
.app .basic-panel-heading h3{
  margin:0 0 4px !important;
  color:#20364c;
  font-size:16px !important;
  line-height:1.3;
  font-weight:950 !important;
}
.app .basic-panel-heading p{
  margin:0;
  color:#7b8897;
  font-size:12px;
  line-height:1.45;
}
.app .basic-edit-badge{
  flex:0 0 auto;
  padding:5px 9px;
  border-radius:999px;
  background:#fff7ed;
  color:#c2410c;
  font-size:11px;
  font-weight:900;
  white-space:nowrap;
}
.app .basic-form-grid{
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
}
.app .basic-form-grid .field{min-width:0;margin-bottom:0}
.app .basic-form-grid .field>label{margin-bottom:6px;color:#536176;font-size:11px;font-weight:900}
.app .basic-form-grid input,
.app .basic-form-grid select{
  min-height:42px;
  border-color:#d6e0ea;
  background:#fff;
  font-size:13px;
  font-weight:700;
}
.app .basic-form-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:8px;
  min-height:42px;
  margin:17px 0 0 !important;
  padding:14px 0 0;
  border-top:1px solid #e1e8f0;
}
.app .basic-form-actions:empty{display:none}
.app .basic-form-actions>button{
  min-width:110px;
  min-height:40px;
  justify-content:center;
  font-size:12px;
  font-weight:900;
}
.app .basic-list-heading{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  min-width:0;
  margin:24px 0 10px;
}
.app .basic-list-heading>div:first-child{min-width:0}
.app .basic-list-heading h3,
.app .basic-list-heading h4{
  margin:0 0 3px !important;
  color:#20364c;
  font-size:16px !important;
  line-height:1.3;
  font-weight:950 !important;
}
.app .basic-list-heading h4{font-size:14px !important}
.app .basic-list-heading p{
  margin:0;
  color:#8491a1;
  font-size:11px;
  line-height:1.4;
}
.app .basic-list-heading>strong{
  flex:0 0 auto;
  color:#1d4ed8;
  font-size:13px;
  font-weight:950;
  white-space:nowrap;
}
.app .basic-list-heading-compact{margin-top:22px}
.app .basic-list-controls{
  display:grid;
  grid-template-columns:minmax(240px,390px) auto;
  align-items:center;
  gap:9px;
  min-width:0;
}
.app .basic-list-controls>strong{color:#1d4ed8;font-size:12px;font-weight:950;white-space:nowrap}
.app .basic-search-input{min-width:0}
.app .basic-search-input input{min-height:38px;font-size:12px}
.app .basic-table-scroll{
  width:100%;
  max-width:100%;
  margin:0 !important;
  border:1px solid #dfe7f0;
  border-radius:14px !important;
  background:#fff;
  box-shadow:0 4px 14px rgba(15,23,42,.025);
}
.app .basic-table-scroll table{
  width:100% !important;
  min-width:0 !important;
  table-layout:fixed !important;
}
.app .basic-table-scroll th{
  padding:11px 9px !important;
  border-bottom:1px solid #dfe7f0;
  background:#edf3f9;
  color:#536176;
  font-size:11px;
  font-weight:950;
  text-align:center;
}
.app .basic-table-scroll td{
  padding:10px 9px !important;
  border-top:0;
  border-bottom:1px solid #edf1f5;
  color:#334155;
  font-size:12px;
  line-height:1.4;
  text-align:center;
  white-space:normal !important;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
.app .basic-table-scroll tbody tr:last-child td{border-bottom:0}
.app .basic-table-scroll tbody tr:hover{background:#f8fbff}
.app .basic-vendor-table th:nth-child(1),
.app .basic-vendor-table td:nth-child(1){width:11%}
.app .basic-vendor-table th:nth-child(2),
.app .basic-vendor-table td:nth-child(2){width:17%}
.app .basic-vendor-table th:nth-child(3),
.app .basic-vendor-table td:nth-child(3){width:12%}
.app .basic-vendor-table th:nth-child(4),
.app .basic-vendor-table td:nth-child(4),
.app .basic-vendor-table th:nth-child(5),
.app .basic-vendor-table td:nth-child(5){width:13%}
.app .basic-vendor-table th:nth-child(6),
.app .basic-vendor-table td:nth-child(6){width:22%}
.app .basic-vendor-table th:nth-child(7),
.app .basic-vendor-table td:nth-child(7){width:12%}
.app .basic-vendor-table td:nth-child(6){text-align:left}
.app .basic-vendor-table td:last-child{white-space:nowrap !important}
.app .basic-vendor-table .icon,
.app .basic-table-scroll .icon{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:31px;
  min-height:31px;
  margin:0 2px;
  padding:5px;
  border:1px solid #dbe4ee;
  border-radius:8px;
  background:#f8fafc;
  color:#64748b;
}
.app .basic-vendor-table .icon:hover,
.app .basic-table-scroll .icon:hover{background:#eef5fc;color:#2563eb}
.app .basic-split-grid{
  display:grid;
  grid-template-columns:minmax(300px,.85fr) minmax(420px,1.15fr);
  gap:16px;
  min-width:0;
  margin-top:20px;
}
.app .basic-entry-section{
  display:flex;
  flex-direction:column;
  min-width:0;
  padding:18px;
  border:1px solid #e1e8f0;
  border-radius:16px;
  background:#f8fafc;
}
.app .basic-entry-section .basic-panel-heading{margin-bottom:14px}
.app .basic-form-stack{display:grid;gap:10px;min-width:0}
.app .basic-form-stack .field{margin:0}
.app .basic-form-stack .field>label{margin-bottom:6px;color:#536176;font-size:11px;font-weight:900}
.app .basic-form-stack input{min-height:42px;font-size:13px;font-weight:700}
.app .basic-save-button{width:100%;min-height:40px;justify-content:center;font-size:12px;font-weight:900}
.app .basic-entry-section .basic-list-heading{margin-top:23px}
.app .basic-entry-section .basic-table-scroll{flex:1}
.app .basic-items-list-heading{align-items:end}
.app .basic-layout-page>.layout-map{margin-top:20px}
.app .basic-layout-page>.layout-edit-guide{margin-top:16px}
.app .basic-mobile-list{display:none}

@media (min-width:901px) and (max-width:1200px){
  .app .basic-master-page{padding-left:22px !important;padding-right:22px !important}
  .app .basic-vendors-page .basic-form-grid,
  .app .basic-items-page .basic-form-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .app .basic-vendors-page .vendor-register-grid>.field:nth-child(6),
  .app .basic-vendors-page .vendor-register-grid>.field:nth-child(7){grid-column:auto}
  .app .basic-split-grid{grid-template-columns:1fr 1fr}
}

@media (max-width:900px){
  .app .basic-master-page{
    width:100% !important;
    padding:16px !important;
    border-radius:22px !important;
    box-shadow:0 8px 24px rgba(15,23,42,.06);
  }
  .app .basic-page-header{
    display:grid;
    grid-template-columns:1fr;
    align-items:stretch;
    gap:13px;
    padding-bottom:16px;
  }
  .app .basic-page-heading h2{font-size:24px !important}
  .app .basic-page-heading p{font-size:12px}
  .app .basic-page-header-actions{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);
    align-items:stretch;
    justify-content:stretch;
  }
  .app .basic-count-badge{width:100%;min-width:0;min-height:42px;padding:0 7px;font-size:11px;overflow:hidden;text-overflow:ellipsis}
  .app .basic-upload-button{width:100% !important;min-height:42px;justify-content:center;padding:8px 7px;font-size:12px;overflow:hidden;text-overflow:ellipsis}
  .app .basic-entry-panel{margin-top:16px;padding:14px;border-radius:16px}
  .app .basic-panel-heading{margin-bottom:13px}
  .app .basic-panel-heading h3{font-size:17px !important}
  .app .basic-panel-heading p{font-size:11px}
  .app .basic-form-grid{grid-template-columns:1fr !important;gap:10px !important}
  .app .basic-form-grid .field{margin:0 !important}
  .app .basic-form-grid input,
  .app .basic-form-stack input,
  .app .basic-form-stack .search-select input{min-height:44px;font-size:15px}
  .app .basic-form-actions{
    display:grid !important;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    margin-top:14px !important;
    padding-top:12px;
  }
  .app .basic-form-actions>button{width:100%;min-width:0;min-height:42px;padding:8px 6px;font-size:12px}
  .app .basic-list-heading{
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    align-items:end;
    gap:8px;
    margin:20px 0 9px;
  }
  .app .basic-list-heading h3{font-size:16px !important}
  .app .basic-list-heading p{font-size:10px}
  .app .basic-list-controls{
    grid-column:1 / -1;
    grid-template-columns:minmax(0,1fr) auto;
    gap:8px;
    width:100%;
  }
  .app .basic-list-controls input{min-height:42px;font-size:14px}
  .app .basic-list-controls>strong{font-size:11px}
  .app .basic-split-grid{grid-template-columns:1fr;gap:12px;margin-top:16px}
  .app .basic-entry-section{padding:14px;border-radius:16px}
  .app .basic-entry-section .basic-list-heading{margin-top:20px}
  .app .basic-save-button{min-height:44px;font-size:13px}
  .app .basic-table-scroll{display:none !important}
  .app .basic-mobile-list{display:grid !important;gap:8px;min-width:0}
  .app .basic-mobile-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    min-width:0;
    padding:11px 12px;
    border:1px solid #e1e8f0;
    border-radius:12px;
    background:#fff;
  }
  .app .basic-mobile-row-copy{
    display:grid;
    gap:3px;
    min-width:0;
  }
  .app .basic-mobile-row-copy span,
  .app .basic-mobile-row-copy small{
    min-width:0;
    overflow:hidden;
    color:#7b8897;
    font-size:10px;
    line-height:1.35;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .app .basic-mobile-row-copy strong{
    min-width:0;
    overflow:hidden;
    color:#172033;
    font-size:15px;
    line-height:1.3;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .app .basic-mobile-row-copy small{color:#64748b;font-size:10px}
  .app .basic-mobile-row-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto;margin-left:auto}
  .app .basic-mobile-row-actions .icon{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:36px;
    min-width:36px;
    min-height:36px;
    margin:0 !important;
    padding:7px;
    border:1px solid #dbe4ee;
    border-radius:9px;
    background:#f8fafc;
    color:#64748b;
  }
  .app .basic-item-mobile-row .basic-mobile-row-copy strong{font-size:16px}
  .app .basic-mobile-empty{
    padding:24px 12px;
    border:1px dashed #cbd5e1;
    border-radius:12px;
    background:#f8fafc;
    color:#94a3b8;
    font-size:12px;
    font-weight:850;
    text-align:center;
  }
}"""
css_closing = "\n\n" + chr(96) + ";\n"
css_position = app.rfind(css_closing)
if css_position < 0:
    raise RuntimeError("기초등록 CSS 종료 태그를 찾지 못했습니다.")
app = app[:css_position] + "\n\n" + basic_css + app[css_position:]

APP_PATH.write_text(app, encoding="utf-8")
print("기초등록 공통 디자인 패치를 적용했습니다.")
