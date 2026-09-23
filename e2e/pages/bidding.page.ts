import { expect, type Page } from "@playwright/test";

export class BiddingPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.getByRole("button", { name: "입찰공고", exact: true }).click();
    await expect(this.page.getByRole("heading", { name: "입찰공고" })).toBeVisible();
  }
}
