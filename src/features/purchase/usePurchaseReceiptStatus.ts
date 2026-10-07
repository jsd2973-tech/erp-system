import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { normalizePurchaseReceiptStatus } from "./purchaseModel";
import type { createPurchaseService } from "./purchaseService";
import type { Purchase, PurchaseReceiptStatus } from "./purchaseTypes";

type ReceiptOptions = {
  service: Pick<ReturnType<typeof createPurchaseService>, "updatePurchaseReceipt">;
  canUpdate: boolean;
  setPurchases: Dispatch<SetStateAction<Purchase[]>>;
  getTodayKey: () => string;
  showToast: (message: string, tone?: "success" | "info") => void;
  addActivityLog: (entry: { module: string; action: string; target_id: string; target_title: string; detail: string }) => Promise<unknown>;
};

export function usePurchaseReceiptStatus(options: ReceiptOptions) {
  const [savingId, setSavingId] = useState("");
  const saving = useRef(false);

  const updateReceipt = async (purchase: Purchase, status: Exclude<PurchaseReceiptStatus, "unknown">) => {
    if (!options.canUpdate) {
      options.showToast("물품 수취상태 변경은 관리자만 가능합니다.", "info");
      return;
    }
    if (saving.current || normalizePurchaseReceiptStatus(purchase.receiptStatus) === status) return;
    saving.current = true;
    setSavingId(purchase.id);
    try {
      const { data, error } = await options.service.updatePurchaseReceipt(purchase.id, status, options.getTodayKey());
      if (error) throw error;
      if (!data) throw new Error("저장된 구매건을 확인하지 못했습니다.");
      options.setPurchases((previous) => previous.map((item) => item.id === purchase.id
        ? { ...item, receiptStatus: normalizePurchaseReceiptStatus(data.receipt_status), receivedDate: data.received_date || "" }
        : item));
      const cancelled = purchase.receiptStatus === "received" && status === "unreceived";
      options.showToast(status === "received" ? "물품 수취완료 처리했습니다." : cancelled ? "물품 수취를 취소했습니다." : "물품을 미수취로 변경했습니다.");
      try {
        await options.addActivityLog({
          module: "구매",
          action: status === "received" ? "물품 수취완료" : cancelled ? "물품 수취취소" : "물품 미수취 확인",
          target_id: purchase.id,
          target_title: purchase.vendor || "",
          detail: `${purchase.date || "-"} · ${status === "received" ? `수취일 ${data.received_date}` : "미수취"}`,
        });
      } catch {
        options.showToast("수취상태는 저장됐지만 작업로그 기록에 실패했습니다.", "info");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message
        : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "다시 시도해 주세요.";
      options.showToast(`물품 수취상태 저장 실패: ${message}`, "info");
    } finally {
      saving.current = false;
      setSavingId("");
    }
  };
  return { savingId, updateReceipt };
}
