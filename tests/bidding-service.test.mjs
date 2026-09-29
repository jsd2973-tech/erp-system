import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/features/bidding/biddingService.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/import type \{[\s\S]*?\} from "\.\/biddingTypes";\s*/, "");
const service = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const notice = (id, noticeDate) => ({
  id, source: "나라장터", businessType: "공사", bidNo: id, title: id, agency: "대전시청",
  noticeDate, deadline: "", amount: 0, url: "https://example.invalid/" + id,
});

test("입찰 frontend service는 같은 query를 G2B와 LH endpoint로 병렬 전달하고 결과를 날짜순 병합한다", async () => {
  const requests = [];
  const result = await service.loadBidNotices(
    { from: "2026-09-01", to: "2026-09-30" },
    { include: ["골재", "잡석"], exclude: ["순환골재"] },
    async (input) => {
      requests.push(String(input));
      const target = String(input).includes("/api/g2b?") ? "g2b" : "lh";
      return new Response(JSON.stringify({
        notices: [notice(target, target === "g2b" ? "2026-09-01" : "2026-09-02")],
        diagnostics: { receivedCount: 1, failedCalls: 0, failedPages: 0, truncated: false, partial: false },
        sourceStatus: { [target]: { status: "normal" } },
      }), { status: 200 });
    },
  );

  assert.deepEqual(requests.map((url) => new URL(url, "https://erp.test").pathname).sort(), ["/api/g2b", "/api/lh"]);
  for (const request of requests) {
    const params = new URL(request, "https://erp.test").searchParams;
    assert.equal(params.get("include"), "골재,잡석");
    assert.equal(params.get("exclude"), "순환골재");
    assert.equal(params.get("from"), "2026-09-01");
    assert.equal(params.get("to"), "2026-09-30");
  }
  assert.deepEqual(result.notices.map((row) => row.id), ["lh", "g2b"]);
  assert.equal(result.loadState, "normal");
  assert.equal(result.diagnostics.matchedCount, 2);
});

test("한 source 실패는 성공 결과를 유지하고 partial/page diagnostic을 합친다", async () => {
  const result = await service.loadBidNotices(
    { from: "2026-09-01", to: "2026-09-30" },
    { include: ["골재"], exclude: ["순환골재"] },
    async (input) => {
      if (String(input).startsWith("/api/lh?")) {
        return new Response(JSON.stringify({ error: "mock LH failure" }), { status: 502 });
      }
      return new Response(JSON.stringify({
        notices: [notice("g2b", "2026-09-01")],
        diagnostics: { receivedCount: 3, failedCalls: 1, failedPages: 2, truncated: true, partial: true },
        sourceStatus: { g2b: { status: "partial", failedCalls: 1, failedPages: 2, truncated: true } },
      }), { status: 200 });
    },
  );

  assert.equal(result.notices.length, 1);
  assert.equal(result.loadState, "partial");
  assert.equal(result.diagnostics.failedCalls, 2);
  assert.equal(result.diagnostics.failedPages, 2);
  assert.equal(result.diagnostics.truncated, true);
  assert.equal(result.diagnostics.partial, true);
  assert.equal(result.diagnostics.sourceStatus.lh.status, "failed");
});

test("G2B와 LH가 모두 실패하면 기존 failed 상태와 안내를 반환한다", async () => {
  const result = await service.loadBidNotices(
    { from: "2026-09-01", to: "2026-09-30" },
    { include: ["골재"], exclude: ["순환골재"] },
    async () => new Response(JSON.stringify({ error: "mock failure" }), { status: 502 }),
  );

  assert.deepEqual(result.notices, []);
  assert.equal(result.loadState, "failed");
  assert.equal(result.diagnostics.failedCalls, 2);
  assert.equal(result.diagnostics.partial, true);
  assert.equal(result.error, "나라장터와 LH 공고를 불러오지 못했습니다. 잠시 후 다시 새로고침해 주세요.");
});
