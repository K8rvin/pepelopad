import { test, expect } from "@playwright/test";

test("HUD показывает район, улицу и ближайший дом", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  await expect(page.locator("#locationChip")).toBeVisible();
  await expect(page.locator("#locationChip")).toContainText(
    "Краснооктябрьский район",
  );
  await expect(page.locator("#locationChip")).toContainText("Библиотечная");
  await expect(page.locator("#locationChip")).toContainText(/д\. .+/);
  expect(errors).toEqual([]);
});
