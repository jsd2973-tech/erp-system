import { numericValue } from "../purchase/purchaseModel";
import { normalizePurchasePriceText } from "../purchase/purchasePriceHistory";
import type { MaintenancePurchaseLink, PurchaseRow } from "../purchase/purchaseTypes";

export type PurchaseRowEditViolation =
  | { reason: "linked-row-removed" }
  | { reason: "quantity-below-used"; itemName: string; usedQty: number }
  | { reason: "item-name-changed" };

export const getMaintenancePurchaseUsage = (links: MaintenancePurchaseLink[]) => {
  const usage = new Map<string, number>();
  links.forEach((link) => {
    const key = link.purchase_id + "\u001f" + link.purchase_row_id;
    usage.set(key, (usage.get(key) || 0) + numericValue(link.used_qty));
  });
  return usage;
};

export const validateLinkedPurchaseRowsForEdit = ({
  purchaseId,
  rows,
  links,
}: {
  purchaseId: string;
  rows: PurchaseRow[];
  links: MaintenancePurchaseLink[];
}): PurchaseRowEditViolation | null => {
  const linkedRows = links.filter((link) => link.purchase_id === purchaseId);
  if (!linkedRows.length) return null;

  const nextRowsById = new Map(rows.map((row) => [String(row.id), row]));
  if (linkedRows.some((link) => !nextRowsById.has(link.purchase_row_id))) {
    return { reason: "linked-row-removed" };
  }

  const usedByRow = new Map<string, number>();
  linkedRows.forEach((link) => {
    usedByRow.set(link.purchase_row_id, (usedByRow.get(link.purchase_row_id) || 0) + numericValue(link.used_qty));
  });
  for (const [rowId, usedQty] of usedByRow.entries()) {
    const nextRow = nextRowsById.get(rowId);
    if (nextRow && usedQty > numericValue(nextRow.qty)) {
      return { reason: "quantity-below-used", itemName: nextRow.item || "구매 품목", usedQty };
    }
  }

  const changedName = linkedRows.some((link) => {
    const nextRow = nextRowsById.get(link.purchase_row_id);
    return Boolean(nextRow) &&
      normalizePurchasePriceText(nextRow!.item) !== normalizePurchasePriceText(link.item_name);
  });
  return changedName ? { reason: "item-name-changed" } : null;
};
