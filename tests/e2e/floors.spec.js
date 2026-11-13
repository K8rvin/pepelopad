import { test, expect } from "@playwright/test";

test("переходы по этажам, добыча, зомби и сохранение", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__floorTest = {
        enter: (building = "hospital") => enterFloor(building, "ground"),
        moveToEntrance: (type) => {
          for (let bx = -6; bx <= 6; bx++)
            for (let by = -6; by <= 6; by++) {
              const building = planBlock(bx, by).buildings.find((b) => b.type === type);
              if (!building) continue;
              P.x = (building.x + Math.floor(building.w / 2) + 0.5) * 16;
              P.y = (building.y + building.h - 0.5) * 16;
              updateInteract();
              return promptObj?.kind;
            }
          return null;
        },
        dieAndRespawn: () => {
          gameOver("zombie");
          respawn();
          return window.__floorTest.snapshot();
        },
        go: (target) => {
          promptObj = { kind: "stairs", o: { target } };
          doInteract();
          return window.__floorTest.snapshot();
        },
        snapshot: () => ({
          floor: currentFloorId,
          state,
          building: FLOOR_SCENE?.buildingId || null,
          looted: FLOOR_CONTAINERS.get("5,5")?.looted || false,
          stairs: FLOOR_SCENE?.stairs.map((stair) => stair.target) || [],
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
          const container = FLOOR_CONTAINERS.get("5,5");
          startSearch(container);
          searching.t = 999;
          finishSearch();
          return OV.get("Lfloor:hospital:ground:0") === true;
        },
        saveAndLoad: () => {
          saveGame();
          return { loaded: loadGame(), ...window.__floorTest.snapshot() };
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  expect(
    await page.evaluate(() => window.__floorTest.moveToEntrance("hospital")),
  ).toBe("floorEntrance");
  await page.keyboard.press("e");

  expect(await page.evaluate(() => window.__floorTest.snapshot().floor)).toBe(
    "ground",
  );
  expect(await page.evaluate(() => window.__floorTest.go("upper").floor)).toBe(
    "upper",
  );
  const combat = await page.evaluate(() => window.__floorTest.spawnAndShoot());
  expect(combat.floor).toBe("upper");
  expect(combat.projectiles).toBeGreaterThan(0);

  expect(await page.evaluate(() => window.__floorTest.go("ground").floor)).toBe(
    "ground",
  );
  expect(await page.evaluate(() => window.__floorTest.loot())).toBe(true);
  await page.evaluate(() => window.__floorTest.go("upper"));
  await page.evaluate(() => window.__floorTest.go("ground"));
  expect(await page.evaluate(() => window.__floorTest.snapshot().looted)).toBe(
    true,
  );

  const restored = await page.evaluate(() => window.__floorTest.saveAndLoad());
  expect(restored.loaded).toBe(true);
  expect(restored.floor).toBe("ground");
  expect(restored.state).toBe("floor");
  const outside = await page.evaluate(() => window.__floorTest.go("outdoor"));
  expect(outside.floor).toBe("outdoor");
  expect(outside.state).toBe("play");
  for (const [building, floor] of [
    ["hospital", "upper"],
    ["hospital", "basement"],
    ["gunstore", "basement"],
    ["apartments", "upper"],
    ["apartments", "basement"],
  ]) {
    const result = await page.evaluate(
      ({ building, floor }) => {
        window.__floorTest.enter(building);
        const reached = window.__floorTest.go(floor);
        const restored = window.__floorTest.saveAndLoad();
        return {
          reached,
          restored,
          respawned: window.__floorTest.dieAndRespawn(),
        };
      },
      { building, floor },
    );
    expect(result.reached.floor).toBe(floor);
    expect(result.reached.building).toBe(building);
    expect(result.restored.loaded).toBe(true);
    expect(result.restored.floor).toBe(floor);
    expect(result.restored.building).toBe(building);
    expect(result.respawned.floor).toBe("outdoor");
    expect(result.respawned.state).toBe("play");
  }
  expect(errors).toEqual([]);
});
