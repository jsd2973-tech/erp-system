export type ReceiptOcrResult = {
  date?: string;
  merchant?: string;
  totalAmount?: number;
  confidence?: {
    date?: number;
    merchant?: number;
    totalAmount?: number;
  };
};

type TextLine = { text: string; index: number };
type DateCandidate = { value: string; line: TextLine; score: number };
type AmountCandidate = { value: number; line: TextLine; score: number };

const DATE_KEYWORDS = [
  /거래\s*일자|거래일/,
  /결제\s*일자|결제일/,
  /승인\s*일자|승인일시|승인일/,
  /구매\s*일자|구매일/,
  /발행\s*일자|발행일/,
  /판매\s*일자|판매일/,
  /사용\s*일자|사용일/,
  /날짜|일자/,
];

const AMOUNT_KEYWORDS = [
  { pattern: /최종\s*결제\s*금액/, score: 120 },
  { pattern: /총\s*결제\s*금액/, score: 115 },
  { pattern: /카드\s*결제\s*금액/, score: 110 },
  { pattern: /결제\s*금액/, score: 105 },
  { pattern: /결제\s*합계/, score: 102 },
  { pattern: /합계\s*금액/, score: 100 },
  { pattern: /승인\s*금액/, score: 108 },
  { pattern: /총\s*액/, score: 95 },
  { pattern: /합계/, score: 90 },
  { pattern: /받은\s*금액/, score: 82 },
  { pattern: /카드\s*승인\s*금액/, score: 80 },
];

const EXCLUDED_AMOUNT_CONTEXT = /공급\s*가액|공급액|과세\s*금액|부가세|vat|할인|거스름돈|카드\s*잔액|잔액|적립|포인트|승인\s*번호|사업자\s*등록\s*번호|카드\s*번호/i;
const MERCHANT_LABEL = /(?:상호명?|가맹점명|판매자명|상점명)\s*[:：]?\s*(.+)$/i;
const MERCHANT_EXCLUDED = /사업자|등록\s*번호|대표자?|주소|도로명|지번|전화|tel|fax|카드|승인|할부|포인트|적립|영수증|거래명세서|신용|체크|pos|van|고객|번호|일시|일자|합계|금액|부가세|공급가액|(?:^|\s)(?:업태|종목|업종)\s*[:：]?|(?:^|\s)도\s*[,·ㆍ.]?\s*소매|(?:^|\s)(?:도매|소매)업/i;

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
  if (Array.isArray(value.responses)) {
    return extractOcrText(value.responses[0]);
  }
  return "";
};

const toLines = (text: string): TextLine[] => text
  .split("\n")
  .map((line, index) => ({ text: line.replace(/\s+/g, " ").trim(), index }))
  .filter((line) => line.text.length > 0);

const isValidDate = (year: number, month: number, day: number) => {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const dateKey = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const dateMatches = (line: TextLine) => {
  const result: Array<{ value: string; position: number }> = [];
  const separated = /(?<!\d)(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?!\d)/g;
  const koreanDate = /(?<!\d)(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;
  const compact = /(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/g;

  for (const match of line.text.matchAll(separated)) {
    const rawYear = Number(match[1]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDate(year, month, day)) result.push({ value: dateKey(year, month, day), position: match.index || 0 });
  }
  for (const match of line.text.matchAll(koreanDate)) {
    const rawYear = Number(match[1]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDate(year, month, day)) result.push({ value: dateKey(year, month, day), position: match.index || 0 });
  }
  for (const match of line.text.matchAll(compact)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDate(year, month, day)) result.push({ value: dateKey(year, month, day), position: match.index || 0 });
  }
  return result;
};

const parseDate = (lines: TextLine[]) => {
  const candidates: DateCandidate[] = [];
  lines.forEach((line) => {
    const keywordScore = DATE_KEYWORDS.reduce((score, keyword, index) =>
      keyword.test(line.text) ? Math.max(score, 100 - index * 5) : score, 0);
    dateMatches(line).forEach((match) => {
      candidates.push({
        value: match.value,
        line,
        score: keywordScore + (keywordScore ? 20 : 0) - line.index * 0.25 - match.position * 0.001,
      });
    });
  });
  candidates.sort((a, b) => b.score - a.score || a.line.index - b.line.index);
  const selected = candidates[0];
  return selected
    ? { value: selected.value, confidence: selected.score >= 100 ? 0.95 : 0.72 }
    : undefined;
};

const cleanMerchant = (value: string) => value
  .replace(/^[|:：\-–—\s]+/, "")
  .replace(/[|]+$/, "")
  .replace(/\s+(?:대표자?|사업자\s*번호|전화|주소)\s*[:：].*$/i, "")
  .trim();

const isMerchantCandidate = (value: string) => {
  const candidate = cleanMerchant(value);
  if (candidate.length < 2 || candidate.length > 80) return false;
  if (MERCHANT_EXCLUDED.test(candidate)) return false;
  if (/^\d[\d\s./-]*$/.test(candidate)) return false;
  if (!/[가-힣A-Za-z]/.test(candidate)) return false;
  if (/\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}/.test(candidate)) return false;
  return true;
};

const parseMerchant = (lines: TextLine[]) => {
  const labeled: Array<{ value: string; score: number }> = [];
  lines.forEach((line) => {
    const match = line.text.match(MERCHANT_LABEL);
    if (match && isMerchantCandidate(match[1])) labeled.push({ value: cleanMerchant(match[1]), score: 150 - line.index });
  });
  if (labeled.length) {
    labeled.sort((a, b) => b.score - a.score);
    return { value: labeled[0].value, confidence: 0.96 };
  }

  const candidates: Array<{ value: string; score: number }> = [];
  lines.slice(0, 12).forEach((line, index) => {
    if (!isMerchantCandidate(line.text)) return;
    const normalized = line.text.replace(/\s+/g, " ");
    const koreanCount = (normalized.match(/[가-힣]/g) || []).length;
    const businessHint = /주식회사|㈜|\(주\)|마트|식당|카페|공구|주유소|건설|산업|농협|편의점|점$/.test(normalized) ? 18 : 0;
    const score = 60 + businessHint + koreanCount * 0.5 - index * 5 - (/[0-9]{4,}/.test(normalized) ? 15 : 0);
    candidates.push({ value: cleanMerchant(normalized), score });
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? { value: candidates[0].value, confidence: 0.72 } : undefined;
};

const extractAmountTokens = (value: string) => {
  const result: Array<{ value: number; position: number }> = [];
  const pattern = /(?<![\d-])(?:₩|￦)?\s*(\d{1,3}(?:[\s,]\d{3})+|\d{2,})(?:\.\d+)?\s*원?/g;
  for (const match of value.matchAll(pattern)) {
    const numeric = Number(match[1].replace(/[\s,]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0 && numeric < 1_000_000_000) {
      result.push({ value: Math.round(numeric), position: match.index || 0 });
    }
  }
  return result;
};

// 영수증 OCR은 `합 계`, `승인 금액`처럼 한글 라벨 안에도 공백을 넣을 수 있다.
// 숫자 사이 공백은 금액 토큰에서 유효하므로 한글 문자 사이 공백만 정규화한다.
const normalizeAmountLabelText = (value: string) =>
  value.replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "");

const parseAmount = (lines: TextLine[]) => {
  const candidates: AmountCandidate[] = [];
  lines.forEach((line, lineIndex) => {
    const searchableText = normalizeAmountLabelText(line.text);
    AMOUNT_KEYWORDS.forEach(({ pattern, score: keywordScore }) => {
      const match = searchableText.match(pattern);
      if (!match || match.index == null) return;

      const after = searchableText.slice(match.index + match[0].length);
      const before = searchableText.slice(0, match.index);
      const afterAmounts = extractAmountTokens(after);
      const beforeAmounts = extractAmountTokens(before);
      const nextAmounts = extractAmountTokens(normalizeAmountLabelText(lines[lineIndex + 1]?.text || ""));
      const selected = afterAmounts[0] || beforeAmounts[beforeAmounts.length - 1] || nextAmounts[0];
      if (!selected) return;

      const context = `${line.text} ${searchableText}`;
      const excludedOnly = EXCLUDED_AMOUNT_CONTEXT.test(context) && !/최종\s*결제|총\s*결제|카드\s*결제|결제\s*합계|합계\s*금액|총\s*액|합계|승인\s*금액/.test(searchableText);
      if (excludedOnly) return;
      candidates.push({
        value: selected.value,
        line,
        score: keywordScore + (afterAmounts.length ? 10 : 0) - line.index * 0.25,
      });
    });
  });

  if (!candidates.length) {
    lines.forEach((line) => {
      if (!/[원₩￦]/.test(line.text) || EXCLUDED_AMOUNT_CONTEXT.test(line.text)) return;
      const amounts = extractAmountTokens(line.text);
      const selected = amounts[amounts.length - 1];
      if (selected) candidates.push({ value: selected.value, line, score: 35 + line.index * 0.05 });
    });
  }

  candidates.sort((a, b) => b.score - a.score || b.line.index - a.line.index);
  const selected = candidates[0];
  return selected
    ? { value: selected.value, confidence: selected.score >= 90 ? 0.94 : 0.62 }
    : undefined;
};

export const parseReceiptOcr = (input: unknown): ReceiptOcrResult => {
  const text = extractOcrText(input);
  if (!text) return {};
  const lines = toLines(text);
  const date = parseDate(lines);
  const merchant = parseMerchant(lines);
  const totalAmount = parseAmount(lines);

  return {
    ...(date ? { date: date.value } : {}),
    ...(merchant ? { merchant: merchant.value } : {}),
    ...(totalAmount ? { totalAmount: totalAmount.value } : {}),
    confidence: {
      ...(date ? { date: date.confidence } : {}),
      ...(merchant ? { merchant: merchant.confidence } : {}),
      ...(totalAmount ? { totalAmount: totalAmount.confidence } : {}),
    },
  };
};
