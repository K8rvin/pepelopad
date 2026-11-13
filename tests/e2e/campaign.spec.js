import { test, expect } from "@playwright/test";

async function installCampaignDriver(page) {
  await page.route("**/index.html*index=0.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\n      requestAnimationFrame(frame);";
    const driver = `      window.__campaignTest = {
        snapshot: () => ({
          state,
          main: Q.main,
          endless: Q.endless,
          sideCount: Q.side.length,
          quest: mainQuest()?.id || null,
          radio: baseProj.radio,
          radioParts: countItem("radiopart"),
          progress: { ...Q.prog },
        }),
        satisfyCurrentQuest: () => {
          const quest = mainQuest();
          if (!quest) return;
          for (const [goal, target] of quest.goals) {
            const repeat = goal === "nest" || goal === "kills" ? target : 1;
            for (let i = 0; i < repeat; i++) {
              if (goal === "mega") qEvent("nest", { mega: true });
              else if (goal === "nest") qEvent("nest", { tier: 1 });
              else if (goal === "siege") qEvent("siege", {});
              else if (goal === "kills") qEvent("kill", { type: "walker" });
              else if (goal === "drive") qEvent("drive", { m: target });
              else if (goal === "car_repair") qEvent("car", { action: "repair" });
              else if (goal === "camp_talk") qEvent("camp", {});
              else if (goal === "donate") qEvent("donate", { n: target });
              else if (goal === "deliver") qEvent("deliver", {});
              else if (goal === "rescue") qEvent("rescue", {});
              else if (goal.startsWith("project_"))
                qEvent("project", { id: goal.slice(8), level: target });
              else if (goal.startsWith("craft_"))
                qEvent("craft", { id: goal.slice(6) });
              else if (goal.startsWith("bp_")) qEvent("bp", { w: goal.slice(3) });
              else qEvent("loot", { id: goal, n: target });
            }
          }
        },
        saveAndLoad: () => {
          saveGame();
          return { loaded: loadGame(), ...window.__campaignTest.snapshot() };
        },
      };
${marker}`;
    if (!source.includes(marker))
      throw new Error("Campaign driver marker not found");
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
}

test("кампания m1–m10, сохранения и бесконечный режим", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await installCampaignDriver(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(
    () => window.__campaignTest?.snapshot().state === "play",
  );

  for (let chapter = 0; chapter < 10; chapter++) {
    const before = await page.evaluate(() => window.__campaignTest.snapshot());
    expect(before.quest).toBe(`m${chapter + 1}`);
    await page.evaluate(() => window.__campaignTest.satisfyCurrentQuest());

    if (chapter < 9) {
      const after = await page.evaluate(() =>
        window.__campaignTest.saveAndLoad(),
      );
      expect(after.loaded).toBe(true);
      expect(after.state).toBe("play");
      expect(after.main).toBe(chapter + 1);
      expect(after.quest).toBe(`m${chapter + 2}`);
    }
  }

  const ending = await page.evaluate(() => window.__campaignTest.saveAndLoad());
  expect(ending.loaded).toBe(true);
  expect(ending.state).toBe("ending");
  expect(ending.main).toBe(10);
  await expect(page.locator("#endOv")).toBeVisible();
  await expect(page.locator("#endText")).toContainText("Кампания завершена");

  await page.locator("#btnEndless").click();
  const endless = await page.evaluate(() =>
    window.__campaignTest.saveAndLoad(),
  );
  expect(endless.loaded).toBe(true);
  expect(endless.state).toBe("play");
  expect(endless.endless).toBe(true);
  expect(endless.main).toBe(10);
  expect(endless.sideCount).toBe(3);
  await expect(page.locator("#endOv")).toBeHidden();
  expect(errors).toEqual([]);
});
