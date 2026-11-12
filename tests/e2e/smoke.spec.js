import { test, expect } from "@playwright/test";

const watchErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

const closeInitialDialog = async (page) => {
  for (let i = 0; i < 12; i++) {
    if (await page.locator("#dialog").isHidden()) return;
    await page.locator("#dialog").click();
    await page.waitForTimeout(60);
  }
  await expect(page.locator("#dialog")).toBeHidden();
};

test("пролог показывает подсказку и обрабатывает один клик диалога", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await closeInitialDialog(page);

  await page.keyboard.down("w");
  await page.waitForTimeout(2450);
  await page.keyboard.up("w");

  await expect(page.locator("#prompt")).toBeVisible();
  await expect(page.locator("#promptT")).toContainText("окно");
  await page.keyboard.press("e");
  await page.locator("#dialog").click();
  await expect(page.locator("#dlgText")).toContainText("Свет над городом");
  await expect(page.locator("#dlgText")).not.toContainText("На проспекте");
  expect(errors).toEqual([]);
});

test("крафт и все вкладки открываются без ошибок JavaScript", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForTimeout(900);
  await page.keyboard.press("c");

  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("#craftList .craftRow")).toHaveCount(25);

  for (const tab of [
    "inv",
    "skill",
    "quest",
    "base",
    "camp",
    "trunk",
    "log",
    "craft",
  ]) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("костёр и ассеты загружаются в браузере", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const loaded = await page.evaluate(() =>
    Promise.all(
      [
        "/assets/effects/campfire.gif",
        "/assets/effects/arrow.gif",
        "/assets/effects/small-explosion.png",
        "/assets/sprites/player.png",
        "/assets/sprites/walker.png",
        "/assets/sprites/elec.png",
      ].map(
        (src) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = src;
          }),
      ),
    ),
  );
  expect(loaded).toEqual([true, true, true, true, true, true]);
  const frameCount = await page.evaluate(async () => {
    const response = await fetch("/assets/effects/small-explosion.json");
    const metadata = await response.json();
    return metadata.frames.length;
  });
  expect(frameCount).toBe(163);
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForTimeout(900);
  expect(errors).toEqual([]);
});
