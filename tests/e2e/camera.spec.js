import { test, expect } from "@playwright/test";

test("скорость отдаляет камеру, опции вращения и minimap сохраняются", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__cameraTest = {
        drive: () => {
          Z.length = 0;
          const car = CARS.get("starter:residential");
          P.x = car.x;
          P.y = car.y;
          P.inCar = car.id;
          car.angle = 0.3;
          car.speed = vehicleDefinition(car.type).maxSpeed;
          for (let index = 0; index < 12; index++) update(0.05);
          const moving = { zoom: cam.zoom, rotation: cam.rotation, mapRotation: cam.mapRotation };
          const world = { x: P.x + 120, y: P.y - 80 },
            screen = w2s(world.x, world.y),
            restored = screenToWorld(screen.x, screen.y);
          saveGame();
          loadGame();
          const options = { ...OPTIONS };
          P.inCar = null;
          for (let index = 0; index < 40; index++) update(0.05);
          return {
            moving,
            options,
            roundTrip: Math.hypot(world.x - restored.x, world.y - restored.y),
            stopped: { zoom: cam.zoom, rotation: cam.rotation, mapRotation: cam.mapRotation },
          };
        },
      };
${marker}`;
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseOv")).toBeVisible();
  await page.locator("#rotateCamera").check();
  await page.locator("#rotateMinimap").check();
  await page.keyboard.press("Escape");
  const result = await page.evaluate(() => window.__cameraTest.drive());
  expect(result.moving.zoom).toBeLessThan(0.95);
  expect(Math.abs(result.moving.rotation)).toBeGreaterThan(0.1);
  expect(Math.abs(result.moving.mapRotation)).toBeGreaterThan(0.1);
  expect(result.roundTrip).toBeLessThan(0.001);
  expect(result.options).toEqual({
    rotateCamera: true,
    rotateMinimap: true,
  });
  expect(result.stopped.zoom).toBeGreaterThan(0.99);
  expect(Math.abs(result.stopped.rotation)).toBeLessThan(0.01);
  expect(Math.abs(result.stopped.mapRotation)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});
