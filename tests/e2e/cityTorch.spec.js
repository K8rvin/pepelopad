import { test, expect } from "@playwright/test";

test("факел: зажигание из рюкзака, свет ночью, сейв; ходьба анимируется", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.player);

  // кладём факел в рюкзак и зажигаем через действие предмета
  await page.evaluate(() => {
    window.__city.inv.slots[0] = { id: "torch", n: 2 };
  });
  await page.keyboard.press("KeyI");
  await page.locator('.slot[data-slot="0"]').click();
  await page.locator('button[data-act="use"]').click();
  const lit = await page.evaluate(() => window.__city.player.torch);
  expect(lit).toBe(true);
  await page.keyboard.press("Escape");

  // ходьба ставит флаг moving (анимация)
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  const moving = await page.evaluate(() => window.__city.player.moving);
  await page.keyboard.up("KeyW");
  expect(moving).toBe(true);

  // сейв и перезагрузка: факел горит
  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.player);
  const lit2 = await page.evaluate(() => window.__city.player.torch);
  expect(lit2).toBe(true);
  expect(errors).toEqual([]);
});
