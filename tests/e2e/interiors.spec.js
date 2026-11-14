import { test, expect } from "@playwright/test";

async function startWithDriver(page, driver) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    await route.fulfill({
      response,
      body: source.replace(
        marker,
        `window.__interiorTest = {${driver}};\n${marker}`,
      ),
    });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  return errors;
}

test("m1 ведёт в ближайший супермаркет с доступными полками", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    target: () => Q.targets[0],
    loot: () => {
      const target = Q.targets[0],
        block = planBlock(target.bx, target.by),
        shelf = block.containers.find((item) => item.wayId === target.wayId && item.type === "shelf");
      P.x = shelf.x * 16 + 8;
      P.y = shelf.y * 16 + 8;
      getChunk(Math.floor(P.x / 256), Math.floor(P.y / 256));
      updateBuildingPresence();
      const layout = OSM_CITY.interiorFor(activeBuilding, currentFloorId);
      startSearch(shelf);
      searching.t = 999;
      finishSearch();
      return {
        wayId: activeBuilding.wayId,
        shelfId: shelf.id,
        lootTable: shelf.lootTable,
        fixtures: layout.fixtures.length,
        completed: Q.main > 0,
      };
    },
    saveAndLoad: () => {
      saveGame();
      loadGame();
      return Q.targets[0].wayId;
    },
  `,
  );
  const target = await page.evaluate(() => window.__interiorTest.target());
  expect(target.wayId).toBe(112437649);
  expect(target.distance / 16).toBeLessThan(300);
  expect(target.label).toContain("Пятёрочка");
  expect(await page.evaluate(() => window.__interiorTest.saveAndLoad())).toBe(
    112437649,
  );
  const result = await page.evaluate(() => window.__interiorTest.loot());
  expect(result).toMatchObject({
    wayId: 112437649,
    lootTable: "market",
    completed: true,
  });
  expect(result.fixtures).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});

test("пилотная многоэтажка имеет комнаты, двери и контейнеры своего этажа", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    pilot: () => {
      const building = OSM_CITY.buildings.get(112436182),
        block = planBlock(building.bx, building.by),
        ground = block.containers.find((item) => item.wayId === building.wayId && item.floorId === "ground"),
        upper = block.containers.find((item) => item.wayId === building.wayId && item.floorId === "upper");
      OSM_CITY.stairsFor(building, "ground");
      OSM_CITY.stairsFor(building, "upper");
      P.x = ground.x * 16 + 8;
      P.y = ground.y * 16 + 8;
      getChunk(Math.floor(P.x / 256), Math.floor(P.y / 256));
      updateBuildingPresence();
      const layout = OSM_CITY.interiorFor(building, "ground"),
        wall = layout.internalWalls[0],
        door = layout.doors[0],
        wallHit = wall && circleHit((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2, 4),
        doorHit = door && circleHit(door.x, door.y, 4),
        groundBefore = { ground: isContainerActive(ground), upper: isContainerActive(upper) };
      transitionFloor("upper");
      const upperLayout = OSM_CITY.interiorFor(building, "upper"),
        upperAfter = { ground: isContainerActive(ground), upper: isContainerActive(upper) };
      saveGame();
      loadGame();
      return {
        groundBefore,
        upperAfter,
        walls: layout.internalWalls.length,
        fixtures: layout.fixtures.length,
        upperFixtures: upperLayout.fixtures.length,
        wallHit: Boolean(wallHit),
        doorHit: Boolean(doorHit),
        restoredFloor: currentFloorId,
        restoredWay: activeBuilding?.wayId,
      };
    },
  `,
  );
  const result = await page.evaluate(() => window.__interiorTest.pilot());
  expect(result.walls).toBeGreaterThan(0);
  expect(result.fixtures).toBeGreaterThan(0);
  expect(result.upperFixtures).toBeGreaterThan(0);
  expect(result.wallHit).toBe(true);
  expect(result.doorHit).toBe(false);
  expect(result.groundBefore).toEqual({ ground: true, upper: false });
  expect(result.upperAfter).toEqual({ ground: false, upper: true });
  expect(result.restoredFloor).toBe("upper");
  expect(result.restoredWay).toBe(112436182);
  expect(errors).toEqual([]);
});
