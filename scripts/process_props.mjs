// Интеграция props-ассетов из tmp/ (png/webp): чистка alpha, обрезка по
// контенту, ресайз и сохранение в public/assets/gen + assets-src.
// Кадры одной группы (group) обрезаются ОБЩИМ bbox и масштабом, чтобы
// брёвна/камни не дрожали между кадрами анимации.
// Использование: node scripts/process_props.mjs [id ...] (без аргументов — все)
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
  generator: {
    file: "Винтажный дизельный генератор с кабелем.webp",
    width: 256,
    prompt:
      "Isometric portable diesel generator: faded orange-red fuel tank, blackened steel frame, recoil starter, control panel with sockets and knife switch, coiled cable at base, transparent RGBA.",
  },
  fire_0: {
    file: "Изометрический костёр в каменном кольце.webp",
    width: 160,
    group: "fire",
    prompt:
      "Campfire frame 0 of 3: crossed charred logs on grey stone ring, low broad flame leaning left, two embers, thin smoke, transparent RGBA.",
  },
  fire_1: {
    file: "Высокий костёр с одним искрящимся угольком.webp",
    width: 160,
    group: "fire",
    prompt:
      "Campfire frame 1 of 3: same logs and stones, tall narrow flame tongue, one ember, same camera, transparent RGBA.",
  },
  fire_2: {
    file: "Живописный костёр с дымом и углями.webp",
    width: 160,
    group: "fire",
    prompt:
      "Campfire frame 2 of 3: same logs and stones, medium flame in two tongues, three embers, smoke wisp, same camera, transparent RGBA.",
  },
};

const only = process.argv.slice(2);
const ids = Object.keys(PROPS).filter((id) => !only.length || only.includes(id));
const PAD = 8;

const browser = await chromium.launch();
const page = await browser.newPage();
const measure = async (file) => {
  const source = path.join(ROOT, "tmp", file);
  const base64 = fs.readFileSync(source).toString("base64");
  const mime = file.endsWith(".webp") ? "image/webp" : "image/png";
  const m = await page.evaluate(
    async ({ base64, mime }) => {
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
      // lossy webp сдвигает непрозрачность 255 → 251..254: возвращаем 255
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] < 4) px[i] = 0;
        else if (px[i] >= 250) px[i] = 255;
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
      return {
        base64,
        mime,
        w: image.width,
        h: image.height,
        minX,
        minY,
        maxX,
        maxY,
      };
    },
    { base64, mime },
  );
  return m;
};

const measured = {};
for (const id of ids) measured[id] = await measure(PROPS[id].file);
// общий bbox группы: кадры анимации не должны дрожать масштабом/позицией
const groupBox = {};
for (const id of ids) {
  const g = PROPS[id].group;
  if (!g) continue;
  const m = measured[id];
  const b = (groupBox[g] ||= { minX: m.minX, minY: m.minY, maxX: m.maxX, maxY: m.maxY });
  b.minX = Math.min(b.minX, m.minX);
  b.minY = Math.min(b.minY, m.minY);
  b.maxX = Math.max(b.maxX, m.maxX);
  b.maxY = Math.max(b.maxY, m.maxY);
}

for (const id of ids) {
  const def = PROPS[id];
  const m = measured[id];
  const box = def.group ? groupBox[def.group] : m;
  const minX = Math.max(0, box.minX - PAD);
  const minY = Math.max(0, box.minY - PAD);
  const maxX = Math.min(m.w, box.maxX + PAD + 1);
  const maxY = Math.min(m.h, box.maxY + PAD + 1);
  const cw = maxX - minX,
    ch = maxY - minY;
  const result = await page.evaluate(
    async ({ base64, mime, minX, minY, cw, ch, width }) => {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:${mime};base64,` + base64;
      });
      const out = document.createElement("canvas");
      out.width = width;
      out.height = Math.max(1, Math.round((width * ch) / cw));
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(image, minX, minY, cw, ch, 0, 0, out.width, out.height);
      return {
        width: out.width,
        height: out.height,
        png: out.toDataURL("image/png").split(",")[1],
      };
    },
    { base64: m.base64, mime: m.mime, minX, minY, cw, ch, width: def.width },
  );
  const genDir = path.join(ROOT, "public", "assets", "gen");
  const srcDir = path.join(ROOT, "assets-src", "generated");
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });
  const buf = Buffer.from(result.png, "base64");
  fs.writeFileSync(path.join(genDir, `${id}.png`), buf);
  fs.writeFileSync(path.join(srcDir, `gpt_${id}_v1.png`), buf);
  const source = path.join(ROOT, "tmp", def.file);
  const meta = {
    id,
    source: "GPT",
    prompt: def.prompt,
    originalImport: `tmp/${def.file}`,
    createdAt: new Date().toISOString(),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    originalSize: [m.w, m.h],
    runtime: `public/assets/gen/${id}.png`,
    runtimeSize: [result.width, result.height],
    processing: {
      alphaBelow4Removed: true,
      alpha250PlusPromotedTo255: true,
      cropThreshold: 16,
      padding: PAD,
      groupBox: def.group || null,
    },
  };
  fs.writeFileSync(
    path.join(srcDir, `gpt_${id}_v1.png.json`),
    JSON.stringify(meta, null, 2) + "\n",
  );
  console.log(`${id}: ${result.width}x${result.height}`);
}
await browser.close();