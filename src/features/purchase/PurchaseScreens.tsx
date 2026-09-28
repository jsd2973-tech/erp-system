import { useEffect, useMemo, useRef, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  getPurchaseItemSummary,
  isPurchasePaid,
  maintenancePurchaseLinkIdentity,
  numericValue,
} from "./purchaseModel";
import { PurchasePriceHistoryModal, signedMoney, signedPercent, type PurchaseEntryUi } from "./PurchaseEntry";
import {
  buildPurchasePriceHistory,
  getPurchaseEffectiveUnitPrice,
  getPurchasePriceHistoryKey,
  type PurchasePriceHistory,
} from "./purchasePriceHistory";
import type { MaintenancePurchaseLink, Purchase, PurchasePaymentStatus, PurchaseRow, PurchaseSearch } from "./purchaseTypes";

export type PurchaseAttachmentViewer = { title: string; urls: string[] };
export type PurchaseAttachmentViewerModalProps = {
  viewer: PurchaseAttachmentViewer | null;
  onClose: () => void;
};
export type PurchaseAttachmentSummaryButtonProps = {
  urls?: string[];
  onOpen: () => void;
};

type PurchaseExportRow = Record<string, unknown>;

export type PurchaseScreensUi = PurchaseEntryUi & {
  AttachmentSummaryButton: ComponentType<PurchaseAttachmentSummaryButtonProps>;
  AttachmentViewerModal: ComponentType<PurchaseAttachmentViewerModalProps>;
  downloadExcel: (fileName: string, rows: PurchaseExportRow[]) => void;
  downloadPdf: (fileName: string, title: string, rows: PurchaseExportRow[]) => void;
  todayText: () => string;
  withTotalRow: (rows: PurchaseExportRow[], totalRow: PurchaseExportRow) => PurchaseExportRow[];
  getTodayKey: () => string;
  formatInputDate: (value: string) => string;
  koreaNow: () => Date;
  toDateKey: (date: Date) => string;
};

export type PurchaseListProps = {
  purchases: Purchase[];
  maintenancePurchaseLinks: MaintenancePurchaseLink[];
  search: PurchaseSearch;
  setSearch: Dispatch<SetStateAction<PurchaseSearch>>;
  editPurchase: (purchase: Purchase) => void;
  deletePurchase: (purchaseId: string) => void | Promise<void>;
  isAdmin: boolean;
  canUpdateTaxInvoice: boolean;
  taxInvoiceSavingId: string;
  onUpdateTaxInvoice: (purchase: Purchase, received: boolean) => void | Promise<void>;
  paymentSavingId: string;
  onUpdatePayment: (purchase: Purchase, status: PurchasePaymentStatus) => void | Promise<void>;
  onLinkPhoto: (purchase: Purchase) => void;
  onQuickPurchase: () => void;
  onImportPurchaseExcel: (file: File) => void | Promise<void>;
  ui: PurchaseScreensUi;
};

export type PurchaseStatusProps = {
  purchases: Purchase[];
  ui: Pick<PurchaseScreensUi, "Field" | "DateInput" | "ScrollTable" | "money" | "downloadExcel" | "todayText" | "withTotalRow">;
};

export function PurchaseList({
  purchases,
  maintenancePurchaseLinks = [],
  search,
  setSearch,
  editPurchase,
  deletePurchase,
  isAdmin,
  canUpdateTaxInvoice,
  taxInvoiceSavingId,
  onUpdateTaxInvoice,
  paymentSavingId,
  onUpdatePayment,
  onLinkPhoto,
  onQuickPurchase,
  onImportPurchaseExcel,
  ui,
}: PurchaseListProps) {
  const {
    ScrollTable,
    AttachmentGroup,
    AttachmentSummaryButton,
    AttachmentViewerModal,
    money,
    downloadExcel,
    downloadPdf,
    todayText,
    withTotalRow,
    getTodayKey,
    formatInputDate,
    koreaNow,
    toDateKey,
  } = ui;
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [attachmentViewer, setAttachmentViewer] = useState<{ title: string; urls: string[] } | null>(null);
  const [purchasePage, setPurchasePage] = useState(1);
  const purchaseImportInputRef = useRef<HTMLInputElement | null>(null);
  const purchasePageSize = 20;
  const purchaseTotalPages = Math.max(1, Math.ceil((purchases || []).length / purchasePageSize));
  const purchaseSafePage = Math.min(Math.max(purchasePage, 1), purchaseTotalPages);
  const purchaseStartIndex = (purchaseSafePage - 1) * purchasePageSize;
  const pagedPurchases = (purchases || []).slice(purchaseStartIndex, purchaseStartIndex + purchasePageSize);
  const purchaseEndIndex = purchases.length ? Math.min(purchaseStartIndex + pagedPurchases.length, purchases.length) : 0;
  const liveDetailPurchase = detailPurchase
    ? (purchases || []).find((purchase: Purchase) => purchase.id === detailPurchase.id) || detailPurchase
    : null;

  useEffect(() => {
    setPurchasePage(1);
  }, [search.from, search.to, search.vendor, search.warehouse, search.item, search.taxInvoice, search.paymentStatus]);

  useEffect(() => {
    if (purchasePage > purchaseTotalPages) setPurchasePage(purchaseTotalPages);
  }, [purchasePage, purchaseTotalPages]);

  const setPurchasePeriod = (from: string, to: string) => {
    setSearch({ ...search, from, to });
  };
  const setThisWeekPeriod = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setPurchasePeriod(toDateKey(monday), toDateKey(sunday));
  };
  const setThisMonthPeriod = () => {
    const now = koreaNow();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPurchasePeriod(toDateKey(first), toDateKey(last));
  };
  const setLastMonthPeriod = () => {
    const now = koreaNow();
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    setPurchasePeriod(toDateKey(first), toDateKey(last));
  };
  const setThisYearPeriod = () => {
    const now = koreaNow();
    setPurchasePeriod(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
  };

  const openPurchaseDetail = (purchase: Purchase) => {
    setDetailPurchase(purchase);
  };

  const renderPurchasePages = () => {
    if (purchaseTotalPages <= 1) return null;

    const pages = Array.from({ length: purchaseTotalPages }, (_, i) => i + 1).filter((page) => {
      return page === 1 || page === purchaseTotalPages || Math.abs(page - purchaseSafePage) <= 2;
    });

    return (
      <div className="purchase-pagination">
        <button disabled={purchaseSafePage <= 1} onClick={() => setPurchasePage((page) => Math.max(1, page - 1))}>이전</button>
        {pages.map((page, index) => {
          const prevPage = pages[index - 1];
          return (
            <span key={page} className="purchase-page-group">
              {prevPage && page - prevPage > 1 && <span className="purchase-page-ellipsis">...</span>}
              <button className={page === purchaseSafePage ? "active" : ""} onClick={() => setPurchasePage(page)}>{page}</button>
            </span>
          );
        })}
        <button disabled={purchaseSafePage >= purchaseTotalPages} onClick={() => setPurchasePage((page) => Math.min(purchaseTotalPages, page + 1))}>다음</button>
      </div>
    );
  };

  const renderPaymentStatusCheck = (purchase: Purchase) => {
    const paid = isPurchasePaid(purchase);
    return (
      <label className={`payment-status-check${paid ? " checked" : ""}`}>
        <input
          type="checkbox"
          data-testid={`purchase-payment-toggle-${purchase.id}`}
          checked={paid}
          disabled={!isAdmin || Boolean(paymentSavingId)}
          onChange={(event) => onUpdatePayment(purchase, event.target.checked ? "paid" : "unpaid")}
        />
        <em>{paymentSavingId === purchase.id ? "저장 중" : paid ? "지급완료" : "미지급"}</em>
      </label>
    );
  };

  return <>
    <AttachmentViewerModal viewer={attachmentViewer} onClose={() => setAttachmentViewer(null)} />
    <section className="card lookup-page purchase-lookup-page"><div className="between"><h2>구매조회</h2><div className="purchase-lookup-actions"><button className="primary" onClick={onQuickPurchase}>구매입력</button><button onClick={() => purchaseImportInputRef.current?.click()}>엑셀 업로드</button><input ref={purchaseImportInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportPurchaseExcel(file); e.currentTarget.value = ""; }} /><button onClick={() => downloadExcel(`구매조회_${todayText()}`, withTotalRow(
  purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: getPurchaseItemSummary(p), 세금계산서: p.taxInvoiceReceived ? "받음" : "미수취", 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })),
  { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }
))}>엑셀 다운로드</button><button onClick={() => downloadPdf(`구매조회_${todayText()}`, "구매조회", withTotalRow(purchases.map((p: Purchase) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 대표품목: getPurchaseItemSummary(p), 세금계산서: p.taxInvoiceReceived ? "받음" : "미수취", 공급가액: p.supplyTotal, 부가세액: p.vatTotal, 합계: p.total })), { 일자: "총합계", 공급가액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.supplyTotal || 0), 0), 부가세액: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.vatTotal || 0), 0), 합계: purchases.reduce((sum: number, p: Purchase) => sum + Number(p.total || 0), 0) }))}>PDF 출력</button></div></div><div className="purchase-period-buttons"><button onClick={() => setPurchasePeriod(getTodayKey(), getTodayKey())}>오늘</button><button onClick={setThisWeekPeriod}>이번주</button><button onClick={setThisMonthPeriod}>이번달</button><button onClick={setLastMonthPeriod}>지난달</button><button onClick={setThisYearPeriod}>올해</button><button onClick={() => setSearch({ from: "", to: "", vendor: "", warehouse: "", item: "", taxInvoice: "" })}>전체</button></div><div className="grid5 purchase-filter-grid"><input placeholder="시작일 240107 또는 20240107" value={search.from} onChange={(e) => setSearch({ ...search, from: formatInputDate(e.target.value) })} /><input placeholder="종료일 240107 또는 20240107" value={search.to} onChange={(e) => setSearch({ ...search, to: formatInputDate(e.target.value) })} /><input placeholder="거래처 검색" value={search.vendor} onChange={(e) => setSearch({ ...search, vendor: e.target.value })} /><input placeholder="창고 검색" value={search.warehouse} onChange={(e) => setSearch({ ...search, warehouse: e.target.value })} /><input placeholder="품목 검색" value={search.item} onChange={(e) => setSearch({ ...search, item: e.target.value })} /><select aria-label="세금계산서 수취 여부" value={search.taxInvoice || ""} onChange={(e) => setSearch({ ...search, taxInvoice: e.target.value })}><option value="">세금계산서 전체</option><option value="received">받음</option><option value="unreceived">미수취</option></select></div>
      <div className="purchase-payment-filter-row"><label>지급상태 <select aria-label="지급상태" value={search.paymentStatus || ""} onChange={(e) => setSearch({ ...search, paymentStatus: e.target.value })}><option value="">전체</option><option value="unpaid">미지급</option><option value="paid">지급완료</option></select></label></div>
      <div className="purchase-page-summary">검색결과 {money(purchases.length)}건 · {purchases.length ? `${money(purchaseStartIndex + 1)}-${money(purchaseEndIndex)}건` : "0건"} 표시</div>
      <div className="mobile-purchase-cards">
  {!pagedPurchases.length ? (
    <div className="empty">저장된 구매내역 없음</div>
  ) : pagedPurchases.map((p: Purchase, pageIndex: number) => {
    const index = purchaseStartIndex + pageIndex;
    const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
    const seq = sameDateBeforeCount + 1;
    return (
      <div className="mobile-purchase-card" key={`mobile-${p.id}`}>
        <div className="mobile-purchase-card-head">
          <strong>{p.vendor || "거래처 미입력"}</strong>
          <span>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</span>
        </div>
        <div className="mobile-purchase-card-row"><span>품목</span><b><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></b></div>
        <div className="mobile-purchase-card-row"><span>창고</span><b>{p.warehouse || "-"}</b></div>
        <div className="mobile-purchase-card-row"><span>합계</span><b>{money(p.total)}원</b></div>
        <div className="mobile-purchase-card-row"><span>지급상태</span><b>{renderPaymentStatusCheck(p)}{isPurchasePaid(p) && p.paidDate ? <small className="purchase-payment-date">{p.paidDate}</small> : null}</b></div>
        <div className="mobile-purchase-card-row"><span>세금계산서</span><b><label className={`tax-invoice-check${p.taxInvoiceReceived ? " checked" : ""}`}><input type="checkbox" checked={Boolean(p.taxInvoiceReceived)} disabled={!canUpdateTaxInvoice || Boolean(taxInvoiceSavingId)} onChange={(e) => onUpdateTaxInvoice(p, e.target.checked)} /><em>{taxInvoiceSavingId === p.id ? "저장 중" : p.taxInvoiceReceived ? "받음" : "미수취"}</em></label></b></div>
        <div className="mobile-purchase-card-row"><span>첨부</span><b><AttachmentSummaryButton urls={p.image_urls || (p.image_url ? [p.image_url] : [])} onOpen={() => setAttachmentViewer({ title: `${p.vendor || "거래처 미입력"} · ${p.date || "-"}`, urls: p.image_urls || (p.image_url ? [p.image_url] : []) })} /></b></div>
        {isAdmin && (
          <div className="mobile-purchase-card-actions">
            <button onClick={() => onLinkPhoto(p)}>사진연결</button>
            <button onClick={() => editPurchase(p)}>수정</button>
            <button onClick={() => deletePurchase(p.id)}>삭제</button>
          </div>
        )}
      </div>
    );
  })}
</div><ScrollTable><table><thead><tr><th>관리번호</th><th>거래처</th><th>품목</th><th>창고</th><th>합계</th><th>지급상태</th><th>세금계산서</th><th>첨부</th><th>관리</th></tr></thead><tbody>{!pagedPurchases.length ? <tr><td colSpan={9} className="empty">저장된 구매내역 없음</td></tr> : pagedPurchases.map((p: Purchase, pageIndex: number) => {
  const index = purchaseStartIndex + pageIndex;
  const sameDateBeforeCount = purchases.slice(0, index).filter((x: Purchase) => x.date === p.date).length;
  const seq = sameDateBeforeCount + 1;
  return <tr key={p.id}><td>{`${p.date || ""}-${String(seq).padStart(2, "0")}`}</td><td>{p.vendor}</td><td><button className="purchase-item-detail-button" onClick={() => openPurchaseDetail(p)}>{getPurchaseItemSummary(p)}</button></td><td>{p.warehouse}</td><td>{money(p.total)}</td><td>{renderPaymentStatusCheck(p)}{isPurchasePaid(p) && p.paidDate ? <small className="purchase-payment-date">{p.paidDate}</small> : null}</td><td><label className={`tax-invoice-check${p.taxInvoiceReceived ? " checked" : ""}`}><input type="checkbox" checked={Boolean(p.taxInvoiceReceived)} disabled={!canUpdateTaxInvoice || Boolean(taxInvoiceSavingId)} onChange={(e) => onUpdateTaxInvoice(p, e.target.checked)} /><em>{taxInvoiceSavingId === p.id ? "저장 중" : p.taxInvoiceReceived ? "받음" : "미수취"}</em></label></td><td><AttachmentSummaryButton urls={p.image_urls || (p.image_url ? [p.image_url] : [])} onOpen={() => setAttachmentViewer({ title: `${p.vendor || "거래처 미입력"} · ${p.date || "-"}`, urls: p.image_urls || (p.image_url ? [p.image_url] : []) })} /></td><td>{isAdmin ? <><button className="icon" onClick={() => onLinkPhoto(p)}>사진</button><button className="icon" onClick={() => editPurchase(p)}><Pencil size={16} /></button><button className="icon" onClick={() => deletePurchase(p.id)}><Trash2 size={16} /></button></> : "-"}</td></tr>})}</tbody></table></ScrollTable>{renderPurchasePages()}</section>
    {liveDetailPurchase && (
      <div className="purchase-detail-modal-backdrop" onClick={() => setDetailPurchase(null)}>
        <div className="purchase-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="purchase-detail-modal-head">
            <div>
              <h2>상세 품목</h2>
              <p>{liveDetailPurchase.vendor || "거래처 미입력"} · {liveDetailPurchase.date || "날짜 없음"}</p>
            </div>
            <button onClick={() => setDetailPurchase(null)}>닫기</button>
          </div>
          <ScrollTable>
            <table className="purchase-detail-table">
              <thead>
                <tr><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세액</th><th>합계</th><th>정비사용</th></tr>
              </thead>
              <tbody>
                {(liveDetailPurchase.rows || []).map((row: PurchaseRow) => (
                  <tr key={row.id}>
                    <td>{row.item || "-"}</td>
                    <td>{row.spec || "-"}</td>
                    <td className="right">{money(row.qty)}</td>
                    <td className="right">{money(row.price)}</td>
                    <td className="right">{money(row.supply)}</td>
                    <td className="right">{money(row.vat)}</td>
                    <td className="right">{money(row.total)}</td>
                    <td>
                      {(() => {
                        const links = maintenancePurchaseLinks.filter((link: MaintenancePurchaseLink) => link.purchase_id === liveDetailPurchase.id && link.purchase_row_id === row.id);
                        const usedQty = links.reduce((sum: number, link: MaintenancePurchaseLink) => sum + numericValue(link.used_qty), 0);
                        const remainingQty = Math.max(0, numericValue(row.qty) - usedQty);
                        return (
                          <div className="purchase-maintenance-usage-cell">
                            {links.length
                              ? links.map((link: MaintenancePurchaseLink) => <span key={maintenancePurchaseLinkIdentity(link)}>{link.maintenance_date_snapshot || "-"} · {link.maintenance_title_snapshot || link.maintenance_equipment_snapshot || "정비"} · {link.used_qty} 사용</span>)
                              : <span>사용처 없음</span>}
                            <small>구매 {money(row.qty)} · 정비사용 {money(usedQty)} · 미연결 {money(remainingQty)}</small>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="purchase-detail-total">
            <span>공급가액 {money(liveDetailPurchase.supplyTotal)}원</span>
            <span>부가세 {money(liveDetailPurchase.vatTotal)}원</span>
            <b>합계 {money(liveDetailPurchase.total)}원</b>
          </div>
          <div className="purchase-maintenance-summary">
            <h3>정비 사용내역</h3>
            {(() => {
              const links = maintenancePurchaseLinks.filter((link: MaintenancePurchaseLink) => link.purchase_id === liveDetailPurchase.id);
              return links.length ? links.map((link: MaintenancePurchaseLink) => (
                <div key={maintenancePurchaseLinkIdentity(link)}>
                  <strong>{link.item_name || "품목"}</strong>
                  <span>{link.maintenance_date_snapshot || "-"} · {link.maintenance_equipment_snapshot || "대상 미입력"} · {link.maintenance_title_snapshot || "정비"}</span>
                  <b>{link.used_qty} 사용 · {money(link.used_qty * link.unit_price_snapshot)}원</b>
                </div>
              )) : <p className="muted">연결된 정비 사용내역이 없습니다.</p>;
            })()}
          </div>
          <div className="purchase-payment-detail">
            <div>
              <span>지급상태</span>
              <strong className={`purchase-payment-badge ${isPurchasePaid(liveDetailPurchase) ? "paid" : "unpaid"}`}>{isPurchasePaid(liveDetailPurchase) ? "지급완료" : "미지급"}</strong>
              {isPurchasePaid(liveDetailPurchase) && liveDetailPurchase.paidDate ? <small>{liveDetailPurchase.paidDate}</small> : null}
            </div>
            {isAdmin && (
              <button
                className={isPurchasePaid(liveDetailPurchase) ? "danger" : "primary"}
                disabled={paymentSavingId === liveDetailPurchase.id}
                onClick={() => onUpdatePayment(liveDetailPurchase, isPurchasePaid(liveDetailPurchase) ? "unpaid" : "paid")}
              >
                {paymentSavingId === liveDetailPurchase.id ? "저장 중..." : isPurchasePaid(liveDetailPurchase) ? "지급완료 취소" : "지급완료 처리"}
              </button>
            )}
          </div>
          <div className="purchase-detail-attachment-box">
            <h3>첨부파일</h3>
            <AttachmentGroup urls={liveDetailPurchase.image_urls || (liveDetailPurchase.image_url ? [liveDetailPurchase.image_url] : [])} />
          </div>
        </div>
      </div>
    )}
  </>;
}



export function PurchaseStatus({ purchases, ui }: PurchaseStatusProps) {
  const { Field, DateInput, ScrollTable, money, downloadExcel, todayText, withTotalRow } = ui;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vendor, setVendor] = useState("");
  const [item, setItem] = useState("");
  const [priceHistoryModal, setPriceHistoryModal] = useState<PurchasePriceHistory | null>(null);
  const [mobileItemAnalysisOpen, setMobileItemAnalysisOpen] = useState(false);
  const [mobileMonthlyOpen, setMobileMonthlyOpen] = useState(false);
  const [mobileVendorOpen, setMobileVendorOpen] = useState(false);
  const [mobilePurchaseDetailOpen, setMobilePurchaseDetailOpen] = useState(false);

  const hasItemAnalysisFilter = Boolean(from || to || vendor || item);
  useEffect(() => {
    setMobileItemAnalysisOpen(hasItemAnalysisFilter);
    setMobilePurchaseDetailOpen(hasItemAnalysisFilter);
  }, [hasItemAnalysisFilter]);

  const allPriceHistoryMap = useMemo(() => buildPurchasePriceHistory(purchases), [purchases]);

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      const d = p.date || "";
      const okFrom = !from || d >= from;
      const okTo = !to || d <= to;
      const okVendor = !vendor || p.vendor.includes(vendor);
      const okItem = !item || p.rows.some((r) => r.item.includes(item));
      return okFrom && okTo && okVendor && okItem;
    });
  }, [purchases, from, to, vendor, item]);

  const summary = useMemo(() => {
    const totalSupply = filtered.reduce((sum, p) => sum + Number(p.supplyTotal || 0), 0);
    const totalVat = filtered.reduce((sum, p) => sum + Number(p.vatTotal || 0), 0);
    const total = filtered.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const rowCount = filtered.reduce((sum, p) => sum + (p.rows?.length || 0), 0);
    return { totalSupply, totalVat, total, rowCount };
  }, [filtered]);

  const monthRangeText = (month: string) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return "-";
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${month}-01 ~ ${month}-${String(lastDay).padStart(2, "0")}`;
  };

  const monthly = useMemo(() => {
    const vendorKeyword = vendor.trim();
    const itemKeyword = item.trim();

    const base = purchases.filter((p) => {
      const okVendor = !vendorKeyword || String(p.vendor || "").includes(vendorKeyword);
      const okItem = !itemKeyword || (p.rows || []).some((r) => String(r.item || "").includes(itemKeyword));
      return okVendor && okItem;
    });

    const selectedMonths = new Set<string>();

    if (from || to) {
      base.forEach((p) => {
        const date = String(p.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const month = date.slice(0, 7);
        const monthStart = `${month}-01`;
        const [year, monthNumber] = month.split("-").map(Number);
        const monthEnd = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
        const overlapsFrom = !from || monthEnd >= from;
        const overlapsTo = !to || monthStart <= to;
        if (overlapsFrom && overlapsTo) selectedMonths.add(month);
      });
    }

    const map = new Map<string, { month: string; period: string; count: number; rowCount: number; supply: number; vat: number; total: number }>();

    base.forEach((p) => {
      const date = String(p.date || "");
      const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "미지정";

      if ((from || to) && month !== "미지정" && !selectedMonths.has(month)) return;

      const cur = map.get(month) || {
        month,
        period: monthRangeText(month),
        count: 0,
        rowCount: 0,
        supply: 0,
        vat: 0,
        total: 0,
      };

      cur.count += 1;
      cur.rowCount += (p.rows || []).length;
      cur.supply += Number(p.supplyTotal || 0);
      cur.vat += Number(p.vatTotal || 0);
      cur.total += Number(p.total || 0);
      map.set(month, cur);
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [purchases, from, to, vendor, item]);

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendor: string; count: number; total: number }>();
    filtered.forEach((p) => {
      const name = p.vendor || "미지정";
      const cur = map.get(name) || { vendor: name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.total || 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const itemAnalysis = useMemo(() => {
    type ItemAnalysisBucket = {
      key: string;
      item: string;
      spec: string;
      count: number;
      quantity: number;
      supply: number;
      total: number;
      priceValues: number[];
      weightedPriceTotal: number;
      weightedQuantity: number;
      latestInPeriod: { date: string; vendor: string; sortKey: string } | null;
      vendorTotals: Map<string, { vendor: string; total: number }>;
    };

    const map = new Map<string, ItemAnalysisBucket>();
    const itemKeyword = item.trim();

    filtered.forEach((purchase) => {
      (purchase.rows || []).forEach((row) => {
        const rowItem = String(row.item || "").trim();
        const rowSpec = String(row.spec || "").trim();
        if (!rowItem || (itemKeyword && !rowItem.includes(itemKeyword))) return;

        const key = getPurchasePriceHistoryKey(rowItem, rowSpec);
        const qty = Number(row.qty || 0);
        const supply = Number(row.supply || 0);
        const total = Number(row.total || 0);
        const effectivePrice = getPurchaseEffectiveUnitPrice(row);
        const bucket = map.get(key) || {
          key,
          item: rowItem,
          spec: rowSpec,
          count: 0,
          quantity: 0,
          supply: 0,
          total: 0,
          priceValues: [],
          weightedPriceTotal: 0,
          weightedQuantity: 0,
          latestInPeriod: null,
          vendorTotals: new Map<string, { vendor: string; total: number }>(),
        };

        bucket.count += 1;
        bucket.quantity += Number.isFinite(qty) ? qty : 0;
        bucket.supply += Number.isFinite(supply) ? supply : 0;
        bucket.total += Number.isFinite(total) ? total : 0;
        if (effectivePrice.price > 0) {
          bucket.priceValues.push(effectivePrice.price);
          if (qty > 0) {
            bucket.weightedPriceTotal += effectivePrice.price * qty;
            bucket.weightedQuantity += qty;
          }
        }

        const candidateSortKey = `${purchase.date || ""}|${purchase.id || ""}`;
        if (!bucket.latestInPeriod || candidateSortKey > bucket.latestInPeriod.sortKey) {
          bucket.latestInPeriod = { date: purchase.date || "", vendor: purchase.vendor || "", sortKey: candidateSortKey };
        }

        const vendorKey = String(purchase.vendor || "거래처 미입력").trim() || "거래처 미입력";
        const vendorValue = (Number.isFinite(supply) && supply > 0)
          ? supply
          : Math.max(0, effectivePrice.price * Math.max(0, qty));
        const currentVendor = bucket.vendorTotals.get(vendorKey) || { vendor: vendorKey, total: 0 };
        currentVendor.total += vendorValue;
        bucket.vendorTotals.set(vendorKey, currentVendor);
        map.set(key, bucket);
      });
    });

    return Array.from(map.values())
      .map((bucket) => {
        const history = allPriceHistoryMap.get(bucket.key);
        const majorVendor = Array.from(bucket.vendorTotals.values()).sort((a, b) => b.total - a.total)[0];
        return {
          ...bucket,
          history,
          weightedAvgPrice: bucket.weightedQuantity > 0 ? bucket.weightedPriceTotal / bucket.weightedQuantity : null,
          minPrice: bucket.priceValues.length ? Math.min(...bucket.priceValues) : null,
          maxPrice: bucket.priceValues.length ? Math.max(...bucket.priceValues) : null,
          recentPrice: history?.latest?.price ?? null,
          previousPrice: history?.previous?.price ?? null,
          historyDeltaAmount: history?.deltaAmount ?? null,
          historyDeltaPercent: history?.deltaPercent ?? null,
          recentDate: history?.latest?.date || bucket.latestInPeriod?.date || "",
          recentVendor: history?.latest?.vendor || bucket.latestInPeriod?.vendor || "거래처 미입력",
          majorVendor: majorVendor?.vendor || "거래처 미입력",
        };
      })
      .sort((a, b) => {
        const dateCompare = String(b.recentDate || "").localeCompare(String(a.recentDate || ""));
        if (dateCompare !== 0) return dateCompare;
        return b.supply - a.supply;
      });
  }, [filtered, allPriceHistoryMap, item]);

  return (
    <section className="card">
      <div className="between"><h2>구매현황</h2><button onClick={() => downloadExcel(`구매현황_${todayText()}`, withTotalRow(
  filtered.flatMap((p) => (p.rows || []).map((r) => ({ 일자: p.date, 거래처: p.vendor, 창고: p.warehouse, 품목: r.item, 규격: r.spec, 수량: r.qty, 단가: r.price, 공급가액: r.supply, 부가세액: r.vat, 합계: r.total }))),
  {
    일자: "총합계",
    수량: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.qty || 0), 0), 0),
    단가: filtered.reduce((sum, p) => sum + (p.rows || []).reduce((s, r) => s + Number(r.price || 0), 0), 0),
    공급가액: filtered.reduce((sum, p) => sum + Number(p.supplyTotal || 0), 0),
    부가세액: filtered.reduce((sum, p) => sum + Number(p.vatTotal || 0), 0),
    합계: filtered.reduce((sum, p) => sum + Number(p.total || 0), 0)
  }
))}>엑셀 다운로드</button></div>
      <div className="grid5">
        <Field label="시작일"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="종료일"><DateInput value={to} onChange={setTo} /></Field>
        <Field label="거래처"><input placeholder="거래처 일부 검색" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
        <Field label="품목"><input placeholder="품목 일부 검색" value={item} onChange={(e) => setItem(e.target.value)} /></Field>
        <Field label="초기화"><button onClick={() => { setFrom(""); setTo(""); setVendor(""); setItem(""); }}>검색 초기화</button></Field>
      </div>

      <div className="status-cards">
        <div><span>구매건수</span><b>{filtered.length}건</b></div>
        <div><span>품목행수</span><b>{summary.rowCount}건</b></div>
        <div><span>공급가액</span><b>{money(summary.totalSupply)}원</b></div>
        <div><span>부가세액</span><b>{money(summary.totalVat)}원</b></div>
        <div><span>총합계</span><b>{money(summary.total)}원</b></div>
      </div>

      <div className="between purchase-status-section-head">
        <div>
          <h3>월별 구매현황</h3>
          <p className="muted">월별 집계는 선택한 기간이 월 중간이어도 해당 월 1일~말일 전체 기준으로 계산됩니다.</p>
        </div>

        <div className="purchase-status-section-actions">
          <button type="button" className="purchase-status-mobile-toggle" onClick={() => setMobileMonthlyOpen((open) => !open)} aria-expanded={mobileMonthlyOpen}>
            {mobileMonthlyOpen ? "접기" : "펼치기"}
          </button>
        <button onClick={() => downloadExcel(`월별구매현황_${todayText()}`, withTotalRow(
          monthly.map((m) => ({
            월: m.month,
            집계기간: m.period,
            구매건수: m.count,
            품목행수: m.rowCount,
            공급가액: m.supply,
            부가세액: m.vat,
            합계: m.total,
          })),
          {
            월: "총합계",
            집계기간: "-",
            구매건수: monthly.reduce((sum, m) => sum + m.count, 0),
            품목행수: monthly.reduce((sum, m) => sum + m.rowCount, 0),
            공급가액: monthly.reduce((sum, m) => sum + m.supply, 0),
            부가세액: monthly.reduce((sum, m) => sum + m.vat, 0),
            합계: monthly.reduce((sum, m) => sum + m.total, 0),
          }
        ))}>월별 엑셀</button>

        </div>
      </div>
      <div className={`purchase-status-collapsible-body${mobileMonthlyOpen ? " open" : ""}`}>
      <ScrollTable>
        <table>
          <thead><tr><th>월</th><th>집계기간</th><th>구매건수</th><th>품목행수</th><th>공급가액</th><th>부가세액</th><th>합계</th></tr></thead>
          <tbody>{!monthly.length ? <tr><td colSpan={7} className="empty">조회된 월별 구매현황 없음</td></tr> : monthly.map((m) => <tr key={m.month}><td className="bold">{m.month}</td><td>{m.period}</td><td className="right">{money(m.count)}</td><td className="right">{money(m.rowCount)}</td><td className="right">{money(m.supply)}</td><td className="right">{money(m.vat)}</td><td className="right bold">{money(m.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>
      </div>

      <div className="between purchase-status-section-head">
        <h3>거래처별 구매현황</h3>
        <button type="button" className="purchase-status-mobile-toggle" onClick={() => setMobileVendorOpen((open) => !open)} aria-expanded={mobileVendorOpen}>
          {mobileVendorOpen ? "접기" : "펼치기"}
        </button>
      </div>
      <div className={`purchase-status-collapsible-body${mobileVendorOpen ? " open" : ""}`}>
      <ScrollTable>
        <table>
          <thead><tr><th>거래처</th><th>구매건수</th><th>합계</th></tr></thead>
          <tbody>{!byVendor.length ? <tr><td colSpan={3} className="empty">조회된 거래처 없음</td></tr> : byVendor.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td>{v.count}</td><td className="right bold">{money(v.total)}</td></tr>)}</tbody>
        </table>
      </ScrollTable>
      </div>

      <div className="between purchase-status-section-head purchase-price-analysis-head">
        <div>
          <h3>품목별 단가분석</h3>
          <p className="muted">구매횟수·수량·최저/최고/가중평균은 선택기간 기준, 최근·직전단가는 전체 구매이력 기준입니다.</p>
        </div>
        <button onClick={() => downloadExcel(`품목별단가분석_${todayText()}`, withTotalRow(
          itemAnalysis.map((analysis) => ({
            품목: analysis.item,
            규격: analysis.spec,
            구매횟수: analysis.count,
            총수량: analysis.quantity,
            최근단가: analysis.recentPrice ?? "",
            직전단가: analysis.previousPrice ?? "",
            전회대비: analysis.historyDeltaAmount ?? "",
            최저단가: analysis.minPrice ?? "",
            최고단가: analysis.maxPrice ?? "",
            가중평균단가: analysis.weightedAvgPrice ?? "",
            최근구매일: analysis.recentDate,
            주요거래처: analysis.majorVendor,
          })),
          { 품목: "총합계", 구매횟수: itemAnalysis.reduce((sum, analysis) => sum + analysis.count, 0), 총수량: itemAnalysis.reduce((sum, analysis) => sum + analysis.quantity, 0) }
        ))}>품목별 엑셀</button>
      </div>
      <div className="purchase-price-analysis-desktop">
        <ScrollTable>
          <table>
            <thead><tr><th>품목</th><th>규격</th><th>구매횟수</th><th>총수량</th><th>최근단가</th><th>직전단가</th><th>전회대비</th><th>최저단가</th><th>최고단가</th><th>가중평균</th><th>최근구매일</th><th>주요거래처</th></tr></thead>
            <tbody>{!itemAnalysis.length ? <tr><td colSpan={12} className="empty">조회된 품목 단가이력 없음</td></tr> : itemAnalysis.map((analysis) => (
              <tr key={analysis.key}>
                <td><button type="button" className="purchase-price-history-link" onClick={() => { if (analysis.history) setPriceHistoryModal(analysis.history); }}>{analysis.item}</button></td>
                <td>{analysis.spec || "-"}</td>
                <td className="right">{money(analysis.count)}</td>
                <td className="right">{money(analysis.quantity)}</td>
                <td className="right bold">{analysis.recentPrice === null ? "-" : `${money(analysis.recentPrice)}원`}</td>
                <td className="right">{analysis.previousPrice === null ? "-" : `${money(analysis.previousPrice)}원`}</td>
                <td className={`right purchase-price-analysis-delta${analysis.historyDeltaAmount !== null && analysis.historyDeltaAmount > 0 ? " up" : analysis.historyDeltaAmount !== null && analysis.historyDeltaAmount < 0 ? " down" : ""}`}>
                  {analysis.historyDeltaAmount === null ? "-" : `${signedMoney(analysis.historyDeltaAmount)}${analysis.historyDeltaPercent === null ? "" : ` (${signedPercent(analysis.historyDeltaPercent)})`}`}
                </td>
                <td className="right">{analysis.minPrice === null ? "-" : `${money(analysis.minPrice)}원`}</td>
                <td className="right">{analysis.maxPrice === null ? "-" : `${money(analysis.maxPrice)}원`}</td>
                <td className="right">{analysis.weightedAvgPrice === null ? "-" : `${money(analysis.weightedAvgPrice)}원`}</td>
                <td>{analysis.recentDate || "-"}</td>
                <td>{analysis.majorVendor}</td>
              </tr>
            ))}</tbody>
          </table>
        </ScrollTable>
      </div>
      <div className="purchase-price-analysis-mobile">
        <div className="purchase-price-analysis-mobile-toggle">
          <div>
            <strong>품목별 단가분석</strong>
            <span>{hasItemAnalysisFilter ? `${itemAnalysis.length}개 품목` : "기간·거래처·품목을 선택하면 자동으로 펼쳐집니다."}</span>
          </div>
          <button type="button" onClick={() => setMobileItemAnalysisOpen((open) => !open)} aria-expanded={mobileItemAnalysisOpen}>
            {mobileItemAnalysisOpen ? "접기" : "분석 보기"}
          </button>
        </div>
        {mobileItemAnalysisOpen && (
          <div className="purchase-price-analysis-mobile-list">
        {!itemAnalysis.length ? <div className="empty">조회된 품목 단가이력 없음</div> : itemAnalysis.map((analysis) => (
          <article className="purchase-price-analysis-card" key={`mobile-${analysis.key}`}>
            <div className="purchase-price-analysis-card-head">
              <div><strong>{analysis.item}</strong>{analysis.spec && <span>{analysis.spec}</span>}</div>
              <small>{analysis.count}회 구매</small>
            </div>
            <div className="purchase-price-analysis-card-grid">
              <div><span>최근단가</span><b>{analysis.recentPrice === null ? "-" : `${money(analysis.recentPrice)}원`}</b></div>
              <div><span>직전단가</span><b>{analysis.previousPrice === null ? "-" : `${money(analysis.previousPrice)}원`}</b></div>
              <div><span>가중평균</span><b>{analysis.weightedAvgPrice === null ? "-" : `${money(analysis.weightedAvgPrice)}원`}</b></div>
              <div><span>최근구매</span><b>{analysis.recentDate || "-"}</b></div>
            </div>
            <div className={`purchase-price-analysis-card-change${analysis.historyDeltaAmount !== null && analysis.historyDeltaAmount > 0 ? " up" : analysis.historyDeltaAmount !== null && analysis.historyDeltaAmount < 0 ? " down" : ""}`}>
              전회 대비 {analysis.historyDeltaAmount === null ? "-" : `${signedMoney(analysis.historyDeltaAmount)}${analysis.historyDeltaPercent === null ? "" : ` (${signedPercent(analysis.historyDeltaPercent)})`}`}
            </div>
            <div className="purchase-price-analysis-card-meta">주요거래처 {analysis.majorVendor} · 최저 {analysis.minPrice === null ? "-" : `${money(analysis.minPrice)}원`} · 최고 {analysis.maxPrice === null ? "-" : `${money(analysis.maxPrice)}원`}</div>
            <button type="button" className="purchase-price-history-link" onClick={() => { if (analysis.history) setPriceHistoryModal(analysis.history); }}>최근 구매이력·거래처 비교</button>
          </article>
        ))}
          </div>
        )}
      </div>

      <div className="purchase-status-detail-section">
        <div className="between purchase-status-section-head purchase-status-detail-head">
          <h3>상세 구매내역 <span className="purchase-status-detail-count">({filtered.length}건)</span></h3>
          <button
            type="button"
            className="purchase-status-mobile-toggle"
            onClick={() => setMobilePurchaseDetailOpen((open) => !open)}
            aria-expanded={mobilePurchaseDetailOpen}
          >
            {mobilePurchaseDetailOpen ? "접기" : "내역 보기"}
          </button>
        </div>
        <div className={`purchase-status-collapsible-body${mobilePurchaseDetailOpen ? " open" : ""}`}>
        <ScrollTable>
          <table>
            <thead><tr><th>일자</th><th>거래처</th><th>창고</th><th>대표품목</th><th>수량</th><th>공급가액</th><th>부가세액</th><th>합계</th></tr></thead>
            <tbody>{!filtered.length ? <tr><td colSpan={8} className="empty">조회된 구매내역 없음</td></tr> : filtered.map((p) => <tr key={p.id}><td>{p.date}</td><td>{p.vendor}</td><td>{p.warehouse}</td><td>{getPurchaseItemSummary(p)}</td><td className="right">{money((p.rows || []).reduce((sum, r) => sum + Number(r.qty || 0), 0))}</td><td className="right">{money(p.supplyTotal)}</td><td className="right">{money(p.vatTotal)}</td><td className="right bold">{money(p.total)}</td></tr>)}</tbody>
          </table>
        </ScrollTable>

        </div>
      </div>
      {priceHistoryModal && <PurchasePriceHistoryModal ui={{ ScrollTable, money }} history={priceHistoryModal} onClose={() => setPriceHistoryModal(null)} />}
    </section>
  );
}
