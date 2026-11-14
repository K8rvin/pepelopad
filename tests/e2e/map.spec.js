import { test, expect } from "@playwright/test";

async function startWithMapDriver(page) {
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__mapTest = {
        snapshot: () => ({ ...mapController.getState(), state, floor: currentFloorId }),
        target: () => questTargetWorld(),
        showStreet: () => {
          const way = OSM_CITY.gameWorld.wayById.get(35844144),
            a = way.points[0],
            b = way.points[1];
          P.x = (a[0] + b[0]) / 2;
          P.y = (a[1] + b[1]) / 2;
          updateBuildingPresence();
          drawMinimap();
          return way.tags.name;
        },
        enter: () => {
          const block = OSM_PROJECTION.blockForSite("hospital"),
            building = OSM_CITY.specials.get(K(block.bx, block.by)).building;
          P.x = (building.bounds.minX + building.bounds.maxX) / 2;
          P.y = (building.bounds.minY + building.bounds.maxY) / 2;
          updateBuildingPresence();
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
}

test("большая карта: zoom, pan и пользовательская метка", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await startWithMapDriver(page);
  await page.locator("#mmap").click();
  await expect(page.locator("#mapOv")).toBeVisible();
  const before = await page.evaluate(() => window.__mapTest.snapshot());
  const canvas = page.locator("#bmap");
  await canvas.hover();
  await page.mouse.wheel(0, -120);
  await expect
    .poll(
      async () => (await page.evaluate(() => window.__mapTest.snapshot())).zoom,
    )
    .toBeGreaterThan(before.zoom);

  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 70,
    box.y + box.height / 2 + 40,
    {
      steps: 5,
    },
  );
  await page.mouse.up();
  const panned = await page.evaluate(() => window.__mapTest.snapshot());
  expect(panned.center.x).not.toBe(before.center.x);
  expect(panned.center.y).not.toBe(before.center.y);

  await canvas.click({ position: { x: 160, y: 180 } });
  const marked = await page.evaluate(() => window.__mapTest.snapshot());
  expect(marked.waypoint).not.toBeNull();
  await page.keyboard.press("m");
  expect((await page.evaluate(() => window.__mapTest.target())).label).toBe(
    "Метка",
  );

  await page.locator("#mmap").click();
  await canvas.click({ button: "right", position: { x: 160, y: 180 } });
  expect(
    (await page.evaluate(() => window.__mapTest.snapshot())).waypoint,
  ).toBeNull();
  expect(errors).toEqual([]);
});

test("карта внутри здания переключает этажи и возвращается в игру", async ({
  page,
}) => {
  await startWithMapDriver(page);
  await page.evaluate(() => window.__mapTest.enter());
  await page.keyboard.press("m");
  await expect(page.locator("#mapFloorNav")).toBeVisible();
  await expect(page.locator("#mapFloorName")).toHaveText("Первый этаж");
  await page.locator("#mapFloorNext").click();
  await expect(page.locator("#mapFloorName")).toHaveText("Второй этаж");
  await page.locator("#mapFloorNext").click();
  await expect(page.locator("#mapFloorName")).toHaveText("Подвал");
  await page.keyboard.press("m");
  const restored = await page.evaluate(() => window.__mapTest.snapshot());
  expect(restored.state).toBe("play");
  expect(restored.floor).toBe("ground");
});

test("миникарта показывает название улицы при наведении", async ({ page }) => {
  await startWithMapDriver(page);
  const street = await page.evaluate(() => window.__mapTest.showStreet());
  await page.locator("#mmap").hover();
  await expect(page.locator("#mmapHint")).toBeVisible();
  await expect(page.locator("#mmapHint")).toHaveText(street);
});
