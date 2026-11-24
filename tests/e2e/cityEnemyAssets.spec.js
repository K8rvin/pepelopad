import { test, expect } from "@playwright/test";

test("громила и Матка: уникальные кадры, GIF-ходьба и трупы", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(
    () =>
      window.__city?.SPRTEX?.brute_attack?.naturalWidth > 0 &&
      window.__city?.SPRTEX?.matka_walk_7?.naturalWidth > 0,
  );
  await page.evaluate(() => {
    const c = window.__city;
    for (const z of c.city.zombies) z.dead = true;
    for (const n of c.npcs) n.weapon = null;
    for (const s of c.survivors) s.weapon = null;
    const x = c.player.x,
      y = c.player.y;
    const brute = c.spawn(x - 2, y, "brute");
    const matka = c.spawn(x + 2, y, "boss");
    for (const z of [brute, matka]) {
      Object.assign(z, {
        moving: false,
        hurtT: 0,
        attackT: 0,
        attackCd: 999,
        alertT: 0,
        retarget: 999,
        tx: z.x,
        ty: z.y,
      });
    }
    matka.animT = 0;
    c.combat.corpses = [];
    window.__enemyBrute = brute;
    window.__enemyMatka = matka;
    c.teleport(x, y);
    document.querySelector("#levelup").style.display = "none";
  });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const c = window.__city;
    document.querySelector("#pause").style.display = "none";
    c.cam.x = c.player.x;
    c.cam.y = c.player.y;
  });
  await page.screenshot({ path: ".cache/enemy_base.png" });

  await page.evaluate(() => {
    for (const z of [window.__enemyBrute, window.__enemyMatka]) {
      z.moving = true;
      z.tx = z.x + 2;
    }
    window.__enemyMatka.animT = 4.8;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: ".cache/enemy_walk.png" });
  expect(await page.evaluate(() => window.__enemyMatka.animT)).toBeGreaterThan(
    0,
  );

  await page.evaluate(() => {
    for (const z of [window.__enemyBrute, window.__enemyMatka]) {
      z.moving = false;
      z.hurtT = 0.3;
      z.tx = z.x;
      z.ty = z.y;
    }
  });
  await page.screenshot({ path: ".cache/enemy_hurt.png" });

  await page.evaluate(() => {
    for (const z of [window.__enemyBrute, window.__enemyMatka]) {
      z.hurtT = 0;
      z.attackT = 0.45;
    }
  });
  await page.screenshot({ path: ".cache/enemy_attack.png" });

  await page.evaluate(() => {
    const c = window.__city;
    for (const z of [window.__enemyBrute, window.__enemyMatka]) z.dead = true;
    c.combat.corpses = [window.__enemyBrute, window.__enemyMatka].map((z) => ({
      x: z.x,
      y: z.y,
      t: 0,
      pose: 0,
      type: z.type,
      face: 1,
      scale: z.type === "boss" ? 1.6 : 1.28,
    }));
  });
  await page.screenshot({ path: ".cache/enemy_fall.png" });
  expect(await page.evaluate(() => window.__city.combat.corpses.length)).toBe(
    2,
  );
  expect(errors).toEqual([]);
});
