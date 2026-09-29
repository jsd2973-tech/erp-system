import type { BidLoadState, BidNotice, BidRegionFilter, BidSourceFilter } from "./biddingTypes";

export const BID_REGION_LABELS: Record<BidRegionFilter, string> = {
  local: "우리 지역",
  all: "전체 지역",
  daejeon: "대전",
  sejong: "세종",
  chungnam: "충남",
};

const BID_REGION_KEYWORDS: Record<Exclude<BidRegionFilter, "local" | "all">, string[]> = {
  daejeon: ["대전", "대전광역시"],
  sejong: ["세종", "세종특별자치시"],
  chungnam: [
    "충남", "충청남도", "천안", "공주", "보령", "아산", "서산", "논산", "계룡", "당진",
    "금산", "부여", "서천", "청양", "홍성", "예산", "태안",
  ],
};

export const BID_FOLLOW_TODAY_KEY = "erp_bid_follow_today_v1";
export const BID_SEEN_NOTICE_KEY = "erp_bid_seen_notice_ids_v1";

export const toBidDateInput = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
};

export const getBidQuickRange = (days: number, now: Date = new Date()) => {
  const toKey = toBidDateInput(now);
  const to = new Date(toKey + "T00:00:00+09:00");
  const from = new Date(to.getTime() - Math.max(0, days - 1) * 86400000);
  return { from: toBidDateInput(from), to: toKey };
};

export const getBidDeadlineBadge = (deadline: string, status?: string, now = Date.now()) => {
  if (status === "마감" || !deadline) return "";
  const timestamp = new Date(deadline.trim().replace(/\//g, "-").replace(" ", "T")).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const remainingDays = Math.ceil((timestamp - now) / 86400000);
  if (remainingDays <= 0) return "오늘 마감";
  if (remainingDays <= 2) return "D-" + remainingDays;
  return "";
};

export const isBidNoticeNew = (noticeId: string, seenIds: ReadonlySet<string>, hasSeenHistory: boolean) =>
  hasSeenHistory && !seenIds.has(noticeId);

export const matchesBidRegion = (
  notice: Pick<BidNotice, "agency" | "regionText">,
  region: BidRegionFilter,
) => {
  if (region === "all") return true;
  // 실제 참가제한·납품·구역 관련 필드를 우선 사용하고, 값이 없을 때만 기관명으로 보완합니다.
  const regionText = String(notice.regionText || "").trim().toLowerCase();
  const text = regionText || String(notice.agency || "").trim().toLowerCase();
  const matches = (target: Exclude<BidRegionFilter, "local" | "all">) =>
    BID_REGION_KEYWORDS[target].some((keyword) => text.includes(keyword.toLowerCase()));
  return region === "local"
    ? matches("daejeon") || matches("sejong") || matches("chungnam")
    : matches(region);
};

export const filterBidNotices = (
  notices: BidNotice[],
  source: BidSourceFilter,
  region: BidRegionFilter,
  search: string,
) => {
  const keyword = search.trim().toLowerCase();
  return notices.filter((notice) => {
    if (source === "g2b" && notice.source !== "나라장터") return false;
    if (source === "lh" && notice.source !== "LH") return false;
    if (!matchesBidRegion(notice, region)) return false;
    if (!keyword) return true;
    return (notice.title + " " + notice.agency + " " + notice.bidNo).toLowerCase().includes(keyword);
  });
};

export const formatBidAmount = (amount: number) =>
  amount > 0 ? amount.toLocaleString("ko-KR") + "원" : "금액 미공개";

export const formatBidDate = (value: string) => value ? value.slice(0, 16) : "미정";

export const getBidLoadLabel = (state: BidLoadState) =>
  state === "failed" ? "조회실패" : state === "partial" ? "일부조회" : state === "normal" ? "연동 정상" : "조회 준비";
