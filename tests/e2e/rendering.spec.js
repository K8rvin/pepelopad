import { test, expect } from "@playwright/test";

test("зомби рисуется на экране с логическим размером спрайта", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__zombieRenderCheck = () => {
        Z.length = 0;
        P.x = 64;
        P.y = 64;
        cam.x = P.x;
        cam.y = P.y;
        spawnZ("walker", P.x + 70, P.y);
        const stats = { draws: 0, sizes: [] };
        const original = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
          if (image === S.walker) {
            stats.draws++;
            stats.sizes.push([image.width, image.height]);
          }
          return original.call(this, image, ...args);
        };
        window.__zombieRenderStats = stats;
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  await page.evaluate(() => window.__zombieRenderCheck());
  await page.waitForFunction(() => window.__zombieRenderStats.draws > 0);
  const stats = await page.evaluate(() => window.__zombieRenderStats);
  expect(stats.draws).toBeGreaterThan(0);
  expect(stats.sizes.every(([w, h]) => w === 12 && h === 14)).toBe(true);
  expect(errors).toEqual([]);
});
