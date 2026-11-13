import { test, expect } from "@playwright/test";

test("лук попадает по зомби на открытой дороге", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__combatTest = () => {
        Z = [];
        PR = [];
        P.x = 64;
        P.y = 64;
        P.weapon = "bow";
        P.owned.bow = true;
        P.mags.bow = 25;
        P.cd = 0;
        P.rl = 0;
        spawnZ("walker", 144, 64);
        for (let i = 0; i < 600 && stats.kills === 0; i++) {
          const aim = w2s(Z[0]?.x ?? 144, Z[0]?.y ?? 64);
          mouse.x = aim.x;
          mouse.y = aim.y;
          mouse.down = true;
          update(0.05);
        }
        mouse.down = false;
        return { kills: stats.kills, shots: stats.shots, arrows: P.mags.bow };
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const result = await page.evaluate(() => window.__combatTest());
  console.log("COMBAT_PROBE", result);
  expect(result.kills).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
