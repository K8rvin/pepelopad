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
