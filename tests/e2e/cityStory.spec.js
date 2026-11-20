import { test, expect } from "@playwright/test";

test("история: диалог с выбором у Олега, последствия и сейв", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.story);

  // подходим к Олегу в парковом лагере — открывается история s1
  await page.evaluate(() => {
    const c = window.__city;
    const park = c.camps.find((k) => k.id === "park");
    c.teleport(park.x + 1, park.y + 1);
  });
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg .who")).toHaveText("Записка");

  // листаем реплики до выбора
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg .dlg-choices button")).toHaveCount(2);

  // выбираем «найду её» → доверие парку +6, бит advancing
  await page.locator('#dlg button[data-ci="0"]').click();
  const st = await page.evaluate(() => ({
    i: window.__city.story.i,
    trust: window.__city.camps.find((k) => k.id === "park").trust,
    flag: !!window.__city.story.flags.promised,
  }));
  expect(st.i).toBe(1);
  expect(st.trust).toBe(6);
  expect(st.flag).toBe(true);

  // сейв и перезагрузка: прогресс истории на месте
  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.story);
  const i2 = await page.evaluate(() => window.__city.story.i);
  expect(i2).toBe(1);
  expect(errors).toEqual([]);
});
