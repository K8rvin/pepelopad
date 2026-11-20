import { test, expect } from "@playwright/test";

test("навыки: панель P, XP от действий, рюкзак от Силы, сейв v4", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.skills);

  // панель персонажа: 4 характеристики + 7 навыков
  await page.keyboard.press("KeyP");
  await expect(page.locator("#ui .panel.wide h3").first()).toHaveText(
    "Характеристики",
  );
  await expect(page.locator("#ui .skill-row")).toHaveCount(11);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ui")).toBeHidden();

  // ходьба даёт XP атлетики
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyW");
  const ath = await page.evaluate(
    () => window.__city.skills.skills.athletics.xp,
  );
  expect(ath).toBeGreaterThan(0);

  // повышения через реальный gainXp: уровни и модификаторы пересчитываются
  await page.evaluate(() => window.__city.gainXp("archery", 500));
  const arch = await page.evaluate(
    () => window.__city.skills.skills.archery.level,
  );
  expect(arch).toBeGreaterThanOrEqual(3);

  // Сила растит рюкзак (+1 слот за 2 уровня выше старта)
  await page.evaluate(() => window.__city.gainXp("crafting", 4000));
  const carry = await page.evaluate(() => ({
    str: window.__city.skills.attrs.strength.level,
    slots: window.__city.inv.size,
  }));
  expect(carry.str).toBeGreaterThan(2);
  expect(carry.slots).toBe(24 + Math.floor((carry.str - 2) / 2));

  // сейв v4 переживает перезагрузку (без ?new=1)
  await page.evaluate(() => window.__city.save());
  const v = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pepelopad_city_v4")).v,
  );
  expect(v).toBe(4);
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.skills);
  const after = await page.evaluate(() => ({
    arch: window.__city.skills.skills.archery.level,
    str: window.__city.skills.attrs.strength.level,
    slots: window.__city.inv.size,
    hpMax: window.__city.combat.playerMaxHp,
  }));
  expect(after.arch).toBe(arch);
  expect(after.str).toBe(carry.str);
  expect(after.slots).toBe(carry.slots);
  expect(after.hpMax).toBe(100); // выносливость не качали — макс. HP базовый
  expect(errors).toEqual([]);
});
