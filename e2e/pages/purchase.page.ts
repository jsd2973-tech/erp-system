import { expect, type Page } from "@playwright/test";
import type { E2EData } from "../helpers/test-data";
import { selectSearchOption } from "./search-select";

export class PurchasePage {
  constructor(private readonly page: Page) {}

  private get isMobile() {
    return (this.page.viewportSize()?.width || 1280) <= 900;
  }

  private async openPurchaseNavigation() {
    if (this.isMobile) {
      await this.page.locator(".mobile-bottom-nav").getByRole("button", { name: "구매", exact: true }).click();
      return;
    }
    const group = this.page.getByTestId("nav-group-purchase");
    if (!(await this.page.getByTestId("menu-new").isVisible())) await group.click();
  }

  async openEntry() {
    const menu = this.page.getByTestId("menu-new");
    if (this.isMobile) {
      await this.openPurchaseNavigation();
      await this.page.locator(".role-mobile-sheet-grid").getByRole("button", { name: "구매입력", exact: true }).click();
    } else {
      await this.openPurchaseNavigation();
      await menu.click();
    }
    await expect(this.page.getByTestId("purchase-save")).toBeVisible();
  }

  async openList() {
    const menu = this.page.getByTestId("menu-list");
    if (this.isMobile) {
      await this.openPurchaseNavigation();
      await this.page.locator(".role-mobile-sheet-grid").getByRole("button", { name: "구매조회", exact: true }).click();
    } else {
      await this.openPurchaseNavigation();
      await menu.click();
    }
    await expect(this.page.getByRole("heading", { name: "구매조회" })).toBeVisible();
  }

  async preparePurchaseItem(data: E2EData) {
    await this.openEntry();
    await this.page.getByTestId("purchase-vendor").fill(data.vendorName);
    await selectSearchOption(this.page, "purchase-vendor", data.vendorName);
    await this.page.getByTestId("purchase-warehouse").fill(data.warehouseName);
    await selectSearchOption(this.page, "purchase-warehouse", data.warehouseName);
    const itemSearchId = this.isMobile ? "purchase-mobile-item-search-0" : "purchase-item-search-0";
    await this.page.getByTestId(itemSearchId).fill(data.itemName);
    await selectSearchOption(this.page, itemSearchId, data.itemName);
  }

  async createPurchase(
    data: E2EData,
    options: { qty?: number; price?: number; date?: string; spec?: string } = {},
  ) {
    const { qty = 4, price = 910000, date, spec = data.itemSpec } = options;
    await this.preparePurchaseItem(data);
    if (date) {
      await this.page.locator(".purchase-entry-card .date-text-input").fill(date.replaceAll("-", ""));
    }
    await this.page.getByTestId(this.isMobile ? "purchase-mobile-spec-0" : "purchase-spec-0").fill(spec);
    await this.page.getByTestId(this.isMobile ? "purchase-mobile-qty-0" : "purchase-qty-0").fill(String(qty));
    await this.page.getByTestId(this.isMobile ? "purchase-mobile-price-0" : "purchase-price-0").fill(String(price));
    const saveButton = this.page.getByTestId("purchase-save");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(this.page.getByText("구매내역을 저장했습니다.", { exact: true })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "구매조회" })).toBeVisible();
  }
}
