import { test, expect } from "@playwright/test";

test("типы зомби, стадность и Матка: спавн, тревога, призыв, сейв", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/city.html?new=1");
  await page.waitForFunction(() => window.__city?.spawn);

  // спавним бегуна и громилу рядом с игроком, проверяем типы и hp
  const spawned = await page.evaluate(() => {
    const c = window.__city;
    const r = c.spawn(c.player.x + 6, c.player.y, "runner");
    const b = c.spawn(c.player.x + 8, c.player.y, "brute");
    return { runner: r.type, bruteHp: b.hp };
  });
  expect(spawned.runner).toBe("runner");
  expect(spawned.bruteHp).toBe(260);

  // тревога распространяется:alertNear будит соседей спавненных зомби
  const alerted = await page.evaluate(() => {
    const c = window.__city;
    c.alertNear(c.player.x + 7, c.player.y, 3);
    return c.city.zombies.filter((z) => !z.dead && z.alertT > 0).length;
  });
  expect(alerted).toBeGreaterThanOrEqual(2);
  // отводим игрока, чтобы стая не забила его во время ожидания призыва
  await page.evaluate(() => {
    const c = window.__city;
    c.teleport(c.player.x + 40, c.player.y + 40);
  });

  // Матка: спавн + призыв ходоков за ~19 с игрового времени
  const boss = await page.evaluate(() => {
    const c = window.__city;
    const b = c.spawn(c.player.x + 12, c.player.y + 12, "boss");
    return { hp: b.hp, n0: c.city.zombies.length };
  });
  expect(boss.hp).toBe(900);
  await page.waitForFunction(
    (n0) => window.__city.city.zombies.length > n0,
    boss.n0,
    { timeout: 30000 },
  );

  // сейв сохраняет типы зомби
  await page.evaluate(() => window.__city.save());
  const types = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pepelopad_city_v4"));
    return [...new Set(d.zombies.map((z) => z.type))].sort();
  });
  expect(types).toContain("boss");
  expect(types).toContain("brute");
  expect(types).toContain("runner");
  expect(errors).toEqual([]);
});
