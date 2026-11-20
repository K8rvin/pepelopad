import { test, expect } from "@playwright/test";

test("пригород: один этаж, без заборов, здание фейдится за игроком", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/city.html?new=1");
  await page.waitForFunction(() => window.__city?.city);

  const gen = await page.evaluate(() => ({
    floors: [...new Set(window.__city.city.buildings.map((b) => b.floors))],
    fences: window.__city.city.fences.length,
    houses: window.__city.city.buildings.filter((b) => b.style === "house")
      .length,
  }));
  expect(gen.floors).toEqual([1]);
  expect(gen.fences).toBe(0);
  expect(gen.houses).toBeGreaterThan(50);

  // игрок за северной стеной дома → здание уходит в прозрачность
  const id = await page.evaluate(() => {
    const c = window.__city;
    const h = c.city.buildings.find((b) => b.style === "house");
    c.teleport(h.x + h.w / 2, h.y - 4);
    return h.id;
  });
  await page.waitForTimeout(900);
  const alpha = await page.evaluate((i) => window.__city.R.bFade.get(i), id);
  expect(alpha).toBeLessThan(0.5);

  // перед южной стеной — здание снова плотное
  await page.evaluate((i) => {
    const c = window.__city;
    const h = c.city.buildings.find((b) => b.id === i);
    c.teleport(h.x + h.w / 2, h.y + h.h + 4);
  }, id);
  await page.waitForTimeout(900);
  const alpha2 = await page.evaluate((i) => window.__city.R.bFade.get(i), id);
  expect(alpha2).toBe(1);
  expect(errors).toEqual([]);
});
