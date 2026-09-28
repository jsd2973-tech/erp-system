import { reconcileFuelReceiptOcr, type FuelReceiptOcrResult } from "./fuelReceiptOcr";
import type { FuelRecord } from "./fuelTypes";

export type FuelOcrField =
  | "fuel_date"
  | "station_name"
  | "product_name"
  | "quantity"
  | "unit_price"
  | "supply_amount"
  | "vat_amount"
  | "total_amount";

export type FuelOcrTouchedFields = Record<FuelOcrField, boolean>;
export type FuelOcrManualValues = Pick<FuelRecord, "product_name"> & { unit_price: string };

export type FuelOcrMergeResult = {
  patch: Partial<Record<FuelOcrField, string>>;
  state: "success" | "error";
  message: string;
  detectedLabels: string[];
  appliedLabels: string[];
  rejectedLabels: string[];
};

const LABEL_FIELD: Record<string, FuelOcrField> = {
  주유일자: "fuel_date",
  주유처: "station_name",
  유종: "product_name",
  주유량: "quantity",
  단가: "unit_price",
  공급가액: "supply_amount",
  부가세: "vat_amount",
  합계금액: "total_amount",
};

export const createFuelOcrTouchedFields = (): FuelOcrTouchedFields => ({
  fuel_date: false,
  station_name: false,
  product_name: false,
  quantity: false,
  unit_price: false,
  supply_amount: false,
  vat_amount: false,
  total_amount: false,
});

export const applyFuelReceiptOcrResult = (
  result: FuelReceiptOcrResult,
  manual: FuelOcrManualValues,
  touched: FuelOcrTouchedFields,
  referenceRecords: Array<Pick<FuelRecord, "product_name" | "unit_price">>,
): FuelOcrMergeResult => {
  const resultProduct = String(result.productName || manual.product_name || "").trim();
  const contextUnitPrices = [
    Number(manual.unit_price || 0),
    ...referenceRecords
      .filter((record) => !resultProduct || !record.product_name || record.product_name === resultProduct)
      .map((record) => Number(record.unit_price || 0)),
  ];
  const normalizedResult = reconcileFuelReceiptOcr(result, contextUnitPrices);
  const detectedLabels = [
    normalizedResult.fuelDate ? "주유일자" : "",
    normalizedResult.stationName ? "주유처" : "",
    normalizedResult.productName ? "유종" : "",
    normalizedResult.quantity != null ? "주유량" : "",
    normalizedResult.unitPrice != null ? "단가" : "",
    normalizedResult.supplyAmount != null ? "공급가액" : "",
    normalizedResult.vatAmount != null ? "부가세" : "",
    normalizedResult.totalAmount != null ? "합계금액" : "",
  ].filter(Boolean);
  const hasAmountContext = result.totalAmount != null || result.supplyAmount != null;
  const rejectedLabels = [
    (result.quantity != null || hasAmountContext) && normalizedResult.quantity == null ? "주유량" : "",
    (result.unitPrice != null || hasAmountContext) && normalizedResult.unitPrice == null ? "단가" : "",
  ].filter(Boolean);
  const appliedLabels = detectedLabels.filter((label) => {
    const field = LABEL_FIELD[label];
    return field ? !touched[field] : true;
  });
  const patch: Partial<Record<FuelOcrField, string>> = {
    ...(result.fuelDate && !touched.fuel_date ? { fuel_date: result.fuelDate } : {}),
    ...(result.stationName && !touched.station_name ? { station_name: result.stationName } : {}),
    ...(result.productName && !touched.product_name ? { product_name: result.productName } : {}),
    ...(normalizedResult.quantity != null && !touched.quantity ? { quantity: String(normalizedResult.quantity) } : {}),
    ...(normalizedResult.unitPrice != null && !touched.unit_price ? { unit_price: String(normalizedResult.unitPrice) } : {}),
    ...(normalizedResult.supplyAmount != null && !touched.supply_amount ? { supply_amount: String(normalizedResult.supplyAmount) } : {}),
    ...(normalizedResult.vatAmount != null && !touched.vat_amount ? { vat_amount: String(normalizedResult.vatAmount) } : {}),
    ...(normalizedResult.totalAmount != null && !touched.total_amount ? { total_amount: String(normalizedResult.totalAmount) } : {}),
  };

  if (!detectedLabels.length) {
    return {
      patch,
      state: "error",
      message: "영수증에서 유류 항목을 확인하지 못했습니다. 차량·현장 선택값은 유지했습니다. 직접 입력해 주세요.",
      detectedLabels,
      appliedLabels,
      rejectedLabels,
    };
  }
  if (rejectedLabels.length) {
    return {
      patch,
      state: "success",
      message: "영수증에서 " + detectedLabels.join("·") + "을(를) 자동 입력했습니다. " + rejectedLabels.join("·") + "은(는) 인쇄값과 금액 관계가 맞지 않아 자동 입력하지 않았습니다. 직접 확인 후 저장해 주세요.",
      detectedLabels,
      appliedLabels,
      rejectedLabels,
    };
  }
  if (!appliedLabels.length) {
    return {
      patch,
      state: "success",
      message: "영수증 분석 완료. 기존에 직접 입력한 값은 유지했습니다. 차량·현장 선택값도 유지했습니다. 확인 후 저장해 주세요.",
      detectedLabels,
      appliedLabels,
      rejectedLabels,
    };
  }
  const missingLabels = detectedLabels.filter((label) => !appliedLabels.includes(label));
  return {
    patch,
    state: "success",
    message: missingLabels.length
      ? "영수증에서 " + appliedLabels.join("·") + "을(를) 자동 입력했습니다. " + missingLabels.join("·") + "은(는) 기존 입력값을 유지했습니다. 차량·현장 선택값은 유지했습니다. 확인 후 저장해 주세요."
      : "영수증에서 주유일자·주유처·유종·주유량·단가·공급가액·부가세·합계금액을 자동 입력했습니다. 차량·현장 선택값은 유지했습니다. 확인 후 저장해 주세요.",
    detectedLabels,
    appliedLabels,
    rejectedLabels,
  };
};

export const isFuelReceiptImage = (file: File) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "");
export const isFuelReceiptPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");

export const fileToFuelDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("이미지를 읽지 못했습니다."));
  reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
  reader.readAsDataURL(file);
});

export const compressFuelReceiptImage = (file: File): Promise<File> => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1800;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return resolve(file);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        resolve(new File([blob], "fuel-receipt-" + Date.now() + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.8);
    };
    image.onerror = () => resolve(file);
    image.src = String(reader.result || "");
  };
  reader.onerror = () => resolve(file);
  reader.readAsDataURL(file);
});

export const requestFuelReceiptOcr = async (
  accessToken: string,
  dataUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<FuelReceiptOcrResult> => {
  const response = await fetcher("/api/receipt-ocr", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ dataUrl, mode: "fuel" }),
  });
  const body = await response.json().catch(() => ({})) as { error?: unknown } & FuelReceiptOcrResult;
  if (!response.ok) throw new Error(String(body?.error || "영수증 OCR 분석에 실패했습니다."));
  return body;
};
