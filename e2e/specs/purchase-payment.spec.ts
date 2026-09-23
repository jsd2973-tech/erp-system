import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { PurchasePage } from "../pages/purchase.page";

test("@smoke 구매 등록과 지급완료/취소가 조회 필터 및 DB에 반영된다", async ({ page, e2e }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 4, price: 910000 });

  const { data: purchase, error: purchaseError } = await e2e.db
    .from("purchases")
    .select("id,date,rows,payment_status,paid_date")
    .eq("vendor", e2e.vendorName)
    .single();
  expect(purchaseError).toBeNull();
  if (!purchase) throw new Error("The saved E2E purchase was not returned by the test database.");
  expect(purchase).toMatchObject({ payment_status: "unpaid", paid_date: null });
  expect(purchase?.rows?.[0]).toMatchObject({ item: e2e.itemName, spec: e2e.itemSpec, qty: "4", price: "910000" });

  await purchases.openList();
  const purchaseTable = page.locator(".purchase-lookup-page .scroll-table");
  await expect(purchaseTable.getByText(e2e.vendorName, { exact: true })).toBeVisible();
  const paymentToggle = purchaseTable.getByTestId(`purchase-payment-toggle-${purchase.id}`);
  await expect(paymentToggle).toBeVisible();
  await paymentToggle.check();
  await expect.poll(async () => {
    const { data } = await e2e.db.from("purchases").select("payment_status,paid_date").eq("id", purchase.id).single();
    return data;
  }).toMatchObject({ payment_status: "paid", paid_date: expect.any(String) });

  await page.getByRole("combobox", { name: "지급상태" }).selectOption("paid");
  await expect(paymentToggle).toBeVisible();
  await expect(paymentToggle).toBeChecked();
  await page.getByRole("combobox", { name: "지급상태" }).selectOption("unpaid");
  await expect(paymentToggle).toBeHidden();

  await page.getByRole("combobox", { name: "지급상태" }).selectOption("paid");
  await purchaseTable.getByTestId(`purchase-payment-toggle-${purchase.id}`).uncheck();
  await expect.poll(async () => {
    const { data } = await e2e.db.from("purchases").select("payment_status,paid_date").eq("id", purchase.id).single();
    return data;
  }).toEqual({ payment_status: "unpaid", paid_date: null });
  await page.getByRole("combobox", { name: "지급상태" }).selectOption("unpaid");
  await expect(purchaseTable.getByTestId(`purchase-payment-toggle-${purchase.id}`)).toBeVisible();
  await expect(purchaseTable.getByTestId(`purchase-payment-toggle-${purchase.id}`)).not.toBeChecked();
});

test("@mobile-smoke 모바일 화면에서 구매조회가 열린다", async ({ page }) => {
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.openList();
  await expect(page.getByRole("heading", { name: "구매조회" })).toBeVisible();
});
