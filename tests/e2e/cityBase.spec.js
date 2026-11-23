import { test, expect } from "@playwright/test";

test("база: основание V, постройка, склад, сейв переживает перезагрузку", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.base);

  // базу можно основать только на траве: газон парка (старт теперь у АЗС)
  await page.evaluate(() => window.__city.teleport(118, 118));
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyV");
  const founded = await page.evaluate(() => window.__city.base.founded);
  expect(founded).toBe(true);

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
    bar: window.__city.base.structures.includes("barricade"),
    can: window.__city.base.storage.slots.some((s) => s && s.id === "can"),
  }));
  expect(after.founded).toBe(true);
  expect(after.bar).toBe(true);
  expect(after.can).toBe(true);
  expect(errors).toEqual([]);
});
