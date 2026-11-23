import { test, expect } from "@playwright/test";

async function boot(page, main = "m03", stage = 0) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  await page.evaluate(
    ({ main, stage }) => {
      const c = window.__city;
      const defs = c.campaign.context().questDefs;
      c.quests.states = { [main]: "active" };
      c.quests.stages = { [main]: stage };
      c.quests.done = defs
        .filter((q) => q.kind === "main" && q.id < main)
        .map((q) => q.id);
      c.story.flags.oleg_free = true;
      const nina = c.survivors.find((s) => s.id === "nina");
      nina.state = "rescued";
      nina.campId = "motel";
      const motel = c.camps.find((camp) => camp.id === "motel");
      if (!motel.rescued.includes("nina")) motel.rescued.push("nina");
      c.campaign.sync();
    },
    { main, stage },
  );
  return errors;
}

async function give(page, items) {
  await page.evaluate((items) => {
    const inv = window.__city.inv;
    for (const [id, n] of Object.entries(items)) {
      const index = inv.slots.findIndex((s) => !s);
      inv.slots[index] = { id, n };
    }
  }, items);
}

async function object(page, id, wait = 1200) {
  await page.evaluate((id) => {
    const c = window.__city;
    const o = c.interactions.objects.find((o) => o.id === id);
    c.teleport(o.x, o.y + 0.8);
  }, id);
  await page.waitForTimeout(100);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(wait);
}

async function talk(page, id, choice = null) {
  await page.evaluate((id) => {
    const c = window.__city;
    const n = c.npcs.find((n) => n.id === id);
    c.teleport(n.x, n.y + 0.8);
  }, id);
  await page.keyboard.press("KeyE");
  const lines = await page.evaluate(
    () => window.__city.campaign.dialogue.conversation?.lines.length || 0,
  );
  for (let i = 1; i < lines; i++) await page.keyboard.press("KeyE");
  const buttons = page.locator("#dlg button");
  if (choice !== null && (await buttons.count()))
    await buttons.nth(choice).click();
  else if (lines) await page.keyboard.press("KeyE");
}

test("мотель: материалы, ремонт, собственный номер и сохранение", async ({
  page,
}) => {
  const errors = await boot(page, "m03");
  await give(page, { wood: 12, scrap: 10, part: 3, fuel: 4 });
  await talk(page, "victor", 0);
  await object(page, "motel_barricade", 1800);
  await object(page, "motel_emergency_cache");
  await object(page, "motel_generator", 1800);
  await talk(page, "irina");
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("m03")),
  ).toBe(true);
  expect(await page.evaluate(() => window.__city.story.home.unlocked)).toBe(
    true,
  );
  await object(page, "home_crate", 200);
  await expect(page.locator("#ui")).toContainText("Номер Дэна");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__city.save());
  await page.goto("/?nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(await page.evaluate(() => window.__city.story.home.unlocked)).toBe(
    true,
  );
  expect(
    await page.evaluate(() => window.__city.story.flags.generator_repaired),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("побочное спасение: Толя освобождён, следует и становится жителем", async ({
  page,
}) => {
  const errors = await boot(page, "m04");
  await page.evaluate(() =>
    window.__city.campaign.executeEffects({ startQuest: "s_tolya" }),
  );
  await object(page, "market_laundry");
  await page.evaluate(() => {
    const c = window.__city;
    const s = c.survivors.find((s) => s.id === "tolya");
    c.teleport(s.x, s.y + 0.7);
  });
  await page.keyboard.press("KeyE");
  await page.evaluate(() => {
    const c = window.__city;
    const container = c.loot.containers.find(
      (item) => item.id === "gas_training_wood",
    );
    const s = c.survivors.find((s) => s.id === "tolya");
    c.teleport(container.x, container.y + 0.8);
    s.x = container.x + 0.4;
    s.y = container.y + 0.6;
  });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__city.ui.isLoot());
  expect(
    await page.evaluate(
      () => window.__city.survivors.find((s) => s.id === "tolya").state,
    ),
  ).toBe("following");
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyG");
  expect(
    await page.evaluate(
      () => window.__city.survivors.find((s) => s.id === "tolya").state,
    ),
  ).toBe("waiting");
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__city.ui.isLoot());
  expect(
    await page.evaluate(
      () => window.__city.survivors.find((s) => s.id === "tolya").state,
    ),
  ).toBe("waiting");
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyG");
  await page.evaluate(() => {
    const c = window.__city;
    const camp = c.camps.find((camp) => camp.id === "park");
    const s = c.survivors.find((s) => s.id === "tolya");
    c.teleport(camp.x, camp.y);
    s.x = camp.x + 1;
    s.y = camp.y + 1;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__city.survivors.find((s) => s.id === "tolya").state,
      ),
    )
    .toBe("rescued");
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("s_tolya")),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__city.camps
        .find((c) => c.id === "park")
        .rescued.includes("tolya"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("осада, три волны, открытый финал, эпилог и послевыгровое сохранение", async ({
  page,
}) => {
  const errors = await boot(page, "m15", 2);
  await object(page, "motel_siege_start");
  expect(await page.evaluate(() => window.__city.siege.active)).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__city.city.zombies.some(
        (z) => !z.dead && z.questGroup === "motel_siege_1",
      ),
    ),
  ).toBe(true);
  for (let wave = 1; wave <= 3; wave++) {
    await page.evaluate((wave) => {
      const c = window.__city;
      for (const z of c.city.zombies)
        if (z.questGroup === `motel_siege_${wave}`) z.dead = true;
      c.campaign.update(0.05, false);
      if (wave < 3) c.campaign.update(21, false);
    }, wave);
  }
  expect(await page.evaluate(() => window.__city.quests.states.m16)).toBe(
    "active",
  );
  await object(page, "motel_final_list");
  await talk(page, "gromov", 0);
  await expect(page.locator("#epilogue")).toBeVisible();
  await expect(page.locator("#epilogue")).toContainText("Открытые ворота");
  await page.locator("#epilogueContinue").click();
  expect(await page.evaluate(() => window.__city.story.ending)).toBe("open");
  await page.evaluate(() => window.__city.save());
  await page.goto("/?nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(await page.evaluate(() => window.__city.story.ending)).toBe("open");
  expect(await page.evaluate(() => window.__city.siege.finished)).toBe(true);
  expect(errors).toEqual([]);
});
