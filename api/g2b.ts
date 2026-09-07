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

const toItems = (payload: any): G2bRawItem[] => {
  const header = payload?.response?.header;
  const code = String(header?.resultCode ?? "00");
  if (code !== "00" && code !== "000") {
    throw new Error(String(header?.resultMsg || `나라장터 오류 (${code})`));
  }
  const items = payload?.response?.body?.items;
  if (Array.isArray(items)) return items;
  if (Array.isArray(items?.item)) return items.item;
  if (items?.item && typeof items.item === "object") return [items.item];
  return [];
};

const textValue = (value: unknown) => String(value ?? "").trim();

const fetchOperation = async (
  operation: (typeof G2B_OPERATIONS)[number],
  keyword: string,
  serviceKey: string,
  begin: string,
  end: string,
): Promise<G2bFetchedItem[]> => {
  const params = new URLSearchParams({
    ServiceKey: serviceKey,
    type: "json",
    inqryDiv: "1",
    inqryBgnDt: begin,
    inqryEndDt: end,
    numOfRows: "100",
    pageNo: "1",
  });
  if (keyword) params.set("bidNtceNm", keyword);
  const response = await fetch(`${G2B_BASE_URL}/${operation.path}?${params.toString()}`);
  const body = await response.text();
  if (!response.ok) throw new Error(`나라장터 연결 실패 (${response.status})`);
  try {
    return toItems(JSON.parse(body)).map((item) => ({ ...item, businessType: operation.name } as G2bFetchedItem));
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
      const primarySettled: PromiseSettledResult<G2bFetchedItem[]>[] = [];
      // 최대 90일 선택 시에도 나라장터에는 30일 단위로 순차 요청합니다.
      for (const range of dateRanges) {
        primarySettled.push(...await settleInBatches(
          G2B_OPERATIONS.flatMap((operation) => include.map((keyword) => () =>
            fetchOperation(operation, keyword, normalizedServiceKey, dateTimeKey(range.from), dateTimeKey(range.to, true))
          )),
        ));
      }
      let allSettled = [...primarySettled];
      let successful = primarySettled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (!successful.length) {
        const firstError = primarySettled.find((result): result is PromiseRejectedResult => result.status === "rejected");
        throw firstError?.reason || new Error("나라장터 공고를 불러오지 못했습니다.");
      }

      let fetchedItems = successful.flat();
      // 키워드 검색이 빈 배열로 정상 응답하는 경우 최근 7일 전체 공고를
      // 한 번 더 조회한 뒤 ERP에서 키워드를 직접 적용합니다.
      if (!fetchedItems.length) {
        const fallbackSettled: PromiseSettledResult<G2bFetchedItem[]>[] = [];
        for (const range of dateRanges) {
          fallbackSettled.push(...await settleInBatches(
            G2B_OPERATIONS.map((operation) => () => fetchOperation(
              operation,
              "",
              normalizedServiceKey,
              dateTimeKey(range.from),
              dateTimeKey(range.to, true),
            )),
          ));
        }
        allSettled = [...allSettled, ...fallbackSettled];
        const fallbackSuccessful = fallbackSettled.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : []
        );
        successful = [...successful, ...fallbackSuccessful];
        fetchedItems = fallbackSuccessful.flat();
      }

      const now = Date.now();
      const seen = new Set<string>();
      const includeLower = include.map((keyword) => keyword.toLowerCase());
      const notices = fetchedItems
        .filter((item) => {
          const title = textValue(item.bidNtceNm).toLowerCase();
          return title
            && includeLower.some((keyword) => title.includes(keyword))
            && !exclude.some((keyword) => title.includes(keyword));
        })
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
            regionText: [item.dminsttNm, item.ntceInsttNm, item.prtcptLmtRgnNm].map(textValue).filter(Boolean).join(" "),
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

      const failedCalls = allSettled.filter((result) => result.status === "rejected").length;
      return json({
        notices,
        fetchedAt: new Date().toISOString(),
        failedCalls,
        diagnostics: { receivedCount: fetchedItems.length, matchedCount: notices.length },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "나라장터 공고를 불러오지 못했습니다.";
      return json({ error: message }, 502);
    }
  },
};
