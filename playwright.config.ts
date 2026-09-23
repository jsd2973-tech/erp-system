import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      grepInvert: /@mobile-smoke/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      grep: /@mobile-smoke/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "node scripts/e2e-vite-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
