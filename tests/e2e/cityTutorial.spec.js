import { test, expect } from "@playwright/test";

test("обучение на АЗС: лут, крафт, пауза, портрет, лук и нож", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(await page.evaluate(() => window.__city.quests.states.m00)).toBe(
    "active",
  );

  // вступление: монолог Дэна с портретом ГГ, мир на паузе
  await expect(page.locator("#dlg")).toBeVisible();
  const introPortrait = page.locator('#dlg img[data-portrait="dan"]');
  await expect(introPortrait).toBeVisible();
  expect(await introPortrait.getAttribute("src")).toContain("portrait_gg.png");
  const introTod = await page.evaluate(() => window.__city.survival.tod);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__city.survival.tod)).toBe(introTod);
  for (let i = 0; i < 4; i++) await page.keyboard.press("KeyE");
  await page.locator("#dlg button").click(); // «К заправке.»
  await expect(page.locator("#dlg")).toBeHidden();

  // старт рядом с АЗС: до двери меньше 30 м
  const startDist = await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((b) => b.poi === "АЗС");
    return Math.hypot(c.player.x - (b.x + b.w / 2), c.player.y - (b.y + b.h));
  });
  expect(startDist).toBeLessThan(30);

  // заваленная дверь: замок на месте, E у двери — подсказка Олега
  expect(
    await page.evaluate(() =>
      window.__city.city.storyLocks.some((l) => l.id === "gas_door"),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((b) => b.poi === "АЗС");
    c.teleport(b.x + (b.doorU ?? Math.round(b.w / 2)), b.y + b.h + 0.8);
  });
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg")).toContainText("Дверь завалена");
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg")).toBeHidden();

  // маркер этапа обыска ведёт к конкретному ящику, а не к зданию
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m00))
    .toBe(1);
  const marker = await page.evaluate(() => {
    const c = window.__city;
    const t = c.campaign.target();
    const crate = c.loot.containers.find((k) => k.id === "gas_training_wood");
    return {
      poi: t?.poi,
      near: t ? Math.hypot(t.x + 0.5 - crate.x, t.y + 0.5 - crate.y) : 99,
    };
  });
  expect(marker.poi).toBe("Столярный ящик");
  expect(marker.near).toBeLessThan(1);

  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find((b) => b.poi === "АЗС");
    c.teleport(b.x + b.w / 2, b.y + b.h + 10);
  });
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m00))
    .toBe(1);

  for (const id of [
    "gas_training_wood",
    "gas_training_blade",
    "gas_training_medical",
  ]) {
    await page.evaluate((id) => {
      const c = window.__city;
      const container = c.loot.containers.find((item) => item.id === id);
      c.teleport(container.x, container.y + 0.8);
    }, id);
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__city.ui.isLoot());
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
  }
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m00))
    .toBe(2);

  await page.keyboard.press("KeyC");
  await expect(page.locator("#ui .loot-row.tutorial")).toHaveCount(3);
  const frozenCraft = await page.evaluate(() => {
    const c = window.__city;
    const z = c.city.zombies.find((z) => !z.dead);
    return { tod: c.survival.tod, hp: c.combat.playerHp, x: z?.x, y: z?.y };
  });
  await page.waitForTimeout(500);
  const afterCraft = await page.evaluate(() => {
    const c = window.__city;
    const z = c.city.zombies.find((z) => !z.dead);
    return { tod: c.survival.tod, hp: c.combat.playerHp, x: z?.x, y: z?.y };
  });
  expect(afterCraft).toEqual(frozenCraft);
  for (const id of ["arrows", "knife", "medkit"])
    await page.locator(`#ui button.craft[data-id="${id}"]`).click();
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m00))
    .toBe(3);
  // цель этапа разговора — заваленная дверь (голос за ней), а не NPC внутри
  expect(await page.evaluate(() => window.__city.campaign.target()?.door)).toBe(
    true,
  );
  await page.keyboard.press("KeyC");

  await page.evaluate(() => {
    const c = window.__city;
    const n = c.npcs.find((n) => n.id === "oleg");
    c.teleport(n.x, n.y + 1.2);
  });
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg")).toBeVisible();
  await expect(page.locator('#dlg img[data-portrait="oleg"]')).toBeVisible();
  expect(
    await page.locator('#dlg img[data-portrait="oleg"]').getAttribute("src"),
  ).toContain("portrait_oleg.png");
  const typography = await page.evaluate(() => ({
    width: document.querySelector("#dlg").getBoundingClientRect().width,
    font: parseFloat(
      getComputedStyle(document.querySelector(".dlg-line")).fontSize,
    ),
    portraitRight:
      document.querySelector(".dlg-portrait").getBoundingClientRect().left >
      document.querySelector(".dlg-main").getBoundingClientRect().left,
  }));
  expect(typography.width).toBeGreaterThan(800);
  expect(typography.font).toBeGreaterThanOrEqual(18);
  expect(typography.portraitRight).toBe(true);
  const frozenTalk = await page.evaluate(() => {
    const c = window.__city;
    const z = c.city.zombies.find((z) => !z.dead);
    return { tod: c.survival.tod, hp: c.combat.playerHp, x: z?.x, y: z?.y };
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__city.survival.tod)).toBe(
    frozenTalk.tod,
  );
  expect(await page.evaluate(() => window.__city.combat.playerHp)).toBe(
    frozenTalk.hp,
  );
  expect(
    await page.evaluate(
      () => window.__city.city.zombies.find((z) => !z.dead).x,
    ),
  ).toBe(frozenTalk.x);
  await page.screenshot({ path: ".cache/tutorial_dialogue.png" });
  for (let i = 0; i < 3; i++) await page.keyboard.press("KeyE");
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.stages.m00))
    .toBe(4);

  await page.evaluate(() => {
    const c = window.__city;
    const target = c.interactions.objects.find(
      (o) => o.id === "gas_practice_target",
    );
    c.teleport(target.x - 4, target.y);
  });
  const beforePractice = await page.evaluate(() => window.__city.survival.tod);
  await page.evaluate(() => {
    const c = window.__city;
    const target = c.interactions.objects.find(
      (o) => o.id === "gas_practice_target",
    );
    const camS = { x: (c.cam.x - c.cam.y) * 32, y: (c.cam.x + c.cam.y) * 16 };
    const aimS = {
      x: (target.x - target.y) * 32,
      y: (target.x + target.y) * 16 - 0.9 * 32,
    };
    window.__tutorialAim = {
      x: (aimS.x - camS.x) * 2 + innerWidth / 2,
      y: (aimS.y - camS.y) * 2 + innerHeight / 2,
    };
  });
  const aim = await page.evaluate(() => window.__tutorialAim);
  await page.mouse.move(aim.x, aim.y);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__city.survival.tod)).toBeGreaterThan(
    beforePractice,
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.__city.quests.progress.m00).some((k) =>
          k.startsWith("practice:bow"),
        ),
      ),
    )
    .toBe(true);

  await page.keyboard.press("Digit3");
  await page.evaluate(() => {
    const c = window.__city;
    const target = c.interactions.objects.find(
      (o) => o.id === "gas_practice_target",
    );
    c.teleport(target.x - 1, target.y);
    const camS = { x: (c.cam.x - c.cam.y) * 32, y: (c.cam.x + c.cam.y) * 16 };
    const aimS = {
      x: (target.x - target.y) * 32,
      y: (target.x + target.y) * 16 - 0.9 * 32,
    };
    window.__tutorialAim = {
      x: (aimS.x - camS.x) * 2 + innerWidth / 2,
      y: (aimS.y - camS.y) * 2 + innerHeight / 2,
    };
  });
  const meleeAim = await page.evaluate(() => window.__tutorialAim);
  await page.mouse.click(meleeAim.x, meleeAim.y);
  await expect
    .poll(() => page.evaluate(() => window.__city.quests.states.m01))
    .toBe("active");
  expect(
    await page.evaluate(() => window.__city.quests.done.includes("m00")),
  ).toBe(true);
  // крупные цветные баннеры: новая миссия, затем празднование завершения
  await expect(page.locator("#levelup .lu-card.quest-new")).toBeVisible();
  await expect(page.locator("#levelup .lu-kind")).toHaveText("НОВОЕ ЗАДАНИЕ");
  await expect(page.locator("#levelup .lu-card.quest-completed")).toBeVisible({
    timeout: 6000,
  });
  expect(errors).toEqual([]);
});

test("портреты: загрузка файлов, Лена→Маша и реплика Дэна→ГГ", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(() => window.__city?.SPRTEX?.portrait_gg);
  expect(
    await page.evaluate(() =>
      ["oleg", "vera", "sanych", "raya", "masha", "gg"].every(
        (id) => window.__city.SPRTEX[`portrait_${id}`]?.naturalWidth > 0,
      ),
    ),
  ).toBe(true);

  await page.evaluate(() => {
    const c = window.__city;
    c.quests.states = { m04: "active" };
    c.quests.stages = { m04: 2 };
    c.campaign.sync();
    const n = c.npcs.find((n) => n.id === "lena");
    c.teleport(n.x, n.y + 0.8);
  });
  await page.keyboard.press("KeyE");
  const lena = page.locator('#dlg img[data-portrait="lena"]');
  await expect(lena).toBeVisible();
  expect(await lena.getAttribute("src")).toContain("portrait_masha.png");
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");

  await page.evaluate(() => {
    const c = window.__city;
    c.quests.states = { m13: "active" };
    c.quests.stages = { m13: 2 };
    c.campaign.sync();
    const n = c.npcs.find((n) => n.id === "mark");
    c.teleport(n.x, n.y + 0.8);
  });
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  const dan = page.locator('#dlg img[data-portrait="dan"]');
  await expect(dan).toBeVisible();
  expect(await dan.getAttribute("src")).toContain("portrait_gg.png");
  expect(errors).toEqual([]);
});
