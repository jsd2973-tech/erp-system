import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import PurchaseMaintenanceModals from "../purchase/PurchaseMaintenanceModals";
import { maintenancePurchaseLinkIdentity } from "../purchase/purchaseModel";
import type { PurchaseEntryUi, PurchaseSelectOption } from "../purchase/PurchaseEntry";
import type { MaintenancePurchaseLink } from "../purchase/purchaseTypes";
import type { Maint, MaintItem, MaintenanceForm } from "./maintenanceTypes";

type PurchaseMaintenanceModalModel = ComponentProps<typeof PurchaseMaintenanceModals>;
type MaintenanceSuggestion = {
  item: string;
  spec: string;
  qty: number;
  price: number;
  count: number;
  lastDate: string;
};
type MaintenanceRecentPurchase = {
  date: string;
  vendor: string;
  warehouse: string;
  item: string;
  spec: string;
  price: number;
} | null;

export type MaintenanceEntryModel = {
  form: {
    value: MaintenanceForm;
    setValue: Dispatch<SetStateAction<MaintenanceForm>>;
    editingId: string;
    saving: boolean;
    uploading: boolean;
    saveError: string;
    onSave: () => void | Promise<void>;
    onReset: () => void;
  };
  items: {
    rows: MaintItem[];
    update: (index: number, key: keyof MaintItem, value: string | number | undefined, selectedItem?: PurchaseSelectOption) => void;
    remove: (index: number) => void;
    add: () => void;
    supplyTotal: number;
    vatTotal: number;
    grandTotal: number;
  };
  suggestions: {
    warehouseKey: string;
    all: MaintenanceSuggestion[];
    visible: MaintenanceSuggestion[];
    showAll: boolean;
    setShowAll: (value: boolean | ((previous: boolean) => boolean)) => void;
    onOpenPurchaseCopy: () => void;
    onAdd: (items: MaintenanceSuggestion[]) => void;
  };
  templates: {
    open: boolean;
    setOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
    search: string;
    setSearch: (value: string) => void;
    records: Maint[];
    onApply: (record: Maint) => void;
  };
  purchaseLinks: {
    drafts: MaintenancePurchaseLink[];
    onOpen: (row: MaintItem, link?: MaintenancePurchaseLink) => void;
    onRemove: (link: MaintenancePurchaseLink) => void;
    modals: PurchaseMaintenanceModalModel;
  };
  attachments: {
    setUploading: Dispatch<SetStateAction<boolean>>;
    uploadFiles: (files: FileList | File[]) => Promise<string[]>;
  };
  catalog: {
    warehouseNames: string[];
    itemOptions: PurchaseSelectOption[];
    getRecentPurchaseInfo: (itemName: string) => MaintenanceRecentPurchase;
  };
  todayKey: string;
};

export function MaintenanceEntry({ model, ui }: { model: MaintenanceEntryModel; ui: PurchaseEntryUi }) {
  const { Field, DateInput, SearchSelect, AttachmentGroup, ScrollTable, money } = ui;
  const { form, items, suggestions, templates, purchaseLinks, attachments, catalog, todayKey } = model;
  const maintForm = form.value;
  const setMaintForm = form.setValue;
  const editingMaintId = form.editingId;
  const maintSaving = form.saving;
  const maintUploading = form.uploading;
  const maintSaveError = form.saveError;
  const saveMaint = form.onSave;
  const resetMaintForm = form.onReset;
  const maintItems = items.rows;
  const updateMaintItem = items.update;
  const removeMaintItem = items.remove;
  const maintSupplyTotal = items.supplyTotal;
  const maintVatTotal = items.vatTotal;
  const maintGrandTotal = items.grandTotal;
  const maintWarehouseKey = suggestions.warehouseKey;
  const maintSuggestedItems = suggestions.all;
  const visibleMaintSuggestedItems = suggestions.visible;
  const showAllMaintSuggestions = suggestions.showAll;
  const setShowAllMaintSuggestions = suggestions.setShowAll;
  const openMaintenancePurchaseCopyModal = suggestions.onOpenPurchaseCopy;
  const addMaintSuggestedItems = suggestions.onAdd;
  const maintTemplateOpen = templates.open;
  const setMaintTemplateOpen = templates.setOpen;
  const maintTemplateSearch = templates.search;
  const setMaintTemplateSearch = templates.setSearch;
  const maintTemplateRecords = templates.records;
  const applyMaintTemplate = templates.onApply;
  const maintPurchaseLinksDraft = purchaseLinks.drafts;
  const openMaintPurchaseLinkModal = purchaseLinks.onOpen;
  const removeMaintPurchaseLink = purchaseLinks.onRemove;
  const setMaintUploading = attachments.setUploading;
  const uploadMaintFiles = attachments.uploadFiles;
  const { warehouseNames, itemOptions, getRecentPurchaseInfo } = catalog;
  const getTodayKey = () => todayKey;

  return (
    <>
<section className="card">
            <div className="between">
              <h2>{editingMaintId ? "정비 수정" : "정비 등록"}</h2>
              <button onClick={() => setMaintTemplateOpen((value) => !value)}>이전 작업 불러오기</button>
            </div>

            {maintTemplateOpen && (
              <div className="subcard" style={{ marginBottom: 14 }}>
                <div className="between">
                  <strong>이전 정비작업 선택</strong>
                  <input
                    style={{ maxWidth: 320 }}
                    value={maintTemplateSearch}
                    onChange={(e) => setMaintTemplateSearch(e.target.value)}
                    placeholder="작업명/창고/품목 검색"
                  />
                </div>
                <ScrollTable>
                  <table>
                    <thead>
                      <tr><th>정비일자</th><th>창고</th><th>정비제목</th><th>품목</th><th>합계</th><th>불러오기</th></tr>
                    </thead>
                    <tbody>
                      {!maintTemplateRecords.length ? (
                        <tr><td colSpan={6} className="empty">불러올 정비 이력이 없습니다.</td></tr>
                      ) : maintTemplateRecords.map((record) => (
                        <tr key={`maint-template-${record.id}`}>
                          <td>{record.date || "-"}</td>
                          <td>{record.warehouse || "-"}</td>
                          <td className="bold">{record.title || "-"}</td>
                          <td>{(record.items || []).map((item) => item.item).filter(Boolean).slice(0, 3).join(", ") || "-"}</td>
                          <td className="right bold">{money(record.total || record.cost || 0)}</td>
                          <td><button className="primary" onClick={() => applyMaintTemplate(record)}>선택</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
                <p className="draft-help-text">날짜, 작업자, 사진은 복사하지 않고 제목/내용/창고/품목/수량/단가만 현재 정비등록에 채웁니다.</p>
              </div>
            )}

            <div className="grid3">
              <Field label="정비일자" required>
                <DateInput
                  value={maintForm.date || getTodayKey()}
                  onChange={(value) => setMaintForm({ ...maintForm, date: value })}
                  placeholder="20260519 또는 260519"
                  ariaLabel="정비일자 선택"
                />
              </Field>
              <SearchSelect testId="maintenance-warehouse" label="창고" required value={maintForm.warehouse} options={warehouseNames} onChange={(v) => setMaintForm({ ...maintForm, warehouse: v })} placeholder="창고 선택/검색" />
              <Field label="작업자">
                <input value={maintForm.manager} onChange={(e) => setMaintForm({ ...maintForm, manager: e.target.value })} />
              </Field>
              <Field label="정비제목" required>
                <input data-testid="maintenance-title" value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} />
              </Field>
              <Field label="정비내용">
                <textarea className="maint-detail-input" rows={3} value={maintForm.detail} onChange={(e) => setMaintForm({ ...maintForm, detail: e.target.value })} placeholder="정비 작업내용을 입력하세요" />
              </Field>
              <Field label="정비비용">
                <input value={maintForm.cost} readOnly />
              </Field>
            </div>

            <div className="maint-suggest-box">
                <div className="maint-suggest-head">
                  <div>
                    <strong>
                      창고 추천 품목
                      {!!maintWarehouseKey && <em>{maintSuggestedItems.length}개</em>}
                    </strong>
                    <span>
                      {!maintWarehouseKey
                        ? "창고를 선택하면 해당 창고의 과거 정비 사용품목을 보여줍니다."
                        : maintSuggestedItems.length
                          ? `"${maintForm.warehouse}"에서 자주 사용된 품목입니다.`
                          : `"${maintForm.warehouse}"의 기존 정비 이력에 등록된 사용품목이 없습니다.`}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {!!maintWarehouseKey && (
                      <button type="button" className="primary" onClick={openMaintenancePurchaseCopyModal}>
                        구매내역에서 품목 추가
                      </button>
                    )}
                    {!!maintSuggestedItems.length && (
                      <button type="button" className="primary" onClick={() => addMaintSuggestedItems(maintSuggestedItems)}>
                        추천 품목 전체 추가
                      </button>
                    )}
                  </div>
                </div>

                {!!maintSuggestedItems.length && (
                  <>
                    <div className="maint-suggest-chips">
                      {visibleMaintSuggestedItems.map((item) => (
                        <button key={item.item} onClick={() => addMaintSuggestedItems([item])}>
                          <b>{item.item}</b>
                          <span>{item.count}회 사용</span>
                        </button>
                      ))}
                    </div>

                    {maintSuggestedItems.length > 8 && (
                      <div className="maint-suggest-more">
                        <button onClick={() => setShowAllMaintSuggestions((value) => !value)}>
                          {showAllMaintSuggestions ? "접기" : `더보기 ${maintSuggestedItems.length - 8}개`}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!maintSuggestedItems.length && (
                  <div className="maint-suggest-empty">
                    {maintWarehouseKey ? "이 창고의 첫 정비 품목을 등록하면 다음부터 자동 추천됩니다." : "먼저 위에서 창고를 선택하세요."}
                  </div>
                )}
              </div>

            <h3>사용 품목</h3>
            <div className="table-wrap entry-desktop-table">
              <table>
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>규격</th>
                    <th>수량</th>
                    <th>단가</th>
                    <th>공급가액</th>
                    <th>부가세</th>
                    <th>합계</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {maintItems.map((r, i) => {
                    const recentPurchaseInfo = getRecentPurchaseInfo(String(r.item || ""));
                    const linkedPurchaseRows = maintPurchaseLinksDraft.filter((link) => link.maintenance_row_id === r.id);

                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="maintenance-item-editor">
                            <SearchSelect
                              testId={`maintenance-item-search-${i}`}
                              value={r.item}
                              options={itemOptions}
                              onChange={(v) => updateMaintItem(i, "item", v)}
                              onSelect={(option) => updateMaintItem(i, "item", option.name || option.value, option)}
                              placeholder="품목 검색"
                              variant="item"
                            />
                            <input
                              value={r.item}
                              onChange={(e) => updateMaintItem(i, "item", e.target.value)}
                              placeholder="품목명 직접수정"
                            />
                          </div>
                          {recentPurchaseInfo && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                              최근구매: {recentPurchaseInfo.date || "-"} / {recentPurchaseInfo.vendor || "거래처 미입력"} / 단가 {money(recentPurchaseInfo.price)}원
                            </div>
                          )}
                          <div className="maintenance-purchase-link-editor">
                            <button type="button" data-testid="maintenance-purchase-link" onClick={() => openMaintPurchaseLinkModal(r)}>구매이력 연결</button>
                            {linkedPurchaseRows.map((link) => (
                              <span key={maintenancePurchaseLinkIdentity(link)}>
                                {link.vendor_snapshot || "거래처 미입력"} · {link.purchase_date_snapshot || "-"} · {money(link.unit_price_snapshot)}원 · {link.used_qty} 사용
                                <button type="button" onClick={() => openMaintPurchaseLinkModal(r, link)}>수정</button>
                                <button type="button" onClick={() => removeMaintPurchaseLink(link)}>해제</button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td><input data-testid={`maintenance-spec-${i}`} value={r.spec} onChange={(e) => updateMaintItem(i, "spec", e.target.value)} /></td>
                        <td><input data-testid={`maintenance-qty-${i}`} className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateMaintItem(i, "qty", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateMaintItem(i, "price", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateMaintItem(i, "supply", e.target.value)} /></td>
                        <td><input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateMaintItem(i, "vat", e.target.value)} /></td>
                        <td className="right bold">{money(r.total)}</td>
                        <td>
                          <button className="icon" title="행 삭제" aria-label="행 삭제" onClick={() => removeMaintItem(i)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-entry-item-list" aria-label="정비 사용 품목 입력">
              {maintItems.map((r, i) => {
                const recentPurchaseInfo = getRecentPurchaseInfo(String(r.item || ""));
                const linkedPurchaseRows = maintPurchaseLinksDraft.filter((link) => link.maintenance_row_id === r.id);

                return (
                  <div className="mobile-entry-item-card maintenance" key={`mobile-maint-${r.id}`}>
                    <div className="mobile-entry-item-head">
                      <div><span>정비 품목</span><b>{i + 1}</b></div>
                      <button type="button" className="mobile-entry-delete" onClick={() => removeMaintItem(i)} aria-label={`${i + 1}번 정비 품목 삭제`}><Trash2 size={16} /> 삭제</button>
                    </div>

                    <SearchSelect
                      label="품목"
                      value={r.item}
                      options={itemOptions}
                      onChange={(value) => updateMaintItem(i, "item", value)}
                      onSelect={(option) => updateMaintItem(i, "item", option.name || option.value, option)}
                      placeholder="품목명 검색"
                      variant="item"
                    />

                    <Field label="품목명 직접수정">
                      <input value={r.item} onChange={(e) => updateMaintItem(i, "item", e.target.value)} placeholder="이번 정비에서 사용할 품목명" />
                    </Field>

                    {recentPurchaseInfo && (
                      <div className="mobile-entry-recent">
                        <span>최근 구매</span>
                        <b>{recentPurchaseInfo.date || "-"} · {recentPurchaseInfo.vendor || "거래처 미입력"}</b>
                        <em>단가 {money(recentPurchaseInfo.price)}원</em>
                      </div>
                    )}

                    <div className="maintenance-purchase-link-editor mobile">
                      <button type="button" onClick={() => openMaintPurchaseLinkModal(r)}>구매이력 연결</button>
                      {linkedPurchaseRows.map((link) => (
                        <span key={maintenancePurchaseLinkIdentity(link)}>
                          {link.vendor_snapshot || "거래처 미입력"} · {link.purchase_date_snapshot || "-"} · {money(link.unit_price_snapshot)}원 · {link.used_qty} 사용
                          <button type="button" onClick={() => openMaintPurchaseLinkModal(r, link)}>수정</button>
                          <button type="button" onClick={() => removeMaintPurchaseLink(link)}>해제</button>
                        </span>
                      ))}
                    </div>

                    <Field label="규격">
                      <input value={r.spec} onChange={(e) => updateMaintItem(i, "spec", e.target.value)} placeholder="규격 입력" />
                    </Field>

                    <div className="mobile-entry-grid">
                      <Field label="수량">
                        <input className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateMaintItem(i, "qty", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="단가">
                        <input className="right" inputMode="decimal" value={r.price} onChange={(e) => updateMaintItem(i, "price", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="공급가액">
                        <input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateMaintItem(i, "supply", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="부가세">
                        <input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateMaintItem(i, "vat", e.target.value)} placeholder="0" />
                      </Field>
                    </div>

                    <div className="mobile-entry-total"><span>품목 합계</span><b>{money(r.total)}원</b></div>
                  </div>
                );
              })}
            </div>

            <div className="maintenance-entry-footer">
              <div className="maintenance-entry-support">
                <button className="maintenance-add-item-button" onClick={() => items.add()}><Plus size={16} /> 품목 추가</button>
                <div className="maintenance-upload-panel">
                  <strong>정비 첨부파일</strong>
                  <p>사진 20MB · PDF 30MB · 음성 50MB 이하, 한 번에 최대 20개입니다.</p>
                  <label className={`upload${maintUploading ? " upload-busy" : ""}`} aria-disabled={maintUploading}>
                    <Upload size={16} /> {maintUploading ? "첨부 업로드 중..." : "첨부파일 선택"}
                    <input
                      type="file"
                      accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
                      multiple
                      disabled={maintUploading}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const files = e.target.files;
                        if (!files?.length) return;
                        setMaintUploading(true);
                        try {
                          const urls = await uploadMaintFiles(files);
                          setMaintForm((prev) => ({
                            ...prev,
                            image_urls: [...(prev.image_urls || []), ...urls],
                          }));
                        } finally {
                          input.value = "";
                          setMaintUploading(false);
                        }
                      }}
                    />
                  </label>
                  <div className="receipt-preview">
                    {(maintForm.image_urls || []).length ? (
                      <AttachmentGroup
                        urls={maintForm.image_urls || []}
                        onRemove={(removeIndex) => setMaintForm((prev) => ({
                          ...prev,
                          image_urls: (prev.image_urls || []).filter((_, idx) => idx !== removeIndex),
                        }))}
                      />
                    ) : (
                      <span>첨부파일 없음</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="totals maintenance-entry-summary">
                <span>정비금액 요약</span>
                <div>공급가액 합계 <b>{money(maintSupplyTotal)}원</b></div>
                <div>부가세액 합계 <b>{money(maintVatTotal)}원</b></div>
                <div className="big"><em>총합</em><strong>{money(maintGrandTotal)}원</strong></div>
              </div>
            </div>

            {maintSaveError && <div className="save-error-box">{maintSaveError}</div>}

            <div className="actions right-actions entry-actions">
              <button data-testid="maintenance-save" className="primary" disabled={maintSaving || maintUploading} onClick={saveMaint}>
                <Save size={16} /> {maintUploading ? "업로드 중..." : maintSaving ? "저장 중..." : editingMaintId ? "수정 저장" : "저장"}
              </button>
              <button disabled={maintSaving || maintUploading} onClick={resetMaintForm}><RotateCcw size={16} /> 초기화</button>
            </div>
            <p className="draft-help-text">작성 중인 정비등록 내용은 자동 임시저장됩니다. 저장 실패나 메뉴 이동 후에도 다시 정비등록에 들어오면 복원됩니다.</p>
          </section>
      <PurchaseMaintenanceModals {...purchaseLinks.modals} />
    </>
  );
}
