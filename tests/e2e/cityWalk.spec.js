import { test, expect } from "@playwright/test";

test("походка: фаза от дистанции, ноги в противофазе, стоя — ровно", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);

  // свободная точка с путём до 6 м по экранному D, чтобы ходьба не упёрлась
  await page.evaluate(async () => {
    const c = window.__city;
    const { solidRectAt } = await import("/src/iso/world/cityGen.js");
    const ux = Math.SQRT1_2,
      uy = -Math.SQRT1_2;
    for (let y = 20; y < c.city.SIZE - 20; y += 7)
      for (let x = 20; x < c.city.SIZE - 20; x += 7) {
        let ok = true;
        for (let d = 0; d <= 6; d += 0.4)
          if (solidRectAt(c.city, x + ux * d, y + uy * d, 0.4)) {
            ok = false;
            break;
          }
        if (ok) {
          c.teleport(x, y);
          return;
        }
      }
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  const ph1 = await page.evaluate(() => window.__city.player.walkPh);
  // кадры цикла походки для визуальной проверки
  await page.screenshot({ path: ".cache/walk_1.png" });
  await page.waitForTimeout(160);
  await page.screenshot({ path: ".cache/walk_2.png" });
  await page.waitForTimeout(160);
  const ph2 = await page.evaluate(() => window.__city.player.walkPh);
  await page.screenshot({ path: ".cache/walk_3.png" });
  expect(ph1).toBeGreaterThan(0);
  expect(ph2).toBeGreaterThan(ph1);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(200);
  const ph3 = await page.evaluate(() => window.__city.player.walkPh);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__city.player.walkPh)).toBe(ph3);
  expect(await page.evaluate(() => window.__city.player.moving)).toBe(false);
  expect(errors).toEqual([]);
});
