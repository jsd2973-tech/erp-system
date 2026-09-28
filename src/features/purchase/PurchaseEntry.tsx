import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react";
import { Plus, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import {
  comparePurchaseUnitPrice,
  getPurchaseVendorPriceStat,
  normalizePurchasePriceText,
  type PurchasePriceHistory,
} from "./purchasePriceHistory";
import type { PurchaseRow } from "./purchaseTypes";

export type PurchaseSelectOption = {
  id?: string;
  label?: string;
  value?: string;
  code?: string;
  name?: string;
  spec?: string;
  unit?: string;
  price?: number;
};

export type PurchaseFieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
};

export type PurchaseDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

export type PurchaseSearchSelectProps = {
  label?: string;
  required?: boolean;
  value: string;
  options: Array<string | PurchaseSelectOption>;
  onChange: (value: string) => void;
  onSelect?: (option: PurchaseSelectOption) => void;
  placeholder?: string;
  variant?: "default" | "item";
  testId?: string;
};

export type PurchaseAttachmentGroupProps = {
  urls?: string[];
  onRemove?: (index: number) => void;
};

export type PurchaseScrollTableProps = { children: ReactNode };

export type PurchaseEntryUi = {
  Field: ComponentType<PurchaseFieldProps>;
  DateInput: ComponentType<PurchaseDateInputProps>;
  SearchSelect: ComponentType<PurchaseSearchSelectProps>;
  AttachmentGroup: ComponentType<PurchaseAttachmentGroupProps>;
  ScrollTable: ComponentType<PurchaseScrollTableProps>;
  money: (value: number | string | undefined) => string;
};

export type PurchaseEntryModel = {
  menuTab: string;
  purchaseEntryPopupOpen: boolean;
  setPurchaseEntryPopupOpen: (open: boolean) => void;
  editingPurchaseId: string;
  purchaseHeader: { date: string; vendor: string; warehouse: string; image_urls: string[] };
  setPurchaseHeader: Dispatch<SetStateAction<PurchaseEntryModel["purchaseHeader"]>>;
  todayKey: string;
  vendorOptions: PurchaseSelectOption[];
  warehouseNames: string[];
  itemOptions: PurchaseSelectOption[];
  rows: PurchaseRow[];
  setRows: Dispatch<SetStateAction<PurchaseRow[]>>;
  getPurchasePriceHistoryForRow: (row: PurchaseRow) => PurchasePriceHistory | undefined;
  setPurchasePriceHistoryModal: Dispatch<SetStateAction<PurchasePriceHistory | null>>;
  updateRow: (index: number, key: keyof PurchaseRow, value: string | number | undefined, selectedItem?: PurchaseSelectOption) => void;
  openNewItemModal: (index: number) => void;
  removePurchaseRow: (index: number) => void;
  emptyRow: () => PurchaseRow;
  purchaseUploading: boolean;
  setPurchaseUploading: Dispatch<SetStateAction<boolean>>;
  uploadPurchaseFiles: (files: FileList | File[]) => Promise<string[]>;
  purchaseSupplyTotal: number;
  purchaseVatTotal: number;
  purchaseTotal: number;
  purchaseSaving: boolean;
  savePurchase: () => void;
  resetPurchaseForm: () => void;
};

export type PurchaseHistoryUi = Pick<PurchaseEntryUi, "ScrollTable" | "money">;

export const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${Number(value || 0).toLocaleString("ko-KR")}원`;
export const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

export function PurchasePriceHistorySummary({
  ui,
  history,
  currentPrice,
  selectedVendor,
  onOpen,
}: {
  history?: PurchasePriceHistory;
  currentPrice: number;
  selectedVendor: string;
  onOpen: () => void;
  ui: PurchaseHistoryUi;
}) {
  const { money } = ui;
  if (!history?.latest) return null;

  const latest = history.latest;
  const previous = history.previous;
  const currentComparison = comparePurchaseUnitPrice(currentPrice, latest.price);
  const vendorStat = getPurchaseVendorPriceStat(history, selectedVendor);
  const historyDeltaTone = history.deltaAmount === null || history.deltaAmount === 0
    ? "neutral"
    : history.deltaAmount > 0 ? "up" : "down";
  const currentDeltaTone = !currentComparison || currentComparison.deltaAmount === 0
    ? "neutral"
    : currentComparison.deltaAmount > 0 ? "up" : "down";

  return (
    <div className="purchase-price-history-summary">
      <div className="purchase-price-history-head">
        <strong>최근 구매정보</strong>
        <button type="button" onClick={onOpen}>최근 이력 {history.entries.length}건</button>
      </div>
      <div className="purchase-price-history-grid">
        <div><span>최근단가</span><b>{money(latest.price)}원</b><small>{latest.date || "일자 미입력"} · {latest.vendor || "거래처 미입력"}</small></div>
        <div><span>직전단가</span><b>{previous ? `${money(previous.price)}원` : "-"}</b><small>{previous ? `${previous.date || "일자 미입력"} · ${previous.vendor || "거래처 미입력"}` : "이전 구매 없음"}</small></div>
        <div className={`purchase-price-change ${historyDeltaTone}`}>
          <span>전회 대비</span>
          <b>{history.deltaAmount === null ? "-" : signedMoney(history.deltaAmount)}</b>
          <small>{history.deltaPercent === null ? "비교할 이전 단가 없음" : signedPercent(history.deltaPercent)}</small>
        </div>
      </div>
      {vendorStat && normalizePurchasePriceText(vendorStat.vendor) !== normalizePurchasePriceText(latest.vendor) && (
        <div className="purchase-price-vendor-hint">
          현재 거래처 최근단가 <b>{money(vendorStat.latest.price)}원</b>
          <span>{vendorStat.latest.date || "일자 미입력"} · {vendorStat.vendor}</span>
        </div>
      )}
      {currentComparison && (
        <div className={`purchase-price-current-comparison ${currentDeltaTone}${Math.abs(currentComparison.deltaPercent) >= 10 ? " strong" : ""}`}>
          현재 입력단가 {money(currentComparison.current)}원
          <b>{currentComparison.deltaAmount === 0 ? "최근단가와 동일" : `${signedMoney(currentComparison.deltaAmount)} (${signedPercent(currentComparison.deltaPercent)})`}</b>
          {Math.abs(currentComparison.deltaPercent) >= 10 && <small>최근 구매가 대비 10% 이상 차이</small>}
        </div>
      )}
      {latest.priceDerivedFromSupply && <small className="purchase-price-derived-note">단가가 없는 과거 행은 공급가액 ÷ 수량으로 계산했습니다.</small>}
    </div>
  );
}

export function PurchasePriceHistoryModal({ ui, history, onClose }: { ui: PurchaseHistoryUi; history: PurchasePriceHistory; onClose: () => void }) {
  const { ScrollTable, money } = ui;
  const recentRows = history.entries.slice(0, 10);

  return (
    <div className="purchase-price-history-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="purchase-price-history-modal" role="dialog" aria-modal="true" aria-label="품목 단가이력">
        <div className="purchase-price-history-modal-head">
          <div>
            <span>구매 단가이력</span>
            <h2>{history.item || "품목"}</h2>
            {history.spec && <p>규격: {history.spec}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="단가이력 닫기"><X size={18} /> 닫기</button>
        </div>

        <div className="purchase-price-history-kpis">
          <div><span>최근단가</span><b>{history.latest ? `${money(history.latest.price)}원` : "-"}</b></div>
          <div><span>직전단가</span><b>{history.previous ? `${money(history.previous.price)}원` : "-"}</b></div>
          <div><span>수량 가중평균</span><b>{history.weightedAvgPrice === null ? "-" : `${money(history.weightedAvgPrice)}원`}</b></div>
          <div><span>최저 · 최고</span><b>{money(history.minPrice)}원 · {money(history.maxPrice)}원</b></div>
        </div>

        <section className="purchase-price-history-modal-section">
          <div className="purchase-price-history-section-head">
            <div><h3>최근 구매이력</h3><small>최신순 최대 10건</small></div>
          </div>
          <ScrollTable>
            <table>
              <thead><tr><th>구매일</th><th>거래처</th><th>수량</th><th>단가</th><th>공급가액</th><th>합계</th></tr></thead>
              <tbody>{recentRows.map((entry) => (
                <tr key={`${entry.purchaseId}-${entry.id}`}>
                  <td>{entry.date || "-"}</td>
                  <td>{entry.vendor || "거래처 미입력"}</td>
                  <td className="right">{money(entry.qty)}</td>
                  <td className="right">{money(entry.price)}원{entry.priceDerivedFromSupply && <small className="purchase-price-derived-mark">*</small>}</td>
                  <td className="right">{money(entry.supply)}원</td>
                  <td className="right bold">{money(entry.total)}원</td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollTable>
        </section>

        <section className="purchase-price-history-modal-section">
          <div className="purchase-price-history-section-head">
            <div><h3>거래처별 최근단가</h3><small>최근단가가 낮은 거래처부터 표시</small></div>
          </div>
          <ScrollTable>
            <table>
              <thead><tr><th>거래처</th><th>최근구매일</th><th>최근단가</th><th>최근  평균단가</th><th>구매횟수</th></tr></thead>
              <tbody>{history.vendorStats.map((stat) => (
                <tr key={stat.vendorKey}>
                  <td>{stat.vendor}</td>
                  <td>{stat.latest.date || "-"}</td>
                  <td className="right bold">{money(stat.latest.price)}원</td>
                  <td className="right">{money(stat.weightedAvgPrice)}원</td>
                  <td className="right">{money(stat.count)}회</td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollTable>
        </section>
        <p className="purchase-price-history-note">* 단가가 없는 과거 구매행은 공급가액 ÷ 수량으로 보완 계산했습니다.</p>
      </div>
    </div>
  );
}


export function PurchaseEntryView({ model, ui }: { model: PurchaseEntryModel; ui: PurchaseEntryUi }) {
  const {
    menuTab,
    purchaseEntryPopupOpen,
    setPurchaseEntryPopupOpen,
    editingPurchaseId,
    purchaseHeader,
    setPurchaseHeader,
    todayKey,
    vendorOptions,
    warehouseNames,
    itemOptions,
    rows,
    setRows,
    getPurchasePriceHistoryForRow,
    setPurchasePriceHistoryModal,
    updateRow,
    openNewItemModal,
    removePurchaseRow,
    emptyRow,
    purchaseUploading,
    setPurchaseUploading,
    uploadPurchaseFiles,
    purchaseSupplyTotal,
    purchaseVatTotal,
    purchaseTotal,
    purchaseSaving,
    savePurchase,
    resetPurchaseForm,
  } = model;
  const { Field, DateInput, SearchSelect, AttachmentGroup, money } = ui;
  const getTodayKey = () => todayKey;

  return (
    <>
        {(menuTab === "new" || purchaseEntryPopupOpen) && (
          <section className={`card purchase-entry-card ${purchaseEntryPopupOpen ? "purchase-entry-popup-card" : ""}`}>
            <div className="purchase-entry-popup-head">
              <h2>{editingPurchaseId ? "구매 수정" : "구매 입력"}</h2>
              {purchaseEntryPopupOpen && <button onClick={() => setPurchaseEntryPopupOpen(false)}>닫기</button>}
            </div>
            <div className="grid3">
              <Field label="일자" required>
                <DateInput
                  value={purchaseHeader.date || getTodayKey()}
                  onChange={(value) => setPurchaseHeader({ ...purchaseHeader, date: value })}
                  placeholder="20260501 또는 260501"
                  ariaLabel="구매일자 선택"
                />
              </Field>
              <SearchSelect testId="purchase-vendor" label="거래처" required value={purchaseHeader.vendor} options={vendorOptions} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, vendor: v })} placeholder="거래처명 일부 입력" />
              <SearchSelect testId="purchase-warehouse" label="창고" required value={purchaseHeader.warehouse} options={warehouseNames} onChange={(v) => setPurchaseHeader({ ...purchaseHeader, warehouse: v })} placeholder="창고명 일부 입력" />
            </div>
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
                <thead><tr><th>품목 <span className="required-mark">*</span></th><th>규격</th><th>수량 <span className="required-mark">*</span></th><th>단가</th><th>공급가액</th><th>부가세액</th><th>합계</th><th>관리</th></tr></thead>
                <tbody>{rows.map((r, i) => {
                  const priceHistory = getPurchasePriceHistoryForRow(r);
                  return <tr key={r.id}><td>
  <div className="purchase-item-editor">
    <SearchSelect
      testId={`purchase-item-search-${i}`}
      value={r.item}
      options={itemOptions}
      onChange={(v) => updateRow(i, "item", v)}
      onSelect={(option) => updateRow(i, "item", option.name || option.value, option)}
      placeholder="품목 검색"
      variant="item"
    />
    <input
      value={r.item}
      onChange={(e) => updateRow(i, "item", e.target.value)}
      placeholder="품목명 직접수정"
      title="이번 구매입력에서만 품목명을 수정합니다. 품목등록 원본은 바뀌지 않습니다."
    />
    <button
      type="button"
      onClick={() => openNewItemModal(i)}
    >
      + 신규
    </button>
  </div>
  <PurchasePriceHistorySummary
                    ui={ui}
    history={priceHistory}
    currentPrice={Number(r.price || 0)}
    selectedVendor={purchaseHeader.vendor}
    onOpen={() => { if (priceHistory) setPurchasePriceHistoryModal(priceHistory); }}
  />
</td><td><input data-testid={`purchase-spec-${i}`} value={r.spec} onChange={(e) => updateRow(i, "spec", e.target.value)} /></td><td><input data-testid={`purchase-qty-${i}`} className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} /></td><td><input data-testid={`purchase-price-${i}`} className="right" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateRow(i, "supply", e.target.value)} /></td><td><input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateRow(i, "vat", e.target.value)} /></td><td className="right bold">{money(r.total)}</td><td><button className="icon" title="행 삭제" aria-label="행 삭제" onClick={() => removePurchaseRow(i)}><Trash2 size={16} /></button></td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="mobile-entry-item-list" aria-label="구매 품목 입력">
              {rows.map((r, i) => {
                const priceHistory = getPurchasePriceHistoryForRow(r);
                return (
                <div className="mobile-entry-item-card" key={`mobile-purchase-${r.id}`}>
                  <div className="mobile-entry-item-head">
                    <div><span>구매 품목</span><b>{i + 1}</b></div>
                    <button type="button" className="mobile-entry-delete" onClick={() => removePurchaseRow(i)} aria-label={`${i + 1}번 구매 품목 삭제`}><Trash2 size={16} /> 삭제</button>
                  </div>

                  <SearchSelect
                    testId={`purchase-mobile-item-search-${i}`}
                    label="품목"
                    required
                    value={r.item}
                    options={itemOptions}
                    onChange={(value) => updateRow(i, "item", value)}
                    onSelect={(option) => updateRow(i, "item", option.name || option.value, option)}
                    placeholder="품목명 검색"
                    variant="item"
                  />

                  <Field label="품목명 직접수정">
                    <div className="mobile-entry-inline-row">
                      <input value={r.item} onChange={(e) => updateRow(i, "item", e.target.value)} placeholder="이번 구매에서 사용할 품목명" />
                      <button type="button" onClick={() => openNewItemModal(i)}><Plus size={16} /> 신규</button>
                    </div>
                  </Field>

                  <PurchasePriceHistorySummary
                    ui={ui}
                    history={priceHistory}
                    currentPrice={Number(r.price || 0)}
                    selectedVendor={purchaseHeader.vendor}
                    onOpen={() => { if (priceHistory) setPurchasePriceHistoryModal(priceHistory); }}
                  />

                  <Field label="규격">
                    <input data-testid={`purchase-mobile-spec-${i}`} value={r.spec} onChange={(e) => updateRow(i, "spec", e.target.value)} placeholder="규격 입력" />
                  </Field>

                  <div className="mobile-entry-grid">
                    <Field label="수량" required>
                      <input data-testid={`purchase-mobile-qty-${i}`} className="right" inputMode="decimal" value={r.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="단가">
                      <input data-testid={`purchase-mobile-price-${i}`} className="right" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="공급가액">
                      <input className="right" inputMode="decimal" value={r.supply} onChange={(e) => updateRow(i, "supply", e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="부가세액">
                      <input className="right" inputMode="decimal" value={r.vat} onChange={(e) => updateRow(i, "vat", e.target.value)} placeholder="0" />
                    </Field>
                  </div>

                  <div className="mobile-entry-total"><span>품목 합계</span><b>{money(r.total)}원</b></div>
                </div>
                );
              })}
            </div>
            <div className="purchase-entry-footer">
              <div className="purchase-entry-support">
                <button className="purchase-add-item-button" onClick={() => setRows([...rows, emptyRow()])}><Plus size={16} /> 품목 추가</button>
                <div className="purchase-upload-panel">
                  <strong>구매 첨부파일</strong>
                  <p>사진 20MB · PDF 30MB · 음성 50MB 이하, 한 번에 최대 20개입니다.</p>
                  <label className={`upload${purchaseUploading ? " upload-busy" : ""}`} aria-disabled={purchaseUploading}>
                    <Upload size={16} /> {purchaseUploading ? "첨부 업로드 중..." : "첨부파일 선택"}
                    <input
                      type="file"
                      accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm"
                      multiple
                      disabled={purchaseUploading}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const files = e.target.files;
                        if (!files?.length) return;
                        setPurchaseUploading(true);
                        try {
                          const urls = await uploadPurchaseFiles(files);
                          setPurchaseHeader((prev) => ({
                            ...prev,
                            image_urls: [...(prev.image_urls || []), ...urls],
                          }));
                        } finally {
                          input.value = "";
                          setPurchaseUploading(false);
                        }
                      }}
                    />
                  </label>
                  <div className="receipt-preview">
                    {(purchaseHeader.image_urls || []).length ? (
                      <AttachmentGroup
                        urls={purchaseHeader.image_urls || []}
                        onRemove={(removeIndex) => setPurchaseHeader((prev) => ({
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
              <div className="totals purchase-entry-summary">
                <span>결제금액 요약</span>
                <div>공급가액 합계 <b>{money(purchaseSupplyTotal)}원</b></div>
                <div>부가세액 합계 <b>{money(purchaseVatTotal)}원</b></div>
                <div className="big"><em>총합</em><strong>{money(purchaseTotal)}원</strong></div>
              </div>
            </div>
            <div className="actions right-actions entry-actions"><button data-testid="purchase-save" className="primary" disabled={purchaseSaving || purchaseUploading} onClick={savePurchase}><Save size={16} /> {purchaseUploading ? "업로드 중..." : purchaseSaving ? "저장 중..." : editingPurchaseId ? "수정 저장" : "저장"}</button><button disabled={purchaseSaving || purchaseUploading} onClick={resetPurchaseForm}><RotateCcw size={16} /> 초기화</button></div>
            <p className="draft-help-text">작성 중인 구매입력 내용은 자동 임시저장됩니다. 새로고침하거나 메뉴를 이동해도 다시 구매입력에 들어오면 복원됩니다.</p>
          </section>
        )}
    </>
  );
}
