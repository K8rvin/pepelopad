// Замер холодной загрузки игры: свежий браузерный контекст без кэша и storage.
// Использование: node scripts/measure_load.mjs [url] [runs]
// По умолчанию: http://localhost:5173/?new=1, 1 прогон.
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:5173/?new=1";
const runs = Number(process.argv[3]) || 1;

async function measure() {
  const browser = await chromium.launch();
  const context = await browser.newContext(); // чистый профиль: без кэша/cookies/storage
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const wall0 = Date.now();
  await page.goto(url, { waitUntil: "commit", timeout: 120000 });
  // время от timeOrigin (начало навигации) до исчезновения #loading
  const readyMs = await page.evaluate(
    () =>
      new Promise((res, rej) => {
        const deadline = performance.now() + 120000;
        const poll = () => {
          if (window.__city && !document.getElementById("loading"))
            return res(performance.now());
          if (performance.now() > deadline)
            return rej(new Error("timeout: игра не загрузилась"));
          requestAnimationFrame(poll);
        };
        poll();
      }),
  );
  const wallMs = Date.now() - wall0;
  await page.waitForTimeout(300); // добрать запоздавшие ответы
  const stats = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const rs = performance.getEntriesByType("resource").map((e) => ({
      name: e.name.split("/").pop().split("?")[0],
      type: e.initiatorType,
      bytes: e.transferSize || e.encodedBodySize || 0,
      ms: Math.round(e.duration),
    }));
    return {
      nav: n
        ? {
            domContentLoaded: Math.round(n.domContentLoadedEventEnd),
            loadEvent: Math.round(n.loadEventEnd),
            docBytes: n.transferSize || 0,
          }
        : null,
      resources: rs,
    };
  });
  await browser.close();

  const byType = {};
  let totalBytes = stats.nav ? stats.nav.docBytes : 0;
  for (const r of stats.resources) {
    byType[r.type] = byType[r.type] || { count: 0, bytes: 0 };
    byType[r.type].count++;
    byType[r.type].bytes += r.bytes;
    totalBytes += r.bytes;
  }
  const slowest = [...stats.resources].sort((a, b) => b.ms - a.ms).slice(0, 5);
  return {
    readyMs: Math.round(readyMs),
    wallMs,
    nav: stats.nav,
    count: stats.resources.length,
    totalBytes,
    byType,
    slowest,
    errors,
  };
}

const mib = (b) => (b / 1048576).toFixed(2);
for (let i = 0; i < runs; i++) {
  const r = await measure();
  console.log(`\n=== Прогон ${i + 1}/${runs}: ${url} ===`);
  console.log(
    `Готовность игры (от начала навигации): ${r.readyMs} мс (wall ${r.wallMs} мс)`,
  );
  if (r.nav)
    console.log(
      `DOMContentLoaded: ${r.nav.domContentLoaded} мс · load event: ${r.nav.loadEvent} мс`,
    );
  console.log(`Запросов: ${r.count} · передано: ${mib(r.totalBytes)} МиБ`);
  for (const [t, v] of Object.entries(r.byType).sort(
    (a, b) => b[1].bytes - a[1].bytes,
  ))
    console.log(`  ${t}: ${v.count} шт, ${mib(v.bytes)} МиБ`);
  console.log("Самые долгие запросы:");
  for (const s of r.slowest)
    console.log(`  ${s.ms} мс · ${mib(s.bytes)} МиБ · ${s.name}`);
  if (r.errors.length) {
    console.log(`ОШИБКИ (${r.errors.length}):`);
    for (const e of r.errors.slice(0, 5)) console.log("  " + e);
  } else console.log("Ошибок консоли/страницы: нет");
}