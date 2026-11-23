import { test, expect } from "@playwright/test";

test("загрузка: полоска с этапами доходит до 100% и исчезает", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  // логируем этапы и прогресс до того, как boot() удалит оверлей
  await page.addInitScript(() => {
    window.__loadLog = { stages: [], maxPct: 0 };
    const start = () => {
      const root = document.getElementById("loading");
      if (!root) return;
      // querySelector по корню работает и после detach — финальные 100% видны
      const read = () => {
        const sub = root.querySelector("#loadSub");
        const pct = root.querySelector("#loadPct");
        if (sub) {
          const t = sub.textContent;
          if (window.__loadLog.stages.at(-1) !== t)
            window.__loadLog.stages.push(t);
        }
        if (pct)
          window.__loadLog.maxPct = Math.max(
            window.__loadLog.maxPct,
            parseInt(pct.textContent, 10) || 0,
          );
      };
      new MutationObserver(read).observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      read();
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", start);
    else start();
  });
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);
  await expect(page.locator("#loading")).toHaveCount(0);

  const log = await page.evaluate(() => window.__loadLog);
  expect(log.maxPct).toBe(100);
  expect(log.stages).toContain("Строим здания и дороги…");
  expect(log.stages).toContain("Сажаем деревья и зажигаем фонари…");
  expect(
    log.stages.some((s) =>
      [
        "Красим асфальт и стены…",
        "Поднимаем мертвецов из могил…",
        "Фотографируем выживших…",
      ].includes(s),
    ),
  ).toBe(true);
  expect(log.stages.at(-1)).toBe("Район проснулся. Удачи!");
  expect(errors).toEqual([]);
});
