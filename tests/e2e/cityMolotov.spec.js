import { test, expect } from "@playwright/test";

test("Молотов: крафт, бросок мышью, огонь и сохранение экипировки", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.spawn, null, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    const c = window.__city;
    for (const z of c.city.zombies) z.dead = true;
    for (const n of c.npcs) n.weapon = null;
    for (const s of c.survivors) s.weapon = null;
    c.give("fuel", 1);
    c.give("cloth", 1);
  });
  await page.keyboard.press("KeyC");
  await page.locator('button.craft[data-id="molotov"]').click();
  expect(
    await page.evaluate(() =>
      window.__city.inv.slots.some((s) => s?.id === "molotov" && s.n === 1),
    ),
  ).toBe(true);
  await page.keyboard.press("KeyC");
  await page.keyboard.press("Digit4");
  await expect(page.locator("#hudWeapons .wep.on")).toContainText(
    "Коктейль Молотова",
  );
  const point = await page.evaluate(() => {
    const c = window.__city;
    const x = c.player.x + 4,
      y = c.player.y;
    const z = c.spawn(x, y, "walker");
    z.hp = 60;
    z.level = c.player.level;
    window.__molotovTarget = z;
    const sx = (x - y) * 32,
      sy = (x + y) * 16;
    const csx = (c.cam.x - c.cam.y) * 32,
      csy = (c.cam.x + c.cam.y) * 16;
    return {
      x: (sx - csx) * 2 + innerWidth / 2,
      y: (sy - csy) * 2 + innerHeight / 2,
    };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    () =>
      window.__city.combat.fires.length > 0 && window.__molotovTarget.hp <= 40,
  );
  expect(
    await page.evaluate(() =>
      window.__city.inv.slots.some((s) => s?.id === "molotov"),
    ),
  ).toBe(false);
  await page.screenshot({ path: ".cache/molotov_fire.png" });
  await page.waitForFunction(() => window.__molotovTarget.dead, null, {
    timeout: 7000,
  });
  expect(await page.evaluate(() => window.__city.combat.kills)).toBe(1);
  expect(
    await page.evaluate(() => window.__city.skills.skills.archery.xp),
  ).toBe(0);
  await page.evaluate(() => {
    window.__city.give("molotov", 1);
    window.__city.save();
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.player, null, {
    timeout: 30000,
  });
  expect(await page.evaluate(() => window.__city.player.weapon)).toBe(
    "molotov",
  );
  expect(
    await page.evaluate(() =>
      window.__city.inv.slots.some((s) => s?.id === "molotov" && s.n === 1),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.__city.combat.fires)).toEqual([]);
  expect(errors).toEqual([]);
});
