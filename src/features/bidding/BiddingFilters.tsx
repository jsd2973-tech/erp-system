import { BID_REGION_LABELS, toBidDateInput } from "./biddingModel";
import type { useBidding } from "./useBidding";

type BiddingFilterProps = Pick<ReturnType<typeof useBidding>, "keywordControls" | "rangeControls" | "searchControls">;

export function BiddingFilters({ keywordControls, rangeControls, searchControls }: BiddingFilterProps) {
  const {
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
  } = keywordControls;
  const { bidFilters, setBidFilters, setQuickRange, setBidDateManually } = rangeControls;
  const { source, setSource, search, setSearch, bidLoading, loadBidNotices } = searchControls;

  return (
    <>
      <div className="bid-keyword-panel">
        <div className="bid-keyword-group">
          <strong>포함 키워드</strong>
          <div className="bid-keyword-chips">
            {keywords.include.map((keyword) => (
              <span className="include" key={keyword}>{keyword}{canEditKeywords && <button type="button" onClick={() => removeKeyword("include", keyword)} aria-label={keyword + " 삭제"}>×</button>}</span>
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
              <span className="exclude" key={keyword}>{keyword}{canEditKeywords && <button type="button" onClick={() => removeKeyword("exclude", keyword)} aria-label={keyword + " 삭제"}>×</button>}</span>
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
            {(Object.keys(BID_REGION_LABELS) as (keyof typeof BID_REGION_LABELS)[]).map((region) => (
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
    </>
  );
}
