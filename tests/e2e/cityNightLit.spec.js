import { test, expect } from "@playwright/test";

test("ночь: без фриза запечки города, окна загораются стримом", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);
  // встаём южнее дома: фасад и его окна попадают в кадр для визуальной проверки
  await page.evaluate(() => {
    const c = window.__city;
    const b = c.city.buildings.find(
      (b) => b.style === "house" || b.style === "brick",
    );
    c.teleport(b.x + b.w / 2, b.y + b.h + 7);
  });
  await page.waitForTimeout(600); // прогрев дневных фасадов

  const stats = await page.evaluate(
    () =>
      new Promise((res) => {
        const c = window.__city;
        c.setTod(22); // ночь: раньше первый кадр печёт фасады всего города
        const samples = [];
        let n = 0;
        const tick = () => {
          samples.push(c.frameMs());
          if (++n < 60) requestAnimationFrame(tick);
          else {
            const sorted = [...samples].sort((a, b) => a - b);
            res({
              max: Math.max(...samples),
              median: sorted[sorted.length >> 1],
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  // синхронной запечки фасадов всего города в первый ночной кадр нет
  expect(stats.max).toBeLessThan(40);
  expect(stats.median).toBeLessThan(16);
  await page.waitForFunction(() => window.__city.litQueueSize() === 0, null, {
    timeout: 8000,
  });
  // lit-подложка запекается лениво по запросу и доступна рендеру после дренажа
  const bid = await page.evaluate(async () => {
    const c = window.__city;
    const { buildingLitCanvas, buildingSprite } =
      await import("/src/iso/render/buildings.js");
    let best = null,
      bd = Infinity;
    for (const b of c.city.buildings) {
      const d = Math.hypot(
        b.x + b.w / 2 - c.player.x,
        b.y + b.h / 2 - c.player.y,
      );
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    buildingSprite(best); // один фасад явно (здание может быть вне кадра)
    buildingLitCanvas(best); // запрос ставит lit в очередь, если ещё не запечено
    return best.id;
  });
  await page.waitForFunction(() => window.__city.litQueueSize() === 0, null, {
    timeout: 8000,
  });
  expect(
    await page.evaluate(async (bid) => {
      const c = window.__city;
      const { buildingLitCanvas } =
        await import("/src/iso/render/buildings.js");
      return !!buildingLitCanvas(c.city.buildings.find((b) => b.id === bid));
    }, bid),
  ).toBe(true);
  await page.waitForTimeout(200);
  await page.screenshot({ path: ".cache/night_lit.png" });
  expect(errors).toEqual([]);
});
