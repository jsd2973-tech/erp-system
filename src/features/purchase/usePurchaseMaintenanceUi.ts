import { useMemo, useState } from "react";
import { maintenancePurchaseLinkIdentity, numericValue } from "./purchaseModel";
import {
  buildPurchaseMaintenanceCopyCandidates,
  buildPurchaseMaintenanceLinkCandidates,
  type PurchaseMaintenanceLinkCandidate,
  type PurchaseMaintenanceTargetRow,
} from "./purchaseMaintenanceModel";
import type { MaintenancePurchaseLink, Purchase } from "./purchaseTypes";

export type PurchaseMaintenanceLinkModalState = {
  open: boolean;
  maintenanceRowId: string;
  search: string;
  selectedPurchaseId: string;
  selectedPurchaseRowId: string;
  usedQty: string;
  editingLinkId: string;
};

export type PurchaseMaintenanceCopyModalState = {
  open: boolean;
  search: string;
  selectedRowKeys: string[];
};

const emptyLinkModal = (): PurchaseMaintenanceLinkModalState => ({
  open: false,
  maintenanceRowId: "",
  search: "",
  selectedPurchaseId: "",
  selectedPurchaseRowId: "",
  usedQty: "",
  editingLinkId: "",
});

const emptyCopyModal = (): PurchaseMaintenanceCopyModalState => ({
  open: false,
  search: "",
  selectedRowKeys: [],
});

export const usePurchaseMaintenanceUi = ({
  purchases,
  maintenancePurchaseLinks,
  draftLinks,
  editingMaintenanceId,
  maintenanceRows,
  warehouse,
}: {
  purchases: Purchase[];
  maintenancePurchaseLinks: MaintenancePurchaseLink[];
  draftLinks: MaintenancePurchaseLink[];
  editingMaintenanceId: string;
  maintenanceRows: PurchaseMaintenanceTargetRow[];
  warehouse: string;
}) => {
  const [linkModal, setLinkModal] = useState<PurchaseMaintenanceLinkModalState>(emptyLinkModal);
  const [copyModal, setCopyModal] = useState<PurchaseMaintenanceCopyModalState>(emptyCopyModal);

  const activeLinkRow = maintenanceRows.find((row) => row.id === linkModal.maintenanceRowId);
  const linkCandidates = useMemo(
    () => buildPurchaseMaintenanceLinkCandidates({
      open: linkModal.open,
      targetRow: activeLinkRow,
      searchText: linkModal.search,
      editingLinkId: linkModal.editingLinkId,
      purchases,
      maintenancePurchaseLinks,
      draftLinks,
      editingMaintenanceId,
    }),
    [activeLinkRow, draftLinks, editingMaintenanceId, linkModal.editingLinkId, linkModal.open, linkModal.search, maintenancePurchaseLinks, purchases]
  );
  const copyCandidates = useMemo(
    () => buildPurchaseMaintenanceCopyCandidates({
      open: copyModal.open,
      warehouse,
      searchText: copyModal.search,
      purchases,
      maintenancePurchaseLinks,
      draftLinks,
      editingMaintenanceId,
    }),
    [copyModal.open, copyModal.search, draftLinks, editingMaintenanceId, maintenancePurchaseLinks, purchases, warehouse]
  );

  const openLinkModal = (row: PurchaseMaintenanceTargetRow, link?: MaintenancePurchaseLink) => {
    const rowQty = numericValue(row.qty);
    if (rowQty <= 0) return false;
    setLinkModal({
      open: true,
      maintenanceRowId: row.id,
      search: "",
      selectedPurchaseId: link?.purchase_id || "",
      selectedPurchaseRowId: link?.purchase_row_id || "",
      usedQty: link ? String(link.used_qty) : String(rowQty),
      editingLinkId: link ? maintenancePurchaseLinkIdentity(link) : "",
    });
    return true;
  };

  const closeLinkModal = () => setLinkModal(emptyLinkModal());
  const setLinkSearch = (search: string) => setLinkModal((previous) => ({ ...previous, search }));
  const setUsedQty = (usedQty: string) => setLinkModal((previous) => ({ ...previous, usedQty }));

  const selectLinkCandidate = (candidate: PurchaseMaintenanceLinkCandidate) => {
    const rowQty = numericValue(activeLinkRow?.qty);
    const suggestedQty = Math.min(rowQty, candidate.remainingQty);
    setLinkModal((previous) => ({
      ...previous,
      selectedPurchaseId: candidate.purchase.id,
      selectedPurchaseRowId: String(candidate.row.id),
      usedQty: String(suggestedQty || rowQty || ""),
    }));
  };

  const openCopyModal = () => setCopyModal({ open: true, search: "", selectedRowKeys: [] });
  const closeCopyModal = () => setCopyModal(emptyCopyModal());
  const setCopySearch = (search: string) => setCopyModal((previous) => ({ ...previous, search }));
  const toggleCopyCandidate = (rowKey: string) => {
    setCopyModal((previous) => ({
      ...previous,
      selectedRowKeys: previous.selectedRowKeys.includes(rowKey)
        ? previous.selectedRowKeys.filter((key) => key !== rowKey)
        : [...previous.selectedRowKeys, rowKey],
    }));
  };

  return {
    linkModal,
    copyModal,
    activeLinkRow,
    linkCandidates,
    copyCandidates,
    openLinkModal,
    closeLinkModal,
    setLinkSearch,
    setUsedQty,
    selectLinkCandidate,
    openCopyModal,
    closeCopyModal,
    setCopySearch,
    toggleCopyCandidate,
  };
};
