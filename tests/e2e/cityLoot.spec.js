import { test, expect } from "@playwright/test";

test("обыск: шкала времени, пустые без подсказки, автозакрытие окна", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.peek);

  // пустой контейнер: подсказки обыска нет
  const empty = await page.evaluate(() => {
    const c = window.__city;
    const e = c.loot.containers.find((k) => c.peek(k).length === 0);
    if (!e) return null;
    c.teleport(e.x + 0.5, e.y + 0.5);
    return e.id;
  });
  if (empty) {
    await page.waitForTimeout(300);
    const near = await page.evaluate(() => window.__city.loot.nearest);
    expect(near).toBeNull();
  }

  // непустой контейнер: E → шкала обыска → окно лута
  await page.evaluate(() => {
    const c = window.__city;
    const k = c.loot.containers.find((x) => c.peek(x).length > 0);
    c.teleport(k.x + 0.5, k.y + 0.5);
  });
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__city.search() !== null);
  await expect(page.locator("#ui")).toBeHidden();
  await page.waitForFunction(() => window.__city.search() === null, {
    timeout: 5000,
  });
  await expect(page.locator("#ui .panel h3").first()).toContainText("Обыск");

  // «Взять всё» → окно закрывается (контейнер опустел)
  await page.locator("#takeAll").click();
  await expect(page.locator("#ui")).toBeHidden();
  expect(errors).toEqual([]);
});

test("окно обыска: имя контейнера и хоткеи в названиях кнопок", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.ui?.openLoot);
  await page.evaluate(() => {
    const c = window.__city;
    const k = c.loot.containers.find((x) => x.id === "gas_training_wood");
    // содержимое фиксируется при обыске; эмулируем завершённый обыск
    c.loot.opened.set(k.id, c.peek(k));
    c.ui.openLoot(k);
  });
  await expect(page.locator("#ui .panel h3").first()).toContainText(
    "Столярный ящик",
  );
  await expect(page.locator("#takeAll")).toContainText("Space");
  await expect(page.locator("#ui .loot-row button").first()).toContainText(
    "(E)",
  );
  await expect(page.locator("#ui .hint").last()).toContainText("Space — всё");
  expect(errors).toEqual([]);
});
