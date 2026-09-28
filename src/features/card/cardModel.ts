import type { ReceiptOcrResult } from "./receiptOcr";
import type { CardForm, CardOcrState, CardOcrTouchedFields, CardUse } from "./cardTypes";

export const CARD_DRAFT_KEY = "erp_card_draft_v1";

export const createEmptyCardForm = (date: string): CardForm => ({
  date,
  user_name: "",
  place: "",
  amount: "",
  memo: "",
  image_url: "",
  image_urls: [],
});

export const normalizeCardUse = (row: Record<string, unknown>): CardUse => ({
  ...row,
  amount: Number(row.amount || 0),
}) as CardUse;

export const getCardOcrDetectedLabels = (result: ReceiptOcrResult) => [
  result.date ? "날짜" : "",
  result.merchant ? "상호명" : "",
  result.totalAmount != null ? "총합계" : "",
].filter(Boolean);

export const getCardOcrAppliedLabels = (
  result: ReceiptOcrResult,
  current: CardForm,
  touched: CardOcrTouchedFields,
  today: string,
) => [
  result.date && !touched.date && (!current.date || current.date === today) ? "날짜" : "",
  result.merchant && !touched.place && !String(current.place || "").trim() ? "상호명" : "",
  result.totalAmount != null && !touched.amount && !String(current.amount || "").trim() ? "총합계" : "",
].filter(Boolean);

export const mergeCardOcrForm = (
  previous: CardForm,
  result: ReceiptOcrResult,
  touched: CardOcrTouchedFields,
  today: string,
): CardForm => ({
  ...previous,
  ...(result.date && !touched.date && (!previous.date || previous.date === today) ? { date: result.date } : {}),
  ...(result.merchant && !touched.place && !String(previous.place || "").trim() ? { place: result.merchant } : {}),
  ...(result.totalAmount != null && !touched.amount && !String(previous.amount || "").trim() ? { amount: String(result.totalAmount) } : {}),
});

export const getCardOcrFeedback = (
  result: ReceiptOcrResult,
  current: CardForm,
  touched: CardOcrTouchedFields,
  today: string,
): { state: CardOcrState; message: string } => {
  const detectedLabels = getCardOcrDetectedLabels(result);
  const appliedLabels = getCardOcrAppliedLabels(result, current, touched, today);

  if (!detectedLabels.length) {
    return {
      state: "error",
      message: "영수증에서 날짜·상호명·총합계를 확인하지 못했습니다. 직접 입력해 주세요.",
    };
  }

  if (!appliedLabels.length) {
    return {
      state: "success",
      message: "영수증 분석 완료. 기존에 입력한 날짜·상호명·금액은 유지했습니다. 확인 후 저장해 주세요.",
    };
  }

  const missingLabels = detectedLabels.filter((label) => !appliedLabels.includes(label));
  return {
    state: "success",
    message: missingLabels.length
      ? `영수증에서 ${appliedLabels.join("·")}을(를) 자동 입력했습니다. ${missingLabels.join("·")}은(는) 기존 입력값을 유지했습니다.`
      : "영수증에서 날짜·상호명·총합계를 자동 입력했습니다. 확인 후 저장해 주세요.",
  };
};
