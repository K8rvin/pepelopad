// Нормализация кадров бегуна по высоте контента к стойке: выпад/атака
// рисовались ниже стойки в том же канвасе и «усаживали» силуэт при беге.
// Канвас расширяется под масштабированный контент (без обрезки выпада),
// низ контента отстоит от низа канваса как у стойки — ступни на одной линии.
// Источник — исходники assets-src/generated, результат — public/assets/gen.
// Использование: node scripts/normalize_runner_frames.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets-src", "generated");
const GEN = path.join(ROOT, "public", "assets", "gen");
const FRAMES = ["runner_walk", "runner_attack"];
const PAD_X = 24,
  PAD_TOP = 24;

const browser = await chromium.launch();
const page = await browser.newPage();
const load = (dir, file) =>
  fs.readFileSync(path.join(dir, file + ".png")).toString("base64");
const measure = async (base64) =>
  page.evaluate(async (base64) => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = "data:image/png;base64," + base64;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width,
      minY = c.height,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] >= 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    return { w: img.width, h: img.height, minX, minY, maxX, maxY };
  }, base64);

const stand = await measure(load(SRC, "gpt_runner_v1"));
const standH = stand.maxY - stand.minY + 1;
const standBottom = stand.h - 1 - stand.maxY;
for (const id of FRAMES) {
  const srcB64 = load(SRC, `gpt_${id}_v1`);
  const f = await measure(srcB64);
  const k = standH / (f.maxY - f.minY + 1);
  const cw = Math.ceil((f.maxX - f.minX + 1) * k);
  const newW = cw + PAD_X * 2;
  const newH = standH + PAD_TOP + standBottom;
  const out = await page.evaluate(
    async ({ base64, k, minX, minY, newW, newH, PAD_X, PAD_TOP }) => {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = "data:image/png;base64," + base64;
      });
      const c = document.createElement("canvas");
      c.width = newW;
      c.height = newH;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.translate(PAD_X - minX * k, PAD_TOP - minY * k);
      g.scale(k, k);
      g.drawImage(img, 0, 0);
      return c.toDataURL("image/png").split(",")[1];
    },
    { base64: srcB64, k, minX: f.minX, minY: f.minY, newW, newH, PAD_X, PAD_TOP },
  );
  fs.writeFileSync(path.join(GEN, id + ".png"), Buffer.from(out, "base64"));
  const metaPath = path.join(SRC, `gpt_${id}_v1.png.json`);
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    meta.runtimeSize = [newW, newH];
    meta.processing = {
      ...meta.processing,
      normalizedToStandContent: true,
      normalizeK: Number(k.toFixed(4)),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  }
  console.log(`${id}: k=${k.toFixed(3)} → ${newW}x${newH}, контент = высоте стойки`);
}
await browser.close();