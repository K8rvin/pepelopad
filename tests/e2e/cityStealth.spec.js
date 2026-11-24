import { test, expect } from "@playwright/test";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(() => window.__city?.player);
  return errors;
}

test("R переключает присед, показывает HUD и запрещает спринт", async ({
  page,
}) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__city.player.crouched)).toBe(false);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => window.__city.player.crouched))
    .toBe(true);
  await expect(page.locator("#hudStealth")).toContainText("R присед");
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(() => ({
      crouched: window.__city.player.crouched,
      moving: window.__city.player.moving,
      sprinting: window.__city.player.sprinting,
    })),
  ).toEqual({ crouched: true, moving: true, sprinting: false });
  await expect(page.locator("#hudStealth")).toContainText("тихо");
  await page.screenshot({ path: ".cache/stealth_crouch.png" });
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => window.__city.player.crouched))
    .toBe(false);
  expect(errors).toEqual([]);
});

test("стена скрывает игрока, открытое помещение и шум спринта выдают", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const c = window.__city;
    for (const z of c.city.zombies) z.dead = true;
    for (const n of c.npcs) n.weapon = null;
    for (const s of c.survivors) s.weapon = null;
    const b = c.city.buildings.find((b) => b.floors === 1);
    const z = c.spawn(b.x + 2, b.y + 2, "walker");
    Object.assign(z, {
      alertT: 0,
      attackCd: 999,
      retarget: 999,
      tx: b.x + 2,
      ty: b.y + 2,
    });
    Object.assign(c.player, {
      x: b.x - 1,
      y: b.y + 2,
      level: 0,
      crouched: true,
      moving: false,
      sprinting: false,
    });
    window.__stealthZ = z;
    window.__stealthB = b;
    c.teleport(c.player.x, c.player.y);
  });
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => window.__stealthZ.alertT),
  ).toBeLessThanOrEqual(0);

  await page.evaluate(() => {
    const c = window.__city;
    const b = window.__stealthB;
    const z = window.__stealthZ;
    z.x = b.x + b.doorU;
    z.y = b.y + b.h - 2;
    z.tx = z.x;
    z.ty = z.y;
    c.player.x = b.x + b.doorU;
    c.player.y = b.y + b.h - 1;
    c.teleport(c.player.x, c.player.y);
  });
  await expect
    .poll(() => page.evaluate(() => window.__stealthZ.alertT))
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    const c = window.__city;
    const p = c.player;
    p.x += 30;
    p.crouched = false;
    const z = c.spawn(p.x + 8, p.y, "walker");
    z.alertT = 0;
    z.attackCd = 999;
    window.__stealthZ = z;
    c.teleport(p.x, p.y);
  });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await expect
    .poll(() => page.evaluate(() => window.__stealthZ.alertT))
    .toBeGreaterThan(0);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  expect(errors).toEqual([]);
});
