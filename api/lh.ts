const LH_BASE_URL = "https://apis.data.go.kr/B552555/OpenBidInfoList/getOpenBidInfo";

declare const process: { env: Record<string, string | undefined> };

type LhRawItem = Record<string, string>;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "s-maxage=300, stale-while-revalidate=600" : "no-store",
  },
});

const textValue = (value: unknown) => String(value ?? "").trim();

const dateKey = (value: string) => value.replace(/-/g, "");

const parseDateInput = (value: string | null, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const decodeXml = (value: string) => value.trim()
  .replace(/^<!\[CDATA\[/, "")
  .replace(/\]\]>$/, "")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .trim();

const tagValue = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
};

const parseItems = (xml: string): LhRawItem[] => {
  const resultCode = tagValue(xml, "resultCode");
  if (resultCode && resultCode !== "00") {
    throw new Error(tagValue(xml, "resultMsg") || `LH API 오류 (${resultCode})`);
  }
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const itemXml = match[1];
    const fields = [
      "bidNum", "bidDegree", "cstrtnJobGbNm", "bidKind", "bidnmKor", "zoneHqCd",
      "bidProgrsStatus", "tndrCtrctMedCd", "tndrbidRegDt", "presmtPrc", "addtTax",
      "designPrc", "fdmtlAmt", "tndrdocAcptBgninDtm", "tndrdocAcptEndDtm", "openDtm",
      "zoneRstrct1", "zoneRstrct2", "zoneRstrct3", "zoneRstrct4",
    ];
    return Object.fromEntries(fields.map((field) => [field, tagValue(itemXml, field)])) as LhRawItem;
  });
};

const normalizeServiceKey = (serviceKey: string) => {
  try {
    return decodeURIComponent(serviceKey.trim());
  } catch {
    return serviceKey.trim();
  }
};

const responseText = async (response: Response) => {
  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const replacementCount = (utf8.match(/�/g) || []).length;
  if (replacementCount < 3) return utf8;
  try {
    return new TextDecoder("euc-kr").decode(bytes);
  } catch {
    return utf8;
  }
};

const fetchPage = async (serviceKey: string, from: string, to: string, pageNo: number) => {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: "100",
    tndrbidRegDtStart: dateKey(from),
    tndrbidRegDtEnd: dateKey(to),
  });
  const response = await fetch(`${LH_BASE_URL}?${params.toString()}`);
  const body = await responseText(response);
  if (!response.ok) throw new Error(`LH 연결 실패 (${response.status})`);
  const items = parseItems(body);
  const totalCount = Number(tagValue(body, "totalCount") || items.length);
  const rowsPerPage = Number(tagValue(body, "numOfRows") || items.length || 100);
  return { items, totalCount, rowsPerPage };
};

const fetchRemainingPages = async (serviceKey: string, from: string, to: string, pageCount: number) => {
  const pages: Awaited<ReturnType<typeof fetchPage>>[] = [];
  for (let pageNo = 2; pageNo <= pageCount; pageNo += 5) {
    const batch = Array.from(
      { length: Math.min(5, pageCount - pageNo + 1) },
      (_, index) => fetchPage(serviceKey, from, to, pageNo + index),
    );
    pages.push(...await Promise.all(batch));
  }
  return pages;
};

const detailUrl = (businessType: string, bidNo: string, bidDegree: string) => {
  const route = businessType.includes("시설공사")
    ? "BidConstructDetailListCmd"
    : businessType.includes("용역")
      ? "BidsrvcsDetailListCmd"
      : businessType.includes("지급자재")
        ? "BidctrctgdsDetailListCmd"
        : businessType.includes("물품")
          ? "BidgdsDetailListCmd"
          : "BidMasterListCmd";
  const params = new URLSearchParams({ bidDegree: bidDegree || "00", bidNum: bidNo });
  return `https://ebid.lh.or.kr/ebid.et.tp.cmd.${route}.dev?${params.toString()}`;
};

const parseDeadline = (value: string) => {
  const normalized = value.trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})\s+/, "$1-$2-$3T");
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") return json({ error: "GET 요청만 허용됩니다." }, 405);

    const serviceKey = process.env.LH_SERVICE_KEY;
    if (!serviceKey) return json({ error: "Vercel에 LH_SERVICE_KEY가 설정되지 않았습니다." }, 503);

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

    const from = requestUrl.searchParams.get("from") || beginDate.toISOString().slice(0, 10);
    const to = requestUrl.searchParams.get("to") || endDate.toISOString().slice(0, 10);

    try {
      const normalizedKey = normalizeServiceKey(serviceKey);
      const firstPage = await fetchPage(normalizedKey, from, to, 1);
      const pageCount = Math.min(30, Math.max(1, Math.ceil(firstPage.totalCount / firstPage.rowsPerPage)));
      const remaining = pageCount > 1
        ? await fetchRemainingPages(normalizedKey, from, to, pageCount)
        : [];
      const fetchedItems = [firstPage, ...remaining].flatMap((page) => page.items);
      const includeLower = include.map((keyword) => keyword.toLowerCase());
      const seen = new Set<string>();
      const now = Date.now();
      const notices = fetchedItems
        .filter((item) => {
          const title = textValue(item.bidnmKor).toLowerCase();
          return title
            && includeLower.some((keyword) => title.includes(keyword))
            && !exclude.some((keyword) => title.includes(keyword));
        })
        .map((item) => {
          const bidNo = textValue(item.bidNum);
          const bidDegree = textValue(item.bidDegree) || "00";
          const businessType = textValue(item.cstrtnJobGbNm);
          const deadline = textValue(item.tndrdocAcptEndDtm);
          const rawStatus = textValue(item.bidProgrsStatus);
          const isClosed = parseDeadline(deadline) < now
            || ["낙찰", "유찰", "마감", "취소"].some((status) => rawStatus.includes(status));
          return {
            id: `lh-${bidNo}-${bidDegree}`,
            source: "LH",
            businessType,
            bidNo: `${bidNo}-${bidDegree}`,
            title: textValue(item.bidnmKor),
            agency: textValue(item.zoneHqCd) || "한국토지주택공사",
            regionText: [item.zoneHqCd, item.zoneRstrct1, item.zoneRstrct2, item.zoneRstrct3, item.zoneRstrct4]
              .map(textValue).filter(Boolean).join(" "),
            noticeDate: textValue(item.tndrbidRegDt).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
            deadline,
            status: isClosed ? "마감" : "진행중",
            amount: Number(item.fdmtlAmt || item.designPrc || item.presmtPrc || 0),
            url: detailUrl(businessType, bidNo, bidDegree),
          };
        })
        .filter((item) => {
          if (!item.bidNo || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .sort((a, b) => b.noticeDate.localeCompare(a.noticeDate));

      return json({
        notices,
        fetchedAt: new Date().toISOString(),
        diagnostics: {
          receivedCount: fetchedItems.length,
          matchedCount: notices.length,
          totalCount: firstPage.totalCount,
          truncated: firstPage.totalCount > pageCount * firstPage.rowsPerPage,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "LH 공고를 불러오지 못했습니다.";
      return json({ error: message }, 502);
    }
  },
};
