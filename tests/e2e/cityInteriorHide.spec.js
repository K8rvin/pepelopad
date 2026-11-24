import { test, expect } from "@playwright/test";

test("NPC внутри здания не виден снаружи и виден изнутри", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.npcs);
  // игрок снаружи АЗС у двери: Олег внутри не рисуется
  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((k) => k.poi === "АЗС");
    c.teleport(b.x + 4, b.y + b.h + 2);
  });
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(() => {
      const c = window.__city;
      const o = c.npcs.find((n) => n.id === "oleg");
      return { drawn: o._drawn, skipped: c.R.interiorSkipped };
    }),
  ).toEqual({ drawn: false, skipped: expect.any(Number) });
  expect(
    await page.evaluate(() => window.__city.R.interiorSkipped),
  ).toBeGreaterThan(0);
  // игрок внутри АЗС: Олег рисуется
  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((k) => k.poi === "АЗС");
    c.teleport(b.x + 4, b.y + 3);
  });
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () => window.__city.npcs.find((n) => n.id === "oleg")._drawn,
    ),
  ).toBe(true);
  // E у двери снаружи продолжает работать по координатам
  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((k) => k.poi === "АЗС");
    c.teleport(b.x + (b.doorU ?? 4), b.y + b.h + 0.8);
  });
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg")).toContainText("Дверь завалена");
  expect(errors).toEqual([]);
});
