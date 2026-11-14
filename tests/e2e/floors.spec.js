import { test, expect } from "@playwright/test";

test("единый мир: двери, окна, внутренняя добыча, этажи и сохранение", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__floorTest = {
        building: (type) => {
          if (OSM_PROJECTION.sites[type]) {
            const block = OSM_PROJECTION.blockForSite(type);
            return OSM_CITY.specials.get(K(block.bx, block.by))?.building;
          }
          return [...OSM_CITY.buildings.values()].find((building) => building.type === type && OSM_CITY.stairsFor(building, "ground").length);
        },
        cross: (type, kind = "door") => {
          const building = window.__floorTest.building(type);
          const opening = building.openings.find((item) => item.kind === kind);
          P.x = opening.x + opening.nx * 16;
          P.y = opening.y + opening.ny * 16;
          updateBuildingPresence();
          const before = { x: P.x, y: P.y };
          for (let step = 0; step < 16; step++) moveBody(P, -opening.nx * 2, -opening.ny * 2);
          updateBuildingPresence();
          return { before, ...window.__floorTest.snapshot() };
        },
        go: (target) => {
          const stair = OSM_CITY.stairsFor(activeBuilding, currentFloorId).find((item) => item.target === target);
          P.x = stair.x;
          P.y = stair.y;
          const before = { x: P.x, y: P.y };
          updateInteract();
          doInteract();
          return { before, ...window.__floorTest.snapshot() };
        },
        snapshot: () => ({
          floor: currentFloorId,
          state,
          building: activeBuilding?.type || null,
          wayId: activeBuilding?.wayId || null,
          x: P.x,
          y: P.y,
          fade: $("fade").classList.contains("on"),
          stairs: activeBuilding ? OSM_CITY.stairsFor(activeBuilding, currentFloorId).map((stair) => stair.target) : [],
        }),
        spawnAndShoot: () => {
          spawnZ("walker", P.x + 30, P.y);
          P.cd = 0;
          P.rl = 0;
          P.mags.bow = 5;
          fireWeapon();
          return { floor: Z[Z.length - 1].floorId, projectiles: PR.length };
        },
        loot: () => {
          const block = OSM_PROJECTION.blockForSite("hospital");
          const container = planBlock(block.bx, block.by).containers[0];
          P.x = container.x * 16 + 8;
          P.y = container.y * 16 + 8;
          updateBuildingPresence();
          startSearch(container);
          searching.t = 999;
          finishSearch();
          return OV.get("L" + container.id) === true;
        },
        saveAndLoad: () => {
          saveGame();
          return { loaded: loadGame(), ...window.__floorTest.snapshot() };
        },
        dieAndRespawn: () => {
          gameOver("zombie");
          respawn();
          return window.__floorTest.snapshot();
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  await page.waitForFunction(
    () => !document.querySelector("#fade").classList.contains("on"),
  );

  for (const kind of ["door", "window"]) {
    const entered = await page.evaluate(
      (kind) => window.__floorTest.cross("hospital", kind),
      kind,
    );
    expect(entered.state).toBe("play");
    expect(entered.floor).toBe("ground");
    expect(entered.wayId).toBe(123686711);
    expect(entered.fade).toBe(false);
    expect(entered.x).not.toBe(entered.before.x);
    expect(entered.y).not.toBe(entered.before.y);
  }
  expect(await page.evaluate(() => window.__floorTest.loot())).toBe(true);
  const upstairs = await page.evaluate(() => window.__floorTest.go("upper"));
  expect(upstairs.floor).toBe("upper");
  expect(upstairs.state).toBe("play");
  expect(upstairs).toMatchObject({
    x: upstairs.before.x,
    y: upstairs.before.y,
    fade: false,
  });
  const combat = await page.evaluate(() => window.__floorTest.spawnAndShoot());
  expect(combat.floor).toBe("upper");
  expect(combat.projectiles).toBeGreaterThan(0);
  expect(
    (await page.evaluate(() => window.__floorTest.go("ground"))).floor,
  ).toBe("ground");
  expect(
    (await page.evaluate(() => window.__floorTest.go("basement"))).floor,
  ).toBe("basement");
  const restored = await page.evaluate(() => window.__floorTest.saveAndLoad());
  expect(restored).toMatchObject({
    loaded: true,
    floor: "basement",
    state: "play",
    wayId: 123686711,
  });
  expect(
    (await page.evaluate(() => window.__floorTest.dieAndRespawn())).floor,
  ).toBe("outdoor");

  for (const [building, target] of [
    ["gunstore", "basement"],
    ["apartments", "upper"],
  ]) {
    const result = await page.evaluate(
      ({ building, target }) => {
        window.__floorTest.cross(building);
        const changed = window.__floorTest.go(target);
        return { changed, restored: window.__floorTest.saveAndLoad() };
      },
      { building, target },
    );
    expect(result.changed.floor).toBe(target);
    expect(result.restored.loaded).toBe(true);
    expect(result.restored.floor).toBe(target);
    expect(result.restored.state).toBe("play");
  }
  expect(errors).toEqual([]);
});
