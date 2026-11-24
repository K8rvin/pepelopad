// Визуальный контроль кадров персонажей (этап 46): спавнит все четыре типа
// рядом с игроком и снимает экран при zoom 2 (дефолт) и zoom 1 (Z).
// Использование: node scripts/capture_frames.mjs <before|after> [url]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const tag = process.argv[2] || "shot";
const url = process.argv[3] || "http://127.0.0.1:5173";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".cache");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url + "/?new=1&intro=0");
await page.waitForFunction(() => window.__city?.spawn, null, {
  timeout: 30000,
});
await page.evaluate(() => {
  const c = window.__city;
  c.spawn(c.player.x + 3, c.player.y, "walker");
  c.spawn(c.player.x + 4.5, c.player.y, "runner");
  c.spawn(c.player.x + 6, c.player.y, "brute");
  c.spawn(c.player.x - 3, c.player.y, "boss");
  c.alertNear(c.player.x + 4, c.player.y, 8);
});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, `frames_zoom2_${tag}.png`) });
await page.keyboard.press("KeyZ");
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, `frames_zoom1_${tag}.png`) });
await browser.close();
console.log(`saved .cache/frames_zoom2_${tag}.png, frames_zoom1_${tag}.png`);
