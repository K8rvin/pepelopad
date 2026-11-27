import { test, expect } from "@playwright/test";

test("база: основание V, постройка, склад, сейв переживает перезагрузку", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.base);

  // основать базу на газоне рядом с обычным жилым домом
  const baseSite = await page.evaluate(async () => {
    const c = window.__city;
    const { tileAt } = await import("/src/iso/world/cityGen.js");
    const { T_GRASS } = await import("/src/iso/render/tiles.js");
    for (const building of c.city.buildings) {
      if (
        building.locationId ||
        building.floors !== 1 ||
        !["house", "brick"].includes(building.style)
      )
        continue;
      const candidates = [
        { x: building.x - 0.75, y: building.y + 2 },
        { x: building.x + building.w + 0.75, y: building.y + 2 },
        { x: building.x + 2, y: building.y - 0.75 },
        { x: building.x + 2, y: building.y + building.h + 0.75 },
      ];
      const spot = candidates.find((p) => tileAt(c.city, p.x, p.y) === T_GRASS);
      if (spot) {
        c.teleport(spot.x, spot.y);
        return { buildingId: building.id };
      }
    }
    return null;
  });
  expect(baseSite).toBeTruthy();
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyV");
  const founded = await page.evaluate(() => window.__city.base.founded);
  expect(founded).toBe(true);
  expect(await page.evaluate(() => window.__city.base.buildingId)).toBe(
    baseSite.buildingId,
  );
  const interior = await page.evaluate(async () => {
    const c = window.__city;
    const { getInterior } = await import("/src/iso/world/interiors.js");
    const building = c.city.buildings.find((b) => b.id === c.base.buildingId);
    c.teleport(building.x + building.w / 2, building.y + building.h / 2);
    return getInterior(c.city, building).layout;
  });
  expect(interior).toBe("base");

  // открыть панель базы
  await page.keyboard.press("KeyV");
  await expect(page.locator("#ui .panel.wide h3").first()).toContainText(
    "База",
  );

  // ресурсы и постройка баррикад
  await page.evaluate(() => {
    const c = window.__city;
    c.inv.slots[0] = { id: "wood", n: 6 };
    c.inv.slots[1] = { id: "scrap", n: 4 };
    c.inv.slots[2] = { id: "can", n: 2 };
    c.ui.render();
  });
  await page.locator('button[data-base="build"][data-i="0"]').click();
  const hasBar = await page.evaluate(() =>
    window.__city.base.structures.includes("barricade"),
  );
  expect(hasBar).toBe(true);

  //deposit: тушёнка из рюкзака в склад базы
  await page.locator('.slot[data-side="inv"][data-slot="2"]').click();
  const stored = await page.evaluate(() =>
    window.__city.base.storage.slots.some((s) => s && s.id === "can"),
  );
  expect(stored).toBe(true);

  // сейв и перезагрузка
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.base);
  const after = await page.evaluate(() => ({
    founded: window.__city.base.founded,
    buildingId: window.__city.base.buildingId,
    bar: window.__city.base.structures.includes("barricade"),
    can: window.__city.base.storage.slots.some((s) => s && s.id === "can"),
  }));
  expect(after.founded).toBe(true);
  expect(after.buildingId).toBe(baseSite.buildingId);
  expect(after.bar).toBe(true);
  expect(after.can).toBe(true);
  expect(errors).toEqual([]);
});
