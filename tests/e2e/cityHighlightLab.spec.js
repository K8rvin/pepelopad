import { test, expect } from "@playwright/test";

test("лаборатория подсветки: F6, пять вариантов, живое переключение", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.setHighlight);
  // цель обыска на экране: этап 1 и телепорт к учебному ящику
  await page.evaluate(() => {
    const c = window.__city;
    c.quests.stages.m00 = 1;
    const crate = c.loot.containers.find((k) => k.id === "gas_training_wood");
    c.teleport(crate.x + 3, crate.y + 3);
  });
  await page.waitForTimeout(400);
  await expect(page.locator("#hllab")).toBeHidden();
  await page.keyboard.press("F6");
  await expect(page.locator("#hllab")).toBeVisible();
  await expect(page.locator("#hllab button")).toHaveCount(5);
  for (const id of ["float", "ground", "outline", "frame", "beam"]) {
    await page.locator(`#hllab button[data-hl="${id}"]`).click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__city.getHighlight())).toBe(id);
    await expect(page.locator(`#hllab button[data-hl="${id}"]`)).toHaveClass(
      /on/,
    );
  }
  await page.keyboard.press("F6");
  await expect(page.locator("#hllab")).toBeHidden();
  expect(errors).toEqual([]);
});
