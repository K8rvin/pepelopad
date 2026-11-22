// Обработка набора кадров зомби (GPT пользователя) с ЕДИНЫМ масштабом и якорем
// ступней по референсу zombie.png — чтобы шаг/урон/падение/атака не «прыгали».
// Масштаб берётся из шага (upright) относительно референса и применяется ко всем
// кадрам; присевший кадр падения остаётся ниже ростом. Без Python: Chrome canvas.
// Запуск: node scripts/process_zombie_frames.mjs <walk> <hurt> <fall> <attack>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const REF = path.join(ROOT, "public", "assets", "gen", "zombie.png");
const STATES = ["walk", "hurt", "fall", "attack"];
const SRCS = process.argv.slice(2, 6);
if (SRCS.length !== 4) {
  console.error("usage: node scripts/process_zombie_frames.mjs <walk> <hurt> <fall> <attack>");
  process.exit(1);
}
const PROMPTS = {
  walk: "Тот же зомби, что на референсе zombie.png, середина шага, ноги в противофазе, руки вперёд; RGBA, ступни на базовой линии.",
  hurt: "Тот же зомби, что на референсе zombie.png, отклонение назад от удара, голова запрокинута, кровь на груди; RGBA.",
  fall: "Тот же зомби, что на референсе zombie.png, падение на колени и бок, тело скошено к земле; RGBA.",
  attack: "Тот же зомби, что на референсе zombie.png, выброс рук вперёд, раскрытая пасть, укус; RGBA.",
};

const b64 = (p) => fs.readFileSync(p).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ refB64, srcsB64 }) => {
    const load = (b64) =>
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = "data:image/png;base64," + b64;
      });
    const clean = (im) => {
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      const id = g.getImageData(0, 0, c.width, c.height);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const a = id.data[i + 3];
          if (a < 4) id.data[i + 3] = 0;
          else if (a === 254) id.data[i + 3] = 255;
          if (a >= 16) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      g.putImageData(id, 0, 0);
      return { c, bbox: [x0, y0, x1 + 1, y1 + 1] };
    };
    const ref = clean(await load(refB64));
    const [rx0, ry0, rx1, ry1] = ref.bbox;
    const refH = ry1 - ry0;
    const refCx = (rx0 + rx1) / 2;
    const refBottom = ry1;
    const frames = [];
    for (const b64 of srcsB64) frames.push(clean(await load(b64)));
    // единый масштаб из шага (первый кадр) относительно референса
    const walkH = frames[0].bbox[3] - frames[0].bbox[1];
    const scale = refH / walkH;
    const outs = frames.map((f) => {
      const [bx0, by0, bx1, by1] = f.bbox;
      const bw = bx1 - bx0, bh = by1 - by0;
      const dw = bw * scale, dh = bh * scale;
      const out = document.createElement("canvas");
      out.width = ref.c.width;
      out.height = ref.c.height;
      const og = out.getContext("2d");
      og.imageSmoothingEnabled = true;
      og.imageSmoothingQuality = "high";
      const dx = refCx - dw / 2;
      const dy = refBottom - dh; // ступни на базовой линии референса
      og.drawImage(f.c, bx0, by0, bw, bh, dx, dy, dw, dh);
      return { size: [out.width, out.height], dataUrl: out.toDataURL("image/png") };
    });
    return { scale: +scale.toFixed(4), refSize: [ref.c.width, ref.c.height], outs };
  },
  { refB64: b64(REF), srcsB64: SRCS.map(b64) },
);
await browser.close();

STATES.forEach((state, i) => {
  const id = `zombie_${state}`;
  const out = path.join(ROOT, "public", "assets", "gen", id + ".png");
  fs.writeFileSync(out, Buffer.from(result.outs[i].dataUrl.split(",")[1], "base64"));
  const copy = path.join(ROOT, "assets-src", "generated", `gpt_${id}_v1.png`);
  fs.copyFileSync(SRCS[i], copy);
  const meta = {
    id,
    source: "GPT",
    prompt: PROMPTS[state],
    originalImport: "tmp/" + path.basename(SRCS[i]),
    createdAt: new Date(fs.statSync(SRCS[i]).mtime).toISOString(),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(copy)).digest("hex"),
    originalSize: result.outs[i].size,
    runtime: `public/assets/gen/${id}.png`,
    runtimeSize: result.outs[i].size,
    processing: {
      pipeline: "scripts/process_zombie_frames.mjs",
      commonScale: result.scale,
      anchor: "feet baseline + center of zombie.png",
      alphaBelow4Removed: true,
    },
    notes: "Кадр анимации ходока; единый масштаб набора из шага, якорь ступней по zombie.png.",
  };
  fs.writeFileSync(copy + ".json", JSON.stringify(meta, null, 2) + "\n");
  console.log(id, "->", result.outs[i].size.join("x"));
});
console.log("common scale:", result.scale, "ref:", result.refSize.join("x"));
