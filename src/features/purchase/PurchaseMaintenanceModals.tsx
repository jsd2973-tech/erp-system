import { getPurchaseEffectiveUnitPrice } from "./purchasePriceHistory";
import type {
  PurchaseMaintenanceCopyCandidate,
  PurchaseMaintenanceLinkCandidate,
  PurchaseMaintenanceTargetRow,
} from "./purchaseMaintenanceModel";
import type {
  PurchaseMaintenanceCopyModalState,
  PurchaseMaintenanceLinkModalState,
} from "./usePurchaseMaintenanceUi";

type CopyModalProps = {
  state: PurchaseMaintenanceCopyModalState;
  warehouse: string;
  maintenanceDate: string;
  candidates: PurchaseMaintenanceCopyCandidate[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onToggleCandidate: (rowKey: string) => void;
  onConfirm: () => void;
};

type LinkModalProps = {
  state: PurchaseMaintenanceLinkModalState;
  targetRow?: PurchaseMaintenanceTargetRow;
  candidates: PurchaseMaintenanceLinkCandidate[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelectCandidate: (candidate: PurchaseMaintenanceLinkCandidate) => void;
  onUsedQtyChange: (value: string) => void;
  onConfirm: () => void;
};

export default function PurchaseMaintenanceModals({
  copy,
  link,
  formatMoney,
}: {
  copy: CopyModalProps;
  link: LinkModalProps;
  formatMoney: (value: number | string | undefined) => string;
}) {
  return (
    <>
      {copy.state.open && (
        <div className="modal-backdrop" onClick={copy.onClose}>
          <div className="modal-box wide-modal maintenance-purchase-link-modal" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <h2>구매내역에서 정비품목 추가</h2>
                <p className="muted">날짜와 관계없이 현재 정비 창고의 구매품목을 선택해 품목·규격·수량·단가를 한 번에 넣습니다.</p>
              </div>
              <button type="button" onClick={copy.onClose}>닫기</button>
            </div>

            <div className="maintenance-purchase-link-target">
              <strong>{copy.warehouse || "창고 미선택"}</strong>
              <span>정비일자 {copy.maintenanceDate} · 남은 구매수량이 있는 품목만 표시</span>
            </div>

            <input
              value={copy.state.search}
              onChange={(event) => copy.onSearchChange(event.target.value)}
              placeholder="거래처 / 구매일 / 품목 / 규격 검색"
            />

            <div className="scroll-table">
              <table className="maintenance-purchase-link-table">
                <thead>
                  <tr><th>선택</th><th>구매일</th><th>거래처</th><th>품목·규격</th><th>구매수량</th><th>단가</th><th>사용/남음</th></tr>
                </thead>
                <tbody>
                  {!copy.candidates.length ? (
                    <tr><td colSpan={7} className="empty">현재 창고에서 추가할 수 있는 구매품목이 없습니다.</td></tr>
                  ) : copy.candidates.map((candidate) => {
                    const selected = copy.state.selectedRowKeys.includes(candidate.rowKey);
                    const unitPrice = getPurchaseEffectiveUnitPrice(candidate.row).price;
                    return (
                      <tr key={candidate.rowKey} className={selected ? "selected" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => copy.onToggleCandidate(candidate.rowKey)}
                            aria-label={`${candidate.row.item || "구매품목"} 선택`}
                          />
                        </td>
                        <td>{candidate.purchase.date || "-"}</td>
                        <td>{candidate.purchase.vendor || "거래처 미입력"}</td>
                        <td><b>{candidate.row.item || "-"}</b><small>{candidate.row.spec || "규격 없음"}</small></td>
                        <td className="right">{candidate.row.qty || 0}</td>
                        <td className="right">{formatMoney(unitPrice)}원</td>
                        <td className="right">{formatMoney(candidate.usedQty)} / {formatMoney(candidate.remainingQty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="actions right-actions">
              <button type="button" onClick={copy.onClose}>취소</button>
              <button type="button" className="primary" onClick={copy.onConfirm}>
                선택한 {copy.state.selectedRowKeys.length}개 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {link.state.open && (
        <div className="modal-backdrop" onClick={link.onClose}>
          <div className="modal-box wide-modal maintenance-purchase-link-modal" data-testid="maintenance-purchase-link-modal" onClick={(event) => event.stopPropagation()}>
            <div className="between">
              <div>
                <h2>구매품목 연결</h2>
                <p className="muted">품목명이 있으면 같은 구매이력을 우선 표시합니다. 품목이 비어 있으면 전체 구매이력에서 직접 선택할 수 있습니다.</p>
              </div>
              <button type="button" onClick={link.onClose}>닫기</button>
            </div>

            <div className="maintenance-purchase-link-target">
              <strong>{link.targetRow?.item || "품목 미입력"}</strong>
              <span>{link.targetRow?.spec || "규격 미입력"} · 정비 사용수량 {link.targetRow?.qty || 0}</span>
            </div>

            <input
              value={link.state.search}
              onChange={(event) => link.onSearchChange(event.target.value)}
              placeholder={link.targetRow?.item?.trim() ? "거래처 / 날짜 / 품목 / 규격 검색 (비우면 동일 품목만)" : "거래처 / 날짜 / 품목 / 규격 검색 (비우면 전체 구매품목)"}
            />

            <div className="scroll-table">
              <table className="maintenance-purchase-link-table">
                <thead>
                  <tr><th>구매일</th><th>거래처</th><th>품목·규격</th><th>구매수량</th><th>단가</th><th>사용/남음</th><th>선택</th></tr>
                </thead>
                <tbody>
                  {!link.candidates.length ? (
                    <tr><td colSpan={7} className="empty">연결 가능한 구매품목이 없습니다. 검색어를 바꾸거나 구매수량을 확인하세요.</td></tr>
                  ) : link.candidates.map((candidate) => {
                    const selected = link.state.selectedPurchaseId === candidate.purchase.id && link.state.selectedPurchaseRowId === String(candidate.row.id);
                    const unitPrice = getPurchaseEffectiveUnitPrice(candidate.row).price;
                    return (
                      <tr key={candidate.rowKey} data-testid="maintenance-purchase-candidate" className={selected ? "selected" : ""}>
                        <td>{candidate.purchase.date || "-"}</td>
                        <td>{candidate.purchase.vendor || "거래처 미입력"}</td>
                        <td><b>{candidate.row.item || "-"}</b><small>{candidate.row.spec || "규격 없음"}</small></td>
                        <td className="right">{candidate.row.qty || 0}</td>
                        <td className="right">{formatMoney(unitPrice)}원</td>
                        <td className="right">{formatMoney(candidate.usedQty)} / {formatMoney(candidate.remainingQty)}</td>
                        <td><button type="button" className={selected ? "primary" : ""} onClick={() => link.onSelectCandidate(candidate)}>{selected ? "선택됨" : "선택"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="maintenance-purchase-link-quantity">
              <div className="field">
                <label>이번 정비 사용수량<span className="required-mark" aria-hidden="true">*</span></label>
                <input
                  data-testid="maintenance-link-used-qty"
                  inputMode="decimal"
                  value={link.state.usedQty}
                  onChange={(event) => link.onUsedQtyChange(event.target.value)}
                  placeholder="0"
                />
              </div>
              <span>구매단가를 정비 단가에 자동 반영하고 공급가액·부가세·합계를 다시 계산합니다.</span>
            </div>

            <div className="actions right-actions">
              <button type="button" onClick={link.onClose}>취소</button>
              <button type="button" data-testid="maintenance-link-apply" className="primary" onClick={link.onConfirm}>{link.state.editingLinkId ? "연결 수정" : "구매품목 연결"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
