import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/features/bidding/biddingModel.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace('import type { BidLoadState, BidNotice, BidRegionFilter, BidSourceFilter } from "./biddingTypes";', "");
const model = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("입찰 조회 기간은 KST 기준 날짜와 기존 최근 일수 범위를 유지한다", () => {
  const now = new Date("2026-09-28T15:30:00.000Z");
  assert.equal(model.toBidDateInput(now), "2026-09-29");
  assert.deepEqual(model.getBidQuickRange(7, now), { from: "2026-09-23", to: "2026-09-29" });
});

test("입찰 마감 배지는 오늘 마감, D-1, D-2, 마감 상태 규칙을 유지한다", () => {
  const now = Date.parse("2026-09-28T10:00:00.000Z");
  assert.equal(model.getBidDeadlineBadge("2026-09-28T09:59:00.000Z", undefined, now), "오늘 마감");
  assert.equal(model.getBidDeadlineBadge("2026-09-29T09:00:00.000Z", undefined, now), "D-1");
  assert.equal(model.getBidDeadlineBadge("2026-09-30T09:00:00.000Z", undefined, now), "D-2");
  assert.equal(model.getBidDeadlineBadge("2026-09-29T09:00:00.000Z", "마감", now), "");
});

test("우리 지역 및 개별 지역은 지역 정보 우선, 없을 때만 기관명 fallback을 사용한다", () => {
  const localNotice = { agency: "서울 기관", regionText: "충청남도 공주시" };
  assert.equal(model.matchesBidRegion(localNotice, "local"), true);
  assert.equal(model.matchesBidRegion({ agency: "세종특별자치시 본부", regionText: "" }, "local"), true);
  assert.equal(model.matchesBidRegion({ agency: "대전광역시청", regionText: "서울특별시" }, "daejeon"), false);
  assert.equal(model.matchesBidRegion({ agency: "서울 기관", regionText: "" }, "all"), true);
});

test("출처·지역·검색 필터는 기존 순서와 결과 순서를 보존한다", () => {
  const notices = [
    { id: "g2b-1", source: "나라장터", title: "골재 운송", agency: "대전시청", bidNo: "A-1", regionText: "대전" },
    { id: "lh-1", source: "LH", title: "쇄석 납품", agency: "세종 본부", bidNo: "B-1", regionText: "세종" },
    { id: "g2b-2", source: "나라장터", title: "혼합골재", agency: "서울시청", bidNo: "C-1", regionText: "서울" },
  ];
  assert.deepEqual(model.filterBidNotices(notices, "all", "local", "").map((row) => row.id), ["g2b-1", "lh-1"]);
  assert.deepEqual(model.filterBidNotices(notices, "g2b", "all", "c-1").map((row) => row.id), ["g2b-2"]);
});

test("신규 배지는 이전 조회 기록이 있을 때 미확인 공고에만 표시한다", () => {
  const seen = new Set(["old"]);
  assert.equal(model.isBidNoticeNew("old", seen, true), false);
  assert.equal(model.isBidNoticeNew("new", seen, true), true);
  assert.equal(model.isBidNoticeNew("new", seen, false), false);
});
