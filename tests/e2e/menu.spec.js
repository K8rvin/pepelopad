import { test, expect } from "@playwright/test";

test("меню показывает версию, хеш и дату сборки", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !document.querySelector("#btnNew").disabled);
  await expect(page.locator("#appVersion")).toHaveText(/^\d+\.\d+\.\d+$/);
  await expect(page.locator("#buildVersion")).not.toBeEmpty();
  await expect(page.locator("#buildDate")).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
});
