import { expect, type Page } from "@playwright/test";
import { readE2EEnvironment } from "../safety";

export async function loginAsE2EAdmin(page: Page) {
  const env = readE2EEnvironment();
  await page.goto("/");
  await page.locator('input[autocomplete="username"]').fill(env.adminEmail);
  await page.locator('input[autocomplete="current-password"]').fill(env.adminPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("button", { name: "로그아웃", exact: true }).first()).toBeVisible();
}
