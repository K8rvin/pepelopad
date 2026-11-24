import { test, expect } from "@playwright/test";

test("постоянная панель цели: этап, прогресс, подсказка действия", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.quests);
  await expect(page.locator("#objective")).toBeVisible();
  await expect(page.locator("#objective .obj-quest")).toHaveText(
    "ПЕРВЫЕ ПРАВИЛА",
  );
  // этап крафта: крупное описание + подсказка C
  await page.evaluate(() => {
    window.__city.quests.stages.m00 = 2;
  });
  await expect(page.locator("#objective .obj-desc")).toContainText("крафт");
  await expect(page.locator("#objective .obj-hint")).toContainText("C — крафт");
  // этап разговора: подсказка E у двери
  await page.evaluate(() => {
    const c = window.__city;
    c.quests.stages.m00 = 3;
    const b = c.city.buildings.find((k) => k.poi === "АЗС");
    c.teleport(b.x + (b.doorU ?? 4), b.y + b.h + 0.8);
  });
  await expect(page.locator("#objective .obj-hint")).toContainText(
    "E — говорить",
  );
  // кампания завершена — панель скрыта
  await page.evaluate(() => {
    const c = window.__city;
    for (const id of Object.keys(c.quests.states))
      c.quests.states[id] = "completed";
  });
  await expect(page.locator("#objective")).toBeHidden();
  expect(errors).toEqual([]);
});

test("панель цели слева сверху; оружие с хоткеями и подсказка практики", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.quests);
  // панель цели — слева сверху, под статусом HUD
  const box = await page.locator("#objective").boundingBox();
  expect(box.x).toBeLessThan(400);
  expect(box.y).toBeLessThan(300);
  // панель оружия: хоткеи 1/2/3, нож пока не сделан
  await expect(page.locator("#hudWeapons")).toContainText("Лук");
  await expect(
    page.locator("#hudWeapons .wep.off").filter({ hasText: "Нож" }),
  ).toHaveCount(1);
  // этап практики: сначала лук (первая незавершённая цель)
  await page.evaluate(() => {
    window.__city.quests.stages.m00 = 4;
  });
  await expect(page.locator("#objective .obj-hint")).toContainText("ЛКМ");
  // лук отработан → подсказка называет клавишу переключения на нож
  await page.evaluate(() => {
    const c = window.__city;
    c.quests.progress.m00["practice:bow:"] = 1;
  });
  await expect(page.locator("#objective .obj-hint")).toContainText("3 — Нож");
  // сделали нож и взяли в руки: строка активна, подсказка — удар
  await page.evaluate(() => {
    const inv = window.__city.inv;
    const i = inv.slots.findIndex((s) => !s);
    inv.slots[i] = { id: "knife", n: 1 };
  });
  await page.keyboard.press("Digit3");
  await expect(
    page.locator("#hudWeapons .wep.on").filter({ hasText: "Нож" }),
  ).toHaveCount(1);
  await expect(page.locator("#objective .obj-hint")).toContainText(
    "ЛКМ — удар по мишени",
  );
  expect(errors).toEqual([]);
});
