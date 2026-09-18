const G2B_BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";
const G2B_OPERATIONS = [
  { name: "공사", path: "getBidPblancListInfoCnstwkPPSSrch" },
  { name: "용역", path: "getBidPblancListInfoServcPPSSrch" },
  { name: "외자", path: "getBidPblancListInfoFrgcptPPSSrch" },
  { name: "물품", path: "getBidPblancListInfoThngPPSSrch" },
] as const;

declare const process: { env: Record<string, string | undefined> };

type G2bRawItem = Record<string, unknown>;
type G2bFetchedItem = G2bRawItem & { businessType: string };
type G2bPage = {
  items: G2bRawItem[];
  totalCount: number;
  rowsPerPage: number;
};
type G2bCallDiagnostic = {
  operation: string;
  keyword: string;
  from: string;
  to: string;
  totalCount: number;
  receivedCount: number;
  pagesFetched: number;
  requestedPages: number;
  failedPages: number;
  truncated: boolean;
  error?: string;
};
type G2bFetchResult = {
  items: G2bFetchedItem[];
  diagnostic: G2bCallDiagnostic;
};

const G2B_MAX_PAGES = 50;
const G2B_PAGE_BATCH_SIZE = 5;
const G2B_SEARCH_FIELDS = [
  { key: "bidNtceNm", label: "title" },
  { key: "prdctClsfcNoNm", label: "item" },
  { key: "dtilPrdctClsfcNoNm", label: "detail" },
  { key: "cnstwkNm", label: "construction" },
  { key: "servcNm", label: "service" },
  { key: "dlvrPlce", label: "delivery" },
] as const;
const G2B_REGION_FIELDS = [
  "prtcptLmtRgnNm",
  "prtcptLmtRgnNm1",
  "prtcptLmtRgnNm2",
  "prtcptLmtRgnNm3",
  "prtcptLmtRgnNm4",
  "dlvrPlce",
] as const;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "s-maxage=300, stale-while-revalidate=600" : "no-store",
  },
});

const dateTimeKey = (date: Date, endOfDay = false) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}${endOfDay ? "2359" : "0000"}`;
};

const parseDateInput = (value: string | null, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const splitDateRanges = (from: Date, to: Date) => {
  const ranges: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const rangeEnd = new Date(cursor);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 29);
    if (rangeEnd > to) rangeEnd.setTime(to.getTime());
    ranges.push({ from: new Date(cursor), to: new Date(rangeEnd) });
    cursor = new Date(rangeEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return ranges;
};

const settleInBatches = async <T>(tasks: Array<() => Promise<T>>, batchSize = 20) => {
  const results: PromiseSettledResult<T>[] = [];
  for (let index = 0; index < tasks.length; index += batchSize) {
    results.push(...await Promise.allSettled(tasks.slice(index, index + batchSize).map((task) => task())));
  }
  return results;
};

const toPage = (payload: any): G2bPage => {
  const header = payload?.response?.header;
  const code = String(header?.resultCode ?? "00");
  if (code !== "00" && code !== "000") {
    throw new Error(String(header?.resultMsg || `나라장터 오류 (${code})`));
  }
  const body = payload?.response?.body;
  const rawItems = body?.items;
  const items = Array.isArray(rawItems)
    ? rawItems
    : Array.isArray(rawItems?.item)
      ? rawItems.item
      : rawItems?.item && typeof rawItems.item === "object"
        ? [rawItems.item]
        : [];
  const totalCount = Number(body?.totalCount);
  const rowsPerPage = Number(body?.numOfRows);
  return {
    items,
    totalCount: Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : items.length,
    rowsPerPage: Number.isFinite(rowsPerPage) && rowsPerPage > 0 ? rowsPerPage : 100,
  };
};

const textValue = (value: unknown) => String(value ?? "").trim();

const fetchOperationPage = async (
  operation: (typeof G2B_OPERATIONS)[number],
  keyword: string,
  serviceKey: string,
  begin: string,
  end: string,
  pageNo: number,
): Promise<G2bPage> => {
  const params = new URLSearchParams({
    ServiceKey: serviceKey,
    type: "json",
    inqryDiv: "1",
    inqryBgnDt: begin,
    inqryEndDt: end,
    numOfRows: "100",
    pageNo: String(pageNo),
  });
  if (keyword) params.set("bidNtceNm", keyword);
  const response = await fetch(`${G2B_BASE_URL}/${operation.path}?${params.toString()}`);
  const body = await response.text();
  if (!response.ok) throw new Error(`나라장터 연결 실패 (${response.status})`);
  try {
    return toPage(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError) {
      const message = body.match(/<returnAuthMsg>([^<]+)</)?.[1]
        || body.match(/<resultMsg>([^<]+)</)?.[1]
        || "나라장터 응답을 해석하지 못했습니다.";
      throw new Error(message);
    }
    throw error;
  }
};

export const fetchOperation = async (
  operation: (typeof G2B_OPERATIONS)[number],
  keyword: string,
  serviceKey: string,
  begin: string,
  end: string,
): Promise<G2bFetchResult> => {
  const firstPage = await fetchOperationPage(operation, keyword, serviceKey, begin, end, 1);
  const rowsPerPage = Math.max(1, firstPage.rowsPerPage || 100);
  const pageCount = Math.max(1, Math.ceil(firstPage.totalCount / rowsPerPage));
  const requestedPages = Math.min(G2B_MAX_PAGES, pageCount);
  const pages: Array<G2bPage & { pageNo: number }> = [{ ...firstPage, pageNo: 1 }];
  let failedPages = 0;

  for (let pageNo = 2; pageNo <= requestedPages; pageNo += G2B_PAGE_BATCH_SIZE) {
    const pageNumbers = Array.from(
      { length: Math.min(G2B_PAGE_BATCH_SIZE, requestedPages - pageNo + 1) },
      (_, index) => pageNo + index,
    );
    const settled = await Promise.allSettled(
      pageNumbers.map((currentPage) => fetchOperationPage(operation, keyword, serviceKey, begin, end, currentPage)),
    );
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        pages.push({ ...result.value, pageNo: pageNumbers[index] });
      } else {
        failedPages += 1;
      }
    });
  }

  pages.sort((a, b) => a.pageNo - b.pageNo);
  const truncated = pageCount > G2B_MAX_PAGES || failedPages > 0;
  return {
    items: pages.flatMap((page) => page.items.map((item) => ({ ...item, businessType: operation.name } as G2bFetchedItem))),
    diagnostic: {
      operation: operation.name,
      keyword,
      from: begin,
      to: end,
      totalCount: firstPage.totalCount,
      receivedCount: pages.reduce((sum, page) => sum + page.items.length, 0),
      pagesFetched: pages.length,
      requestedPages,
      failedPages,
      truncated,
    },
  };
};

type G2bRequest = {
  operation: (typeof G2B_OPERATIONS)[number];
  keyword: string;
  begin: string;
  end: string;
};

const failedDiagnostic = (request: G2bRequest): G2bCallDiagnostic => ({
  operation: request.operation.name,
  keyword: request.keyword,
  from: request.begin,
  to: request.end,
  totalCount: 0,
  receivedCount: 0,
  pagesFetched: 0,
  requestedPages: 0,
  failedPages: 0,
  truncated: false,
  error: "요청 실패",
});

const collectDiagnostics = (
  requests: G2bRequest[],
  settled: PromiseSettledResult<G2bFetchResult>[],
) => settled.map((result, index) => result.status === "fulfilled" ? result.value.diagnostic : failedDiagnostic(requests[index]));

const buildOperationStatus = (diagnostics: G2bCallDiagnostic[]) => G2B_OPERATIONS.map((operation) => {
  const related = diagnostics.filter((diagnostic) => diagnostic.operation === operation.name);
  const failedCalls = related.filter((diagnostic) => diagnostic.error).length;
  const failedPages = related.reduce((sum, diagnostic) => sum + diagnostic.failedPages, 0);
  const truncated = related.some((diagnostic) => diagnostic.truncated);
  const status = !related.length || failedCalls === related.length
    ? "failed"
    : failedCalls || failedPages || truncated
      ? "partial"
      : "normal";
  return { operation: operation.name, status, failedCalls, failedPages, truncated };
});

const searchFields = (item: G2bRawItem) => G2B_SEARCH_FIELDS
  .map(({ key, label }) => ({ label, value: textValue(item[key]) }))
  .filter((field) => field.value);

export const matchesG2bKeywords = (item: G2bRawItem, include: string[], exclude: string[]) => {
  const searchText = searchFields(item).map((field) => field.value).join(" ").toLowerCase();
  const includeLower = include.map((keyword) => keyword.toLowerCase());
  const excludeLower = exclude.map((keyword) => keyword.toLowerCase());
  return Boolean(searchText)
    && includeLower.some((keyword) => searchText.includes(keyword))
    && !excludeLower.some((keyword) => searchText.includes(keyword));
};

export const matchedG2bFields = (item: G2bRawItem, include: string[]) => {
  const includeLower = include.map((keyword) => keyword.toLowerCase());
  return searchFields(item)
    .filter((field) => includeLower.some((keyword) => field.value.toLowerCase().includes(keyword)))
    .map((field) => field.label);
};

const regionText = (item: G2bRawItem) => G2B_REGION_FIELDS
  .map((field) => textValue(item[field]))
  .filter(Boolean)
  .join(" ");

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") return json({ error: "GET 요청만 허용됩니다." }, 405);

    const serviceKey = process.env.G2B_SERVICE_KEY;
    if (!serviceKey) return json({ error: "Vercel에 G2B_SERVICE_KEY가 설정되지 않았습니다." }, 503);
    // data.go.kr 화면에 Encoding/Decoding 구분 없이 일반 인증키만
    // 표시되는 경우까지 지원합니다. URLSearchParams에는 원문 키를 전달해야 합니다.
    let normalizedServiceKey = serviceKey.trim();
    try {
      normalizedServiceKey = decodeURIComponent(normalizedServiceKey);
    } catch {
      // 이미 디코딩된 키이거나 변환할 필요가 없는 키는 그대로 사용합니다.
    }

    const requestUrl = new URL(request.url);
    const include = (requestUrl.searchParams.get("include") || "골재,잡석,쇄석,혼합골재")
      .split(",").map((item) => item.trim()).filter(Boolean).slice(0, 10);
    const exclude = (requestUrl.searchParams.get("exclude") || "순환골재")
      .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    if (!include.length) return json({ error: "포함 키워드가 필요합니다." }, 400);

    const today = new Date();
    const defaultEndDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const defaultBeginDate = new Date(defaultEndDate);
    defaultBeginDate.setUTCDate(defaultBeginDate.getUTCDate() - 29);
    const beginDate = parseDateInput(requestUrl.searchParams.get("from"), defaultBeginDate);
    const endDate = parseDateInput(requestUrl.searchParams.get("to"), defaultEndDate);
    const rangeDays = Math.floor((endDate.getTime() - beginDate.getTime()) / 86400000) + 1;
    if (rangeDays < 1) return json({ error: "시작일은 종료일보다 늦을 수 없습니다." }, 400);
    if (rangeDays > 90) return json({ error: "조회기간은 최대 90일까지 선택할 수 있습니다." }, 400);
    const dateRanges = splitDateRanges(beginDate, endDate);

    try {
      const primaryRequests: G2bRequest[] = dateRanges.flatMap((range) =>
        G2B_OPERATIONS.flatMap((operation) => include.map((keyword) => ({
          operation,
          keyword,
          begin: dateTimeKey(range.from),
          end: dateTimeKey(range.to, true),
        }))),
      );
      // 일반 조회는 키워드별 검색을 우선해 응답 속도를 유지합니다.
      // 페이지 요청까지 겹치지 않도록 외부 동시성은 4개로 제한합니다.
      const primarySettled = await settleInBatches(
        primaryRequests.map((request) => () => fetchOperation(
          request.operation,
          request.keyword,
          normalizedServiceKey,
          request.begin,
          request.end,
        )),
        4,
      );
      const resultGroups: Array<{
        requests: G2bRequest[];
        settled: PromiseSettledResult<G2bFetchResult>[];
      }> = [{ requests: primaryRequests, settled: primarySettled }];
      let successful = primarySettled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      let fetchedItems = successful.flatMap((result) => result.items);

      // 제목 검색이 완전히 빈 결과일 때만 무키워드 전체검색을 추가합니다.
      // 평소에는 대량 전체검색으로 30일 조회가 지연되지 않도록 합니다.
      if (!fetchedItems.length) {
        const expandedRequests: G2bRequest[] = dateRanges.flatMap((range) =>
          G2B_OPERATIONS.map((operation) => ({
            operation,
            keyword: "",
            begin: dateTimeKey(range.from),
            end: dateTimeKey(range.to, true),
          })),
        );
        const expandedSettled = await settleInBatches(
          expandedRequests.map((request) => () => fetchOperation(
            request.operation,
            "",
            normalizedServiceKey,
            request.begin,
            request.end,
          )),
          4,
        );
        resultGroups.push({ requests: expandedRequests, settled: expandedSettled });
        const expandedSuccessful = expandedSettled.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : []
        );
        successful = [...successful, ...expandedSuccessful];
        fetchedItems = [...fetchedItems, ...expandedSuccessful.flatMap((result) => result.items)];
      }
      if (!successful.length) {
        const firstError = resultGroups.flatMap((group) => group.settled)
          .find((result): result is PromiseRejectedResult => result.status === "rejected");
        throw firstError?.reason || new Error("나라장터 공고를 불러오지 못했습니다.");
      }

      const now = Date.now();
      const seen = new Set<string>();
      const includeLower = include.map((keyword) => keyword.toLowerCase());
      const notices = fetchedItems
        .filter((item) => matchesG2bKeywords(item, includeLower, exclude))
        .map((item) => {
          const bidNo = textValue(item.bidNtceNo);
          const bidOrd = textValue(item.bidNtceOrd) || "000";
          const deadlineText = textValue(item.bidClseDt);
          const deadlineTime = deadlineText ? new Date(deadlineText.replace(" ", "T")).getTime() : Number.POSITIVE_INFINITY;
          const isClosed = !Number.isNaN(deadlineTime) && deadlineTime < now;
          return {
            id: `${bidNo}-${bidOrd}`,
            source: "나라장터",
            businessType: textValue(item.businessType),
            bidNo,
            title: textValue(item.bidNtceNm),
            agency: textValue(item.dminsttNm) || textValue(item.ntceInsttNm),
            regionText: regionText(item),
            matchedBy: matchedG2bFields(item, includeLower),
            noticeDate: textValue(item.bidNtceDt),
            deadline: deadlineText,
            status: isClosed ? "마감" : "진행중",
            amount: Number(item.asignBdgtAmt || item.presmptPrce || 0),
            url: textValue(item.bidNtceDtlUrl) || textValue(item.bidNtceUrl)
              || `https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=${encodeURIComponent(bidNo)}&bidPbancOrd=${encodeURIComponent(bidOrd)}`,
          };
        })
        .filter((item) => {
          if (!item.bidNo || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .sort((a, b) => b.noticeDate.localeCompare(a.noticeDate));

      const callDiagnostics = resultGroups.flatMap((group) => collectDiagnostics(group.requests, group.settled));
      const failedCalls = callDiagnostics.filter((diagnostic) => diagnostic.error).length;
      const failedPages = callDiagnostics.reduce((sum, diagnostic) => sum + diagnostic.failedPages, 0);
      const truncated = callDiagnostics.some((diagnostic) => diagnostic.truncated);
      const partial = failedCalls > 0 || failedPages > 0 || truncated;
      const operationStatus = buildOperationStatus(callDiagnostics);
      return json({
        notices,
        fetchedAt: new Date().toISOString(),
        failedCalls,
        partial,
        truncated,
        diagnostics: {
          source: "나라장터",
          receivedCount: fetchedItems.length,
          matchedCount: notices.length,
          failedCalls,
          failedPages,
          truncated,
          partial,
          operations: operationStatus,
        },
        sourceStatus: {
          g2b: {
            status: !successful.length || operationStatus.every((item) => item.status === "failed")
              ? "failed"
              : partial ? "partial" : "normal",
            failedCalls,
            failedPages,
            truncated,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "나라장터 공고를 불러오지 못했습니다.";
      return json({ error: message }, 502);
    }
  },
};
