// Интеграция props-ассетов из tmp/ (png/webp): вырезка фона по alpha,
// обрезка по контенту, ресайз и сохранение в public/assets/gen + assets-src.
// Использование: node scripts/process_props.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROPS = {
  tent_olive: {
    file: "Потрёпанная палатка выжившего.webp",
    width: 512,
    prompt:
      "Isometric dimetric 2:1 two-person ridge camping tent, olive-drab patched tarp, sagging ridgeline, guy ropes with pegs, dark open entrance flap on the south-east face, mud splashes at base, transparent RGBA.",
  },
  tent_tan: {
    file: "Изометрическая палатка с закрытым входом.webp",
    width: 512,
    prompt:
      "The same ridge tent in faded tan/khaki tarp with different patches, entrance closed with rolled-up door tie, same camera angle, transparent RGBA.",
  },
  crate_wood: {
    file: "Потёртый военный деревянный ящик.webp",
    width: 256,
    prompt:
      "Isometric closed wooden supply crate, worn gray-brown planks, rusty steel corner brackets, faded abstract star stencil, rope handles, transparent RGBA.",
  },
  barricade: {
    file: "Изометрическая баррикада из мешков и металла.webp",
    width: 512,
    prompt:
      "Isometric makeshift barricade: stacked sandbags topped with crossed planks and rusty corrugated sheet, long axis along world Y, transparent RGBA.",
  },
  barricade_gate: {
    file: "Изометрическая постапокалиптическая баррикада.webp",
    width: 512,
    prompt:
      "Isometric wide sandbag-and-plank barricade on trestle legs with corrugated top, long axis along world Y, transparent RGBA.",
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [id, def] of Object.entries(PROPS)) {
  const source = path.join(ROOT, "tmp", def.file);
  const base64 = fs.readFileSync(source).toString("base64");
  const mime = def.file.endsWith(".webp") ? "image/webp" : "image/png";
  const result = await page.evaluate(
    async ({ base64, mime, width }) => {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:${mime};base64,` + base64;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      // чистка alpha как в process_gpt_assets.py: <4 → 0, 254 → 255
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] < 4) px[i] = 0;
        else if (px[i] === 254) px[i] = 255;
      }
      ctx.putImageData(data, 0, 0);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          if (px[(y * canvas.width + x) * 4 + 3] >= 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      if (maxX <= minX || maxY <= minY) throw new Error("no visible pixels");
      const pad = 8;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(canvas.width, maxX + pad + 1);
      maxY = Math.min(canvas.height, maxY + pad + 1);
      const cw = maxX - minX,
        ch = maxY - minY;
      const out = document.createElement("canvas");
      out.width = width;
      out.height = Math.max(1, Math.round((width * ch) / cw));
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);
      return {
        width: out.width,
        height: out.height,
        originalWidth: image.width,
        originalHeight: image.height,
        png: out.toDataURL("image/png").split(",")[1],
      };
    },
    { base64, mime, width: def.width },
  );
  const genDir = path.join(ROOT, "public", "assets", "gen");
  const srcDir = path.join(ROOT, "assets-src", "generated");
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });
  const buf = Buffer.from(result.png, "base64");
  fs.writeFileSync(path.join(genDir, `${id}.png`), buf);
  fs.writeFileSync(path.join(srcDir, `gpt_${id}_v1.png`), buf);
  const meta = {
    id,
    source: "GPT",
    prompt: def.prompt,
    originalImport: `tmp/${def.file}`,
    createdAt: new Date().toISOString(),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    originalSize: [result.originalWidth, result.originalHeight],
    runtime: `public/assets/gen/${id}.png`,
    runtimeSize: [result.width, result.height],
    processing: { alphaBelow4Removed: true, alpha254PromotedTo255: true, cropThreshold: 16, padding: 8 },
  };
  fs.writeFileSync(
    path.join(srcDir, `gpt_${id}_v1.png.json`),
    JSON.stringify(meta, null, 2) + "\n",
  );
  console.log(`${id}: ${result.width}x${result.height}`);
}
await browser.close();