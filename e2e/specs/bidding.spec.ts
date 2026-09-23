import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { BiddingPage } from "../pages/bidding.page";

const localNotice = (id: string, title: string, deadline: string) => ({
  id,
  source: "나라장터",
  businessType: "공사",
  bidNo: id,
  title,
  agency: "대전광역시청",
  regionText: "대전광역시",
  matchedBy: ["title"],
  noticeDate: new Date().toISOString(),
  deadline,
  status: "진행중",
  amount: 128500,
  url: `https://example.invalid/${id}`,
});

test("@regression 입찰공고 mock은 지역·신규·마감 표시와 일부조회 상태를 반영한다", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("erp_bid_seen_notice_ids_v1", "[]"));
  await loginAsE2EAdmin(page);

  const now = Date.now();
  await page.route("**/api/g2b*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notices: [
          localNotice("E2E-BID-TODAY", "E2E 골재 오늘", new Date(now - 60 * 60 * 1000).toISOString()),
          localNotice("E2E-BID-TOMORROW", "E2E 골재 내일", new Date(now + 23 * 60 * 60 * 1000).toISOString()),
          { ...localNotice("E2E-BID-SEOUL", "E2E 골재 서울", new Date(now + 48 * 60 * 60 * 1000).toISOString()), agency: "서울특별시청", regionText: "서울특별시" },
        ],
        diagnostics: { source: "나라장터", receivedCount: 3, matchedCount: 3, failedCalls: 0, failedPages: 0, truncated: false, partial: false },
        sourceStatus: { g2b: { status: "normal", failedCalls: 0, failedPages: 0, truncated: false } },
        partial: false,
      }),
    });
  });
  await page.route("**/api/lh*", async (route) => {
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "E2E mocked LH failure" }) });
  });

  await new BiddingPage(page).open();
  await expect(page.locator(".bid-notice-stage")).toContainText("일부조회");
  await expect(page.locator(".bid-api-error")).toContainText("일부 공고 조회가 완료되지 않았습니다");
  await expect(page.getByText("E2E 골재 오늘", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E 골재 내일", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E 골재 서울", { exact: true })).toHaveCount(0);
  await expect(page.locator(".bid-notice-row").filter({ hasText: "E2E 골재 오늘" })).toContainText("신규");
  await expect(page.locator(".bid-notice-row").filter({ hasText: "E2E 골재 오늘" })).toContainText("오늘 마감");
  await expect(page.locator(".bid-notice-row").filter({ hasText: "E2E 골재 내일" })).toContainText("D-1");
});
