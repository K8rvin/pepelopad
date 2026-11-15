import { test, expect } from "@playwright/test";

async function installStoryDriver(page) {
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__storyTest = {
        snapshot: () => ({
          state,
          main: Q.main,
          quest: mainQuest()?.id || null,
          progress: { ...Q.prog },
          targets: Q.targets?.map((target) => ({ ...target })),
          story: JSON.parse(JSON.stringify(STORY)),
          friendHelp: STORY.friendHelp,
          choiceOpen: storyChoiceActive,
          camp: CAMPS.get("camp_school") ? {
            x: CAMPS.get("camp_school").x,
            y: CAMPS.get("camp_school").y,
            branch: CAMPS.get("camp_school").branch,
            residents: [...CAMPS.get("camp_school").rescuedResidents],
            proj: { ...CAMPS.get("camp_school").proj },
          } : null,
          npcs: NPCS.filter((npc) => npc.storyActor).map((npc) => npc.storyActor),
          crossbowLearned: learned.has("crossbow"),
        }),
        interact: (siteId) => {
          const target = Q.targets.find((item) => item.siteId === siteId);
          if (!target) throw new Error("Missing target " + siteId);
          const point = storyInteractionPosition(target);
          P.x = point.x;
          P.y = point.y;
          P.inCar = null;
          currentFloorId = "outdoor";
          activeBuilding = null;
          updateInteract();
          if (promptObj?.kind !== "story") throw new Error("No story prompt " + siteId);
          doInteract();
        },
        flushDialog: () => {
          let guard = 30;
          while (DL.active && guard-- > 0) advanceDialog();
          if (guard <= 0) throw new Error("Dialog did not finish");
        },
        craftCrossbow: () => qEvent("craft", { id: "crossbow" }),
        firstRoute: () => ({
          killGoal: mainQuest().goals.find(([goal]) => goal === "kills")?.[1],
          zombies: Z.filter((zombie) => zombie.storyEncounter).length,
          targets: Q.targets.map((target) => {
            const point = storyInteractionPosition(target),
              building = OSM_CITY.buildings.get(target.wayId),
              distance = Math.min(...building.openings.filter((opening) => opening.kind === "door").map((opening) => Math.hypot(point.x - opening.x, point.y - opening.y)));
            return { siteId: target.siteId, distance };
          }),
        }),
        defeatFirstEncounter: () => {
          for (const zombie of [...Z])
            if (zombie.storyEncounter) hurtZ(zombie, 999);
          return stats.kills;
        },
        openSchool: () => {
          if (panelOpen()) closePanel();
          openCamp(CAMPS.get("camp_school"));
        },
        close: () => closePanel(),
        saveAndLoad: () => {
          saveGame();
          return { loaded: loadGame(), ...window.__storyTest.snapshot() };
        },
        prepareTravel: () => {
          Q.main = 2;
          Q.prog = {};
          setupMain();
          ensureStarterVehicle();
          const car = CARS.get("starter:residential");
          P.x = car.x;
          P.y = car.y;
          P.inCar = car.id;
          car.fuel = 30;
          tod = 12;
          openMap();
          return { x: P.x, y: P.y, tod, fuel: car.fuel };
        },
        travelSnapshot: () => {
          const car = CARS.get(P.inCar);
          const target = storyTravelTarget();
          return {
            state,
            carId: car?.id,
            x: P.x,
            y: P.y,
            carX: car?.x,
            carY: car?.y,
            fuel: car?.fuel,
            tod,
            target,
            distance: target ? Math.hypot(P.x - target.x, P.y - target.y) / 16 : null,
          };
        },
      };
${marker}`;
    if (!source.includes(marker))
      throw new Error("Story driver marker not found");
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
}

test("новая история m1–m6: диалоги, спасение, ветка и загрузка", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await installStoryDriver(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(
    () => window.__storyTest?.snapshot().state === "play",
  );

  const route = await page.evaluate(() => window.__storyTest.firstRoute());
  expect(route.killGoal).toBe(3);
  expect(route.zombies).toBe(3);
  for (const target of route.targets)
    expect(target.distance).toBeCloseTo(12, 1);

  for (const siteId of ["parents", "friend", "girlfriend"]) {
    await page.evaluate((id) => {
      window.__storyTest.interact(id);
      window.__storyTest.flushDialog();
    }, siteId);
    if (siteId === "friend") {
      await expect(page.locator("#dlgChoices")).toBeVisible();
      await page.locator("#dlgChoices button").nth(1).click();
      await page.evaluate(() => window.__storyTest.flushDialog());
      expect(
        await page.evaluate(() => window.__storyTest.snapshot().friendHelp),
      ).toBe("refused");
    }
  }
  expect(
    await page.evaluate(() => window.__storyTest.defeatFirstEncounter()),
  ).toBe(3);
  expect(await page.evaluate(() => window.__storyTest.snapshot().quest)).toBe(
    "m2",
  );

  for (const siteId of ["bartender", "gunstore"]) {
    await page.evaluate((id) => {
      window.__storyTest.interact(id);
      window.__storyTest.flushDialog();
    }, siteId);
  }
  expect(
    await page.evaluate(() => window.__storyTest.snapshot().crossbowLearned),
  ).toBe(true);
  await expect(page.locator("#qHint")).toContainText("B — построить верстак");
  await page.evaluate(() => window.__storyTest.craftCrossbow());
  expect(await page.evaluate(() => window.__storyTest.snapshot().quest)).toBe(
    "m3",
  );

  await page.evaluate(() => {
    window.__storyTest.interact("work");
    window.__storyTest.flushDialog();
  });
  expect(await page.evaluate(() => window.__storyTest.snapshot().quest)).toBe(
    "m4",
  );
  await page.evaluate(() => {
    window.__storyTest.interact("police");
    window.__storyTest.flushDialog();
    window.__storyTest.openSchool();
    window.__storyTest.close();
  });
  expect(await page.evaluate(() => window.__storyTest.snapshot().quest)).toBe(
    "m5",
  );

  for (const siteId of ["school_medicine", "school_food", "school_rescue"]) {
    await page.evaluate((id) => {
      window.__storyTest.interact(id);
      window.__storyTest.flushDialog();
    }, siteId);
  }
  expect(
    await page.evaluate(
      () => window.__storyTest.snapshot().story.rescue.status,
    ),
  ).toBe("travelling");
  expect(
    await page.evaluate(() => window.__storyTest.snapshot().npcs),
  ).not.toContain("rescue");
  await page.evaluate(() => window.__storyTest.openSchool());
  const school = await page.evaluate(() => window.__storyTest.snapshot());
  expect(school.quest).toBe("m6");
  expect(school.story.rescue.status).toBe("resident");
  expect(school.camp.residents).toEqual(["school_rescue"]);
  await page.getByRole("button", { name: "Построить дозорную вышку" }).click();
  await page.evaluate(() => {
    window.__storyTest.flushDialog();
    window.__storyTest.close();
  });
  expect(await page.evaluate(() => window.__storyTest.snapshot().quest)).toBe(
    "m7",
  );

  const loaded = await page.evaluate(() => window.__storyTest.saveAndLoad());
  expect(loaded.loaded).toBe(true);
  expect(loaded.main).toBe(6);
  expect(loaded.story.branches.school).toBe("watch");
  expect(loaded.camp.branch).toBe("watch");
  expect(loaded.camp.proj.tower).toBeGreaterThan(0);
  expect(loaded.camp.residents).toEqual(["school_rescue"]);
  expect(errors).toEqual([]);
});

test("быстрое путешествие на большой карте двигает машину и расходует ресурсы", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await installStoryDriver(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(
    () => window.__storyTest?.snapshot().state === "play",
  );
  await page.evaluate(() => window.__storyTest.prepareTravel());
  await expect(page.locator("#btnStoryTravel")).toBeEnabled();
  const before = await page.evaluate(() => window.__storyTest.travelSnapshot());
  await page.locator("#btnStoryTravel").click();
  const after = await page.evaluate(() => window.__storyTest.travelSnapshot());
  expect(after.state).toBe("play");
  expect(after.carId).toBe(before.carId);
  expect(after.carX).toBe(after.x);
  expect(after.carY).toBe(after.y);
  expect(after.x).not.toBe(before.x);
  expect(after.fuel).toBeLessThan(before.fuel);
  expect(after.tod).toBeGreaterThan(before.tod);
  expect(after.distance).toBeLessThan(2500);
  expect(errors).toEqual([]);
});
