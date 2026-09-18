import { parseReceiptOcr } from "../card/receiptOcr.js";

export type FuelReceiptOcrResult = {
  fuelDate?: string;
  stationName?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  supplyAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  confidence?: {
    fuelDate?: number;
    stationName?: number;
    productName?: number;
    quantity?: number;
    unitPrice?: number;
    supplyAmount?: number;
    vatAmount?: number;
    totalAmount?: number;
  };
};

type TextLine = { text: string; index: number };
type NumberCandidate = { value: number; score: number };
type NumberToken = {
  value: number;
  amountValue: number;
  position: number;
  hasCurrency: boolean;
  hasThousandsSeparator: boolean;
  hasDecimal: boolean;
  hasVolumeUnit: boolean;
};
type ParsedNumber = { value: number; confidence: number };

const cleanText = (value: unknown) => String(value ?? "")
  .replace(/[\u200b\u00a0]/g, " ")
  .replace(/\r/g, "")
  .trim();

const extractOcrText = (input: unknown): string => {
  if (typeof input === "string") return cleanText(input);
  if (!input || typeof input !== "object") return "";

  const value = input as Record<string, unknown>;
  if (typeof value.text === "string") return cleanText(value.text);
  if (typeof value.description === "string") return cleanText(value.description);
  if (value.fullTextAnnotation && typeof value.fullTextAnnotation === "object") {
    const text = (value.fullTextAnnotation as Record<string, unknown>).text;
    if (typeof text === "string") return cleanText(text);
  }
  if (Array.isArray(value.textAnnotations)) {
    const first = value.textAnnotations[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).description === "string") {
      return cleanText((first as Record<string, unknown>).description);
    }
  }
  if (Array.isArray(value.responses)) return extractOcrText(value.responses[0]);
  return "";
};

const toLines = (text: string): TextLine[] => text
  .split("\n")
  .map((line, index) => ({ text: line.replace(/\s+/g, " ").trim(), index }))
  .filter((line) => line.text.length > 0);

// OCR이 `주 유 량`, `합 계 금 액`처럼 한글 라벨 사이에 공백을 삽입하는 경우를 보정한다.
const normalizeLabelText = (value: string) => value.replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "");

const extractNumberTokens = (value: string) => {
  const result: NumberToken[] = [];
  const pattern = /(?<![\d-])(?:₩|￦)?\s*((?:\d{1,3}(?:,\s*\d{3})+|\d+(?:\s\d{3})+(?!\s*,\s*\d{3})|\d+)(?:(?:\.\s*\d+|,\s*\d{1,2}))?)\s*(?:원|₩|L|ℓ|리터)?/gi;
  for (const match of value.matchAll(pattern)) {
    const raw = match[1].replace(/\s/g, "");
    const decimalComma = /^\d{1,3},\d{1,2}$/.test(raw);
    const numeric = Number(decimalComma ? raw.replace(",", ".") : raw.replace(/,/g, ""));
    const hasCurrency = /[원₩￦]/.test(match[0]);
    const hasThousandsSeparator = /^\d{1,3}(?:,\d{3})+$/.test(raw)
      || (hasCurrency && /^\d{1,3}(?:\.\d{3})+$/.test(raw));
    const amountValue = hasThousandsSeparator ? Number(raw.replace(/[,.]/g, "")) : numeric;
    const valueNumber = hasCurrency && /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? amountValue : numeric;
    if (Number.isFinite(numeric) && numeric > 0 && Number.isFinite(amountValue)) {
      result.push({
        value: valueNumber,
        amountValue,
        position: match.index || 0,
        hasCurrency,
        hasThousandsSeparator,
        hasDecimal: /\.\d+/.test(raw),
        hasVolumeUnit: /(?:L|ℓ|리터)\b/i.test(match[0]),
      });
    }
  }
  return result;
};

// 금액 라벨 옆에는 필기 메모의 숫자가 함께 OCR될 수 있다.
// `원/₩` 또는 콤마 천 단위 구분이 있는 토큰만 금액 후보로 인정해 메모 숫자를 우선 선택하지 않는다.
const selectAmountToken = (tokens: NumberToken[]) => {
  const candidates = tokens.filter((token) => token.hasCurrency || token.hasThousandsSeparator);
  candidates.sort((a, b) => {
    const aStrength = (a.hasCurrency ? 4 : 0) + (a.hasThousandsSeparator ? 3 : 0);
    const bStrength = (b.hasCurrency ? 4 : 0) + (b.hasThousandsSeparator ? 3 : 0);
    return bStrength - aStrength || a.position - b.position;
  });
  return candidates[0];
};

const selectQuantityToken = (tokens: NumberToken[], preferLast = false) => {
  const candidates = [...tokens];
  candidates.sort((a, b) => {
    const aStrength = (a.hasVolumeUnit ? 6 : 0) + (a.hasDecimal ? 3 : 0);
    const bStrength = (b.hasVolumeUnit ? 6 : 0) + (b.hasDecimal ? 3 : 0);
    return bStrength - aStrength || (preferLast ? b.position - a.position : a.position - b.position);
  });
  return candidates[0];
};

const findLabeledNumber = (
  lines: TextLine[],
  labels: Array<{ pattern: RegExp; score: number }>,
  maxValue: number,
) => {
  const candidates: NumberCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const searchable = normalizeLabelText(line.text);
    labels.forEach(({ pattern, score }) => {
      const match = searchable.match(pattern);
      if (!match || match.index == null) return;

      const after = extractNumberTokens(searchable.slice(match.index + match[0].length));
      const before = extractNumberTokens(searchable.slice(0, match.index));
      const next = extractNumberTokens(normalizeLabelText(lines[lineIndex + 1]?.text || ""));
      const selected = after[0] || before[before.length - 1] || next[0];
      if (!selected || selected.value > maxValue) return;

      candidates.push({
        value: selected.value,
        score: score + (after.length ? 10 : before.length ? 4 : 1) - line.index * 0.2,
      });
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  return selected
    ? { value: selected.value, confidence: selected.score >= 100 ? 0.95 : 0.78 }
    : undefined;
};

const findLabeledQuantity = (
  lines: TextLine[],
  labels: Array<{ pattern: RegExp; score: number }>,
  maxValue: number,
) => {
  const candidates: NumberCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const searchable = normalizeLabelText(line.text);
    labels.forEach(({ pattern, score }) => {
      const match = searchable.match(pattern);
      if (!match || match.index == null) return;

      const after = selectQuantityToken(extractNumberTokens(searchable.slice(match.index + match[0].length)));
      const before = selectQuantityToken(extractNumberTokens(searchable.slice(0, match.index)), true);
      const next = selectQuantityToken(extractNumberTokens(normalizeLabelText(lines[lineIndex + 1]?.text || "")));
      const selected = after || before || next;
      if (!selected || selected.value > maxValue) return;

      candidates.push({
        value: selected.value,
        score: score + (after ? 10 : before ? 4 : 1)
          + (selected.hasVolumeUnit ? 5 : 0)
          + (selected.hasDecimal ? 3 : 0)
          - line.index * 0.2,
      });
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  return selected
    ? { value: selected.value, confidence: selected.score >= 100 ? 0.95 : 0.78 }
    : undefined;
};

const findLabeledAmount = (
  lines: TextLine[],
  labels: Array<{ pattern: RegExp; score: number }>,
  maxValue: number,
) => {
  const candidates: NumberCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const searchable = normalizeLabelText(line.text);
    labels.forEach(({ pattern, score }) => {
      const match = searchable.match(pattern);
      if (!match || match.index == null) return;

      const after = selectAmountToken(extractNumberTokens(searchable.slice(match.index + match[0].length)));
      const before = selectAmountToken(extractNumberTokens(searchable.slice(0, match.index)));
      const next = selectAmountToken(extractNumberTokens(normalizeLabelText(lines[lineIndex + 1]?.text || "")));
      const selected = after || before || next;
      if (!selected || selected.amountValue > maxValue) return;

      candidates.push({
        value: selected.amountValue,
        score: score + (after ? 10 : before ? 4 : 1)
          + (selected.hasCurrency ? 5 : 0)
          + (selected.hasThousandsSeparator ? 3 : 0)
          - line.index * 0.2,
      });
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  return selected
    ? { value: selected.value, confidence: selected.score >= 100 ? 0.95 : 0.78 }
    : undefined;
};

const PRODUCT_RULES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /고급\s*휘발유|premium/i, value: "고급휘발유" },
  { pattern: /휘발유|가솔린|gasoline/i, value: "휘발유" },
  { pattern: /초저유황\s*경유|저유황\s*경유|경유|디젤|diesel/i, value: "경유" },
  { pattern: /요소\s*수|요소수|urea/i, value: "요소수" },
  { pattern: /등유|kerosene/i, value: "등유" },
  { pattern: /\bLPG\b/i, value: "LPG" },
  { pattern: /전기|kwh/i, value: "전기" },
];

const PRODUCT_LABEL = /(?:유종|품목|상품명|연료)\s*[:：]?\s*(.*)$/i;

const parseProduct = (lines: TextLine[]) => {
  for (const line of lines) {
    const searchable = normalizeLabelText(line.text);
    const labeled = searchable.match(PRODUCT_LABEL);
    const candidate = labeled?.[1] || searchable;
    const matched = PRODUCT_RULES.find((rule) => rule.pattern.test(candidate) && (Boolean(labeled) || PRODUCT_ONLY.test(candidate.trim()) || /(?:유종|품목|상품명|연료)/i.test(searchable)));
    if (matched) return { value: matched.value, confidence: labeled ? 0.96 : 0.92 };
  }
  return undefined;
};

const STATION_LABEL = /(?:주유\s*처|주유\s*소\s*명|가맹점명|상호명?|판매자명|상점명)\s*[:：]?\s*(.+)$/i;
const STATION_EXCLUDED = /사업자|등록\s*번호|대표자?|주소|도로명|지번|전화|tel|fax|카드|승인|할부|포인트|적립|영수증|거래명세서|신용|체크|pos|van|고객|번호|일시|일자|합계|금액|결제|부가세|공급가액|주유일|주유량|수량|단가|할인|거스름돈|잔액|세액|적립금/i;
const PRODUCT_ONLY = /^(?:경유|휘발유|고급휘발유|요소수|등유|lpg|전기|디젤|가솔린)$/i;

const cleanStation = (value: string) => value
  .replace(/^[|:：\-–—\s]+/, "")
  .replace(/[|]+$/, "")
  .replace(/\s+(?:대표자?|사업자\s*번호|전화|주소)\s*[:：].*$/i, "")
  .replace(/\s+/g, " ")
  .trim();

const isStationCandidate = (value: string) => {
  const candidate = cleanStation(value);
  if (candidate.length < 2 || candidate.length > 80) return false;
  if (STATION_EXCLUDED.test(candidate) || PRODUCT_ONLY.test(candidate)) return false;
  if (/^\d[\d\s./-]*$/.test(candidate)) return false;
  if (!/[가-힣A-Za-z]/.test(candidate)) return false;
  return true;
};

const parseStation = (lines: TextLine[], fallback: string | undefined) => {
  const labeled: Array<{ value: string; score: number }> = [];
  lines.forEach((line) => {
    const match = normalizeLabelText(line.text).match(STATION_LABEL);
    if (match && isStationCandidate(match[1])) labeled.push({ value: cleanStation(match[1]), score: 160 - line.index });
  });
  if (labeled.length) {
    labeled.sort((a, b) => b.score - a.score);
    return { value: labeled[0].value, confidence: 0.96 };
  }

  const candidates: Array<{ value: string; score: number }> = [];
  lines.slice(0, 14).forEach((line, index) => {
    if (!isStationCandidate(line.text)) return;
    const value = cleanStation(line.text);
    const businessHint = /주유소|농협|오일|oil|에너지|충전소|카센터/i.test(value) ? 22 : 0;
    candidates.push({ value, score: 68 + businessHint - index * 5 });
  });
  if (fallback && isStationCandidate(fallback)) candidates.push({ value: cleanStation(fallback), score: 82 });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? { value: candidates[0].value, confidence: candidates[0].score >= 90 ? 0.9 : 0.68 } : undefined;
};

const QUANTITY_LABELS = [
  { pattern: /주유\s*량|판매\s*수량/, score: 125 },
  { pattern: /수량/, score: 115 },
  { pattern: /리터|qty/i, score: 88 },
];
const UNIT_PRICE_LABELS = [
  { pattern: /판매\s*단가|주유\s*단가/, score: 125 },
  { pattern: /단가/, score: 115 },
  { pattern: /원\s*\/\s*(?:l|ℓ|리터)/i, score: 105 },
];
const SUPPLY_LABELS = [
  { pattern: /공급\s*가액|공급액/, score: 130 },
  { pattern: /거래\s*금액/, score: 126 },
  { pattern: /과세\s*표준|과세\s*금액/, score: 112 },
];
const VAT_LABELS = [
  { pattern: /부가\s*세|vat/i, score: 130 },
  { pattern: /세금/, score: 124 },
  { pattern: /세액/, score: 112 },
];
const TOTAL_LABELS = [
  { pattern: /최종\s*결제\s*금액/, score: 155 },
  { pattern: /총\s*결제\s*금액|카드\s*결제\s*금액/, score: 148 },
  { pattern: /결제\s*금액/, score: 140 },
  { pattern: /총\s*금액/, score: 146 },
  { pattern: /총\s*합계|합계\s*금액/, score: 132 },
  { pattern: /합계/, score: 120 },
  { pattern: /총\s*액/, score: 112 },
  { pattern: /받은\s*금액/, score: 92 },
];

const parseQuantity = (lines: TextLine[]) => {
  const labeled = findLabeledQuantity(lines, QUANTITY_LABELS, 100_000);
  if (labeled) return labeled;

  const fallback: NumberCandidate[] = [];
  lines.forEach((line, index) => {
    if (!/(?:L|ℓ|리터)\b/i.test(line.text) || /원\s*\/\s*(?:L|ℓ|리터)/i.test(line.text)) return;
    const token = selectQuantityToken(extractNumberTokens(line.text));
    if (token && token.value <= 100_000) fallback.push({ value: token.value, score: 58 - index * 0.2 });
  });
  fallback.sort((a, b) => b.score - a.score);
  return fallback[0] ? { value: fallback[0].value, confidence: 0.62 } : undefined;
};

const parseUnitPrice = (lines: TextLine[]) => {
  const labeled = findLabeledNumber(lines, UNIT_PRICE_LABELS, 10_000_000);
  if (labeled) return labeled;

  const fallback: NumberCandidate[] = [];
  lines.forEach((line, index) => {
    if (!/원\s*\/\s*(?:L|ℓ|리터)/i.test(line.text)) return;
    const tokens = extractNumberTokens(line.text);
    const token = tokens[tokens.length - 1];
    if (token && token.value <= 10_000_000) fallback.push({ value: token.value, score: 62 - index * 0.2 });
  });
  fallback.sort((a, b) => b.score - a.score);
  return fallback[0] ? { value: fallback[0].value, confidence: 0.68 } : undefined;
};

const approximatelyEqual = (left: number, right: number) =>
  Math.abs(left - right) <= Math.max(2, Math.round(Math.max(Math.abs(left), Math.abs(right)) * 0.001));

const collectAmountValues = (lines: TextLine[]) => Array.from(new Set(
  lines.flatMap((line) => extractNumberTokens(line.text))
    .filter((token) => token.hasCurrency || token.hasThousandsSeparator)
    .map((token) => Math.round(token.amountValue))
    .filter((value) => value >= 10 && value <= 1_000_000_000),
)).sort((a, b) => b - a);

const inferReceiptAmounts = (lines: TextLine[]) => {
  const values = collectAmountValues(lines);
  for (let totalIndex = 0; totalIndex < values.length; totalIndex += 1) {
    const total = values[totalIndex];
    for (let leftIndex = totalIndex + 1; leftIndex < values.length; leftIndex += 1) {
      const left = values[leftIndex];
      if (left >= total) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const right = values[rightIndex];
        if (right >= left) continue;
        if (!approximatelyEqual(left + right, total)) continue;

        return {
          supply: Math.max(left, right),
          vat: Math.min(left, right),
          total,
        };
      }
    }
  }

  // OCR이 세금 줄을 놓쳐도 총액과 공급가액만 남는 카드 영수증이 있다.
  // 두 금액의 차이가 일반적인 부가세 범위일 때만 보조적으로 복원한다.
  if (values.length >= 2) {
    const total = values[0];
    const supply = values[1];
    const vat = total - supply;
    const vatRate = supply > 0 ? vat / supply : 0;
    if (vat > 0 && vatRate >= 0.05 && vatRate <= 0.2) {
      return { supply, vat, total };
    }
  }
  return undefined;
};

const reconcileReceiptAmounts = (
  lines: TextLine[],
  supplyAmount: ParsedNumber | undefined,
  vatAmount: ParsedNumber | undefined,
  totalAmount: ParsedNumber | undefined,
) => {
  // 할인·포인트 등이 포함된 영수증은 공급가액+부가세와 최종금액이 다를 수 있다.
  // 세 항목을 라벨과 함께 모두 찾은 경우에는 그 원본 관계를 덮어쓰지 않는다.
  if (supplyAmount && vatAmount && totalAmount
    && totalAmount.value > supplyAmount.value
    && totalAmount.value > vatAmount.value) {
    return { supplyAmount, vatAmount, totalAmount };
  }

  const inferred = inferReceiptAmounts(lines);
  if (!inferred) return { supplyAmount, vatAmount, totalAmount };

  return {
    supplyAmount: { value: inferred.supply, confidence: 0.9 },
    vatAmount: { value: inferred.vat, confidence: 0.9 },
    totalAmount: { value: inferred.total, confidence: 0.92 },
  };
};

// 카드승인형 주유영수증은 단가가 부가세 포함 금액인 경우가 있어 총금액 ÷ 단가를 먼저 시도한다.
// 주유량을 별도 표기하지 않은 경우에만 보조 계산하고, 사용자가 입력칸에서 확인·수정할 수 있게 한다.
const deriveQuantity = (
  supplyAmount: { value: number } | undefined,
  totalAmount: { value: number } | undefined,
  unitPrice: { value: number } | undefined,
) => {
  if (!unitPrice || unitPrice.value <= 0) return undefined;

  const candidates = [
    ...(totalAmount ? [{ amount: totalAmount.value, confidence: 0.66 }] : []),
    ...(supplyAmount ? [{ amount: supplyAmount.value, confidence: 0.58 }] : []),
  ];
  for (const candidate of candidates) {
    if (candidate.amount <= 0) continue;
    const value = candidate.amount / unitPrice.value;
    const roundedValue = Math.round(value * 1000) / 1000;
    if (!Number.isFinite(roundedValue) || roundedValue <= 0 || roundedValue > 100_000) continue;
    if (approximatelyEqual(roundedValue * unitPrice.value, candidate.amount)) {
      return { value: roundedValue, confidence: candidate.confidence };
    }
  }
  return undefined;
};

const parseAmount = (lines: TextLine[], labels: Array<{ pattern: RegExp; score: number }>) =>
  findLabeledAmount(lines, labels, 1_000_000_000);

export const parseFuelReceiptOcr = (input: unknown): FuelReceiptOcrResult => {
  const text = extractOcrText(input);
  if (!text) return {};

  const lines = toLines(text);
  const base = parseReceiptOcr(input);
  const station = parseStation(lines, base.merchant);
  const product = parseProduct(lines);
  const unitPrice = parseUnitPrice(lines);
  const parsedSupplyAmount = parseAmount(lines, SUPPLY_LABELS);
  const parsedVatAmount = parseAmount(lines, VAT_LABELS);
  const parsedTotalAmount = parseAmount(lines, TOTAL_LABELS);
  const { supplyAmount, vatAmount, totalAmount } = reconcileReceiptAmounts(
    lines,
    parsedSupplyAmount,
    parsedVatAmount,
    parsedTotalAmount,
  );
  const parsedQuantity = parseQuantity(lines);
  const quantityMatchesAmount = parsedQuantity && unitPrice
    ? [supplyAmount, totalAmount].filter(Boolean).some((amount) => approximatelyEqual(parsedQuantity.value * unitPrice.value, amount!.value))
    : true;
  const quantity = (parsedQuantity && quantityMatchesAmount)
    ? parsedQuantity
    : deriveQuantity(supplyAmount, totalAmount, unitPrice) || parsedQuantity;
  const calculatedTotal = totalAmount || (supplyAmount && vatAmount
    ? { value: Math.round(supplyAmount.value + vatAmount.value), confidence: 0.7 }
    : undefined);

  return {
    ...(base.date ? { fuelDate: base.date } : {}),
    ...(station ? { stationName: station.value } : {}),
    ...(product ? { productName: product.value } : {}),
    ...(quantity ? { quantity: quantity.value } : {}),
    ...(unitPrice ? { unitPrice: Math.round(unitPrice.value * 1000) / 1000 } : {}),
    ...(supplyAmount ? { supplyAmount: Math.round(supplyAmount.value) } : {}),
    ...(vatAmount ? { vatAmount: Math.round(vatAmount.value) } : {}),
    ...(calculatedTotal ? { totalAmount: Math.round(calculatedTotal.value) } : {}),
    confidence: {
      ...(base.date ? { fuelDate: base.confidence?.date } : {}),
      ...(station ? { stationName: station.confidence } : {}),
      ...(product ? { productName: product.confidence } : {}),
      ...(quantity ? { quantity: quantity.confidence } : {}),
      ...(unitPrice ? { unitPrice: unitPrice.confidence } : {}),
      ...(supplyAmount ? { supplyAmount: supplyAmount.confidence } : {}),
      ...(vatAmount ? { vatAmount: vatAmount.confidence } : {}),
      ...(calculatedTotal ? { totalAmount: calculatedTotal.confidence } : {}),
    },
  };
};
