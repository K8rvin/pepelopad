import { test, expect } from "@playwright/test";

test("полировка: меню, HUD, карта, журнал, иконки, смерть, настройки", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));

  // чистый контекст (нет сейва) → титульный экран
  await page.goto("/?intro=0");
  await page.waitForFunction(() => window.__city);
  await expect(page.locator("#menu")).toBeVisible();
  await expect(page.locator("#menu h1")).toContainText("МЁРТВЫЙ РАЙОН");
  await page.locator("#mNew").click();
  await expect(page.locator("#menu")).toBeHidden();

  // HUD: полоски HP и сытости, отладка скрыта по умолчанию
  await expect(page.locator("#hud .hudbar.hp")).toBeVisible();
  await expect(page.locator("#hud .hudbar.food")).toBeVisible();
  await expect(page.locator("#debug")).toBeHidden();
  await page.keyboard.press("F3");
  await expect(page.locator("#debug")).toBeVisible();
  await page.keyboard.press("F3");
  await expect(page.locator("#debug")).toBeHidden();

  // миникарта и большая карта
  await expect(page.locator("#minimap")).toBeVisible();
  await page.keyboard.press("KeyM");
  await expect(page.locator("#bigmap")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#bigmap")).toBeHidden();

  // журнал с текущим квестом
  await page.keyboard.press("KeyJ");
  await expect(page.locator("#ui .journal")).toBeVisible();
  await expect(page.locator("#ui .journal")).toContainText("Первые правила");
  await page.keyboard.press("Escape");
  await expect(page.locator("#ui")).toBeHidden();

  // иконки предметов — img, не эмодзи
  await page.keyboard.press("KeyI");
  await expect(page.locator("#ui .slot img.ic").first()).toBeVisible();
  await page.keyboard.press("Escape");

  // звук разблокирован жестом (running или suspended — без ошибок)
  const audioState = await page.evaluate(() => window.__city.audio.state);
  expect(["running", "suspended"]).toContain(audioState);

  // смерть: экран со статистикой и ценой; возрождение по R списывает четверть стрел
  const arrowsBefore = await page.evaluate(() =>
    window.__city.inv.slots.reduce(
      (a, s) => a + (s && s.id === "arrow" ? s.n : 0),
      0,
    ),
  );
  await page.evaluate(() => window.__city.die());
  await expect(page.locator("#death")).toBeVisible();
  await expect(page.locator(".death-panel h2")).toContainText("ТЫ ПОГИБ");
  await expect(page.locator(".death-lost")).toBeVisible();
  await page.keyboard.press("KeyR");
  await expect(page.locator("#death")).toBeHidden();
  const arrowsAfter = await page.evaluate(() =>
    window.__city.inv.slots.reduce(
      (a, s) => a + (s && s.id === "arrow" ? s.n : 0),
      0,
    ),
  );
  expect(arrowsAfter).toBeLessThan(arrowsBefore);
  expect(await page.evaluate(() => window.__city.stats.deaths)).toBe(1);

  // настройки сохраняются через перезагрузку
  await page.keyboard.press("Escape");
  await page.locator("#pSettings").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.evaluate(() => {
    const inp = document.querySelector('#settings input[data-set="master"]');
    inp.value = 30;
    inp.dispatchEvent(new Event("input"));
  });
  await page.locator("#setBack").click();
  await page.reload();
  await page.waitForFunction(() => window.__city);
  expect(await page.evaluate(() => window.__city.settings.master)).toBeCloseTo(
    0.3,
    2,
  );
  // совместимый сейв → сразу в игру, без титульного экрана
  await expect(page.locator("#menu")).toBeHidden();

  expect(errors).toEqual([]);
});
