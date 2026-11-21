import { test, expect } from "@playwright/test";

test("лаборатория походки: G открывает варианты, выбор применяется в игре", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);

  // по умолчанию B («пружинка»), решение пользователя 21.11.2026
  expect(await page.evaluate(() => window.__city.R.gait)).toBe("bob");
  await page.keyboard.press("KeyG");
  await expect(page.locator("#gaitlab")).toBeVisible();
  expect(await page.locator("#gaitlab canvas").count()).toBe(4);
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".cache/gait_lab.png" });

  await page.locator('#gaitlab button[data-gait="knee"]').click();
  expect(await page.evaluate(() => window.__city.R.gait)).toBe("knee");
  await expect(page.locator('#gaitlab button[data-gait="knee"]')).toContainText(
    "в игре",
  );

  // ходьба с выбранным вариантом не роняет игру
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(150); // кадр без клавиши
  expect(await page.evaluate(() => window.__city.player.moving)).toBe(false);

  await page.keyboard.press("KeyG");
  await expect(page.locator("#gaitlab")).toBeHidden();
  expect(errors).toEqual([]);
});
