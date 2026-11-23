import { test, expect } from "@playwright/test";

test("новый интерьер: мебель, обыск кухонной тумбы и сейв v6", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.peek);

  const selected = await page.evaluate(async () => {
    const c = window.__city;
    const { getInterior } = await import("/src/iso/world/interiors.js");
    for (const b of c.city.buildings) {
      if (b.style !== "house" && b.style !== "brick") continue;
      const it = getInterior(c.city, b);
      const container = it.containers.find(
        (k) => k.kind === "sink" && c.peek(k).length > 0,
      );
      if (!container) continue;
      c.teleport(b.x + it.doorU, b.y + b.h - 1);
      return { bid: b.id, id: container.id, layout: it.layout };
    }
    return null;
  });
  expect(selected).toBeTruthy();
  expect(selected.layout).toBe("suburb");
  await page.waitForFunction(
    (bid) => window.__city.loot.interior.has(bid),
    selected.bid,
  );
  await page.evaluate(({ bid, id }) => {
    const c = window.__city;
    const container = c.loot.interior.get(bid).find((k) => k.id === id);
    c.teleport(container.x + 0.8, container.y);
  }, selected);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__city.search() !== null);
  await page.waitForFunction(() => window.__city.search() === null, {
    timeout: 5000,
  });
  await expect(page.locator("#ui .panel h3").first()).toContainText("Обыск");
  await page.locator("#takeAll").click();
  await expect(page.locator("#ui")).toBeHidden();
  expect(
    await page.evaluate((id) => window.__city.loot.opened.has(id), selected.id),
  ).toBe(true);

  await page.evaluate(() => window.__city.save());
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pepelopad_city_v6")).v,
    ),
  ).toBe(6);
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.loot);
  expect(
    await page.evaluate((id) => window.__city.loot.opened.has(id), selected.id),
  ).toBe(true);
  expect(errors).toEqual([]);
});
