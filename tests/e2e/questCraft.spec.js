import { test, expect } from "@playwright/test";

test("m2 требует чертёж и сборку арбалета", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__questCraftTest = {
        lootGunstore: () => {
          Q.main = 1;
          setupMain();
          const block = OSM_PROJECTION.blockForSite("gunstore"),
            container = planBlock(block.bx, block.by).containers[0];
          searching = {
            o: { ...container, looted: false },
            t: 0,
            dur: 0,
          };
          finishSearch();
          return { main: Q.main, hint: $("qHint").textContent, blueprint: learned.has("crossbow") };
        },
        craftCrossbow: () => {
          doCraft(RECIPES.find((recipe) => recipe.id === "crossbow"));
          return { main: Q.main, owned: !!P.owned.crossbow };
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const looted = await page.evaluate(() =>
    window.__questCraftTest.lootGunstore(),
  );
  expect(looted.main).toBe(1);
  expect(looted.blueprint).toBe(true);
  expect(looted.hint).toContain("Собери арбалет на верстаке");
  const crafted = await page.evaluate(() =>
    window.__questCraftTest.craftCrossbow(),
  );
  expect(crafted.main).toBe(2);
  expect(crafted.owned).toBe(true);
  expect(errors).toEqual([]);
});
