import { test, expect } from "@playwright/test";

test("диалог: клик и Space листают реплику, подсказка их называет", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await expect(page.locator("#dlg")).toBeVisible();
  await expect(page.locator("#dlg .hint")).toContainText("Space");
  const line0 = await page.locator("#dlg .dlg-line").textContent();
  await page.locator("#dlg .dlg-line").click();
  const line1 = await page.locator("#dlg .dlg-line").textContent();
  expect(line1).not.toBe(line0);
  await page.keyboard.press("Space");
  const line2 = await page.locator("#dlg .dlg-line").textContent();
  expect(line2).not.toBe(line1);
  expect(errors).toEqual([]);
});
