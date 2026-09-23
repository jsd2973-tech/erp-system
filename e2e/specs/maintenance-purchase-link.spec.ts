import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { MaintenancePage } from "../pages/maintenance.page";
import { PurchasePage } from "../pages/purchase.page";
import { selectSearchOption } from "../pages/search-select";

test("@regression 구매 품목을 정비에 연결하면 stable row ID와 사용수량이 저장된다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 4, price: 910000 });

  const { data: purchase, error: purchaseError } = await e2e.db
    .from("purchases")
    .select("id,rows")
    .eq("vendor", e2e.vendorName)
    .single();
  expect(purchaseError).toBeNull();
  if (!purchase) throw new Error("The saved E2E purchase was not returned by the test database.");
  const purchaseRow = purchase.rows[0];
  expect(purchaseRow.id).toBeTruthy();

  const maintenance = new MaintenancePage(page);
  const maintenanceTitle = await maintenance.connectPurchase(e2e, { maintenanceQty: 2, usedQty: 2 });
  const { data: savedMaintenance, error: maintenanceError } = await e2e.db
    .from("maints")
    .select("id,items")
    .eq("title", maintenanceTitle)
    .single();
  expect(maintenanceError).toBeNull();
  if (!savedMaintenance) throw new Error("The saved E2E maintenance record was not returned by the test database.");

  const { data: links, error: linkError } = await e2e.db
    .from("maintenance_purchase_links")
    .select("purchase_id,purchase_row_id,maintenance_id,used_qty,unit_price_snapshot")
    .eq("maintenance_id", savedMaintenance.id);
  expect(linkError).toBeNull();
  expect(links).toHaveLength(1);
  expect(links?.[0]).toMatchObject({
    purchase_id: purchase.id,
    purchase_row_id: purchaseRow.id,
    maintenance_id: savedMaintenance.id,
    used_qty: 2,
    unit_price_snapshot: 910000,
  });
  expect(savedMaintenance.items[0]).toMatchObject({ item: e2e.itemName, spec: "E2E-MAINTENANCE-SPEC" });
  expect(Number(purchaseRow.qty) - Number(links?.[0].used_qty)).toBe(2);

  await maintenance.openList();
  const maintenanceSummary = await maintenance.openDetail(maintenanceTitle);
  await expect(maintenanceSummary).toContainText(e2e.vendorName);
  await expect(maintenanceSummary).toContainText("910,000원");

  await purchases.openList();
  const purchaseRowInList = page.locator(".purchase-lookup-page .scroll-table tbody tr").filter({ hasText: e2e.vendorName });
  await purchaseRowInList.locator(".purchase-item-detail-button").click();
  const purchaseSummary = page.locator(".purchase-maintenance-summary");
  await expect(purchaseSummary).toContainText(maintenanceTitle);
  await expect(purchaseSummary).toContainText("2 사용");
});

test("@regression 구매 잔량만큼 추가 연결되고 초과 사용은 차단된다", async ({ page, e2e }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 4, price: 910000 });

  const maintenance = new MaintenancePage(page);
  await maintenance.connectPurchase(e2e, { title: `${e2e.prefix} 정비 1`, maintenanceQty: 2, usedQty: 2 });
  await maintenance.connectPurchase(e2e, { title: `${e2e.prefix} 정비 2`, maintenanceQty: 1, usedQty: 1 });

  await maintenance.openEntry();
  await page.getByTestId("maintenance-warehouse").fill(e2e.warehouseName);
  await selectSearchOption(page, "maintenance-warehouse", e2e.warehouseName);
  await page.getByTestId("maintenance-title").fill(`${e2e.prefix} 정비 3`);
  await page.getByTestId("maintenance-item-search-0").fill(e2e.itemName);
  await selectSearchOption(page, "maintenance-item-search-0", e2e.itemName);
  await page.getByTestId("maintenance-qty-0").fill("2");
  await page.locator(".maintenance-item-editor").getByTestId("maintenance-purchase-link").click();
  const modal = page.getByTestId("maintenance-purchase-link-modal");
  const candidate = modal.getByTestId("maintenance-purchase-candidate").filter({ hasText: e2e.vendorName });
  await candidate.getByRole("button", { name: "선택", exact: true }).click();
  await modal.getByTestId("maintenance-link-used-qty").fill("2");
  const alertPromise = page.waitForEvent("dialog");
  await modal.getByTestId("maintenance-link-apply").click();
  const alert = await alertPromise;
  expect(alert.message()).toContain("남은 연결 가능 수량은 1");
  await alert.accept();
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "취소", exact: true }).click();

  const { data: purchase } = await e2e.db.from("purchases").select("id,rows").eq("vendor", e2e.vendorName).single();
  if (!purchase) throw new Error("The saved E2E purchase was not returned by the test database.");
  const { data: links } = await e2e.db.from("maintenance_purchase_links").select("used_qty").eq("purchase_id", purchase.id);
  expect(links?.reduce((sum, link) => sum + Number(link.used_qty), 0)).toBe(3);
  expect(Number(purchase.rows[0].qty) - Number(links?.reduce((sum, link) => sum + Number(link.used_qty), 0))).toBe(1);
});
