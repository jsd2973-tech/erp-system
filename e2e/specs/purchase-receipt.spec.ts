import { test, expect } from "../fixtures";
import type { E2EData } from "../helpers/test-data";
import { loginAsE2EAdmin } from "../pages/login.page";
import { PurchasePage } from "../pages/purchase.page";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const readState = async (e2e: E2EData, id: string) => {
  const { data, error } = await e2e.db.from("purchases")
    .select("receipt_status,received_date,payment_status,paid_date").eq("id", id).single();
  if (error) throw error;
  return data;
};
const seed = async (e2e: E2EData, suffix: string, receiptStatus: string, paid = false) => {
  const id = `${e2e.prefix}-${suffix}`;
  const { error } = await e2e.db.from("purchases").insert({
    id, date: today(), vendor: e2e.vendorName, warehouse: e2e.warehouseName,
    rows: [{ id: `${id}-row`, item: e2e.itemName, spec: e2e.itemSpec, qty: "1", price: "1000", supply: 1000, vat: 100, total: 1100 }],
    supplytotal: 1000, vattotal: 100, total: 1100, itemsummary: e2e.itemName,
    receipt_status: receiptStatus, received_date: receiptStatus === "received" ? today() : null,
    payment_status: paid ? "paid" : "unpaid", paid_date: paid ? "2026-10-01" : null,
  });
  if (error) throw error;
  return id;
};

test("@regression 신규 구매의 수취완료/취소와 지급상태가 독립적으로 즉시 반영된다", async ({ page, e2e }, testInfo) => {
  page.on("dialog", dialog => dialog.accept());
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 1, price: 1000 });
  const { data: row, error } = await e2e.db.from("purchases").select("id").eq("vendor", e2e.vendorName).single();
  expect(error).toBeNull();
  if (!row) throw new Error("New purchase missing");
  expect(await readState(e2e, row.id)).toEqual({ receipt_status: "unreceived", received_date: null, payment_status: "unpaid", paid_date: null });
  const table = page.locator(".purchase-lookup-page .scroll-table");
  const receipt = table.getByTestId(`purchase-receipt-status-${row.id}`);
  const payment = table.getByTestId(`purchase-payment-toggle-${row.id}`);
  await expect(receipt).toHaveValue("unreceived");
  await receipt.selectOption("received");
  await expect(receipt).toHaveValue("received");
  await expect(table.locator(".purchase-receipt-date")).toHaveText(today());
  await expect.poll(() => readState(e2e, row.id)).toEqual({ receipt_status: "received", received_date: today(), payment_status: "unpaid", paid_date: null });
  const warehouseCell = table.locator("tbody tr").first().locator("td").nth(3);
  expect(await warehouseCell.evaluate(cell => cell.scrollWidth <= cell.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("purchase-receipt-1440.png") });
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await warehouseCell.evaluate(cell => cell.scrollWidth <= cell.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("purchase-receipt-1920.png") });

  await payment.click();
  await expect(payment).toBeChecked();
  const paidState = await readState(e2e, row.id);
  expect(paidState).toMatchObject({ receipt_status: "received", received_date: today(), payment_status: "paid", paid_date: today() });
  for (const status of ["unreceived", "received", "unreceived"]) {
    await expect(receipt).toBeEnabled();
    await receipt.selectOption(status);
    await expect(receipt).toHaveValue(status);
    await expect.poll(() => readState(e2e, row.id)).toEqual({ ...paidState, receipt_status: status, received_date: status === "received" ? today() : null });
  }
  await expect(table.locator(".purchase-receipt-date")).toHaveCount(0);
  await expect.poll(async () => {
    const { data } = await e2e.db.from("activity_logs").select("action").eq("target_id", row.id);
    return (data || []).map(log => log.action);
  }).toEqual(expect.arrayContaining(["물품 수취완료", "물품 수취취소"]));
});

test("@regression 미확인 변경·복합 필터와 대량이체 후보는 수취상태와 독립적으로 동작한다", async ({ page, e2e }) => {
  const ids: Record<string, string> = {};
  for (const paid of [false, true]) {
    for (const status of ["unknown", "unreceived", "received"]) {
      ids[`${status}-${paid}`] = await seed(e2e, `${status}-${paid}`, status, paid);
    }
  }
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.openList();
  await page.getByPlaceholder("거래처 검색").fill(e2e.vendorName);
  const table = page.locator(".purchase-lookup-page .scroll-table");
  const receiptFilter = page.getByRole("combobox", { name: "수취상태 필터", exact: true });
  const paymentFilter = page.getByRole("combobox", { name: "지급상태", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(6);
  for (const status of ["unknown", "unreceived", "received"]) {
    await receiptFilter.selectOption(status);
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await paymentFilter.selectOption("unpaid");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.getByTestId(`purchase-receipt-status-${ids[`${status}-false`]}`)).toHaveValue(status);
    await paymentFilter.selectOption("paid");
    await expect(table.getByTestId(`purchase-receipt-status-${ids[`${status}-true`]}`)).toHaveValue(status);
    await paymentFilter.selectOption("");
  }
  await receiptFilter.selectOption("");
  for (const [id, status] of [[ids["unknown-false"], "unreceived"], [ids["unknown-true"], "received"]]) {
    const original = await readState(e2e, id);
    const control = table.getByTestId(`purchase-receipt-status-${id}`);
    await expect(control).toHaveValue("unknown");
    await expect(control).toBeEnabled();
    await control.selectOption(status);
    await expect(control).toHaveValue(status);
    await expect.poll(() => readState(e2e, id)).toEqual({ ...original, receipt_status: status, received_date: status === "received" ? today() : null });
  }
  await receiptFilter.selectOption("received");
  await paymentFilter.selectOption("paid");
  await page.locator(".purchase-period-buttons").getByRole("button", { name: "전체", exact: true }).click();
  await expect(receiptFilter).toHaveValue("");
  await expect(paymentFilter).toHaveValue("");

  await page.getByTestId("menu-bulk_transfer").click();
  const bulk = page.locator(".bulk-transfer-page");
  await bulk.getByPlaceholder("2026-04").fill(today().slice(0, 7));
  const candidate = bulk.locator(".bulk-transfer-card").filter({ hasText: e2e.vendorName });
  await expect(candidate).toBeVisible();
  await expect(candidate).toContainText("3,300원");
  const candidates = await e2e.db.from("purchases").select("payment_status,total").eq("vendor", e2e.vendorName);
  expect((candidates.data || []).filter(p => p.payment_status === "unpaid").reduce((sum, p) => sum + Number(p.total), 0)).toBe(3300);
});

test("@regression 수취 저장 실패는 기존 상태를 유지하고 구매 수정은 수취일을 보존한다", async ({ page, e2e }) => {
  const id = await seed(e2e, "received-edit", "received", true);
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.openList();
  await page.getByPlaceholder("거래처 검색").fill(e2e.vendorName);
  const table = page.locator(".purchase-lookup-page .scroll-table");
  const receipt = table.getByTestId(`purchase-receipt-status-${id}`);
  await page.route(/\/rest\/v1\/purchases\?/, async route => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "E2E 수취 저장 실패", code: "E2E_RECEIPT_FAILURE" }) });
    else await route.continue();
  });
  await receipt.selectOption("unreceived");
  await expect(page.getByText("물품 수취상태 저장 실패: E2E 수취 저장 실패", { exact: true })).toBeVisible();
  await expect(receipt).toHaveValue("received");
  expect(await readState(e2e, id)).toEqual({ receipt_status: "received", received_date: today(), payment_status: "paid", paid_date: "2026-10-01" });
  await page.unroute(/\/rest\/v1\/purchases\?/);
  await purchases.editFromList(e2e.vendorName);
  await page.getByTestId("purchase-save").click();
  await expect(page.getByText("구매내역을 수정했습니다.", { exact: true })).toBeVisible();
  await expect.poll(() => readState(e2e, id)).toEqual({ receipt_status: "received", received_date: today(), payment_status: "paid", paid_date: "2026-10-01" });
});

test("@mobile-smoke 모바일 구매카드에서 수취완료와 취소를 처리한다", async ({ page, e2e }) => {
  const id = await seed(e2e, "mobile-receipt", "unknown");
  await loginAsE2EAdmin(page);
  await new PurchasePage(page).openList();
  await page.getByPlaceholder("거래처 검색").fill(e2e.vendorName);
  const card = page.locator(".mobile-purchase-card").filter({ hasText: e2e.vendorName });
  const receipt = card.getByTestId(`purchase-receipt-status-${id}`);
  await expect(receipt).toHaveValue("unknown");
  await receipt.selectOption("received");
  await expect(card.locator(".purchase-receipt-date")).toHaveText(today());
  await expect(receipt).toBeEnabled();
  await receipt.selectOption("unreceived");
  await expect(receipt).toHaveValue("unreceived");
  await expect.poll(() => readState(e2e, id)).toEqual({ receipt_status: "unreceived", received_date: null, payment_status: "unpaid", paid_date: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
});
