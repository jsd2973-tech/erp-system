import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { CardPage } from "../pages/card.page";

test("@mobile-smoke @regression 카드 OCR은 날짜·상호·금액만 채우고 저장을 기다린다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  await new CardPage(page).openEntry();
  const expectedDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  await page.route("**/storage/v1/object/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "receipts/e2e-card.png" }) });
  });
  await page.route("**/api/receipt-ocr", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ date: expectedDate, merchant: `${e2e.prefix} 테스트상사`, totalAmount: 128500 }),
    });
  });

  const cardForm = page.locator("section.card").filter({ has: page.getByRole("heading", { name: "카드사용 등록" }) });
  await cardForm.locator(".card-receipt-upload-area input[type='file']").first().setInputFiles({
    name: "e2e-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=", "base64"),
  });

  await expect(page.locator(".card-ocr-status")).toContainText("날짜·상호명·총합계");
  await expect(cardForm.locator("input.date-picker-input")).toHaveValue(expectedDate);
  await expect(cardForm.getByPlaceholder("상호/구매처")).toHaveValue(`${e2e.prefix} 테스트상사`);
  await expect(cardForm.getByPlaceholder("0")).toHaveValue("128500");
  await expect(cardForm.getByPlaceholder("사용자/작업자")).toHaveValue("");
  await expect(cardForm.getByPlaceholder("구매내용 메모")).toHaveValue("");
  await expect(cardForm.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await expect(page.getByText("카드사용 내역을 저장했습니다.", { exact: true })).toHaveCount(0);
  const { data: autoSavedRecords, error: queryError } = await e2e.db
    .from("card_uses")
    .select("id")
    .eq("place", `${e2e.prefix} 테스트상사`);
  expect(queryError).toBeNull();
  expect(autoSavedRecords).toEqual([]);
});
