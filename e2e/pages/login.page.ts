import { expect, type Page } from "@playwright/test";
import { readE2EEnvironment } from "../safety";

export async function loginAsE2EAdmin(page: Page) {
  const env = readE2EEnvironment();
  await page.goto("/");
  await page.getByPlaceholder("아이디 입력 예: field01").fill(env.adminEmail);
  await page.getByPlaceholder("비밀번호 입력").fill(env.adminPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByTestId("nav-group-purchase")).toBeVisible();
}
