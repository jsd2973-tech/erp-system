import { useEffect, useState, type KeyboardEvent } from "react";
import {
  BID_FOLLOW_TODAY_KEY,
  BID_SEEN_NOTICE_KEY,
  filterBidNotices,
  getBidDeadlineBadge,
  getBidQuickRange,
  isBidNoticeNew,
  toBidDateInput,
} from "./biddingModel";
import { loadBidNotices as fetchBidNotices } from "./biddingService";
import type {
  BidDiagnostics,
  BidFilters,
  BidKeywords,
  BidLoadState,
  BidNotice,
  BidRegionFilter,
  BidSourceFilter,
  BidUserRole,
} from "./biddingTypes";

const FILTER_SETTINGS_KEY = "erp_bid_filter_settings_v1";
const KEYWORD_SETTINGS_KEY = "erp_bid_keyword_settings_v1";
const DEFAULT_KEYWORDS: BidKeywords = {
  include: ["골재", "잡석", "쇄석", "혼합골재"],
  exclude: ["순환골재"],
};

export function useBidding(currentRole: BidUserRole) {
  const [source, setSource] = useState<BidSourceFilter>("all");
  const [search, setSearch] = useState("");
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [keywordMessage, setKeywordMessage] = useState("");
  const [bidNotices, setBidNotices] = useState<BidNotice[]>([]);
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState("");
  const [bidFetchedAt, setBidFetchedAt] = useState("");
  const [bidLoadState, setBidLoadState] = useState<BidLoadState>("idle");
  const [bidDiagnostics, setBidDiagnostics] = useState<BidDiagnostics | null>(null);
  const [bidFollowToday, setBidFollowToday] = useState(() => window.localStorage.getItem(BID_FOLLOW_TODAY_KEY) !== "0");
  const [bidFilters, setBidFilters] = useState<BidFilters>(() => {
    const defaults: BidFilters = { region: "local", ...getBidQuickRange(30) };
    try {
      const saved = window.localStorage.getItem(FILTER_SETTINGS_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      const allowedRegions: BidRegionFilter[] = ["local", "all", "daejeon", "sejong", "chungnam"];
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      return {
        region: allowedRegions.includes(parsed?.region) ? parsed.region : defaults.region,
        from: datePattern.test(parsed?.from || "") ? parsed.from : defaults.from,
        to: datePattern.test(parsed?.to || "") ? parsed.to : defaults.to,
      };
    } catch {
      return defaults;
    }
  });
  const [keywords, setKeywords] = useState<BidKeywords>(() => {
    try {
      const saved = window.localStorage.getItem(KEYWORD_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.include) && Array.isArray(parsed?.exclude)) {
          return { include: parsed.include, exclude: parsed.exclude };
        }
      }
    } catch {
      // 저장값이 손상된 경우 기본 키워드를 사용합니다.
    }
    return DEFAULT_KEYWORDS;
  });
  const canEditKeywords = currentRole === "admin" || currentRole === "office";

  const addKeyword = (kind: "include" | "exclude") => {
    if (!canEditKeywords) return;
    const value = (kind === "include" ? includeInput : excludeInput).trim();
    if (!value) return setKeywordMessage("추가할 키워드를 입력해 주세요.");
    if ([...keywords.include, ...keywords.exclude].some((keyword) => keyword.toLowerCase() === value.toLowerCase())) {
      return setKeywordMessage("이미 등록된 키워드입니다.");
    }
    setKeywords((current) => ({ ...current, [kind]: [...current[kind], value] }));
    if (kind === "include") setIncludeInput("");
    else setExcludeInput("");
    setKeywordMessage("변경사항을 저장해 주세요.");
  };

  const removeKeyword = (kind: "include" | "exclude", keyword: string) => {
    if (!canEditKeywords) return;
    setKeywords((current) => ({ ...current, [kind]: current[kind].filter((item) => item !== keyword) }));
    setKeywordMessage("변경사항을 저장해 주세요.");
  };

  const saveKeywords = () => {
    if (!canEditKeywords) return;
    if (!keywords.include.length) return setKeywordMessage("포함 키워드는 한 개 이상 필요합니다.");
    window.localStorage.setItem(KEYWORD_SETTINGS_KEY, JSON.stringify(keywords));
    setKeywordMessage("키워드 설정을 저장했습니다.");
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>, kind: "include" | "exclude") => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addKeyword(kind);
  };

  const loadBidNotices = async () => {
    setBidLoading(true);
    setBidError("");
    setBidLoadState("idle");
    try {
      const fromDate = new Date(bidFilters.from + "T00:00:00");
      const toDate = new Date(bidFilters.to + "T23:59:59");
      const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      if (!bidFilters.from || !bidFilters.to || Number.isNaN(rangeDays)) throw new Error("조회 시작일과 종료일을 선택해 주세요.");
      if (rangeDays < 1) throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
      if (rangeDays > 90) throw new Error("조회기간은 최대 90일까지 선택할 수 있습니다.");

      const result = await fetchBidNotices(bidFilters, keywords);
      if (result.loadState === "failed") {
        setBidNotices([]);
        setBidDiagnostics(result.diagnostics);
        setBidLoadState("failed");
        setBidError(result.error);
        return;
      }

      let seenIds: string[] = [];
      let hasSeenHistory = false;
      try {
        const stored = window.localStorage.getItem(BID_SEEN_NOTICE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            seenIds = parsed.map((id) => String(id)).filter(Boolean);
            hasSeenHistory = true;
          }
        }
      } catch {
        // 손상된 신규공고 기록은 이번 조회를 막지 않습니다.
      }
      const seenIdSet = new Set(seenIds);
      const withBadges: BidNotice[] = result.notices.map((notice) => ({
        ...notice,
        isNew: isBidNoticeNew(notice.id, seenIdSet, hasSeenHistory),
        deadlineBadge: getBidDeadlineBadge(notice.deadline, notice.status),
      }));
      try {
        const currentIds = Array.from(new Set([...seenIds, ...withBadges.map((notice) => notice.id)])).slice(-3000);
        window.localStorage.setItem(BID_SEEN_NOTICE_KEY, JSON.stringify(currentIds));
      } catch {
        // localStorage가 막힌 환경에서도 공고 조회는 계속합니다.
      }
      setBidNotices(withBadges);
      setBidFetchedAt(new Date().toISOString());
      setBidDiagnostics({ ...result.diagnostics, matchedCount: withBadges.length });
      setBidLoadState(result.loadState);
      if (result.error) setBidError(result.error);
    } catch (error) {
      setBidNotices([]);
      setBidDiagnostics(null);
      setBidLoadState("failed");
      setBidError(error instanceof Error ? error.message : "입찰공고를 불러오지 못했습니다.");
    } finally {
      setBidLoading(false);
    }
  };

  useEffect(() => {
    // 최초 진입 조회 시 즉시 loading 상태를 설정하는 기존 동작을 유지합니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBidNotices();
    // 첫 진입 시 저장된 키워드로 한 번만 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(bidFilters));
  }, [bidFilters]);

  useEffect(() => {
    if (!bidFollowToday) return;

    const syncBidRangeToKoreaToday = () => {
      const today = toBidDateInput(new Date());
      setBidFilters((current) => {
        if (current.to === today) return current;
        const fromTime = new Date(current.from + "T00:00:00+09:00").getTime();
        const toTime = new Date(current.to + "T00:00:00+09:00").getTime();
        const rangeDays = Number.isFinite(fromTime) && Number.isFinite(toTime)
          ? Math.min(90, Math.max(1, Math.round((toTime - fromTime) / 86400000) + 1))
          : 30;
        return { ...current, ...getBidQuickRange(rangeDays) };
      });
    };

    syncBidRangeToKoreaToday();
    const timer = window.setInterval(syncBidRangeToKoreaToday, 10000);
    window.addEventListener("focus", syncBidRangeToKoreaToday);
    document.addEventListener("visibilitychange", syncBidRangeToKoreaToday);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncBidRangeToKoreaToday);
      document.removeEventListener("visibilitychange", syncBidRangeToKoreaToday);
    };
  }, [bidFollowToday]);

  const setQuickRange = (days: number) => {
    setBidFollowToday(true);
    window.localStorage.setItem(BID_FOLLOW_TODAY_KEY, "1");
    setBidFilters((current) => ({ ...current, ...getBidQuickRange(days) }));
  };

  const setBidDateManually = (key: "from" | "to", value: string) => {
    setBidFollowToday(false);
    window.localStorage.setItem(BID_FOLLOW_TODAY_KEY, "0");
    setBidFilters((current) => ({ ...current, [key]: value }));
  };

  const visibleBidNotices = filterBidNotices(bidNotices, source, bidFilters.region, search);

  return {
    keywordControls: {
      keywords,
      canEditKeywords,
      includeInput,
      excludeInput,
      keywordMessage,
      setIncludeInput,
      setExcludeInput,
      addKeyword,
      removeKeyword,
      saveKeywords,
      handleKeywordKeyDown,
    },
    rangeControls: { bidFilters, setBidFilters, setQuickRange, setBidDateManually },
    searchControls: { source, setSource, search, setSearch, bidLoading, loadBidNotices },
    results: {
      visibleBidNotices,
      bidLoading,
      bidError,
      bidFetchedAt,
      bidLoadState,
      bidDiagnostics,
      bidFilters,
    },
  };
}
