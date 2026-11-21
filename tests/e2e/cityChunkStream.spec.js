import { test, expect } from "@playwright/test";

test("телепорт не фризит: запечка чанков стримится с бюджетом кадра", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1");
  await page.waitForFunction(() => window.__city?.peek);
  await page.waitForTimeout(600); // прогрев стартовых чанков

  const stats = await page.evaluate(
    () =>
      new Promise((res) => {
        const c = window.__city;
        c.teleport(900, 900); // далеко от спавна: все чанки новые
        const samples = [];
        let n = 0;
        const tick = () => {
          samples.push(c.frameMs());
          if (++n < 45) requestAnimationFrame(tick);
          else {
            const sorted = [...samples].sort((a, b) => a - b);
            res({
              max: Math.max(...samples),
              median: sorted[sorted.length >> 1],
              queue: c.bakeQueueSize(),
              chunks: c.R.chunkCache.size,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  // синхронный фриз запечки устранён: ни одного многокадрового стопора
  // (было ~107 мс), типичный кадр остаётся плавным
  expect(stats.max).toBeLessThan(40);
  expect(stats.median).toBeLessThan(16);
  expect(stats.chunks).toBeGreaterThan(9);
  await page.screenshot({ path: ".cache/chunk_stream_mid.png" });
  await page.waitForFunction(() => window.__city.bakeQueueSize() === 0, null, {
    timeout: 8000,
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: ".cache/chunk_stream_full.png" });
  expect(errors).toEqual([]);
});
