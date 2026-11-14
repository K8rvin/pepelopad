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
        buildBench: () => {
          addItem("wood", 20, true);
          addItem("scrap", 20, true);
          buildSel = "bench";
          const px = Math.floor(P.x / 16), py = Math.floor(P.y / 16);
          for (let radius = 2; radius <= 6; radius++)
            for (let y = py - radius; y <= py + radius; y++)
              for (let x = px - radius; x <= px + radius; x++) {
                if (solidAt(x, y)) continue;
                tryPlace(x, y);
                if (nearBench()) {
                  buildSel = null;
                  return true;
                }
              }
          buildSel = null;
          return false;
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
  expect(await page.evaluate(() => window.__questCraftTest.buildBench())).toBe(
    true,
  );
  const crafted = await page.evaluate(() =>
    window.__questCraftTest.craftCrossbow(),
  );
  expect(crafted.main).toBe(2);
  expect(crafted.owned).toBe(true);
  expect(errors).toEqual([]);
});
