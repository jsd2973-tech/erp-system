import { expect, type Page } from "@playwright/test";

export class CardPage {
  constructor(private readonly page: Page) {}

  async openEntry() {
    if ((this.page.viewportSize()?.width || 1280) <= 900) {
      await this.page.locator(".mobile-bottom-nav").getByRole("button", { name: "카드", exact: true }).click();
      await this.page.locator(".role-mobile-sheet-grid").getByRole("button", { name: "카드사용", exact: true }).click();
    } else {
      const menu = this.page.getByTestId("menu-card_use");
      if (!(await menu.isVisible())) await this.page.getByRole("button", { name: "카드", exact: true }).click();
      await menu.click();
    }
    await expect(this.page.getByRole("heading", { name: "카드사용 등록" })).toBeVisible();
  }
}
