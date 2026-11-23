import { test, expect } from "@playwright/test";

test("стрельба внутри здания: стрела летит и попадает в зомби", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.peek);

  // подбираем здание с чистым коридором и проверяем линию огня коллизиями
  const setup = await page.evaluate(async () => {
    const c = window.__city;
    const { getInterior, solidInteriorAt } =
      await import("/src/iso/world/interiors.js");
    const { addItem } = await import("/src/iso/systems/inventory.js");
    for (const b of c.city.buildings) {
      const it = getInterior(c.city, b);
      if (it.corrA === undefined || b.w < b.h || b.w < 10) continue;
      const cy = b.y + (it.corrA + it.corrB) / 2;
      const px = b.x + 2,
        zx = b.x + 6;
      let clear = true;
      for (let x = px; x <= zx + 0.5; x += 0.2)
        if (solidInteriorAt(c.city, x, cy, 0.05, 0)) {
          clear = false;
          break;
        }
      if (!clear) continue;
      c.teleport(px, cy);
      for (const z of c.city.zombies)
        if (Math.hypot(z.x - px, z.y - cy) < 15) z.dead = true;
      const z = c.spawn(zx, cy, "walker");
      const zi = c.city.zombies.indexOf(z);
      addItem(c.inv, "arrow", 3);
      // экранные координаты точки прицела (zoom 1, курсор от края канваса)
      const cv = document.querySelector("canvas");
      const r = cv.getBoundingClientRect();
      const camS = { x: (c.cam.x - c.cam.y) * 32, y: (c.cam.x + c.cam.y) * 16 };
      const aimS = { x: (b.x + 8 - cy) * 32, y: (b.x + 8 + cy) * 16 };
      return {
        zi,
        mx: r.left + aimS.x - camS.x + cv.width / 2,
        my: r.top + aimS.y - camS.y + cv.height / 2,
      };
    }
    return null;
  });
  expect(setup).toBeTruthy();

  await page.mouse.move(setup.mx, setup.my);
  await page.mouse.down();
  await page.waitForTimeout(1000); // натяжение 0,8 с
  const currentAim = await page.evaluate((zi) => {
    const c = window.__city;
    const z = c.city.zombies[zi];
    const cv = document.querySelector("canvas");
    const camS = { x: (c.cam.x - c.cam.y) * 32, y: (c.cam.x + c.cam.y) * 16 };
    const aimS = { x: (z.x - z.y) * 32, y: (z.x + z.y) * 16 - 0.9 * 32 };
    return {
      mx: (aimS.x - camS.x) * 2 + cv.width / 2,
      my: (aimS.y - camS.y) * 2 + cv.height / 2,
    };
  }, setup.zi);
  await page.mouse.move(currentAim.mx, currentAim.my);
  await page.mouse.up();

  await page.waitForFunction(
    (zi) => {
      const z = window.__city.city.zombies[zi];
      return z && (z.dead || z.hp < 70);
    },
    setup.zi,
    { timeout: 5000 },
  );
  expect(errors).toEqual([]);
});
