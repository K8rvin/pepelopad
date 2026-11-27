import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = process.argv[2];
const ID = process.argv[3];
if (!SRC || !ID) {
  console.error("usage: node scripts/process_icons.mjs <src.png> <item-id>");
  process.exit(1);
}

const KEY = `icon_${ID}`;
const OUT = path.join(ROOT, "public", "assets", "gen", `${KEY}.png`);
const COPY = path.join(ROOT, "assets-src", "generated", `gpt_${KEY}_v1.png`);
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async (srcB64) => {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${srcB64}`;
  });
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const ctx = source.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;
  let transparent = 0;
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      const alpha = pixels.data[i + 3];
      if (alpha < 4) pixels.data[i + 3] = 0;
      else if (alpha >= 250) pixels.data[i + 3] = 255;
      if (alpha < 8) transparent++;
      if (alpha < 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  if (maxX <= minX || maxY <= minY) throw new Error("no visible pixels");
  ctx.putImageData(pixels, 0, 0);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const scale = Math.min(224 / cw, 224 / ch, 1);
  const out = document.createElement("canvas");
  out.width = 256;
  out.height = 256;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  outCtx.drawImage(
    source,
    minX,
    minY,
    cw,
    ch,
    Math.round((256 - w) / 2),
    Math.round((256 - h) / 2),
    w,
    h,
  );
  return {
    originalSize: [image.width, image.height],
    transparentPct: +(
      (100 * transparent) /
      (source.width * source.height)
    ).toFixed(2),
    dataUrl: out.toDataURL("image/png"),
  };
}, fs.readFileSync(SRC).toString("base64"));
await browser.close();

fs.writeFileSync(OUT, Buffer.from(result.dataUrl.split(",")[1], "base64"));
fs.copyFileSync(SRC, COPY);
const metadata = {
  id: KEY,
  source: "GPT",
  prompt:
    "Square isometric game inventory icon, single item, clear silhouette, transparent RGBA, no text, border, ground or shadow.",
  originalImport: `tmp/${path.basename(SRC)}`,
  createdAt: new Date(fs.statSync(SRC).mtime).toISOString(),
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(COPY))
    .digest("hex"),
  originalSize: result.originalSize,
  runtime: `public/assets/gen/${KEY}.png`,
  runtimeSize: [256, 256],
  processing: {
    pipeline: "scripts/process_icons.mjs",
    cropThreshold: 16,
    contentMax: 224,
    canvas: [256, 256],
  },
};
fs.writeFileSync(`${COPY}.json`, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(
  "icon:",
  JSON.stringify({
    id: KEY,
    transparentPct: result.transparentPct,
    runtimeSize: [256, 256],
  }),
);
