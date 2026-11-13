import { test, expect } from "@playwright/test";

test("улучшение лагеря, поставка по поручению и сохранение", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const { createSaveData } = await import("/src/persistence/saveSchema.js");
    const { SKILLS } = await import("/src/data/skills.js");
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
        x: 1980,
        y: 2016,
        r: 5,
        hp: 120,
        st: 100,
        hu: 100,
        armor: 0,
        xp: 0,
        lvl: 1,
        sp: 0,
        skills: Object.fromEntries(SKILLS.map((skill) => [skill.id, 0])),
        aim: 0,
        weapon: "bow",
        owned: { bow: true },
        mags: { bow: 0 },
        flash: true,
      },
      inv: [
        { id: "wood", n: 50 },
        { id: "scrap", n: 50 },
        { id: "seeds", n: 12 },
        { id: "elec", n: 6 },
        { id: "cloth", n: 12 },
        { id: "chem", n: 8 },
        { id: "medkit", n: 6 },
        { id: "can", n: 9 },
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
      CARS: new Map(),
      CAMPS: new Map([
        [
          "camp_bridge",
          {
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
          },
        ],
      ]),
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
  await expect(page.locator("#campInfo")).toContainText("Лагерь «Мост»");

  await page.locator("#campList button").filter({ hasText: "Стены" }).click();
  await expect(page.locator("#campInfo")).toContainText("доверие 3");
  await expect(
    page.locator("#campList button").filter({ hasText: "Стены ур.1" }),
  ).toBeVisible();

  await page
    .locator("#campList button")
    .filter({ hasText: "Взять поручение" })
    .click();
  await expect(page.locator("#questList")).toContainText(
    "Лагерь «Мост»: Тушёнка",
  );
  await page
    .locator("#campList button")
    .filter({ hasText: "×3" })
    .first()
    .click();
  await expect(page.locator("#toasts")).toContainText("ЗАДАНИЕ ВЫПОЛНЕНО");
  await expect(page.locator("#campInfo")).toContainText("доверие 9");
  await expect(page.locator("#questList")).not.toContainText(
    "Лагерь «Мост»: Тушёнка",
  );

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#btnToMenu").click();
  await page.reload();
  await page.locator("#btnContinue").click();
  await expect(page.locator("#promptT")).toContainText("Лагерь «Мост»");
  await page.keyboard.press("e");
  await expect(page.locator("#campInfo")).toContainText("доверие 9");
  await expect(
    page.locator("#campList button").filter({ hasText: "Стены ур.1" }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ashfall_v4_city")),
  );
  expect(saved.camps[0][1].proj.wall).toBe(1);
  expect(saved.camps[0][1].trust).toBe(9);
  expect(errors).toEqual([]);
});
