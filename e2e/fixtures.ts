import { test as base, expect } from "@playwright/test";
import { createE2EData, type E2EData } from "./helpers/test-data";

export const test = base.extend<{ e2e: E2EData }>({
  e2e: async ({}, use, testInfo) => {
    const data = await createE2EData(testInfo);
    try {
      await use(data);
    } finally {
      await data.cleanup();
    }
  },
});

export { expect };
