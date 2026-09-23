import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
  "base64",
);

test("@mobile-smoke @regression 유류 영수증 OCR은 항목을 입력하고 선택값을 유지하며 저장 전 확인을 요구한다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  if ((page.viewportSize()?.width || 1280) <= 760) {
    await page.locator(".mobile-bottom-nav").getByRole("button", { name: "더보기", exact: true }).click();
  }
  await page.getByRole("button", { name: "유류관리", exact: true }).click();
  const fuelPage = page.locator(".fuel-management");
  await expect(fuelPage.getByRole("heading", { name: "유류관리" })).toBeVisible();
  await fuelPage.getByRole("button", { name: "직접 입력", exact: true }).click();
  const form = fuelPage.locator(".fuel-manual-panel");
  await expect(form.getByRole("heading", { name: "유류 직접 입력" })).toBeVisible();

  const field = (label: string) => form.locator(".fuel-manual-grid label").filter({ hasText: label }).locator("input");
  const siteName = `${e2e.prefix} E2E 현장`;
  const vehicleNumber = `${e2e.prefix} E2E 차량`;
  await field("현장").fill(siteName);
  await field("차량/장비번호").fill(vehicleNumber);

  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/receipt-ocr", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    if (requests.length === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fuelDate: "2026-09-22",
          stationName: `${e2e.prefix} E2E 주유소`,
          productName: "경유",
          quantity: 42,
          unitPrice: 1700,
          supplyAmount: 71400,
          vatAmount: 7140,
          totalAmount: 78540,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "E2E mock OCR unavailable" }),
    });
  });

  const receiptInput = form.locator('input[type="file"][accept="image/*,application/pdf"]');
  const receipt = { name: "e2e-fuel-receipt.png", mimeType: "image/png", buffer: tinyPng };
  await receiptInput.setInputFiles(receipt);

  const status = form.getByRole("status");
  await expect(status).toContainText("주유일자·주유처·유종·주유량·단가·공급가액·부가세·합계금액을 자동 입력했습니다.");
  await expect(field("주유일자")).toHaveValue("2026-09-22");
  await expect(field("주유처")).toHaveValue(`${e2e.prefix} E2E 주유소`);
  await expect(field("유종")).toHaveValue("경유");
  await expect(field("주유량")).toHaveValue("42");
  await expect(field("단가")).toHaveValue("1700");
  await expect(field("공급가액")).toHaveValue("71400");
  await expect(field("부가세")).toHaveValue("7140");
  await expect(field("합계금액")).toHaveValue("78540");
  await expect(field("현장")).toHaveValue(siteName);
  await expect(field("차량/장비번호")).toHaveValue(vehicleNumber);
  await expect(form.getByRole("button", { name: "확인 후 저장", exact: true })).toBeEnabled();
  await expect(form.locator(".fuel-manual-receipt-meta")).toContainText(receipt.name);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ mode: "fuel" });
  expect(requests[0].dataUrl).toMatch(/^data:image\//);

  const { data: unsavedRecords, error: queryError } = await e2e.db
    .from("fuel_records")
    .select("id")
    .eq("vehicle_number", vehicleNumber);
  expect(queryError).toBeNull();
  expect(unsavedRecords).toEqual([]);

  await receiptInput.setInputFiles(receipt);
  await expect(status).toContainText("E2E mock OCR unavailable 직접 입력해 주세요.");
  await expect(form.locator(".fuel-manual-receipt-meta")).toContainText(receipt.name);
  await field("주유처").fill(`${e2e.prefix} 수동입력 주유소`);
  await expect(field("주유처")).toHaveValue(`${e2e.prefix} 수동입력 주유소`);
  await expect(form.getByRole("button", { name: "확인 후 저장", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(2);

  const { data: stillUnsavedRecords, error: stillUnsavedError } = await e2e.db
    .from("fuel_records")
    .select("id")
    .eq("vehicle_number", vehicleNumber);
  expect(stillUnsavedError).toBeNull();
  expect(stillUnsavedRecords).toEqual([]);
});
