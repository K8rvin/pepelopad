import { test, expect } from "@playwright/test";

test("лаборатория походки: G открывает варианты, выбор применяется в игре", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);

  // по умолчанию G («стойка↔шаг»), решение пользователя 21.11.2026
  expect(await page.evaluate(() => window.__city.R.gait)).toBe("standstep");
  await page.keyboard.press("KeyG");
  await expect(page.locator("#gaitlab")).toBeVisible();
  expect(await page.locator("#gaitlab canvas").count()).toBe(6);
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

  // покадровый F: ассетный шаг подключён, курс зеркалит профиль по ходу
  await page.locator('#gaitlab button[data-gait="frames"]').click();
  expect(await page.evaluate(() => window.__city.R.gait)).toBe("frames");
  // через __city: динамический import на живом dev-сервере даёт новый
  // инстанс модуля (?t= у цепочки main.js) с пустым SPRTEX
  expect(
    await page.evaluate(() => ({
      side: !!window.__city.SPRTEX.survivor_walk,
      front: !!window.__city.SPRTEX.survivor_walk_front,
      back: !!window.__city.SPRTEX.survivor_walk_back,
    })),
  ).toEqual({ side: true, front: true, back: true });
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.face)).toBe(-1);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.face)).toBe(1);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(150);

  // вертикальный ход получает своё направление (для фронт/спина-кадров)
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.player.dir)).toBe("up");
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(150);

  await page.keyboard.press("KeyG");
  await expect(page.locator("#gaitlab")).toBeHidden();
  expect(errors).toEqual([]);
});
