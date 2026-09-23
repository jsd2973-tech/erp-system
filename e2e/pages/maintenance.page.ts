import { expect, type Page } from "@playwright/test";
import type { E2EData } from "../helpers/test-data";
import { selectSearchOption } from "./search-select";

export class MaintenancePage {
  constructor(private readonly page: Page) {}

  async openList() {
    const menu = this.page.getByTestId("menu-maint_list");
    if (!(await menu.isVisible())) await this.page.getByTestId("nav-group-maintenance").click();
    await menu.click();
    await expect(this.page.getByRole("heading", { name: "정비조회" })).toBeVisible();
  }

  async openDetail(title: string) {
    const row = this.page.locator(".maint-lookup-table tbody tr").filter({ hasText: title });
    await row.getByRole("button", { name: title, exact: true }).click();
    return this.page.locator(".maintenance-purchase-summary");
  }

  async deleteFromList(title: string) {
    const row = this.page.locator(".maint-lookup-table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible();
    const dialogPromise = this.page.waitForEvent("dialog");
    await row.locator("button.icon").nth(2).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("정비내역을 휴지통으로 이동");
    await dialog.accept();
    await expect(row).toHaveCount(0);
  }

  async restoreFromTrash(title: string) {
    await this.page.getByRole("button", { name: "휴지통", exact: true }).click();
    const trash = this.page.locator(".trash-page");
    await expect(trash.getByRole("heading", { name: "휴지통" })).toBeVisible();
    await trash.locator("select").selectOption({ label: "정비" });
    await trash.getByPlaceholder("제목/내용/삭제자 검색").fill(title);
    const row = trash.locator("tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible();
    const dialogPromise = this.page.waitForEvent("dialog");
    await row.getByRole("button", { name: "복구", exact: true }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("복구할까요");
    await dialog.accept();
    await expect(row).toHaveCount(0);
  }

  async openEntry() {
    const menu = this.page.getByTestId("menu-maint_new");
    if (!(await menu.isVisible())) await this.page.getByTestId("nav-group-maintenance").click();
    await menu.click();
    await expect(this.page.getByTestId("maintenance-save")).toBeVisible();
  }

  async connectPurchase(
    data: E2EData,
    options: { title?: string; maintenanceQty?: number; usedQty?: number } = {},
  ) {
    const title = options.title ?? `${data.prefix} 정비`;
    const maintenanceQty = options.maintenanceQty ?? 2;
    const usedQty = options.usedQty ?? maintenanceQty;
    await this.openEntry();
    await this.page.getByTestId("maintenance-warehouse").fill(data.warehouseName);
    await selectSearchOption(this.page, "maintenance-warehouse", data.warehouseName);
    await this.page.getByTestId("maintenance-title").fill(title);
    await this.page.getByTestId("maintenance-item-search-0").fill(data.itemName);
    await selectSearchOption(this.page, "maintenance-item-search-0", data.itemName);
    await this.page.getByTestId("maintenance-spec-0").fill("E2E-MAINTENANCE-SPEC");
    await this.page.getByTestId("maintenance-qty-0").fill(String(maintenanceQty));
    await this.page.locator('button[data-testid="maintenance-purchase-link"]:visible').first().click();
    const modal = this.page.getByTestId("maintenance-purchase-link-modal");
    await expect(modal).toBeVisible();
    const candidate = modal.getByTestId("maintenance-purchase-candidate").filter({ hasText: data.vendorName });
    await expect(candidate).toBeVisible();
    await candidate.getByRole("button", { name: "선택", exact: true }).click();
    await modal.getByTestId("maintenance-link-used-qty").fill(String(usedQty));
    await modal.getByTestId("maintenance-link-apply").click();
    await expect(modal).toBeHidden();
    await this.page.getByTestId("maintenance-save").click();
    await expect(this.page.getByText("정비내역을 저장했습니다.", { exact: true })).toBeVisible();
    return title;
  }
}
