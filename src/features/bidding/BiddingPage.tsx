import { getBidLoadLabel } from "./biddingModel";
import { BiddingFilters } from "./BiddingFilters";
import { BiddingResults } from "./BiddingResults";
import { useBidding } from "./useBidding";
import type { BidUserRole } from "./biddingTypes";
import "./bidding.css";

export default function BiddingPage({ currentRole }: { currentRole: BidUserRole }) {
  const bidding = useBidding(currentRole);
  const bidLoadState = bidding.results.bidLoadState;

  return (
    <section className="bid-notice-page">
      <div className="bid-notice-head">
        <div>
          <span>PUBLIC BID</span>
          <h2>입찰공고</h2>
          <p>나라장터와 LH의 공개 입찰공고를 한곳에서 확인합니다.</p>
        </div>
        <div className={"bid-notice-stage " + bidLoadState}>
          <b>{getBidLoadLabel(bidLoadState)}</b>
          <span>나라장터 · LH</span>
        </div>
      </div>

      <BiddingFilters
        keywordControls={bidding.keywordControls}
        rangeControls={bidding.rangeControls}
        searchControls={bidding.searchControls}
      />
      <BiddingResults results={bidding.results} />
    </section>
  );
}
