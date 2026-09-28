import { FileCheck2 } from "lucide-react";
import { BID_REGION_LABELS, formatBidAmount, formatBidDate } from "./biddingModel";
import type { useBidding } from "./useBidding";

type BiddingResultsProps = Pick<ReturnType<typeof useBidding>, "results">;

const BID_SOURCE_LABELS: Record<string, string> = { g2b: "나라장터", lh: "LH" };

export function BiddingResults({ results }: BiddingResultsProps) {
  const {
    visibleBidNotices,
    bidLoading,
    bidError,
    bidFetchedAt,
    bidLoadState,
    bidDiagnostics,
    bidFilters,
  } = results;
  return (
    <>
      <div className="bid-result-summary">
        <div><strong>{visibleBidNotices.length}</strong><span>표시 공고</span></div>
        <p>{bidFetchedAt ? BID_REGION_LABELS[bidFilters.region] + " · " + bidFilters.from + " ~ " + bidFilters.to + " · 마지막 조회 " + new Date(bidFetchedAt).toLocaleString("ko-KR") : "입찰공고 연결 대기 중"}</p>
      </div>
      {bidError && (
        <div className={"bid-api-error " + bidLoadState}>
          <strong>{bidLoadState === "failed" ? "조회실패" : "일부조회"}</strong>
          <span>{bidError}</span>
          {bidDiagnostics?.sourceStatus && (
            <div className="bid-source-status-list">
              {Object.entries(bidDiagnostics.sourceStatus).map(([key, value]) => (
                <span className={value.status} key={key}>
                  {BID_SOURCE_LABELS[key] || key} · {value.status === "normal" ? "정상" : value.status === "failed" ? "실패" : "일부"}
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
    </>
  );
}
