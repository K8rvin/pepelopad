import { test, expect } from "@playwright/test";

test("дерево и камень имеют фон земли, машина — прозрачный фон", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__assetAlpha = () => [TI[14], TI[15], S.car_sedan].map((image) => ({
        width: image.width,
        height: image.height,
        corner: [...image.getContext("2d").getImageData(0, 0, 1, 1).data],
      }));
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => window.__assetAlpha);
  const images = await page.evaluate(() => window.__assetAlpha());
  expect(images).toHaveLength(3);
  for (const image of images) expect(image.width).toBeGreaterThan(0);
  for (const image of images.slice(0, 2)) {
    expect(image.corner[3]).toBe(255);
    expect(image.corner.slice(0, 3)).not.toEqual([0, 0, 0]);
  }
  expect(images[2].corner[3]).toBe(0);
  expect(errors).toEqual([]);
});
