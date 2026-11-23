import { test, expect } from "@playwright/test";

test("повышение навыка: баннер с эффектом, искры, очередь гаснет", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.peek);

  // ровно один уровень Стрельбы (40 XP = порог L0→1), характеристики не растут
  await page.evaluate(() => window.__city.gainXp("archery", 40));
  await page.waitForFunction(() => window.__city.levelFx.active !== null);
  await expect(page.locator("#levelup")).toHaveClass(/show/);
  await expect(page.locator("#levelup .lu-name")).toContainText("Стрельба");
  await expect(page.locator("#levelup .lu-level")).toContainText("УРОВЕНЬ 1");
  await expect(page.locator("#levelup .lu-desc")).toContainText("урона");
  expect(
    await page.evaluate(() => window.__city.levelFx.sparks.length),
  ).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: ".cache/levelup_banner.png" });

  // баннер догорает, очередь пуста, игра продолжается
  await page.waitForFunction(
    () =>
      window.__city.levelFx.active === null &&
      window.__city.levelFx.queue.length === 0,
    null,
    { timeout: 6000 },
  );
  expect(errors).toEqual([]);
});
