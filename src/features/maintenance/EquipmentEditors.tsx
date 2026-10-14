import { useEffect, useRef, useState, type ReactNode } from "react";
import { EQUIPMENT_WORK_TYPES, emptyEquipmentItemDraft, equipmentItemDraft, validEquipmentDate, validateEquipmentItemDraft } from "./equipmentModel";
import type { EquipmentHistoryDraft, EquipmentImportedHistory, EquipmentItem, EquipmentSettings, EquipmentWorkType } from "./equipmentTypes";
import type { EquipmentModule } from "./useEquipmentModule";

export type EquipmentActivity = { module: string; action: string; target_id: string; target_title: string; detail: string };
type EditorCallbacks = { onClose: () => void; onSaved: (message: string) => void; log: (activity: EquipmentActivity) => void | Promise<void> };

function EquipmentDialog({ title, children, onClose, saving }: { title: string; children: ReactNode; onClose: () => void; saving: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    ref.current?.showModal();
    return () => { if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); };
  }, []);
  return <dialog ref={ref} className="equipment-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="between"><h3>{title}</h3><button type="button" disabled={saving} onClick={onClose} aria-label="닫기">닫기</button></div>
    {children}
  </dialog>;
}

function useEditorSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다."); }
    finally { lock.current = false; setSaving(false); }
  };
  return { saving, error, setError, run };
}

export function EquipmentItemEditor({ item, model, warehouses, ...callbacks }: EditorCallbacks & {
  item: EquipmentItem | null; model: EquipmentModule; warehouses: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState(() => item ? equipmentItemDraft(item) : emptyEquipmentItemDraft(model.items[0]?.category || ""));
  const save = useEditorSave();
  const categories = [...new Set(model.items.map(row => row.category))];
  const sharedCount = item?.shared_note_key ? model.items.filter(row => row.shared_note_key === item.shared_note_key).length : 0;
  return <EquipmentDialog title={item ? "설비 기본정보 수정" : "설비 항목 추가"} onClose={callbacks.onClose} saving={save.saving}>
    <form onSubmit={event => {
      event.preventDefault();
      const validation = validateEquipmentItemDraft(draft);
      if (validation) return save.setError(validation);
      void save.run(async () => {
        const updated = await model.saveItem(item, draft);
        await callbacks.log({ module: "정비", action: item ? "설비 기본정보 수정" : "설비 항목 추가", target_id: updated.id, target_title: `${updated.category} / ${updated.name}`, detail: `${item?.spec || "-"} → ${updated.spec || "-"}${sharedCount > 1 ? ` · 공통 비고 ${sharedCount}개 항목` : ""}` });
        callbacks.onSaved(item ? "설비 기본정보를 수정했습니다." : "설비 항목을 추가했습니다."); callbacks.onClose();
      });
    }}>
      <div className="equipment-form-grid">
        <label>대분류<input data-testid="equipment-category" list="equipment-category-options" required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></label>
        <datalist id="equipment-category-options">{categories.map(category => <option key={category} value={category} />)}</datalist>
        <label>관리 항목명<input data-testid="equipment-name" required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>규격<input data-testid="equipment-spec" value={draft.spec} onChange={event => setDraft({ ...draft, spec: event.target.value })} /></label>
        <label>길이-폭-두께<input value={draft.dimensions} onChange={event => setDraft({ ...draft, dimensions: event.target.value })} /></label>
        <label>베어링<input value={draft.bearing} onChange={event => setDraft({ ...draft, bearing: event.target.value })} /></label>
        <label>롤러 (리턴/캐리어)<input value={draft.rollers} onChange={event => setDraft({ ...draft, rollers: event.target.value })} /></label>
        <label>연결 창고<select data-testid="equipment-warehouse" value={draft.warehouse_id || ""} onChange={event => setDraft({ ...draft, warehouse_id: event.target.value || null })}><option value="">연결하지 않음</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
        <label>교체주기 기준<select data-testid="equipment-cycle-method" value={draft.cycle_method} onChange={event => setDraft({ ...draft, cycle_method: event.target.value as typeof draft.cycle_method })}><option value="none">계산하지 않음</option><option value="average">최근 교체 간격 평균</option><option value="fixed">고정 사용기간</option></select></label>
        {draft.cycle_method === "average" && <label>평균 계산 구간 (회)<input type="number" min="1" max="10" step="1" value={draft.cycle_intervals} onChange={event => setDraft({ ...draft, cycle_intervals: Number(event.target.value) })} /></label>}
        {draft.cycle_method === "fixed" && <label>고정 사용기간 (일)<input type="number" min="0.1" step="0.1" required value={draft.fixed_cycle_days ?? ""} onChange={event => setDraft({ ...draft, fixed_cycle_days: event.target.value === "" ? null : Number(event.target.value) })} /></label>}
        <label>예상 교체일 직접 지정<input type="date" data-testid="equipment-expected" value={draft.expected_override || ""} onChange={event => setDraft({ ...draft, expected_override: event.target.value || null })} /><span className="equipment-help">비워두면 교체주기 기준으로 계산합니다.</span></label>
        <label className="equipment-form-wide">비고{sharedCount > 1 ? ` (${sharedCount}개 항목에 공통 적용)` : ""}<textarea data-testid="equipment-notes" rows={3} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div>
      {save.error && <p role="alert" className="equipment-error">{save.error}</p>}
      <div className="equipment-editor-actions"><button type="button" disabled={save.saving} onClick={callbacks.onClose}>취소</button><button className="primary" data-testid="equipment-item-save" disabled={save.saving} type="submit">{save.saving ? "저장 중..." : "저장"}</button></div>
    </form>
  </EquipmentDialog>;
}

export function EquipmentHistoryEditor({ record, model, ...callbacks }: EditorCallbacks & { record: EquipmentImportedHistory; model: EquipmentModule }) {
  const [draft, setDraft] = useState<EquipmentHistoryDraft>(() => ({ work_date: record.work_date, date_text: record.date_text, vendor_label: record.vendor_label, work_detail: record.work_detail, work_type: record.work_type, cost: record.cost, cycle_included: record.cycle_included }));
  const save = useEditorSave();
  return <EquipmentDialog title="기존 정비기록 수정" onClose={callbacks.onClose} saving={save.saving}>
    <form onSubmit={event => {
      event.preventDefault();
      if (draft.work_date && !validEquipmentDate(draft.work_date)) return save.setError("작업일을 확인해주세요.");
      if (!draft.work_date && !draft.date_text.trim()) return save.setError("작업일 또는 기존 날짜·메모를 입력해주세요.");
      if (draft.cost !== null && (!Number.isFinite(draft.cost) || draft.cost < 0)) return save.setError("금액을 0 이상으로 입력해주세요.");
      void save.run(async () => {
        await model.saveImportedHistory(record, { ...draft, cycle_included: !!draft.work_date && draft.work_type !== "inspection" && draft.cycle_included });
        await callbacks.log({ module: "정비", action: "설비 기존이력 수정", target_id: record.id, target_title: draft.vendor_label || "기존 정비기록", detail: `${record.work_date || record.date_text || "-"} → ${draft.work_date || draft.date_text || "-"}` });
        callbacks.onSaved("기존 정비기록을 수정했습니다."); callbacks.onClose();
      });
    }}>
      <div className="equipment-form-grid">
        <label>작업일<input data-testid="equipment-history-date" type="date" value={draft.work_date || ""} onChange={event => setDraft({ ...draft, work_date: event.target.value || null, cycle_included: event.target.value ? draft.cycle_included : false })} /></label>
        <label>작업 구분<select value={draft.work_type} onChange={event => setDraft({ ...draft, work_type: event.target.value as EquipmentWorkType | "legacy", cycle_included: event.target.value === "inspection" ? false : draft.cycle_included })}><option value="legacy">원본 작업표시 유지</option>{EQUIPMENT_WORK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="equipment-form-wide">기존 날짜·메모<input data-testid="equipment-history-date-text" value={draft.date_text} onChange={event => setDraft({ ...draft, date_text: event.target.value })} /><span className="equipment-help">작업일이 비어 있으면 이 표시를 사용합니다.</span></label>
        <label>업체·기존 작업표시<input data-testid="equipment-history-vendor" value={draft.vendor_label} onChange={event => setDraft({ ...draft, vendor_label: event.target.value })} /></label>
        <label>금액 (원, 선택)<input type="number" min="0" step="0.01" value={draft.cost ?? ""} onChange={event => setDraft({ ...draft, cost: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label className="equipment-form-wide">작업내용<textarea data-testid="equipment-history-detail" rows={3} value={draft.work_detail} onChange={event => setDraft({ ...draft, work_detail: event.target.value })} /></label>
        <label className="equipment-checkbox equipment-form-wide"><input type="checkbox" checked={!!draft.work_date && draft.work_type !== "inspection" && draft.cycle_included} disabled={!draft.work_date || draft.work_type === "inspection"} onChange={event => setDraft({ ...draft, cycle_included: event.target.checked })} />교체주기 계산에 포함</label>
      </div>
      {save.error && <p role="alert" className="equipment-error">{save.error}</p>}
      <div className="equipment-editor-actions"><button type="button" disabled={save.saving} onClick={callbacks.onClose}>취소</button><button className="primary" data-testid="equipment-history-save" disabled={save.saving} type="submit">{save.saving ? "저장 중..." : "수정 저장"}</button></div>
    </form>
  </EquipmentDialog>;
}

export function EquipmentSettingsEditor({ settings, model, ...callbacks }: EditorCallbacks & { settings: EquipmentSettings; model: EquipmentModule }) {
  const [title, setTitle] = useState(settings.title), [note, setNote] = useState(settings.common_note);
  const save = useEditorSave();
  return <EquipmentDialog title="설비현황 공통 메모 수정" onClose={callbacks.onClose} saving={save.saving}>
    <form onSubmit={event => { event.preventDefault(); if (!title.trim()) return save.setError("화면 제목을 입력해주세요."); void save.run(async () => {
      await model.saveSettings(title.trim(), note.trim());
      await callbacks.log({ module: "정비", action: "설비 공통메모 수정", target_id: "crusher", target_title: title, detail: note });
      callbacks.onSaved("공통 메모를 수정했습니다."); callbacks.onClose();
    }); }}>
      <div className="equipment-form-grid"><label className="equipment-form-wide">화면 제목<input required value={title} onChange={event => setTitle(event.target.value)} /></label><label className="equipment-form-wide">공통 메모<textarea rows={4} value={note} onChange={event => setNote(event.target.value)} /></label></div>
      {save.error && <p role="alert" className="equipment-error">{save.error}</p>}
      <div className="equipment-editor-actions"><button type="button" disabled={save.saving} onClick={callbacks.onClose}>취소</button><button className="primary" disabled={save.saving} type="submit">{save.saving ? "저장 중..." : "저장"}</button></div>
    </form>
  </EquipmentDialog>;
}
