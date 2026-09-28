import { Pencil } from "lucide-react";
import { maintenancePurchaseLinkIdentity } from "../purchase/purchaseModel";
import type { PurchaseEntryUi } from "../purchase/PurchaseEntry";
import type { MaintenancePurchaseLink, Purchase } from "../purchase/purchaseTypes";
import type { Maint } from "./maintenanceTypes";

export type MaintenanceDetailProps = {
  record: Maint;
  maintenanceNumber: string;
  purchases: Purchase[];
  links: MaintenancePurchaseLink[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: (record: Maint) => void;
  ui: Pick<PurchaseEntryUi, "AttachmentGroup" | "ScrollTable" | "money">;
};

export function MaintenanceDetail({
  record,
  maintenanceNumber,
  purchases,
  links,
  canEdit,
  onClose,
  onEdit,
  ui,
}: MaintenanceDetailProps) {
  const { AttachmentGroup, ScrollTable, money } = ui;
  const recordLinks = links.filter((link) => link.maintenance_id === record.id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box wide-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{record.title}</h2>
        <p><b>관리번호:</b> {maintenanceNumber || "-"} / <b>일자:</b> {record.date} / <b>창고:</b> {record.warehouse} / <b>작업자:</b> {record.manager || "-"}</p>
        <p><b>내용:</b> {record.detail || "-"}</p>
        <div className="maint-modal-attachments">
          <b>첨부:</b>
          <AttachmentGroup urls={record.image_urls || (record.image_url ? [record.image_url] : [])} />
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>부가세</th><th>합계</th></tr></thead>
            <tbody>
              {!(record.items || []).length ? (
                <tr><td colSpan={7} className="empty">사용 품목 없음</td></tr>
              ) : (
                (record.items || []).map((row) => (
                  <tr key={row.id || row.item + "-" + row.spec}>
                    <td>{row.item}</td>
                    <td>{row.spec || "-"}</td>
                    <td className="right">{row.qty}</td>
                    <td className="right">{money(row.price)}</td>
                    <td className="right">{money(row.supply)}</td>
                    <td className="right">{money(row.vat)}</td>
                    <td className="right bold">{money(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="maintenance-purchase-summary">
          <h3>연결된 구매품목</h3>
          {recordLinks.length ? recordLinks.map((link) => {
            const purchase = purchases.find((candidate) => candidate.id === link.purchase_id);
            const purchaseRow = purchase?.rows?.find((row) => row.id === link.purchase_row_id);
            return (
              <div key={maintenancePurchaseLinkIdentity(link)}>
                <strong>{link.item_name || "품목"}</strong>
                <span>{link.purchase_date_snapshot || "-"} · {link.vendor_snapshot || "거래처 미입력"} · 단가 {money(link.unit_price_snapshot)}원</span>
                <b>구매 {purchaseRow?.qty ?? "-"} · {link.used_qty} 사용 · 구매ID {link.purchase_id}</b>
              </div>
            );
          }) : <p className="muted">연결된 구매품목이 없습니다.</p>}
        </div>
        <div className="actions right-actions">
          {canEdit && (
            <button className="primary" onClick={() => onEdit(record)}>
              <Pencil size={16} /> 수정·구매이력 연결
            </button>
          )}
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
