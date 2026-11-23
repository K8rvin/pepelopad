import { test, expect } from "@playwright/test";

test("лагерь: панель E, пожертвование, бартер, сейв переживает перезагрузку", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.camps);

  // подходим к школьному лагерю и открываем панель
  await page.evaluate(() => {
    const c = window.__city;
    const camp = c.camps.find((k) => k.id === "school");
    c.teleport(camp.x + 1, camp.y + 2);
    // ресурсы для пожертвования и бартера
    c.inv.slots[0] = { id: "wood", n: 2 };
    c.inv.slots[1] = { id: "cloth", n: 2 };
  });
  await page.keyboard.press("KeyE");
  await expect(page.locator("#dlg")).toContainText("Вера");
  await page.keyboard.press("KeyE");
  await page.locator("#dlg button").click();
  await expect(page.locator("#ui .panel.wide h3").first()).toContainText(
    "Школьный лагерь",
  );

  // пожертвование дерева → +1 доверия
  await page.locator('button[data-camp="donate"][data-id="wood"]').click();
  const trust1 = await page.evaluate(
    () => window.__city.camps.find((k) => k.id === "school").trust,
  );
  expect(trust1).toBe(1);

  // бартер: бинт за 2 ткани
  await page.locator('button[data-camp="buy"][data-i="0"]').click();
  const meds = await page.evaluate(
    () => window.__city.inv.slots.filter((s) => s && s.id === "meds").length,
  );
  expect(meds).toBeGreaterThan(0);

  // сейв и перезагрузка: доверие и склад на месте
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__city.save());
  await page.goto("/");
  await page.waitForFunction(() => window.__city?.camps);
  const trust2 = await page.evaluate(
    () => window.__city.camps.find((k) => k.id === "school").trust,
  );
  expect(trust2).toBe(1);
  expect(errors).toEqual([]);
});
