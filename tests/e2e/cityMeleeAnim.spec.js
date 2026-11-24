import { test, expect } from "@playwright/test";

test("анимация удара: оружие в руке по дуге, лаборатория F7 переключает", async ({
  page,
}) => {
  await page.goto("/?new=1&intro=0");
  await page.waitForFunction(() => window.__city?.spawn, null, {
    timeout: 30000,
  });
  expect(await page.evaluate(() => window.__city.getMeleeStyle())).toBe(
    "weapon",
  );
  await page.evaluate(() => {
    window.__city.give("knife", 1);
    window.__city.give("bat", 1);
  });
  const swingShot = async (path) => {
    await page.mouse.move(900, 300);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.screenshot({ path });
    await page.mouse.up();
    await page.waitForTimeout(350);
  };
  await page.keyboard.press("Digit3");
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.waitForTimeout(70);
  expect(
    await page.evaluate(() => window.__city.combat.swingWeapon),
  ).toBe("knife");
  await page.screenshot({ path: ".cache/melee_knife.png" });
  await page.mouse.up();
  await page.waitForTimeout(350);
  await page.keyboard.press("Digit2");
  await swingShot(".cache/melee_bat.png");
  expect(
    await page.evaluate(() => window.__city.combat.swingWeapon),
  ).toBe("bat");
  await page.keyboard.press("F7");
  expect(await page.evaluate(() => window.__city.getMeleeStyle())).toBe("arc");
  await swingShot(".cache/melee_arc.png");
  await page.keyboard.press("F7");
  expect(await page.evaluate(() => window.__city.getMeleeStyle())).toBe(
    "weapon",
  );
});
