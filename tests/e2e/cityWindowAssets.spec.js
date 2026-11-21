import { test, expect } from "@playwright/test";

test("новое окно: B создаёт проход, WASD входит, сейв v5 сохраняет состояние", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.city);

  const selected = await page.evaluate(async () => {
    const c = window.__city;
    const { groundWindows, getInterior, solidInteriorAt } =
      await import("/src/iso/world/interiors.js");
    for (const b of c.city.buildings) {
      if (b.style !== "house" && b.style !== "brick") continue;
      getInterior(c.city, b);
      for (const w of groundWindows(b).filter((v) => v.face === "S")) {
        if (solidInteriorAt(c.city, w.x, w.y - 1.2, 0.35)) continue;
        c.teleport(w.x, w.y + 0.8);
        // зомби не толкают игрока в проём: вход проверяется, а не случайность
        for (const z of c.city.zombies)
          if (Math.hypot(z.x - w.x, z.y - w.y) < 8) z.dead = true;
        return { bid: b.id, key: `${w.face}:${w.u}`, wallY: w.y };
      }
    }
    return null;
  });
  expect(selected).toBeTruthy();
  await page.waitForTimeout(350);
  await page.keyboard.press("KeyB");
  expect(
    await page.evaluate(
      ({ bid, key }) => window.__city.city.brokenWindows.get(bid)?.has(key),
      selected,
    ),
  ).toBe(true);

  // обе клавиши одним DOM-событием: раздельные down дают кадры «только W»,
  // сносящие x из узкого проёма окна (проходимость ±0,1 м)
  await page.evaluate(() => {
    for (const code of ["KeyW", "KeyD"])
      window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  });
  // ждём фактического входа, а не фиксированное время (dt-clamp под нагрузкой)
  await page.waitForFunction(
    (wallY) => window.__city.player.y < wallY - 0.3,
    selected.wallY,
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    for (const code of ["KeyW", "KeyD"])
      window.dispatchEvent(new KeyboardEvent("keyup", { code }));
  });

  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.city);
  expect(
    await page.evaluate(
      ({ bid, key }) => window.__city.city.brokenWindows.get(bid)?.has(key),
      selected,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
