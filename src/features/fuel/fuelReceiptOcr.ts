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
  const result: Array<{ value: number; position: number }> = [];
  const pattern = /(?<![\d-])(?:₩|￦)?\s*(\d[\d,\s]*(?:\.\d+)?)\s*(?:원|₩|L|ℓ|리터)?/gi;
  for (const match of value.matchAll(pattern)) {
    const raw = match[1].replace(/\s/g, "");
    const decimalComma = /^\d{1,3},\d{1,2}$/.test(raw);
    const numeric = Number(decimalComma ? raw.replace(",", ".") : raw.replace(/,/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) result.push({ value: numeric, position: match.index || 0 });
  }
  return result;
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
  { pattern: /과세\s*표준|과세\s*금액/, score: 112 },
];
const VAT_LABELS = [
  { pattern: /부가\s*세|vat/i, score: 130 },
  { pattern: /세액/, score: 112 },
];
const TOTAL_LABELS = [
  { pattern: /최종\s*결제\s*금액/, score: 155 },
  { pattern: /총\s*결제\s*금액|카드\s*결제\s*금액/, score: 148 },
  { pattern: /결제\s*금액/, score: 140 },
  { pattern: /총\s*합계|합계\s*금액/, score: 132 },
  { pattern: /합계/, score: 120 },
  { pattern: /총\s*액/, score: 112 },
  { pattern: /받은\s*금액/, score: 92 },
];

const parseQuantity = (lines: TextLine[]) => {
  const labeled = findLabeledNumber(lines, QUANTITY_LABELS, 100_000);
  if (labeled) return labeled;

  const fallback: NumberCandidate[] = [];
  lines.forEach((line, index) => {
    if (!/(?:L|ℓ|리터)\b/i.test(line.text) || /원\s*\/\s*(?:L|ℓ|리터)/i.test(line.text)) return;
    const token = extractNumberTokens(line.text)[0];
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

const parseAmount = (lines: TextLine[], labels: Array<{ pattern: RegExp; score: number }>) =>
  findLabeledNumber(lines, labels, 1_000_000_000);

export const parseFuelReceiptOcr = (input: unknown): FuelReceiptOcrResult => {
  const text = extractOcrText(input);
  if (!text) return {};

  const lines = toLines(text);
  const base = parseReceiptOcr(input);
  const station = parseStation(lines, base.merchant);
  const product = parseProduct(lines);
  const quantity = parseQuantity(lines);
  const unitPrice = parseUnitPrice(lines);
  const supplyAmount = parseAmount(lines, SUPPLY_LABELS);
  const vatAmount = parseAmount(lines, VAT_LABELS);
  const totalAmount = parseAmount(lines, TOTAL_LABELS);
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
