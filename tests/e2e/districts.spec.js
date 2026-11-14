import { test, expect } from "@playwright/test";

test("районный бонус начисляется один раз и показан на карте", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__districtTest = {
        setup: () => {
          const center = OSM_PROJECTION.blockForSite("residential");
          let container = null;
          for (let radius = 0; radius <= 4 && !container; radius++)
            for (let by = center.by - radius; by <= center.by + radius && !container; by++)
              for (let bx = center.bx - radius; bx <= center.bx + radius && !container; bx++)
                container = planBlock(bx, by).containers.find((item) => item.type === "cache") || planBlock(bx, by).containers[0] || null;
          P.x = container.x * 16 + 8;
          P.y = container.y * 16 + 8;
          updateBuildingPresence();
          updateInteract();
          return { name: contName(container.type), id: container.id };
        },
        looted: () => stats.looted,
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const container = await page.evaluate(() => window.__districtTest.setup());
  await expect(page.locator("#promptT")).toContainText(container.name);
  await page.keyboard.press("e");
  await expect(page.locator("#toasts")).toContainText("Обыск:");
  const looted = await page.evaluate(() => window.__districtTest.looted());
  await page.keyboard.press("e");
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__districtTest.looted())).toBe(
    looted,
  );
  await page.keyboard.press("m");
  await expect(page.locator("#mapDistrict")).toContainText(
    "Краснооктябрьский район",
  );
  await expect(page.locator("#mapDistrict")).toContainText("опасность ×0.9");
  await expect(page.locator("#mapDistrict")).toContainText("Тушёнка, Ткань");
  expect(errors).toEqual([]);
});
