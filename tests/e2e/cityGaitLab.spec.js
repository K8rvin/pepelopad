import { test, expect } from "@playwright/test";

// Лаборатория походки удалена (решение пользователя): дефолт G «стойка↔шаг»,
// клавиша G больше не открывает панель; походка и курс работают.
test("походка: дефолт standstep, лаборатория убрана, курс зеркалится", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.peek);

  expect(await page.evaluate(() => window.__city.R.gait)).toBe("standstep");
  await page.keyboard.press("KeyG");
  await expect(page.locator("#gaitlab")).toHaveCount(0);

  // горизонталь: курс зеркалит профиль
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.face)).toBe(-1);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.face)).toBe(1);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__city.player.moving)).toBe(false);

  // вертикаль: своё направление для фронт/спина-кадров
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.dir)).toBe("up");
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(150);

  expect(errors).toEqual([]);
});
