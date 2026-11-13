import { test, expect } from "@playwright/test";

async function installRaidDriver(page) {
  await page.route("**/src/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__raidTest = {
        prepare: () => {
          Q.main = 6;
          const camp = {
            id: "camp_bridge",
            name: "Лагерь «Мост»",
            leader: "Марта",
            x: 2016,
            y: 2016,
            bx: 4,
            by: 2,
            level: 1,
            trust: 0,
            proj: { wall: 0, garden: 0, tower: 0, clinic: 0 },
            quest: null,
          };
          CAMPS.set(camp.id, camp);
          openCamp(camp);
        },
        snapshot: () => ({
          active: activeRaidId(Q.side),
          cargo: countItem("cargo"),
          trust: CAMPS.get("camp_bridge").trust,
          done: Q.raids.fuel_convoy || null,
          sideCount: Q.side.length,
          fuelcans: countItem("fuelcan"),
          rules: currentRaidRules(),
        }),
        collectCargo: () => {
          searching = {
            o: {
              id: "raid-test-cache",
              x: 5 * CELL + 6,
              y: -2 * CELL + 6,
              type: "cache",
              looted: false,
            },
            t: 0,
            dur: 0,
          };
          finishSearch();
        },
        openRaidCamp: () => openCamp(CAMPS.get("camp_bridge")),
        spawnElite: () => {
          P.x = (5 * CELL + 14) * 16;
          P.y = (-2 * CELL + 14) * 16;
          spawnZ("walker", P.x + 40, P.y);
          return Z[Z.length - 1].elite;
        },
        mapText: () => {
          drawBigmap();
          return $("mapDistrict").textContent;
        },
        saveAndLoad: () => {
          saveGame();
          return { loaded: loadGame(), ...window.__raidTest.snapshot() };
        },
      };
${marker}`;
    if (!source.includes(marker))
      throw new Error("Raid driver marker not found");
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
}

test("сюжетный рейд: выдача, правила, груз, награда и сохранение", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await installRaidDriver(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(
    () => window.__raidTest && document.body.className === "play",
  );
  await page.evaluate(() => window.__raidTest.prepare());

  await page
    .locator("#campList button")
    .filter({ hasText: "Сюжетный рейд: Топливо" })
    .click();
  expect(await page.evaluate(() => window.__raidTest.snapshot().active)).toBe(
    "fuel_convoy",
  );
  expect(await page.evaluate(() => window.__raidTest.spawnElite())).toBe(true);
  expect(await page.evaluate(() => window.__raidTest.mapText())).toContain(
    "рейд: патрули ×1.5",
  );

  await page.evaluate(() => window.__raidTest.collectCargo());
  expect(await page.evaluate(() => window.__raidTest.snapshot().cargo)).toBe(3);
  const beforeReward = await page.evaluate(
    () => window.__raidTest.snapshot().fuelcans,
  );
  await page.evaluate(() => window.__raidTest.openRaidCamp());
  for (let i = 0; i < 3; i++)
    await page
      .locator("#campList button")
      .filter({ hasText: "Сдать груз" })
      .click();

  const completed = await page.evaluate(() => window.__raidTest.snapshot());
  expect(completed.done).toBe("done");
  expect(completed.sideCount).toBe(0);
  expect(completed.cargo).toBe(0);
  expect(completed.trust).toBe(18);
  expect(completed.fuelcans).toBe(beforeReward + 2);

  const restored = await page.evaluate(() => window.__raidTest.saveAndLoad());
  expect(restored.loaded).toBe(true);
  expect(restored.done).toBe("done");
  expect(restored.trust).toBe(18);
  await page.evaluate(() => window.__raidTest.openRaidCamp());
  await expect(
    page
      .locator("#campList button")
      .filter({ hasText: "Сюжетный рейд: Топливо" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
