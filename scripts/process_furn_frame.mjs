// Обработка GPT-мебели без Python: Chrome canvas, семантика process_gpt_assets.py
// для kind=furniture (clean alpha <4→0 / 254→255, bbox threshold 16, padding 16,
// thumbnail до 512 по большей стороне). Якорь — южный угол footprint (рендер сам).
// Запуск: node scripts/process_furn_frame.mjs <исходник> <id> [outbase]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const ID = process.argv[3];
const OUTBASE = process.argv[4] || ID;
const SRC = process.argv[2];
if (!SRC || !ID) {
  console.error("usage: node scripts/process_furn_frame.mjs <src.png> <id> [outbase]");
  process.exit(1);
}
const OUT = path.join(ROOT, "public", "assets", "gen", OUTBASE + ".png");
const COPY = path.join(ROOT, "assets-src", "generated", `gpt_${ID}_v1.png`);

const b64 = (p) => fs.readFileSync(p).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async (srcB64) => {
  const im = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = "data:image/png;base64," + srcB64;
  });
  const c = document.createElement("canvas");
  c.width = im.width;
  c.height = im.height;
  const g = c.getContext("2d");
  g.drawImage(im, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, transparent = 0;
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
  const pad = 16;
  const cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad);
  const cx1 = Math.min(c.width, x1 + 1 + pad), cy1 = Math.min(c.height, y1 + 1 + pad);
  const cw = cx1 - cx0, ch = cy1 - cy0;
  const k = Math.min(1, 512 / Math.max(cw, ch));
  const W = Math.max(1, Math.round(cw * k)), H = Math.max(1, Math.round(ch * k));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const og = out.getContext("2d");
  og.imageSmoothingEnabled = true;
  og.imageSmoothingQuality = "high";
  og.drawImage(c, cx0, cy0, cw, ch, 0, 0, W, H);
  return {
    originalSize: [im.width, im.height],
    transparentPct: +((100 * transparent) / (c.width * c.height)).toFixed(2),
    runtimeSize: [W, H],
    dataUrl: out.toDataURL("image/png"),
  };
}, b64(SRC));
await browser.close();

fs.writeFileSync(OUT, Buffer.from(result.dataUrl.split(",")[1], "base64"));
fs.copyFileSync(SRC, COPY);
const meta = {
  id: ID,
  source: "GPT",
  prompt:
    "Single isometric furniture sprite, face-forward 3/4 view, transparent RGBA, alpha=0 background and gaps, no white fringe/pockets, no floor/shadow/text.",
  originalImport: "tmp/" + path.basename(SRC),
  createdAt: new Date(fs.statSync(SRC).mtime).toISOString(),
  sha256: crypto.createHash("sha256").update(fs.readFileSync(COPY)).digest("hex"),
  originalSize: result.originalSize,
  runtime: `public/assets/gen/${OUTBASE}.png`,
  runtimeSize: result.runtimeSize,
  processing: {
    pipeline: "scripts/process_furn_frame.mjs",
    alphaBelow4Removed: true,
    cropThreshold: 16,
    padding: 16,
    thumbnailMax: 512,
  },
  notes: "Лицевая мебель; якорь южного угла footprint задаёт рендер.",
};
fs.writeFileSync(COPY + ".json", JSON.stringify(meta, null, 2) + "\n");
console.log(
  "furn:",
  JSON.stringify({ transparentPct: result.transparentPct, runtimeSize: result.runtimeSize }),
);
console.log("runtime:", result.runtimeSize.join("x"), "->", OUT);
