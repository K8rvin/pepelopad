import { test, expect } from "@playwright/test";

test("дороги содержат машины, городской спавн зомби активен, лагерь безопасен", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__populationTest = {
        cars: async () => {
          const { osmWayWidth } = await import("/src/world/osmMap.js");
          const cx = Math.floor(P.x / 256), cy = Math.floor(P.y / 256);
          for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) getChunk(x, y);
          const roadCars = [...CARS.values()].filter((car) => car.id.startsWith("road:"));
          const invalid = [];
          for (const car of roadCars) {
            const way = OSM_CITY.gameWorld.wayById.get(Number(car.id.split(":")[1]));
            let best = Infinity;
            for (let i = 1; i < way.points.length; i++) {
              const a = way.points[i - 1], b = way.points[i], dx = b[0] - a[0], dy = b[1] - a[1];
              const t = Math.max(0, Math.min(1, ((car.x - a[0]) * dx + (car.y - a[1]) * dy) / (dx * dx + dy * dy)));
              best = Math.min(best, Math.hypot(car.x - a[0] - t * dx, car.y - a[1] - t * dy));
            }
            if (best > osmWayWidth(way) / 2 + 1) invalid.push(car.id);
          }
          return { count: roadCars.length, invalid };
        },
        spawn: (safe) => {
          if (safe) {
            const camp = OSM_PROJECTION.worldToGame(OSM_PROJECTION.sites.camp_bridge);
            P.x = camp.x;
            P.y = camp.y;
            getChunk(Math.floor(P.x / 256), Math.floor(P.y / 256));
          } else {
            const way = OSM_CITY.gameWorld.ways.find((way) => way.tags.highway === "residential" && way.points.some(([x, y]) => Math.hypot(x - SPAWN.x, y - SPAWN.y) > 800));
            P.x = way.points[0][0];
            P.y = way.points[0][1];
          }
          updateBuildingPresence();
          Z.length = 0;
          spawnT = 0;
          for (let i = 0; i < 60; i++) ambientSpawn(1.7);
          return Z.length;
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const cars = await page.evaluate(() => window.__populationTest.cars());
  expect(cars.count).toBeGreaterThan(0);
  expect(cars.invalid).toEqual([]);
  expect(
    await page.evaluate(() => window.__populationTest.spawn(false)),
  ).toBeGreaterThan(5);
  expect(await page.evaluate(() => window.__populationTest.spawn(true))).toBe(
    0,
  );
  expect(errors).toEqual([]);
});
