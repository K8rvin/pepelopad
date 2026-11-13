import { test, expect } from "@playwright/test";

test("деревья и камни создаются только на земле вне зданий", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__worldGenerationCheck = () => {
        const invalid = [];
        for (let bx = -8; bx <= 8; bx++)
          for (let by = -8; by <= 8; by++) {
            const plan = planBlock(bx, by);
            for (const prop of plan.props) {
              if (pavedAt(prop.x, prop.y)) invalid.push([plan.k, "paved", prop]);
              if (!buildingFits(plan.buildings, prop.x, prop.y, 1, 1, 0))
                invalid.push([plan.k, "building", prop]);
            }
          }
        return invalid;
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#seedInp").fill("terrain-check");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  expect(await page.evaluate(() => window.__worldGenerationCheck())).toEqual([]);
  expect(errors).toEqual([]);
});
