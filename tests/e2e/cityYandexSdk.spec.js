import { test, expect } from "@playwright/test";

function mockSdk(page) {
  return page.addInitScript(() => {
    if (window.__yandexCalls) return;
    window.__yandexCalls = {
      ready: 0,
      start: 0,
      stop: 0,
      setData: [],
      scores: [],
    };
    const calls = window.__yandexCalls;
    const player = {
      data: null,
      async setData(data) {
        calls.setData.push(data);
        this.data = data;
      },
      async getData() {
        return this.data;
      },
    };
    window.__yandexPlayer = player;
    window.YaGames = {
      init: async () => ({
        features: {
          LoadingAPI: { ready: () => calls.ready++ },
          GameplayAPI: {
            start: () => calls.start++,
            stop: () => calls.stop++,
          },
        },
        getPlayer: async () => player,
        getLeaderboards: async () => ({
          setLeaderboardScore: async (id, score) => {
            calls.scores.push([id, score]);
          },
        }),
      }),
    };
  });
}

test("без YaGames игра загружается и сохраняется локально", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.route("**/games/sdk/v2", (route) => route.fulfill({ body: "" }));
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(() => window.__city?.campaign);
  await page.evaluate(() => window.__city.save());
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pepelopad_city_v6")).v,
    ),
  ).toBe(6);
  expect(errors).toEqual([]);
});

test("SDK: ready/gameplay, облачный сейв и лидерборды", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.route("**/games/sdk/v2", (route) => route.fulfill({ body: "" }));
  await mockSdk(page);
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(await page.evaluate(() => window.__yandexCalls.ready)).toBeGreaterThan(
    0,
  );
  await expect
    .poll(() => page.evaluate(() => window.__yandexCalls.start))
    .toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__yandexCalls.stop))
    .toBeGreaterThan(0);
  await page.locator("#pContinue").click();
  expect(await page.evaluate(() => window.__yandexCalls.start)).toBeGreaterThan(
    1,
  );

  await page.evaluate(() => {
    const c = window.__city;
    c.combat.kills = 7;
    c.survival.day = 4;
    c.save();
  });
  await page.waitForFunction(() => window.__yandexCalls.setData.length > 0);
  const packed = await page.evaluate(() => window.__yandexCalls.setData.at(-1));
  expect(packed.format).toBe("gzip-v1");
  await page.evaluate(() => window.__city.die());
  await expect
    .poll(() => page.evaluate(() => window.__yandexCalls.scores.length))
    .toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.__yandexCalls.scores)).toEqual([
    ["survival_days", 4],
    ["zombie_kills", 7],
  ]);

  await page.evaluate(() => localStorage.clear());
  await page.goto("/?nb=9");
  await page.waitForFunction(() => window.__city?.campaign);
  expect(
    await page.evaluate(() => ({
      day: window.__city.survival.day,
      kills: window.__city.combat.kills,
    })),
  ).toEqual({ day: 4, kills: 7 });
  expect(errors).toEqual([]);
});
