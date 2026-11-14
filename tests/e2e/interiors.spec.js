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

test("школьная цель использует ближайший супермаркет с доступными полками", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    target: () => {
      Q.main = 4;
      setupMain();
      const target = Q.targets.find((target) => target.siteId === "school_food");
      return { ...target, distance: Math.hypot(target.x - SPAWN.x, target.y - SPAWN.y) };
    },
    loot: () => {
      const target = Q.targets.find((target) => target.siteId === "school_food"),
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
      };
    },
    saveAndLoad: () => {
      saveGame();
      loadGame();
      return Q.targets.find((target) => target.siteId === "school_food").wayId;
    },
  `,
  );
  const target = await page.evaluate(() => window.__interiorTest.target());
  expect(target.wayId).toBe(112437649);
  expect(target.distance / 16).toBeLessThan(300);
  expect(target.osmName).toContain("Пятёрочка");
  expect(await page.evaluate(() => window.__interiorTest.saveAndLoad())).toBe(
    112437649,
  );
  const result = await page.evaluate(() => window.__interiorTest.loot());
  expect(result).toMatchObject({
    wayId: 112437649,
    lootTable: "market",
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

test("похожий дом Репина 21 использует общий шаблон со своими ID", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    matched: () => {
      const building = OSM_CITY.buildings.get(112436656),
        block = planBlock(building.bx, building.by),
        ground = OSM_CITY.interiorFor(building, "ground"),
        upper = OSM_CITY.interiorFor(building, "upper"),
        containers = block.containers.filter((item) => item.wayId === building.wayId);
      return {
        groundWalls: ground.internalWalls.length,
        groundDoors: ground.doors.length,
        upperWalls: upper.internalWalls.length,
        containers: containers.length,
        stableIds: containers.every((item) => item.id.startsWith("osm:112436656:") && !item.id.includes("osm:112436182:")),
        identical: containers.every((item) => {
          const layout = item.floorId === "upper" ? upper : ground,
            original = layout.containers.find((candidate) => candidate.id === item.id);
          return original && original.tileX === item.x && original.tileY === item.y;
        }),
        floors: [...new Set(containers.map((item) => item.floorId))].sort(),
      };
    },
  `,
  );
  const result = await page.evaluate(() => window.__interiorTest.matched());
  expect(result.groundWalls).toBeGreaterThan(0);
  expect(result.groundDoors).toBeGreaterThan(0);
  expect(result.upperWalls).toBeGreaterThan(0);
  expect(result.containers).toBeGreaterThan(0);
  expect(result.stableIds).toBe(true);
  expect(result.identical).toBe(true);
  expect(result.floors).toEqual(["ground", "upper"]);
  expect(errors).toEqual([]);
});

test("неподходящий жилой дом сохраняет обычные контейнеры без шаблона", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    unmatched: () => {
      const building = OSM_CITY.buildings.get(40699743),
        block = planBlock(building.bx, building.by),
        containers = block.containers.filter((item) => item.wayId === building.wayId);
      return {
        ground: OSM_CITY.interiorFor(building, "ground"),
        upper: OSM_CITY.interiorFor(building, "upper"),
        containers: containers.length,
        generic: containers.every((item) => item.floorId === "ground" && /^osm:40699743:\\d+$/.test(item.id)),
      };
    },
  `,
  );
  const result = await page.evaluate(() => window.__interiorTest.unmatched());
  expect(result.ground).toBeNull();
  expect(result.upper).toBeNull();
  expect(result.containers).toBeGreaterThan(0);
  expect(result.generic).toBe(true);
  expect(errors).toEqual([]);
});

test("подсказка миникарты показывает полный адрес безымянного здания", async ({
  page,
}) => {
  const errors = await startWithDriver(
    page,
    `
    showAddress: () => {
      const building = OSM_CITY.buildings.get(112436182),
        point = OSM_CITY.stairsFor(building, "ground")[0];
      P.x = point.x;
      P.y = point.y;
      updateBuildingPresence();
      drawMinimap();
      return {
        activeWay: activeBuilding?.wayId,
        placeName: OSM_CITY.placeNameAt(P.x, P.y),
      };
    },
  `,
  );
  const result = await page.evaluate(() => window.__interiorTest.showAddress());
  expect(result.activeWay).toBe(112436182);
  expect(result.placeName).toBe("Библиотечная улица, 12");
  await page.locator("#mmap").hover();
  await expect(page.locator("#mmapHint")).toBeVisible();
  await expect(page.locator("#mmapHint")).toHaveText("Библиотечная улица, 12");
  expect(errors).toEqual([]);
});
