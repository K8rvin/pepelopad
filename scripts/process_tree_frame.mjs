// Обработка GPT-дерева без Python: headless Chrome + canvas, семантика как в
// process_gpt_assets.py для kind=tree (clean alpha <4→0 / 254→255, bbox threshold 16,
// padding 24, высота 768). Якорь — низ-центр ствола (как у tree_dead/tree_birch).
// Запуск: node scripts/process_tree_frame.mjs <исходник> [id] [outbase]
// id: ключ SPRITE_FILES (по умолчанию tree); outbase: имя runtime-файла (по умолчанию id).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const ID = process.argv[3] || "tree";
const OUTBASE = process.argv[4] || ID;
const SRC = process.argv[2];
if (!SRC) {
  console.error(
    "usage: node scripts/process_tree_frame.mjs <src.png> [id] [outbase]",
  );
  process.exit(1);
}
const OUT = path.join(ROOT, "public", "assets", "gen", OUTBASE + ".png");
const SRC_COPY = path.join(ROOT, "assets-src", "generated", `gpt_${ID}_v1.png`);
const PROMPT =
  process.argv[5] ||
  "Isolated 2D isometric game sprite of a tall poplar in a dead suburb, dark cracked bark, sparse dusty-olive foliage, whole tree from trunk base to crown, transparent RGBA, alpha=0 background and between leaves, no white fringe or pockets, no ground/shadow/text.";

const b64 = (p) => fs.readFileSync(p).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async (srcB64) => {
  const load = (b64) =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = "data:image/png;base64," + b64;
    });
  const src = await load(srcB64);
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1,
    transparent = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const a = id.data[i + 3];
      if (a < 4) id.data[i + 3] = 0;
      else if (a === 254) id.data[i + 3] = 255;
      if (a < 8) transparent++;
      if (a >= 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  g.putImageData(id, 0, 0);
  const pad = 24;
  const cx0 = Math.max(0, x0 - pad),
    cy0 = Math.max(0, y0 - pad),
    cx1 = Math.min(c.width, x1 + 1 + pad),
    cy1 = Math.min(c.height, y1 + 1 + pad);
  const cw = cx1 - cx0,
    ch = cy1 - cy0;
  const H = 768;
  const W = Math.max(1, Math.round((cw * H) / ch));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const og = out.getContext("2d");
  og.imageSmoothingEnabled = true;
  og.imageSmoothingQuality = "high";
  og.drawImage(c, cx0, cy0, cw, ch, 0, 0, W, H);
  return {
    originalSize: [src.width, src.height],
    transparentPct: +((100 * transparent) / (c.width * c.height)).toFixed(2),
    runtimeSize: [W, H],
    dataUrl: out.toDataURL("image/png"),
  };
}, b64(SRC));
await browser.close();

fs.writeFileSync(OUT, Buffer.from(result.dataUrl.split(",")[1], "base64"));
fs.copyFileSync(SRC, SRC_COPY);
const meta = {
  id: ID,
  source: "GPT",
  prompt: PROMPT,
  originalImport: "tmp/" + path.basename(SRC),
  createdAt: new Date(fs.statSync(SRC).mtime).toISOString(),
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(SRC_COPY))
    .digest("hex"),
  originalSize: result.originalSize,
  runtime: `public/assets/gen/${OUTBASE}.png`,
  runtimeSize: result.runtimeSize,
  processing: {
    alphaBelow4Removed: true,
    alpha254PromotedTo255: true,
    cropThreshold: 16,
    padding: 24,
    height: 768,
    pipeline:
      "scripts/process_tree_frame.mjs (headless Chrome canvas, no Python on host)",
  },
  notes:
    "Изолированное дерево; якорь низ-центр ствола, высота 768 как у tree_dead/tree_birch.",
};
fs.writeFileSync(SRC_COPY + ".json", JSON.stringify(meta, null, 2) + "\n");
console.log(
  "tree:",
  JSON.stringify({
    originalSize: result.originalSize,
    transparentPct: result.transparentPct,
    runtimeSize: result.runtimeSize,
  }),
);
console.log("runtime:", result.runtimeSize.join("x"), "->", OUT);
