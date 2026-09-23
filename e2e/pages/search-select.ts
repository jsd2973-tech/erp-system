import { expect, type Page } from "@playwright/test";

export async function selectSearchOption(page: Page, inputTestId: string, optionText: string) {
  const dropdown = page.getByTestId(inputTestId).locator("xpath=..").locator(".dropdown");
  const option = dropdown.locator(".dropdown-item").filter({ hasText: optionText }).first();
  await expect(option).toBeVisible();
  await option.click();
}
