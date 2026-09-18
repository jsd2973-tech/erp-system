import assert from "node:assert/strict";
import { fetchOperation, matchesG2bKeywords } from "../api/g2b.ts";
import { fetchRemainingPages } from "../api/lh.ts";

const originalFetch = globalThis.fetch;

const g2bPayload = (pageNo, totalCount = 205) => ({
  response: {
    header: { resultCode: "00" },
    body: {
      totalCount,
      numOfRows: 100,
      items: {
        item: [{
          bidNtceNo: `G-${pageNo}`,
          bidNtceOrd: "000",
          bidNtceNm: `공고 ${pageNo}`,
          dminsttNm: "테스트기관",
        }],
      },
    },
  },
});

try {
  const requestedPages = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const pageNo = Number(parsed.searchParams.get("pageNo"));
    requestedPages.push(pageNo);
    return new Response(JSON.stringify(g2bPayload(pageNo)), { status: 200 });
  };

  const paged = await fetchOperation(
    { name: "공사", path: "getBidPblancListInfoCnstwkPPSSrch" },
    "골재",
    "test-key",
    "202609010000",
    "202609302359",
  );
  assert.deepEqual(requestedPages.sort((a, b) => a - b), [1, 2, 3]);
  assert.equal(paged.items.length, 3);
  assert.equal(paged.diagnostic.truncated, false);
  assert.equal(paged.diagnostic.pagesFetched, 3);

  assert.equal(matchesG2bKeywords({ dtilPrdctClsfcNoNm: "혼합골재" }, ["혼합골재"], ["순환골재"]), true);
  assert.equal(matchesG2bKeywords({ dtilPrdctClsfcNoNm: "순환골재" }, ["골재"], ["순환골재"]), false);

  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const pageNo = Number(parsed.searchParams.get("pageNo"));
    if (pageNo === 2) return new Response("temporary failure", { status: 503 });
    return new Response(JSON.stringify(g2bPayload(pageNo)), { status: 200 });
  };
  const partial = await fetchOperation(
    { name: "공사", path: "getBidPblancListInfoCnstwkPPSSrch" },
    "골재",
    "test-key",
    "202609010000",
    "202609302359",
  );
  assert.equal(partial.diagnostic.failedPages, 1);
  assert.equal(partial.diagnostic.truncated, true);

  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const pageNo = Number(parsed.searchParams.get("pageNo"));
    if (pageNo === 3) return new Response("temporary failure", { status: 503 });
    return new Response(
      `<response><header><resultCode>00</resultCode></header><body><totalCount>300</totalCount><numOfRows>100</numOfRows><items><item><bidNum>L-${pageNo}</bidNum></item></items></body></response>`,
      { status: 200 },
    );
  };
  const lhPartial = await fetchRemainingPages("test-key", "2026-09-01", "2026-09-30", 3);
  assert.equal(lhPartial.pages.length, 1);
  assert.equal(lhPartial.failedPages, 1);

  console.log("bid pagination tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
