// Обработка кадра ходьбы survivor (GPT-генерация пользователя) без Python:
// headless Chrome + canvas, семантика как в process_gpt_assets.py для character
// (clean alpha <4→0 / 254→255, bbox threshold 16, padding 24, высота 512).
// Высота 512 и padding 24 совпадают с survivor.png → общий якорь ступней.
// Запуск: node scripts/process_walk_frame.mjs <путь к исходнику> [asset id]
// id: survivor_walk (профиль) | survivor_walk_front (к камере) |
//     survivor_walk_back (от камеры); по умолчанию survivor_walk
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const ID = process.argv[3] || "survivor_walk";
const SRC =
  process.argv[2] ||
  path.join(ROOT, "tmp", "Странствующий мужчина в потёртой одежде.png");
const REF = path.join(ROOT, "public", "assets", "gen", "survivor.png");
const OUT = path.join(ROOT, "public", "assets", "gen", ID + ".png");
const SRC_COPY = path.join(ROOT, "assets-src", "generated", `gpt_${ID}_v1.png`);
const PROMPTS = {
  survivor_walk:
    "Тот же персонаж, что на референсе survivor.png, середина шага в профиль: левая нога впереди с пятки, правая сзади на носке, руки в противофазе; полный рост, прозрачный RGBA.",
  survivor_walk_front:
    "Тот же персонаж, что на референсе survivor.png (капюшон, серая куртка, тёмные джинсы, ботинки), тот же фронтальный ракурс/масштаб/освещение; середина шага К камере, руки в противофазе; полный рост, прозрачный RGBA, ступни на базовой линии референса.",
  survivor_walk_back:
    "Тот же персонаж, что на референсе survivor.png, вид со спины (капюшон сзади, плечи, спина куртки); середина шага ОТ камеры, руки в противофазе; полный рост, прозрачный RGBA, ступни на базовой линии референса.",
  survivor_bow_release:
    "Тот же персонаж, что на референсе survivor.png и survivor_bow_draw.png, тот же ракурс/масштаб/освещение; момент отпускания тетивы: струна прямая, кисть правой руки раскрыта у лица, лук в вытянутой левой руке; полный рост, прозрачный RGBA, ступни на базовой линии референса.",
};

const b64 = (p) => fs.readFileSync(p).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ walkB64, refB64 }) => {
    const load = (b64) =>
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = "data:image/png;base64," + b64;
      });
    const walk = await load(walkB64);
    const ref = await load(refB64);
    const stats = (im) => {
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let transparent = 0;
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const a = d[(y * c.width + x) * 4 + 3];
          if (a < 8) transparent++;
          if (a >= 16) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      return {
        size: [im.width, im.height],
        corners: [
          d[3],
          d[(c.width - 1) * 4 + 3],
          d[(c.height - 1) * c.width * 4 + 3],
          d[((c.height - 1) * c.width + c.width - 1) * 4 + 3],
        ],
        transparentPct: +((100 * transparent) / (c.width * c.height)).toFixed(2),
        bbox: [x0, y0, x1 + 1, y1 + 1],
      };
    };
    const walkStats = stats(walk);
    const refStats = stats(ref);
    // clean alpha + crop + scale до высоты 512 (как survivor)
    const c = document.createElement("canvas");
    c.width = walk.width;
    c.height = walk.height;
    const g = c.getContext("2d");
    g.drawImage(walk, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < id.data.length; i += 4) {
      if (id.data[i] < 4) id.data[i] = 0;
      else if (id.data[i] === 254) id.data[i] = 255;
    }
    g.putImageData(id, 0, 0);
    const [bx0, by0, bx1, by1] = walkStats.bbox;
    const pad = 24;
    const cx0 = Math.max(0, bx0 - pad),
      cy0 = Math.max(0, by0 - pad),
      cx1 = Math.min(c.width, bx1 + pad),
      cy1 = Math.min(c.height, by1 + pad);
    const cw = cx1 - cx0,
      ch = cy1 - cy0;
    const H = 512;
    const W = Math.max(1, Math.round((cw * H) / ch));
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const og = out.getContext("2d");
    og.imageSmoothingEnabled = true;
    og.imageSmoothingQuality = "high";
    og.drawImage(c, cx0, cy0, cw, ch, 0, 0, W, H);
    return {
      walkStats,
      refStats,
      runtimeSize: [W, H],
      dataUrl: out.toDataURL("image/png"),
    };
  },
  { walkB64: b64(SRC), refB64: b64(REF) },
);
await browser.close();

fs.writeFileSync(OUT, Buffer.from(result.dataUrl.split(",")[1], "base64"));
fs.copyFileSync(SRC, SRC_COPY);
const meta = {
  id: ID,
  source: "GPT",
  prompt: PROMPTS[ID] || PROMPTS.survivor_walk,
  originalImport: "tmp/" + path.basename(SRC),
  createdAt: new Date(fs.statSync(SRC).mtime).toISOString(),
  sha256: crypto.createHash("sha256").update(fs.readFileSync(SRC_COPY)).digest("hex"),
  originalSize: result.walkStats.size,
  runtime: `public/assets/gen/${ID}.png`,
  runtimeSize: result.runtimeSize,
  processing: {
    alphaBelow4Removed: true,
    alpha254PromotedTo255: true,
    cropThreshold: 16,
    padding: 24,
    height: 512,
    pipeline: "scripts/process_walk_frame.mjs (headless Chrome canvas, no Python on host)",
  },
  notes:
    ID === "survivor_bow_release"
      ? "Кадр отпускания тетивы после выстрела (струна прямая, кисть раскрыта); показывается кратко по combat.releaseT, якорь ступней и масштаб как у survivor_bow_draw."
      : ID === "survivor_walk"
        ? "Ракурс профиля вправо отличается от фронтального survivor.png; используется как покадровый вариант F/G в лаборатории походки, зеркаление в рантайме даёт противоположный шаг."
        : "Кадр шага для вертикального хода варианта G: front — к камере (S), back — от камеры (W); кроссфейд со стойкой survivor.png.",
};
fs.writeFileSync(SRC_COPY + ".json", JSON.stringify(meta, null, 2) + "\n");
console.log("walk:", JSON.stringify(result.walkStats));
console.log("ref:", JSON.stringify(result.refStats));
console.log("runtime:", result.runtimeSize.join("x"), "->", OUT);