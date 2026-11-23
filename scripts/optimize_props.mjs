// Сжатие тяжёлых props-ассетов: runtime рисует их шириной 30–66 px,
// исходники были 1000+ px и весили мегабайты. Ресайз до 4× экранной ширины
// (запас на zoom) с перекодированием PNG; метаданные runtimeSize обновляются.
// Использование: node scripts/optimize_props.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GEN = path.join(ROOT, "public", "assets", "gen");
const SRC = path.join(ROOT, "assets-src", "generated");
// id → экранная ширина при zoom 1 (renderer.js); ресурс = 4×
const TARGETS = { barrel: 30, tires: 48, bench: 66, dumpster: 66 };

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [id, screenW] of Object.entries(TARGETS)) {
  const file = path.join(GEN, id + ".png");
  const before = fs.statSync(file).size;
  const base64 = fs.readFileSync(file).toString("base64");
  const out = await page.evaluate(
    async ({ base64, width }) => {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = "data:image/png;base64," + base64;
      });
      if (img.width <= width)
        return { png: null, w: img.width, h: img.height };
      const c = document.createElement("canvas");
      c.width = width;
      c.height = Math.max(1, Math.round((width * img.height) / img.width));
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      return { png: c.toDataURL("image/png").split(",")[1], w: c.width, h: c.height };
    },
    { base64, width: screenW * 4 },
  );
  if (out.png) fs.writeFileSync(file, Buffer.from(out.png, "base64"));
  const after = fs.statSync(file).size;
  // старые props пришли без префикса gpt_ — поддерживаем оба имени метаданных
  const metaPath = [
    path.join(SRC, `gpt_${id}_v1.png.json`),
    path.join(SRC, `${id}_v1.png.json`),
  ].find((p) => fs.existsSync(p));
  if (metaPath) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    meta.runtimeSize = [out.w, out.h];
    meta.processing = { ...meta.processing, optimizedForScreen: screenW * 4 };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  }
  console.log(
    `${id}: ${(before / 1048576).toFixed(2)} МиБ → ${(after / 1024).toFixed(0)} КиБ (${out.w}x${out.h})`,
  );
}
await browser.close();