import { useEffect, useState, type KeyboardEvent } from "react";
import { FileCheck2 } from "lucide-react";
import {
  BID_FOLLOW_TODAY_KEY,
  BID_REGION_LABELS,
  BID_SEEN_NOTICE_KEY,
  filterBidNotices,
  formatBidAmount,
  formatBidDate,
  getBidDeadlineBadge,
  getBidLoadLabel,
  getBidQuickRange,
  isBidNoticeNew,
  toBidDateInput,
} from "./biddingModel";
import { loadBidNotices as fetchBidNotices } from "./biddingService";
import type {
  BidDiagnostics,
  BidLoadState,
  BidNotice,
  BidRegionFilter,
  BidSourceFilter,
  BidUserRole,
} from "./biddingTypes";
import "./bidding.css";

export default function BiddingPage({ currentRole }: { currentRole: BidUserRole }) {
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
  const [bidFilters, setBidFilters] = useState<{ region: BidRegionFilter; from: string; to: string }>(() => {
    const defaults = { region: "local" as BidRegionFilter, ...getBidQuickRange(30) };
    try {
      const saved = window.localStorage.getItem("erp_bid_filter_settings_v1");
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
  const [keywords, setKeywords] = useState<{ include: string[]; exclude: string[] }>(() => {
    try {
      const saved = window.localStorage.getItem("erp_bid_keyword_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.include) && Array.isArray(parsed?.exclude)) {
          return { include: parsed.include, exclude: parsed.exclude };
        }
      }
    } catch {
      // 저장값이 손상된 경우 기본 키워드를 사용합니다.
    }
    return { include: ["골재", "잡석", "쇄석", "혼합골재"], exclude: ["순환골재"] };
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
    window.localStorage.setItem("erp_bid_keyword_settings_v1", JSON.stringify(keywords));
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
      const fromDate = new Date(`${bidFilters.from}T00:00:00`);
      const toDate = new Date(`${bidFilters.to}T23:59:59`);
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
    void loadBidNotices();
    // 첫 진입 시 저장된 키워드로 한 번만 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem("erp_bid_filter_settings_v1", JSON.stringify(bidFilters));
  }, [bidFilters]);

  useEffect(() => {
    if (!bidFollowToday) return;

    const syncBidRangeToKoreaToday = () => {
      const today = toBidDateInput(new Date());
      setBidFilters((current) => {
        if (current.to === today) return current;
        const fromTime = new Date(`${current.from}T00:00:00+09:00`).getTime();
        const toTime = new Date(`${current.to}T00:00:00+09:00`).getTime();
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
  const bidLoadLabel = getBidLoadLabel(bidLoadState);
  const bidSourceLabels: Record<string, string> = { g2b: "나라장터", lh: "LH" };

  return (
    <section className="bid-notice-page">
      <div className="bid-notice-head">
        <div>
          <span>PUBLIC BID</span>
          <h2>입찰공고</h2>
          <p>나라장터와 LH의 공개 입찰공고를 한곳에서 확인합니다.</p>
        </div>
        <div className={`bid-notice-stage ${bidLoadState}`}>
          <b>{bidLoadLabel}</b>
          <span>나라장터 · LH</span>
        </div>
      </div>

      <div className="bid-keyword-panel">
        <div className="bid-keyword-group">
          <strong>포함 키워드</strong>
          <div className="bid-keyword-chips">
            {keywords.include.map((keyword) => (
              <span className="include" key={keyword}>{keyword}{canEditKeywords && <button type="button" onClick={() => removeKeyword("include", keyword)} aria-label={`${keyword} 삭제`}>×</button>}</span>
            ))}
          </div>
          {canEditKeywords && (
            <div className="bid-keyword-add">
              <input value={includeInput} onChange={(event) => setIncludeInput(event.target.value)} onKeyDown={(event) => handleKeywordKeyDown(event, "include")} placeholder="포함 키워드 입력" />
              <button type="button" onClick={() => addKeyword("include")}>추가</button>
            </div>
          )}
        </div>
        <div className="bid-keyword-group">
          <strong>제외 키워드</strong>
          <div className="bid-keyword-chips">
            {keywords.exclude.map((keyword) => (
              <span className="exclude" key={keyword}>{keyword}{canEditKeywords && <button type="button" onClick={() => removeKeyword("exclude", keyword)} aria-label={`${keyword} 삭제`}>×</button>}</span>
            ))}
            {!keywords.exclude.length && <em>등록된 제외 키워드가 없습니다.</em>}
          </div>
          {canEditKeywords && (
            <div className="bid-keyword-add">
              <input value={excludeInput} onChange={(event) => setExcludeInput(event.target.value)} onKeyDown={(event) => handleKeywordKeyDown(event, "exclude")} placeholder="제외 키워드 입력" />
              <button type="button" onClick={() => addKeyword("exclude")}>추가</button>
            </div>
          )}
        </div>
        <div className="bid-keyword-actions">
          <span>{canEditKeywords ? (keywordMessage || "키워드를 추가하거나 × 버튼으로 삭제한 뒤 저장하세요.") : "관리자 또는 사무실직원이 키워드를 변경할 수 있습니다."}</span>
          {canEditKeywords && <button type="button" className="primary" onClick={saveKeywords}>키워드 저장</button>}
        </div>
      </div>

      <div className="bid-range-panel">
        <div className="bid-range-group">
          <strong>공고 지역</strong>
          <div className="bid-region-buttons">
            {(Object.keys(BID_REGION_LABELS) as BidRegionFilter[]).map((region) => (
              <button
                type="button"
                key={region}
                className={bidFilters.region === region ? "active" : ""}
                onClick={() => setBidFilters((current) => ({ ...current, region }))}
              >{BID_REGION_LABELS[region]}</button>
            ))}
          </div>
          <small>우리 지역은 발주·수요기관 기준 대전, 세종, 충남 공고를 함께 표시합니다.</small>
        </div>
        <div className="bid-range-group">
          <strong>조회기간</strong>
          <div className="bid-date-quick">
            {[7, 30, 90].map((days) => <button type="button" key={days} onClick={() => setQuickRange(days)}>최근 {days}일</button>)}
          </div>
          <div className="bid-date-inputs">
            <input type="date" value={bidFilters.from} max={bidFilters.to} onChange={(event) => setBidDateManually("from", event.target.value)} aria-label="입찰공고 조회 시작일" />
            <span>~</span>
            <input type="date" value={bidFilters.to} min={bidFilters.from} max={toBidDateInput(new Date())} onChange={(event) => setBidDateManually("to", event.target.value)} aria-label="입찰공고 조회 종료일" />
          </div>
          <small>최대 90일까지 선택할 수 있으며 공고 새로고침을 누르면 적용됩니다.</small>
        </div>
      </div>

      <div className="bid-filter-bar">
        <div className="bid-source-tabs" aria-label="공고 출처 선택">
          <button className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>전체</button>
          <button className={source === "g2b" ? "active" : ""} onClick={() => setSource("g2b")}>나라장터</button>
          <button className={source === "lh" ? "active" : ""} onClick={() => setSource("lh")}>LH</button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="공고명 또는 발주기관 검색" aria-label="입찰공고 검색" />
        <button type="button" className="primary" onClick={loadBidNotices} disabled={bidLoading}>{bidLoading ? "공고 불러오는 중..." : "공고 새로고침"}</button>
      </div>

      <div className="bid-result-summary">
        <div><strong>{visibleBidNotices.length}</strong><span>표시 공고</span></div>
        <p>{bidFetchedAt ? `${BID_REGION_LABELS[bidFilters.region]} · ${bidFilters.from} ~ ${bidFilters.to} · 마지막 조회 ${new Date(bidFetchedAt).toLocaleString("ko-KR")}` : "입찰공고 연결 대기 중"}</p>
      </div>
      {bidError && (
        <div className={`bid-api-error ${bidLoadState}`}>
          <strong>{bidLoadState === "failed" ? "조회실패" : "일부조회"}</strong>
          <span>{bidError}</span>
          {bidDiagnostics?.sourceStatus && (
            <div className="bid-source-status-list">
              {Object.entries(bidDiagnostics.sourceStatus).map(([key, value]) => (
                <span className={value.status} key={key}>
                  {bidSourceLabels[key] || key} · {value.status === "normal" ? "정상" : value.status === "failed" ? "실패" : "일부"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bid-list-head">
        <span>출처</span>
        <span>공고명 · 발주기관</span>
        <span>공고금액</span>
        <span>마감일 · 상태</span>
      </div>
      {visibleBidNotices.length ? (
        <div className="bid-notice-list">
          {visibleBidNotices.map((notice) => (
            <article className="bid-notice-row" key={notice.id}>
              <div className="bid-notice-source"><div><b>{notice.source}</b>{notice.isNew && <em className="bid-new-badge">신규</em>}</div><span>{notice.businessType}</span></div>
              <div className="bid-notice-main">
                <a href={notice.url} target="_blank" rel="noreferrer">{notice.title}</a>
                <span>{notice.agency || "기관 미표시"} · {notice.bidNo}</span>
              </div>
              <strong className="bid-notice-amount">{formatBidAmount(notice.amount)}</strong>
              <div className="bid-notice-deadline">
                <span>{formatBidDate(notice.deadline)}</span>
                <i className={notice.status === "마감" ? "closed" : "open"}>{notice.status || "진행중"}</i>
                {notice.deadlineBadge && <em className="bid-deadline-badge">{notice.deadlineBadge}</em>}
                <a href={notice.url} target="_blank" rel="noreferrer">원문 보기</a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bid-empty-state">
          <FileCheck2 size={42} />
          <strong>{bidLoading ? "입찰공고를 불러오고 있습니다" : "조건에 맞는 공고가 없습니다"}</strong>
          <p>포함 키워드 또는 검색어를 바꾸고 공고 새로고침을 눌러보세요.</p>
          <small>선택한 게시일 범위에서 포함 키워드가 있고 제외 키워드가 없는 공고를 표시합니다.</small>
        </div>
      )}
    </section>
  );
}
