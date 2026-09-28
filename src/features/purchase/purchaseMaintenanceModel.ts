import { maintenancePurchaseLinkIdentity, numericValue } from "./purchaseModel";
import { getPurchaseEffectiveUnitPrice, normalizePurchasePriceText } from "./purchasePriceHistory";
import type { MaintenancePurchaseLink, Purchase, PurchaseRow } from "./purchaseTypes";

export type PurchaseMaintenanceTargetRow = {
  id: string;
  item: string;
  spec: string;
  qty: string | number;
};

export type PurchaseMaintenanceLinkCandidate = {
  purchase: Purchase;
  row: PurchaseRow;
  rowKey: string;
  sameItem: boolean;
  sameSpec: boolean;
  usedQty: number;
  remainingQty: number;
};

export type PurchaseMaintenanceCopyCandidate = {
  purchase: Purchase;
  row: PurchaseRow;
  rowKey: string;
  usedQty: number;
  remainingQty: number;
};

export type PurchaseMaintenanceCopiedRow = {
  id: string;
  item: string;
  spec: string;
  qty: number;
  price: number;
  supply: number;
  vat: number;
  total: number;
};

type CandidateBase = {
  purchases: Purchase[];
  maintenancePurchaseLinks: MaintenancePurchaseLink[];
  draftLinks: MaintenancePurchaseLink[];
  editingMaintenanceId: string;
};

export const buildPurchaseMaintenanceLinkCandidates = ({
  open,
  targetRow,
  searchText,
  editingLinkId,
  ...base
}: CandidateBase & {
  open: boolean;
  targetRow?: PurchaseMaintenanceTargetRow;
  searchText: string;
  editingLinkId: string;
}): PurchaseMaintenanceLinkCandidate[] => {
  if (!open || !targetRow) return [];

  const targetItemKey = normalizePurchasePriceText(targetRow.item);
  const targetSpecKey = normalizePurchasePriceText(targetRow.spec);
  const hasTargetItem = Boolean(targetItemKey);
  const hasTargetSpec = Boolean(targetSpecKey);
  const search = searchText.trim().toLocaleLowerCase("ko-KR");
  const isEditingLink = (link: MaintenancePurchaseLink) => maintenancePurchaseLinkIdentity(link) === editingLinkId;
  const committedLinks = base.maintenancePurchaseLinks.filter((link) =>
    !base.editingMaintenanceId || link.maintenance_id !== base.editingMaintenanceId
  );
  const draftLinks = base.draftLinks.filter((link) => !isEditingLink(link));
  const consumed = new Map<string, number>();

  [...committedLinks, ...draftLinks].forEach((link) => {
    const key = `${link.purchase_id}\u001f${link.purchase_row_id}`;
    consumed.set(key, (consumed.get(key) || 0) + numericValue(link.used_qty));
  });

  const allCandidates = base.purchases.flatMap((purchase) =>
    (purchase.rows || []).flatMap((row) => {
      const purchaseRowId = String(row.id || "").trim();
      const purchaseItemName = String(row.item || "").trim();
      if (!purchaseRowId || !purchaseItemName) return [];

      const rowKey = `${purchase.id}\u001f${purchaseRowId}`;
      const purchaseQty = numericValue(row.qty);
      const usedQty = consumed.get(rowKey) || 0;
      const remainingQty = purchaseQty - usedQty;
      const sameItem = hasTargetItem && normalizePurchasePriceText(row.item) === targetItemKey;
      const sameSpec = hasTargetSpec && normalizePurchasePriceText(row.spec) === targetSpecKey;
      const searchable = [purchase.date, purchase.vendor, purchase.warehouse, row.item, row.spec]
        .join(" ")
        .toLocaleLowerCase("ko-KR");

      if (search ? !searchable.includes(search) : (hasTargetItem && !sameItem)) return [];
      if (remainingQty <= 0 && !editingLinkId) return [];

      return [{
        purchase,
        row,
        rowKey,
        sameItem,
        sameSpec,
        usedQty,
        remainingQty: Math.max(0, remainingQty),
      }];
    })
  );

  return allCandidates
    .sort((a, b) => {
      if (a.sameItem !== b.sameItem) return a.sameItem ? -1 : 1;
      if (a.sameSpec !== b.sameSpec) return a.sameSpec ? -1 : 1;
      if ((a.remainingQty > 0) !== (b.remainingQty > 0)) return a.remainingQty > 0 ? -1 : 1;
      const dateCompare = String(b.purchase.date || "").localeCompare(String(a.purchase.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.purchase.id || "").localeCompare(String(a.purchase.id || ""));
    })
    .slice(0, 80);
};

export const buildPurchaseMaintenanceCopyCandidates = ({
  open,
  warehouse,
  searchText,
  ...base
}: CandidateBase & {
  open: boolean;
  warehouse: string;
  searchText: string;
}): PurchaseMaintenanceCopyCandidate[] => {
  if (!open) return [];

  const warehouseKey = normalizePurchasePriceText(warehouse);
  if (!warehouseKey) return [];

  const search = searchText.trim().toLocaleLowerCase("ko-KR");
  const committedLinks = base.maintenancePurchaseLinks.filter((link) =>
    !base.editingMaintenanceId || link.maintenance_id !== base.editingMaintenanceId
  );
  const consumed = new Map<string, number>();
  [...committedLinks, ...base.draftLinks].forEach((link) => {
    const key = `${link.purchase_id}\u001f${link.purchase_row_id}`;
    consumed.set(key, (consumed.get(key) || 0) + numericValue(link.used_qty));
  });
  const currentDraftPurchaseKeys = new Set(
    base.draftLinks.map((link) => `${link.purchase_id}\u001f${link.purchase_row_id}`)
  );

  return base.purchases.flatMap((purchase) => {
    if (normalizePurchasePriceText(purchase.warehouse) !== warehouseKey) return [];

    return (purchase.rows || []).flatMap((row) => {
      const purchaseRowId = String(row.id || "").trim();
      const itemName = String(row.item || "").trim();
      const rowKey = `${purchase.id}\u001f${purchaseRowId}`;
      if (!purchaseRowId || !itemName || currentDraftPurchaseKeys.has(rowKey)) return [];

      const purchaseQty = numericValue(row.qty);
      const usedQty = consumed.get(rowKey) || 0;
      const remainingQty = purchaseQty - usedQty;
      if (remainingQty <= 0) return [];

      const searchable = [purchase.date, purchase.vendor, purchase.warehouse, row.item, row.spec]
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      if (search && !searchable.includes(search)) return [];

      return [{ purchase, row, rowKey, usedQty, remainingQty }];
    });
  })
    .sort((a, b) => {
      const dateCompare = String(b.purchase.date || "").localeCompare(String(a.purchase.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.row.item || "").localeCompare(String(b.row.item || ""), "ko-KR");
    })
    .slice(0, 120);
};

export const buildPurchaseMaintenanceCopyRows = ({
  candidates,
  maintenanceId,
  maintenanceDate,
  warehouse,
  title,
  createId,
}: {
  candidates: PurchaseMaintenanceCopyCandidate[];
  maintenanceId: string;
  maintenanceDate: string;
  warehouse: string;
  title: string;
  createId: () => string;
}): { rows: PurchaseMaintenanceCopiedRow[]; links: MaintenancePurchaseLink[] } => {
  const rows = candidates.map((candidate) => {
    const qty = candidate.remainingQty;
    const price = getPurchaseEffectiveUnitPrice(candidate.row).price;
    const supply = qty * price;
    const vat = Math.round(supply * 0.1);
    return {
      id: createId(),
      item: String(candidate.row.item || "").trim(),
      spec: String(candidate.row.spec || ""),
      qty,
      price,
      supply,
      vat,
      total: supply + vat,
    };
  });
  const links: MaintenancePurchaseLink[] = candidates.map((candidate, index) => ({
    id: "",
    maintenance_id: maintenanceId,
    maintenance_row_id: rows[index].id,
    purchase_id: candidate.purchase.id,
    purchase_row_id: String(candidate.row.id),
    item_name: rows[index].item,
    spec: String(candidate.row.spec || ""),
    used_qty: rows[index].qty,
    unit_price_snapshot: rows[index].price,
    purchase_date_snapshot: candidate.purchase.date || "",
    vendor_snapshot: candidate.purchase.vendor || "",
    maintenance_date_snapshot: maintenanceDate,
    maintenance_equipment_snapshot: warehouse,
    maintenance_title_snapshot: title,
  }));

  return { rows, links };
};
