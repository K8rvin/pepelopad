import { test, expect } from "@playwright/test";

test("районный бонус начисляется один раз и показан на карте", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.locator("#btnToMenu").click();
  await page.evaluate(() => {
    const key = "ashfall_v4_city";
    const save = JSON.parse(localStorage.getItem(key));
    save.P.x = 288;
    save.P.y = 240;
    save.inv = Array(30).fill(null);
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.locator("#btnContinue").click();
  await expect(page.locator("#promptT")).toContainText("Ящик припасов");
  await page.keyboard.press("e");
  await expect(page.locator("#toasts")).toContainText("Обыск:");
  await expect(page.locator("#toasts")).toContainText("Доски");
  await expect(page.locator("#res-wood")).toHaveText("1");

  await page.keyboard.press("e");
  await page.waitForTimeout(1200);
  await expect(page.locator("#res-wood")).toHaveText("1");
  await page.keyboard.press("m");
  await expect(page.locator("#mapDistrict")).toContainText(
    "Рубеж и окрестности",
  );
  await expect(page.locator("#mapDistrict")).toContainText("опасность ×0.5");
  await expect(page.locator("#mapDistrict")).toContainText("Доски, Ткань");
  expect(errors).toEqual([]);
});
