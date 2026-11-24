// Сжатие кадров персонажей (этап 46): runtime рисует актёра высотой
// 78·zoom·scale·runK px (zoom до 2 по Z; кадры ходока используют также
// громила scale 1.28 и Матка 1.6). Ресурс = 2× максимального экранного
// размера при zoom 2 — запас ≥2× для всех типов, ≥3× для ходок/бегуна.
// ЕДИНЫЙ множитель на персонажа от самого высокого канваса: относительный
// масштаб кадров и линия ступней (низ канваса, якорь GAITS) сохраняются.
// Исходники остаются в assets-src/generated; обновляется runtimeSize.
// Использование: node scripts/optimize_frames.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GEN = path.join(ROOT, "public", "assets", "gen");
const SRC = path.join(ROOT, "assets-src", "generated");

// targetH = 2× макс. экранной высоты при zoom 2:
// zombie: 78·2·1.6 (Матка) = 249.6 → 500; runner: 78·2·0.92·1.06 = 152.1 → 320
const GROUPS = {
  zombie: {
    frames: [
      "zombie",
      "zombie_walk",
      "zombie_hurt",
      "zombie_fall",
      "zombie_attack",
    ],
    targetH: 500,
  },
  runner: {
    frames: [
      "runner",
      "runner_walk",
      "runner_hurt",
      "runner_fall",
      "runner_attack",
    ],
    targetH: 320,
  },
  brute: {
    frames: ["brute", "brute_walk", "brute_hurt", "brute_fall", "brute_attack"],
    targetH: 400,
  },
  matka: {
    frames: [
      "matka",
      "matka_walk",
      "matka_hurt",
      "matka_fall",
      "matka_attack",
      ...Array.from({ length: 8 }, (_, i) => `matka_walk_${i}`),
    ],
    targetH: 500,
  },
};

const dims = (file) => {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), buf };
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [group, { frames, targetH }] of Object.entries(GROUPS)) {
  const maxH = Math.max(
    ...frames.map((id) => dims(path.join(GEN, id + ".png")).h),
  );
  const k = targetH / maxH;
  if (k >= 1) {
    console.log(`${group}: канвасы уже компактнее цели ${targetH}, пропуск`);
    continue;
  }
  for (const id of frames) {
    const file = path.join(GEN, id + ".png");
    const { w, h, buf } = dims(file);
    const before = buf.length;
    const newW = Math.max(1, Math.round(w * k));
    const newH = Math.max(1, Math.round(h * k));
    const out = await page.evaluate(
      async ({ base64, newW, newH }) => {
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
        g.drawImage(img, 0, 0, newW, newH);
        return c.toDataURL("image/png").split(",")[1];
      },
      { base64: buf.toString("base64"), newW, newH },
    );
    fs.writeFileSync(file, Buffer.from(out, "base64"));
    const after = fs.statSync(file).size;
    // GPT-кадры: gpt_<id>_v1; стойка ходока: zombie_v1 (без префикса)
    const metaPath = [
      path.join(SRC, `gpt_${id}_v1.png.json`),
      path.join(SRC, `${id}_v1.png.json`),
    ].find((p) => fs.existsSync(p));
    if (metaPath) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      meta.runtimeSize = [newW, newH];
      meta.processing = { ...meta.processing, optimizedForScreen: targetH };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
    }
    console.log(
      `${id}: ${(before / 1048576).toFixed(2)} МиБ → ${(after / 1024).toFixed(0)} КиБ (${newW}x${newH})`,
    );
  }
}
await browser.close();
