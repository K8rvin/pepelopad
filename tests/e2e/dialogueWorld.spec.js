import { test, expect } from "@playwright/test";

async function startGame(page, driver) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    await route.fulfill({
      response,
      body: source.replace(marker, `${driver}\n${marker}`),
    });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  return errors;
}

test("городской диалог печатается и продолжается по Space и E без удара", async ({
  page,
}) => {
  const errors = await startGame(
    page,
    `window.__dialogTest = {
      hits: 0,
      done: false,
      start: () => {
        const originalMelee = melee;
        melee = () => { window.__dialogTest.hits++; originalMelee(); };
        say([{ who: "ТЕСТ", text: "Первая реплика" }, { text: "Вторая реплика" }], () => { window.__dialogTest.done = true; });
      },
    };`,
  );
  await page.evaluate(() => window.__dialogTest.start());
  await expect(page.locator("#dlgText")).toContainText("Первая реплика");
  await page.keyboard.press("Space");
  await expect(page.locator("#dlgText")).toContainText("Вторая реплика");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog")).toBeHidden();
  expect(await page.evaluate(() => window.__dialogTest.done)).toBe(true);
  expect(await page.evaluate(() => window.__dialogTest.hits)).toBe(0);
  expect(errors).toEqual([]);
});

test("школьная территория не закрывает здания и дороги", async ({ page }) => {
  const errors = await startGame(
    page,
    `window.__schoolRenderTest = () => {
      tod = 12;
      const site = OSM_PROJECTION.worldToGame(OSM_PROJECTION.sites.school5);
      P.x = site.x + 180;
      P.y = site.y + 180;
      cam.x = P.x;
      cam.y = P.y;
      updateBuildingPresence();
      render();
      const chunk = visChunks.find((item) => item.cx === Math.floor(P.x / 256) && item.cy === Math.floor(P.y / 256)),
        pixels = chunk.canvas.getContext("2d").getImageData(0, 0, 256, 256).data,
        colors = new Set();
      for (let index = 0; index < pixels.length; index += 4)
        colors.add(String(pixels[index]) + "," + String(pixels[index + 1]) + "," + String(pixels[index + 2]));
      return { colors: colors.size, floor: currentFloorId };
    };`,
  );
  const result = await page.evaluate(() => window.__schoolRenderTest());
  expect(result.floor).toBe("outdoor");
  expect(result.colors).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
