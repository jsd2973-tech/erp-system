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
  await expect(cardForm.getByPlaceholder("0", { exact: true })).toHaveValue("128500");
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

test("@regression 카드 직접 입력·수정·삭제를 유지하고 OCR 실패에도 저장 전 값을 보존한다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  await new CardPage(page).openEntry();

  const expectedDate = "2026-09-22";
  const enteredPlace = `${e2e.prefix} 테스트상사`;
  const cardForm = page.locator("section.card").filter({ has: page.getByRole("heading", { name: "카드사용 등록" }) });
  await cardForm.locator("input.date-picker-input").fill(expectedDate);
  await cardForm.getByPlaceholder("사용자/작업자").fill("E2E 담당자");
  await cardForm.getByPlaceholder("상호/구매처").fill(enteredPlace);
  await cardForm.getByPlaceholder("0", { exact: true }).fill("127000");
  await cardForm.getByPlaceholder("구매내용 메모").fill("E2E 수동 메모");

  let ocrRequests = 0;
  await page.route("**/storage/v1/object/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "receipts/e2e-card-regression.png" }) });
  });
  await page.route("**/api/receipt-ocr", async (route) => {
    ocrRequests += 1;
    if (ocrRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ date: "2026-09-25", merchant: `${e2e.prefix} OCR 상호`, totalAmount: 128500 }),
      });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "E2E OCR mock unavailable" }) });
  });

  const receipt = {
    name: "e2e-card-regression.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=", "base64"),
  };
  const receiptInput = cardForm.locator(".card-receipt-upload-area input[type='file']").first();
  await receiptInput.setInputFiles(receipt);
  await expect(page.locator(".card-ocr-status")).toContainText("기존에 입력한 날짜·상호명·금액은 유지했습니다.");
  await expect(cardForm.locator("input.date-picker-input")).toHaveValue(expectedDate);
  await expect(cardForm.getByPlaceholder("사용자/작업자")).toHaveValue("E2E 담당자");
  await expect(cardForm.getByPlaceholder("상호/구매처")).toHaveValue(enteredPlace);
  await expect(cardForm.getByPlaceholder("0", { exact: true })).toHaveValue("127000");
  await expect(cardForm.getByPlaceholder("구매내용 메모")).toHaveValue("E2E 수동 메모");

  await receiptInput.setInputFiles(receipt);
  await expect(page.locator(".card-ocr-status")).toContainText("E2E OCR mock unavailable 직접 입력해 주세요.");
  await expect(cardForm.locator("input.date-picker-input")).toHaveValue(expectedDate);
  await expect(cardForm.getByPlaceholder("상호/구매처")).toHaveValue(enteredPlace);
  await expect(cardForm.getByPlaceholder("0", { exact: true })).toHaveValue("127000");

  const { data: beforeSave, error: beforeSaveError } = await e2e.db
    .from("card_uses")
    .select("id")
    .eq("place", enteredPlace);
  expect(beforeSaveError).toBeNull();
  expect(beforeSave).toEqual([]);

  await cardForm.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("카드사용 내역을 저장했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "카드조회" })).toBeVisible();

  const { data: savedRecords, error: savedError } = await e2e.db
    .from("card_uses")
    .select("id,date,user_name,place,amount,memo,image_url,image_urls")
    .eq("place", enteredPlace);
  expect(savedError).toBeNull();
  expect(savedRecords).toHaveLength(1);
  const savedRecord = savedRecords?.[0];
  expect(savedRecord).toMatchObject({
    date: expectedDate,
    user_name: "E2E 담당자",
    place: enteredPlace,
    amount: 127000,
    memo: "E2E 수동 메모",
  });
  expect(savedRecord?.image_urls).toHaveLength(2);

  const cardRow = page.locator(".scroll-table tbody tr").filter({ hasText: enteredPlace });
  await expect(cardRow).toBeVisible();
  await cardRow.getByRole("button").first().click();
  const editForm = page.locator("section.card").filter({ has: page.getByRole("heading", { name: "카드사용 수정" }) });
  await expect(editForm).toBeVisible();
  await editForm.getByPlaceholder("0", { exact: true }).fill("129000");
  await editForm.getByPlaceholder("구매내용 메모").fill("E2E 수정 메모");
  await editForm.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.getByText("카드사용 내역을 수정했습니다.", { exact: true })).toBeVisible();

  const { data: updatedRecords, error: updatedError } = await e2e.db
    .from("card_uses")
    .select("id,amount,memo")
    .eq("id", savedRecord!.id);
  expect(updatedError).toBeNull();
  expect(updatedRecords).toEqual([{ id: savedRecord!.id, amount: 129000, memo: "E2E 수정 메모" }]);

  const updatedRow = page.locator(".scroll-table tbody tr").filter({ hasText: enteredPlace });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedRow.getByRole("button").nth(1).click();
  await expect(updatedRow).toHaveCount(0);
  const { data: deletedRecords, error: deletedError } = await e2e.db
    .from("card_uses")
    .select("id")
    .eq("id", savedRecord!.id);
  expect(deletedError).toBeNull();
  expect(deletedRecords).toEqual([]);
  const { data: trashRecords, error: trashError } = await e2e.db
    .from("deleted_records")
    .select("record_id,data")
    .eq("source_table", "card_uses")
    .eq("record_id", savedRecord!.id);
  expect(trashError).toBeNull();
  expect(trashRecords).toHaveLength(1);
  expect(trashRecords?.[0].data).toMatchObject({ amount: 129000, memo: "E2E 수정 메모" });
});
