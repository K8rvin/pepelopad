import { test, expect } from "@playwright/test";

test("жилой спавн без базы и рельсовый транспорт на реальных путях", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__cityLifeTest = {
        snapshot: () => ({
          spawn: SPAWN,
          player: { x: P.x, y: P.y },
          district: OSM_CITY.districtNameAt(SPAWN.x, SPAWN.y),
          buildings: SMAP.size,
          hasCore: Boolean($("coreChip")),
          rail: RAIL_VEHICLES.map((vehicle) => ({ kind: vehicle.kind, distance: vehicle.distance, x: vehicle.x, y: vehicle.y })),
          assets: { train: Boolean(S.train), carriage: Boolean(S.train_carriage), tram: Boolean(S.tram), truck: Boolean(S.car_truck) },
          starter: (() => {
            const car = CARS.get("starter:residential");
            return car && { distance: Math.hypot(car.x - SPAWN.x, car.y - SPAWN.y) / 16, locked: car.locked, broken: car.broken, fuel: car.fuel, free: !circleHit(car.x, car.y, 12, car.id) };
          })(),
        }),
        moveRail: () => {
          const before = RAIL_VEHICLES.map((vehicle) => vehicle.distance);
          updateRailVehicles(0.5);
          return RAIL_VEHICLES.some((vehicle, index) => vehicle.distance !== before[index]);
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  await page.waitForFunction(() => {
    const assets = window.__cityLifeTest.snapshot().assets;
    return Object.values(assets).every(Boolean);
  });
  const snapshot = await page.evaluate(() => window.__cityLifeTest.snapshot());
  expect(snapshot.district).toBe("Краснооктябрьский район");
  expect(snapshot.player).toEqual({ x: snapshot.spawn.x, y: snapshot.spawn.y });
  expect(snapshot.buildings).toBe(0);
  expect(snapshot.hasCore).toBe(false);
  expect(snapshot.starter).toMatchObject({
    locked: false,
    broken: false,
    free: true,
  });
  expect(snapshot.starter.distance).toBeLessThan(40);
  expect(snapshot.starter.fuel).toBeGreaterThan(40);
  expect(
    [...new Set(snapshot.rail.map((vehicle) => vehicle.kind))].sort(),
  ).toEqual(["train", "tram"]);
  expect(await page.evaluate(() => window.__cityLifeTest.moveRail())).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
