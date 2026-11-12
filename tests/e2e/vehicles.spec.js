import { test, expect } from "@playwright/test";

test("класс машины, поездка, ремонт, багажник и сохранение", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const { createSaveData } = await import("/src/persistence/saveSchema.js");
    const { SKILLS } = await import("/src/data/skills.js");
    const skills = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
    const save = createSaveData({
      seed: 123,
      diff: "easy",
      day: 1,
      tod: 12,
      playT: 0,
      timeSpeed: 1,
      lastSiegeDay: 0,
      siegeWarnDay: 0,
      dead: false,
      gateOpen: false,
      P: {
        x: 226,
        y: 480,
        r: 5,
        hp: 120,
        st: 100,
        hu: 100,
        armor: 0,
        xp: 0,
        lvl: 1,
        sp: 0,
        skills,
        aim: 0,
        weapon: "bow",
        owned: { bow: true },
        mags: { bow: 0 },
        flash: true,
      },
      inv: [
        { id: "wood", n: 5 },
        { id: "repairkit", n: 1 },
        { id: "fuelcan", n: 1 },
      ],
      invSlots: 30,
      hasSpear: false,
      learned: new Set(),
      bench: 1,
      Q: {
        main: 0,
        side: [],
        sideProg: {},
        tracked: "main",
        prog: {},
        given: {},
        endless: false,
        sideSeq: 0,
      },
      baseProj: {
        wall: 0,
        workshop: 0,
        garden: 0,
        tower: 0,
        garage: 0,
        radio: 0,
        clinic: 0,
      },
      OV: new Map(),
      SMAP: new Map(),
      EX: new Set(),
      CARS: new Map([
        [
          "test-truck",
          {
            id: "test-truck",
            type: "truck",
            x: 256,
            y: 480,
            angle: 0,
            fuel: 60,
            hp: 180,
            engineHp: 65,
            tireHp: 70,
            locked: false,
            broken: false,
            dead: false,
            speed: 0,
            trunk: [{ id: "wood", n: 2 }],
          },
        ],
      ]),
      CAMPS: new Map(),
      stats: {
        kills: 0,
        nests: 0,
        pois: 0,
        looted: 0,
        crafted: 0,
        shots: 0,
        sieges: 0,
        calm: 0,
        drive: 0,
        camps: 0,
      },
      J: [],
    });
    localStorage.setItem("ashfall_v4_city", JSON.stringify(save));
  });
  await page.reload();
  await page.locator("#btnContinue").click();
  await page.keyboard.press("e");
  await expect(page.locator("#carHud")).toBeVisible();
  await expect(page.locator("#carName")).toHaveText("Грузовик");
  await expect(page.locator("#carEngine")).toHaveText("65");
  await expect(page.locator("#carTires")).toHaveText("70");

  await page.keyboard.down("w");
  await page.waitForTimeout(800);
  await page.keyboard.up("w");
  expect(Number(await page.locator("#carSpeed").textContent())).toBeGreaterThan(
    0,
  );

  await page.keyboard.press("t");
  await expect(page.locator("#trunkGrid .cell")).toHaveCount(24);
  await page.locator("#trunkInv .cell").first().click();
  await expect(page.locator("#trunkGrid .cell .n")).toHaveText(["2", "5"]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("r");
  await expect(page.locator("#carEngine")).toHaveText("100");
  await expect(page.locator("#carTires")).toHaveText("100");
  await page.keyboard.press("f");
  await expect(page.locator("#toasts")).toContainText("Заправлено +45");

  await page.keyboard.press("Escape");
  await page.locator("#btnToMenu").click();
  await page.reload();
  await page.locator("#btnContinue").click();
  await page.keyboard.press("t");
  await expect(page.locator("#trunkInfo")).toContainText("Грузовик");
  await expect(page.locator("#trunkInfo")).toContainText("двигатель 100%");
  await expect(page.locator("#trunkInfo")).toContainText("колёса 100%");
  await expect(page.locator("#trunkGrid .cell")).toHaveCount(24);
  await expect(page.locator("#trunkGrid .cell .n")).toHaveText(["2", "5"]);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ashfall_v4_city")),
  );
  expect(saved.cars[0][1].engineHp).toBe(100);
  expect(saved.cars[0][1].tireHp).toBe(100);
  expect(errors).toEqual([]);
});
