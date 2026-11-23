import { test, expect } from "@playwright/test";

test("багажник: T открывает, клик перекладывает, сейв переживает перезагрузку", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.veh);

  // подходим к исправной машине и садимся
  await page.evaluate(() => {
    const c = window.__city;
    const car = c.city.cars.find((k) => !k.wreck);
    c.teleport(car.x + 2, car.y + 1);
  });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__city.veh.inCar);

  // T — панель багажника: 8 или 12 слотов + рюкзак
  await page.keyboard.press("KeyT");
  await expect(page.locator("#ui .panel.wide h3").first()).toContainText(
    "Багажник",
  );
  const slots = await page.evaluate(() => window.__city.veh.inCar.trunk.size);
  expect([8, 12]).toContain(slots);

  // клик по тушёнке в рюкзаке → стак в багажнике
  const canSlot = await page.evaluate(() =>
    window.__city.inv.slots.findIndex((s) => s && s.id === "can"),
  );
  expect(canSlot).toBeGreaterThanOrEqual(0);
  await page
    .locator(`#ui .slot[data-side="inv"][data-slot="${canSlot}"]`)
    .click();
  const inTrunk = await page.evaluate(
    () =>
      window.__city.veh.inCar.trunk.slots.filter((s) => s && s.id === "can")
        .length,
  );
  expect(inTrunk).toBe(1);
  await page.keyboard.press("KeyT");
  await expect(page.locator("#ui")).toBeHidden();

  // сейв и перезагрузка: багажник на месте
  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.veh);
  await page.keyboard.press("KeyT");
  await expect(page.locator("#ui .panel.wide h3").first()).toContainText(
    "Багажник",
  );
  const after = await page.evaluate(() => {
    const c = window.__city;
    const car = c.city.cars.find((k) => k.trunk);
    return car ? car.trunk.slots.filter((s) => s && s.id === "can").length : 0;
  });
  expect(after).toBe(1);
  expect(errors).toEqual([]);
});
