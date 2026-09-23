import { test, expect } from "../fixtures";
import { loginAsE2EAdmin } from "../pages/login.page";
import { PurchasePage } from "../pages/purchase.page";

const localDateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

test("@regression 최근·직전 구매단가와 규격별 이력이 분리된다", async ({ page, e2e }) => {
  await loginAsE2EAdmin(page);
  const purchases = new PurchasePage(page);
  await purchases.createPurchase(e2e, { qty: 1, price: 820000, date: localDateOffset(-1) });
  await purchases.createPurchase(e2e, { qty: 1, price: 910000, date: localDateOffset(0) });
  await purchases.createPurchase(e2e, {
    qty: 1,
    price: 1550000,
    date: localDateOffset(0),
    spec: `${e2e.itemSpec}-OTHER`,
  });

  await purchases.preparePurchaseItem(e2e);
  const history = page.locator(".purchase-entry-card .entry-desktop-table .purchase-price-history-summary");
  await expect(history).toBeVisible();
  await expect(history).toContainText("최근단가");
  await expect(history).toContainText("910,000원");
  await expect(history).toContainText("직전단가");
  await expect(history).toContainText("820,000원");
  await expect(history).toContainText("+90,000원");
  await expect(history).toContainText("+11.0%");

  const { data: savedPurchases, error } = await e2e.db
    .from("purchases")
    .select("rows")
    .eq("vendor", e2e.vendorName);
  expect(error).toBeNull();
  expect(savedPurchases).toHaveLength(3);
  expect(savedPurchases?.flatMap((purchase) => purchase.rows).map((row) => row.spec)).toContain(`${e2e.itemSpec}-OTHER`);
});
