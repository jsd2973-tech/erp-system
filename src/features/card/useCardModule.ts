import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { CardReceiptUploadTools, createCardService } from "./cardService";
import { buildCardNumberMap, CARD_DRAFT_KEY, createEmptyCardForm, getCardOcrFeedback, mergeCardOcrForm, normalizeCardUse } from "./cardModel";
import type { CardForm, CardOcrState, CardOcrTouchedFields, CardSearch, CardUse } from "./cardTypes";
import { requestCardReceiptOcr } from "./cardOcr";

type CardService = ReturnType<typeof createCardService>;
type CardActivityLog = {
  module: string;
  action: string;
  target_id?: string;
  target_title?: string;
  detail?: string;
};
type CardTrashRecord = {
  source_table: "card_uses";
  module: "카드";
  record_id: string;
  title: string;
  detail: string;
  data: CardUse;
};

export type UseCardModuleOptions = {
  records: CardUse[];
  setRecords: Dispatch<SetStateAction<CardUse[]>>;
  menuTab: string;
  setMenuTab: Dispatch<SetStateAction<string>>;
  isAdmin: boolean;
  canCreateRecords: boolean;
  canEditDeleteRecords: boolean;
  accessToken?: string;
  service: CardService;
  todayKey: () => string;
  createId: () => string;
  money: (value: number | string | undefined) => string;
  addActivityLog: (record: CardActivityLog) => Promise<void>;
  showToast: (message: string) => void;
  moveToTrash: (record: CardTrashRecord) => Promise<boolean>;
  uploadTools: Omit<CardReceiptUploadTools, "alert">;
};

export const useCardModule = ({
  records,
  setRecords,
  menuTab,
  setMenuTab,
  isAdmin,
  canCreateRecords,
  canEditDeleteRecords,
  accessToken,
  service,
  todayKey,
  createId,
  money,
  addActivityLog,
  showToast,
  moveToTrash,
  uploadTools,
}: UseCardModuleOptions) => {
  const [cardForm, setCardForm] = useState<CardForm>(() => createEmptyCardForm(todayKey()));
  const [editingCardUseId, setEditingCardUseId] = useState("");
  const [cardSaving, setCardSaving] = useState(false);
  const [cardUploading, setCardUploading] = useState(false);
  const [cardDraftReady, setCardDraftReady] = useState(false);
  const [cardOcrState, setCardOcrState] = useState<CardOcrState>("idle");
  const [cardOcrMessage, setCardOcrMessage] = useState("");
  const cardSavingRef = useRef(false);
  const cardInputTouchedRef = useRef<CardOcrTouchedFields>({ date: false, place: false, amount: false });
  const cardFormRef = useRef(cardForm);
  cardFormRef.current = cardForm;
  const [cardSearch, setCardSearch] = useState<CardSearch>({ from: "", to: "", user_name: "", place: "" });

  useEffect(() => {
    if (menuTab === "card_use" && !editingCardUseId && !cardForm.date) {
      setCardForm((previous) => ({ ...previous, date: todayKey() }));
    }
  }, [menuTab, editingCardUseId, cardForm.date, todayKey]);

  const hasCardFormValue = () => !!(
    (cardForm.date && cardForm.date !== todayKey()) ||
    cardForm.user_name ||
    cardForm.place ||
    cardForm.amount ||
    cardForm.memo ||
    cardForm.image_url ||
    (cardForm.image_urls || []).length ||
    editingCardUseId
  );

  const clearCardDraft = () => {
    try {
      localStorage.removeItem(CARD_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const clearCardForm = () => {
    setCardForm(createEmptyCardForm(todayKey()));
    setEditingCardUseId("");
    cardInputTouchedRef.current = { date: false, place: false, amount: false };
    setCardOcrState("idle");
    setCardOcrMessage("");
    clearCardDraft();
  };

  const resetCardForm = () => {
    if (hasCardFormValue() && !window.confirm("작성 중인 카드사용 내용을 모두 초기화할까요?")) return;
    clearCardForm();
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CARD_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft?.cardForm) {
          setCardForm(draft.cardForm);
          cardInputTouchedRef.current = {
            date: Boolean(draft.editingCardUseId || draft.cardForm.place || draft.cardForm.amount || (draft.cardForm.date && draft.cardForm.date !== todayKey())),
            place: Boolean(draft.editingCardUseId || draft.cardForm.place),
            amount: Boolean(draft.editingCardUseId || draft.cardForm.amount),
          };
        }
        if (draft?.editingCardUseId) setEditingCardUseId(draft.editingCardUseId);
      }
    } catch {
      clearCardDraft();
    } finally {
      setCardDraftReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cardDraftReady) return;
    if (!hasCardFormValue()) {
      clearCardDraft();
      return;
    }

    try {
      localStorage.setItem(CARD_DRAFT_KEY, JSON.stringify({
        cardForm,
        editingCardUseId,
        saved_at: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardForm, editingCardUseId, cardDraftReady]);

  const applyCardOcrResult = (result: Awaited<ReturnType<typeof requestCardReceiptOcr>>) => {
    const current = cardFormRef.current;
    const touched = cardInputTouchedRef.current;
    const feedback = getCardOcrFeedback(result, current, touched, todayKey());

    setCardForm((previous) => mergeCardOcrForm(previous, result, cardInputTouchedRef.current, todayKey()));
    setCardOcrState(feedback.state);
    setCardOcrMessage(feedback.message);
  };

  const analyzeCardReceipt = async (file: File) => {
    setCardOcrState("analyzing");
    setCardOcrMessage("영수증 분석 중...");

    try {
      const result = await requestCardReceiptOcr(file, accessToken);
      applyCardOcrResult(result);
    } catch (error: unknown) {
      setCardOcrState("error");
      const message = String((error as { message?: unknown })?.message || "OCR 분석에 실패했습니다.");
      setCardOcrMessage(message.includes("직접 입력") ? message : `${message} 직접 입력해 주세요.`);
    }
  };

  const handleCardAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = input.files;
    if (!files?.length) return;

    setCardOcrState("idle");
    setCardOcrMessage("");
    setCardUploading(true);
    try {
      const { uploadedUrls, ocrFile } = await service.uploadCardReceipts(files, {
        ...uploadTools,
        alert: (message) => window.alert(message),
      });
      setCardForm((previous) => {
        const nextUrls = [...(previous.image_urls || []), ...uploadedUrls];
        return { ...previous, image_urls: nextUrls, image_url: nextUrls[0] || previous.image_url };
      });
      if (ocrFile) await analyzeCardReceipt(ocrFile);
    } catch (error: unknown) {
      const message = String((error as { message?: unknown })?.message || "영수증 첨부에 실패했습니다.");
      setCardOcrState("error");
      setCardOcrMessage(message.includes("직접 입력") ? message : `${message} 직접 입력해 주세요.`);
    } finally {
      input.value = "";
      setCardUploading(false);
    }
  };

  const saveCardUse = async () => {
    if (cardSavingRef.current) return;
    if (cardUploading) return window.alert("첨부파일 업로드가 끝난 후 저장해 주세요.");
    if (editingCardUseId && !canEditDeleteRecords) return window.alert("수정은 관리자만 가능합니다.");
    if (!canCreateRecords) return window.alert("등록 권한이 없습니다.");
    const cardDate = cardForm.date || todayKey();
    if (!cardForm.place || !Number(cardForm.amount || 0)) {
      return window.alert("사용일자, 사용처, 금액을 확인하세요.");
    }
    cardSavingRef.current = true;
    setCardSaving(true);

    try {
      const isEditing = !!editingCardUseId;
      const payload: CardUse = normalizeCardUse({
        id: editingCardUseId || createId(),
        date: cardDate,
        user_name: cardForm.user_name,
        place: cardForm.place,
        amount: Number(cardForm.amount || 0),
        memo: cardForm.memo,
        image_url: (cardForm.image_urls || [])[0] || cardForm.image_url,
        image_urls: cardForm.image_urls || (cardForm.image_url ? [cardForm.image_url] : []),
      });

      const { error } = await service.saveCardUse(payload);
      if (error) return window.alert(`카드사용 저장 실패: ${error.message}`);

      setRecords((previous) =>
        isEditing
          ? previous.map((cardUse) => (cardUse.id === editingCardUseId ? payload : cardUse))
          : [payload, ...previous],
      );

      await addActivityLog({
        module: "카드",
        action: isEditing ? "수정" : "등록",
        target_id: payload.id,
        target_title: payload.place || "",
        detail: `${payload.date || "-"} · ${money(payload.amount)}원 · ${payload.memo || ""}`,
      });

      clearCardForm();
      showToast(isEditing ? "카드사용 내역을 수정했습니다." : "카드사용 내역을 저장했습니다.");
      setMenuTab("card_list");
    } catch (error: unknown) {
      const errorMessage = String((error as { message?: unknown })?.message || "");
      const message = errorMessage ? `카드사용 저장 중 오류: ${errorMessage}` : "카드사용 저장 중 알 수 없는 오류가 발생했습니다.";
      window.alert(message);
    } finally {
      cardSavingRef.current = false;
      setCardSaving(false);
    }
  };

  const editCardUse = (cardUse: CardUse) => {
    setEditingCardUseId(cardUse.id);
    cardInputTouchedRef.current = {
      date: Boolean(cardUse.date),
      place: Boolean(cardUse.place),
      amount: Boolean(cardUse.amount),
    };
    setCardOcrState("idle");
    setCardOcrMessage("");
    setCardForm({
      date: cardUse.date || "",
      user_name: cardUse.user_name || "",
      place: cardUse.place || "",
      amount: String(cardUse.amount || ""),
      memo: cardUse.memo || "",
      image_url: cardUse.image_url || "",
      image_urls: cardUse.image_urls || (cardUse.image_url ? [cardUse.image_url] : []),
    });
    setMenuTab("card_use");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCardUse = async (id: string) => {
    if (!canEditDeleteRecords) return window.alert("삭제는 관리자만 가능합니다.");
    const target = records.find((item) => item.id === id);
    if (!target) return window.alert("삭제할 카드사용내역을 찾지 못했습니다.");
    if (!window.confirm("카드사용내역을 휴지통으로 이동할까요?")) return;

    const ok = await moveToTrash({
      source_table: "card_uses",
      module: "카드",
      record_id: id,
      title: target.place || "",
      detail: `${target.date || "-"} · ${money(target.amount || 0)}원`,
      data: target,
    });
    if (!ok) return;

    const { error } = await service.deleteCardUse(id);
    if (error) return window.alert(`카드사용 삭제 실패: ${error.message}`);
    setRecords((previous) => previous.filter((cardUse) => cardUse.id !== id));
    await addActivityLog({
      module: "카드",
      action: "휴지통 이동",
      target_id: id,
      target_title: target.place || "",
      detail: `${target.date || "-"} · ${money(target.amount || 0)}원`,
    });
  };

  const cardNumberMap = useMemo(() => buildCardNumberMap(records), [records]);
  const filteredCardUses = useMemo(() => records
    .filter((cardUse) => (!cardSearch.from || (cardUse.date || "") >= cardSearch.from)
      && (!cardSearch.to || (cardUse.date || "") <= cardSearch.to)
      && (!cardSearch.user_name || (cardUse.user_name || "").includes(cardSearch.user_name))
      && (!cardSearch.place || (cardUse.place || "").includes(cardSearch.place)))
    .sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.id || "").localeCompare(String(a.id || ""));
    })
    .map((cardUse) => ({ ...cardUse, managementNo: cardNumberMap.get(cardUse.id) || "" })), [records, cardSearch, cardNumberMap]);

  const entry = {
    cardForm,
    editingCardUseId,
    cardSaving,
    cardUploading,
    cardOcrState,
    cardOcrMessage,
    todayKey,
    onDateChange: (date: string) => {
      cardInputTouchedRef.current.date = true;
      setCardForm((previous) => ({ ...previous, date }));
    },
    onUserNameChange: (user_name: string) => setCardForm({ ...cardForm, user_name }),
    onPlaceChange: (place: string) => {
      cardInputTouchedRef.current.place = true;
      setCardForm((previous) => ({ ...previous, place }));
    },
    onAmountChange: (amount: string) => {
      cardInputTouchedRef.current.amount = true;
      setCardForm((previous) => ({ ...previous, amount }));
    },
    onMemoChange: (memo: string) => setCardForm({ ...cardForm, memo }),
    onAttachmentChange: handleCardAttachmentChange,
    onRemoveAttachment: (removeIndex: number) => setCardForm((previous) => {
      const nextUrls = (previous.image_urls || []).filter((_, index) => index !== removeIndex);
      return { ...previous, image_urls: nextUrls, image_url: nextUrls[0] || "" };
    }),
    onSave: saveCardUse,
    onReset: resetCardForm,
  };

  const list = {
    filteredCardUses,
    search: cardSearch,
    setSearch: setCardSearch,
    isAdmin,
    onEdit: editCardUse,
    onDelete: deleteCardUse,
  };

  return { cardDraft: cardForm, entry, list };
};
