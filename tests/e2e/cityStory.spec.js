import { test, expect } from "@playwright/test";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  await page.evaluate(() => {
    const c = window.__city;
    c.quests.states = { m01: "active" };
    c.quests.stages = { m01: 0 };
    if (!c.quests.done.includes("m00")) c.quests.done.push("m00");
    c.campaign.sync();
  });
  return errors;
}

async function object(page, id) {
  await page.evaluate((id) => {
    const c = window.__city;
    const o = c.interactions.objects.find((o) => o.id === id);
    c.teleport(o.x, o.y + 1.2);
  }, id);
  await page.waitForTimeout(550);
}

async function npc(page, id) {
  await page.evaluate((id) => {
    const c = window.__city;
    const n = c.npcs.find((n) => n.id === id);
    c.teleport(n.x, n.y + 0.8);
  }, id);
  await page.waitForTimeout(100);
}

test("«Последний список»: пролог, Олег, рация, спасение Нины и сейв", async ({
  page,
}) => {
  const errors = await boot(page);
  await object(page, "gas_door");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1000);
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m01))
    .toBe(2);
  expect(
    await page.evaluate(
      () =>
        window.__city.city.zombies.filter((z) => z.questGroup === "gas_rescue")
          .length,
    ),
  ).toBe(3);
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++)
      window.__city.campaign.event("kill", { group: "gas_rescue" });
  });
  await npc(page, "oleg");
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 3; i++) await page.keyboard.press("KeyE");
  await page.locator("#dlg button").last().click();
  await object(page, "gas_battery");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1000);
  await object(page, "gas_radio");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1000);
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("m01")),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__city.story.clues.includes("mark_radio")),
  ).toBe(true);

  await page.evaluate(() => {
    const c = window.__city;
    const s = c.survivors.find((s) => s.id === "nina");
    c.teleport(s.x, s.y + 0.8);
  });
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 2; i++) await page.keyboard.press("KeyE");
  await page.locator("#dlg button").click();
  await page.evaluate(() => {
    const c = window.__city;
    const camp = c.camps.find((c) => c.id === "motel");
    const s = c.survivors.find((s) => s.id === "nina");
    c.teleport(camp.x, camp.y);
    s.x = camp.x + 1;
    s.y = camp.y + 1;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__city.survivors.find((s) => s.id === "nina").state,
      ),
    )
    .toBe("rescued");
  await npc(page, "gromov");
  await page.keyboard.press("KeyE");
  for (let i = 0; i < 2; i++) await page.keyboard.press("KeyE");
  await page.locator("#dlg button").first().click();
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("m02")),
  ).toBe(true);

  await page.evaluate(() => window.__city.save());
  await page.goto("/?nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("m02")),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.__city.survivors.find((s) => s.id === "nina").state,
    ),
  ).toBe("rescued");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pepelopad_city_v6")).v,
    ),
  ).toBe(6);
  expect(errors).toEqual([]);
});
