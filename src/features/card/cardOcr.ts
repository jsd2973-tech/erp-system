import type { ReceiptOcrResult } from "./receiptOcr";

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") resolve(reader.result);
    else reject(new Error("이미지를 읽지 못했습니다."));
  };
  reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
  reader.readAsDataURL(file);
});

export const requestCardReceiptOcr = async (
  file: File,
  accessToken?: string,
  fetcher: typeof fetch = fetch,
): Promise<ReceiptOcrResult> => {
  const dataUrl = await fileToDataUrl(file);
  const response = await fetcher("/api/receipt-ocr", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ dataUrl }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error || "영수증 OCR 분석에 실패했습니다."));
  return body as ReceiptOcrResult;
};
