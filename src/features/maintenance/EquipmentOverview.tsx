import { useMemo, useState } from "react";
import { equipmentPeriodText, equipmentWorkDescription, equipmentWorkLabel } from "./equipmentModel";
import type { EquipmentImportedHistory, EquipmentItem, EquipmentWork } from "./equipmentTypes";
import type { EquipmentModule } from "./useEquipmentModule";
import type { Maint } from "./maintenanceTypes";
import { EquipmentHistoryEditor, EquipmentItemEditor, EquipmentSettingsEditor, type EquipmentActivity } from "./EquipmentEditors";
import { downloadEquipmentWorkbook } from "./equipmentWorkbook";
import "./equipment.css";

type Props = {
  model: EquipmentModule;
  warehouses: { id: string; name: string }[];
  canCreate: boolean;
  canEdit: boolean;
  onRegister: (item: EquipmentItem) => void;
  onEditMaintenance: (maintenance: Maint) => void;
  log: (activity: EquipmentActivity) => void | Promise<void>;
  showToast: (message: string) => void;
  todayKey: string;
};

function WorkCell({ work }: { work?: EquipmentWork }) {
  return work ? <><div className="equipment-date">{work.date || "날짜 미기재"}</div><div className="equipment-secondary">{equipmentWorkDescription(work) || "업체 미기재"}</div></> : <span className="equipment-secondary">—</span>;
}

export function EquipmentOverview({ model, warehouses, canCreate, canEdit, onRegister, onEditMaintenance, log, showToast, todayKey }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [editingItem, setEditingItem] = useState<EquipmentItem | null | undefined>(undefined);
  const [editingHistory, setEditingHistory] = useState<EquipmentImportedHistory | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [exportError, setExportError] = useState("");
  const selected = model.rows.find(row => row.item.id === selectedId);
  const categories = [...new Set(model.rows.map(row => row.item.category))];
  const filteredRows = useMemo(() => {
    const word = keyword.trim().toLowerCase();
    return model.rows.filter(({ item }) => (!category || item.category === category) && (!word || [item.category, item.name, item.spec, item.dimensions, item.bearing, item.rollers, item.notes].join(" ").toLowerCase().includes(word)));
  }, [model.rows, keyword, category]);

  const exportWorkbook = () => {
    if (!model.ready || model.loading || model.error) return;
    setExportError("");
    try { downloadEquipmentWorkbook(model.rows, model.settings, todayKey); }
    catch (caught) { setExportError(caught instanceof Error ? caught.message : "엑셀 파일을 생성하지 못했습니다."); }
  };
  const editWork = (work: EquipmentWork) => {
    if (work.origin === "maintenance") {
      const maintenance = model.linkedMaintenances.find(row => row.id === work.source_id);
      if (maintenance) onEditMaintenance(maintenance);
    } else {
      const record = model.importedHistory.find(row => row.id === work.source_id);
      if (record) setEditingHistory(record);
    }
  };

  return <section className="card lookup-page equipment-overview-page" data-testid="equipment-overview">
    <div className="between equipment-page-heading">
      <div><h2>{model.settings.title}</h2><p className="equipment-secondary">설비 규격 · 최신 작업 · 이전 작업 · 예상 교체일</p></div>
      <div className="actions">
        <button type="button" onClick={() => void model.reload()} disabled={model.loading}>{model.loading ? "불러오는 중..." : "새로고침"}</button>
        <button type="button" data-testid="equipment-export" onClick={exportWorkbook} disabled={!model.ready || model.loading || !!model.error}>엑셀 다운로드</button>
        {canEdit && <button type="button" onClick={() => setEditingSettings(true)} disabled={!model.ready}>공통 메모 수정</button>}
        {canCreate && <button type="button" className="primary" data-testid="equipment-add" onClick={() => setEditingItem(null)} disabled={!model.ready}>설비 항목 추가</button>}
      </div>
    </div>
    {model.settings.common_note && <div className="equipment-common-note">{model.settings.common_note}</div>}
    {model.error && <div role="alert" className="equipment-error">설비현황을 불러오지 못했습니다: {model.error}</div>}
    {exportError && <p role="alert" className="equipment-error">엑셀 출력 실패: {exportError}</p>}
    {!model.ready && !model.error && <p role="status">설비현황을 불러오는 중입니다.</p>}
    {model.ready && !model.error && (selected ? <>
      <div className="between equipment-detail-heading"><h3>{selected.item.category} / {selected.item.name}</h3><div className="actions"><button type="button" onClick={() => setSelectedId("")}>총괄표로</button>{canEdit && <button type="button" data-testid="equipment-basic-edit" onClick={() => setEditingItem(selected.item)}>기본정보 수정</button>}{canCreate && <button className="primary" type="button" onClick={() => onRegister(selected.item)}>정비 등록</button>}</div></div>
      <dl className="equipment-detail-grid">
        {[['규격', selected.item.spec], ['길이-폭-두께', selected.item.dimensions], ['베어링', selected.item.bearing], ['롤러(리턴/캐리어)', selected.item.rollers], ['연결 창고', warehouses.find(row => row.id === selected.item.warehouse_id)?.name], ['평균 사용기간', equipmentPeriodText(selected.average_days)], ['예상 교체일', selected.expected_date], ['비고', selected.item.notes]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
      </dl>
      <div className="between equipment-detail-heading"><strong>전체 작업이력 {selected.history.length}건</strong><span className="equipment-secondary">표시 개수 제한 없이 누적</span></div>
      <div className="equipment-table-wrapper"><table className="equipment-history-table" data-testid="equipment-history-table"><thead><tr><th>작업일</th><th>업체·작업표시</th><th>정비제목·내용</th><th>금액 (원)</th><th>주기 반영</th><th>기록 구분</th><th>수정</th></tr></thead><tbody>
        {!selected.history.length ? <tr><td colSpan={7} className="empty">등록된 작업이력이 없습니다.</td></tr> : selected.history.map(work => <tr key={work.id} data-work-id={work.id}>
          <td className="equipment-date">{work.date || "날짜 미기재"}</td><td>{equipmentWorkDescription(work) || "—"}</td><td className="equipment-work-detail">{work.title && <strong>{work.title}</strong>}{work.detail || (!work.title ? "—" : "")}</td><td className="equipment-number">{work.cost === null ? "—" : work.cost.toLocaleString("ko-KR")}</td><td>{work.cycle_included ? "반영" : "—"}</td><td>{work.origin === "import" ? "기존 총괄표" : "ERP 정비"}</td><td>{canEdit && <button type="button" onClick={() => editWork(work)} aria-label={`${work.date || "기존"} ${equipmentWorkLabel(work.work_type)} 기록 수정`}>수정</button>}</td>
        </tr>)}
      </tbody></table></div>
    </> : <>
      <div className="equipment-list-controls"><label>대분류<select value={category} onChange={event => setCategory(event.target.value)}><option value="">전체</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>설비 검색<input data-testid="equipment-search" placeholder="설비·부품·규격 검색" value={keyword} onChange={event => setKeyword(event.target.value)} /></label><span className="equipment-secondary">전체 {model.rows.length}개 · 표시 {filteredRows.length}개</span></div>
      <div className="equipment-table-wrapper"><table className="equipment-overview-table" data-testid="equipment-overview-table"><colgroup>{[85,150,190,150,145,115,95,170,110].map((width,index) => <col key={index} style={{ width }} />)}</colgroup><thead><tr><th>대분류</th><th>관리 항목</th><th>규격</th><th>최신 작업</th><th>이전 작업</th><th>예상 교체일</th><th>평균 사용기간</th><th>비고</th><th>관리</th></tr></thead><tbody>
        {!filteredRows.length ? <tr><td colSpan={9} className="empty">{model.rows.length ? "검색 조건에 해당하는 항목이 없습니다." : "등록된 설비 항목이 없습니다."}</td></tr> : filteredRows.map(row => <tr key={row.item.id} data-equipment-id={row.item.id}>
          <td>{row.item.category}</td><td><button className="link equipment-item-link" type="button" onClick={() => setSelectedId(row.item.id)}>{row.item.name}</button></td><td className="equipment-spec">{row.item.spec || "—"}{row.item.dimensions && <div className="equipment-secondary">{row.item.dimensions}</div>}</td><td><WorkCell work={row.history[0]} /></td><td><WorkCell work={row.history[1]} /></td><td className="equipment-date">{row.expected_date || "—"}</td><td className="equipment-number">{equipmentPeriodText(row.average_days)}</td><td className="equipment-notes">{row.item.notes || "—"}</td><td><div className="equipment-row-actions">{canCreate && <button type="button" onClick={() => onRegister(row.item)}>정비 등록</button>}{canEdit && <button type="button" onClick={() => setEditingItem(row.item)}>수정</button>}</div></td>
        </tr>)}
      </tbody></table></div>
      <p className="equipment-help">항목명을 누르면 전체 작업이력을 확인할 수 있습니다. 엑셀에는 총괄표와 전체 작업이력 두 시트가 포함됩니다.</p>
    </>)}
    {editingItem !== undefined && <EquipmentItemEditor key={editingItem?.id || "new"} item={editingItem} model={model} warehouses={warehouses} onClose={() => setEditingItem(undefined)} onSaved={showToast} log={log} />}
    {editingHistory && <EquipmentHistoryEditor key={editingHistory.id} record={editingHistory} model={model} onClose={() => setEditingHistory(null)} onSaved={showToast} log={log} />}
    {editingSettings && <EquipmentSettingsEditor settings={model.settings} model={model} onClose={() => setEditingSettings(false)} onSaved={showToast} log={log} />}
  </section>;
}
