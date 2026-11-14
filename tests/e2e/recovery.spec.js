import { test, expect } from "@playwright/test";

test("V освобождает из стены и автомобиля без штрафа", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__recoveryTest = {
        wall: () => {
          const block = OSM_PROJECTION.blockForSite("hospital"),
            building = OSM_CITY.specials.get(K(block.bx, block.by)).building;
          for (let edge = 1; edge < building.points.length; edge++) {
            const a = building.points[edge - 1], b = building.points[edge], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for (let along = 8; along < length; along += 8) {
              P.x = a[0] + (b[0] - a[0]) * along / length;
              P.y = a[1] + (b[1] - a[1]) * along / length;
              if (circleHit(P.x, P.y, P.r)) {
                stuckTime = 2;
                return { x: P.x, y: P.y, blocked: true, hp: P.hp, inventory: JSON.stringify(inv) };
              }
            }
          }
          return { x: P.x, y: P.y, blocked: false, hp: P.hp, inventory: JSON.stringify(inv) };
        },
        snapshot: () => ({ x: P.x, y: P.y, hp: P.hp, inventory: JSON.stringify(inv), free: !circleHit(P.x, P.y, P.r, P.inCar) }),
        carSpeed: () => CARS.get(P.inCar)?.speed,
        car: () => {
          CARS.set("recovery-car", { id: "recovery-car", type: "sedan", x: P.x, y: P.y, angle: 0, hp: 100, fuel: 20, speed: 30 });
          carGridAdd(CARS.get("recovery-car"));
          P.inCar = "recovery-car";
          stuckTime = 2;
          return window.__recoveryTest.snapshot();
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const before = await page.evaluate(() => window.__recoveryTest.wall());
  expect(before.blocked).toBe(true);
  await page.keyboard.press("v");
  const freed = await page.evaluate(() => window.__recoveryTest.snapshot());
  expect(freed.free).toBe(true);
  expect(freed.hp).toBe(before.hp);
  expect(freed.inventory).toBe(before.inventory);
  expect(Math.hypot(freed.x - before.x, freed.y - before.y)).toBeGreaterThan(0);

  await page.evaluate(() => window.__recoveryTest.car());
  await page.keyboard.press("v");
  const car = await page.evaluate(() => ({
    ...window.__recoveryTest.snapshot(),
    speed: window.__recoveryTest.carSpeed(),
  }));
  expect(car.free).toBe(true);
  expect(car.speed).toBe(0);
  expect(car.hp).toBe(before.hp);
  expect(car.inventory).toBe(before.inventory);
  expect(errors).toEqual([]);
});
