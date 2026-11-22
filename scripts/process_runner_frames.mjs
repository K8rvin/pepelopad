// Обработка пяти кадров бегуна с общим масштабом и якорем низ-центр.
// Масштаб берётся от вертикального hurt к базовой стойке: широкие кадры бега,
// атаки и падения сохраняют свою высоту и не растягиваются до полного роста.
// Запуск: node scripts/process_runner_frames.mjs <base> <walk> <hurt> <fall> <attack>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATES = ["base", "walk", "hurt", "fall", "attack"];
const SRCS = process.argv.slice(2, 7);
if (SRCS.length !== 5) {
  console.error(
    "usage: node scripts/process_runner_frames.mjs <base> <walk> <hurt> <fall> <attack>",
  );
  process.exit(1);
}
const PROMPTS = {
  base: "Бегун №13: худощавый зомби в спортивной куртке с номером 13, стойка с наклоном вперёд, мрачный европейский комикс, RGBA.",
  walk: "Тот же Бегун №13, быстрый бег в профиль вправо, руки и ноги в противофазе, мрачный европейский комикс, RGBA.",
  hurt: "Тот же Бегун №13, отклонение корпуса назад от бокового импульса, мрачный европейский комикс, RGBA.",
  fall: "Тот же Бегун №13, потеря равновесия и падение набок, мрачный европейский комикс, RGBA.",
  attack:
    "Тот же Бегун №13, короткий рывок вперёд с вытянутой рукой, мрачный европейский комикс, RGBA.",
};

const b64 = (p) => fs.readFileSync(p).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ srcsB64 }) => {
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
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
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
      if (x1 < 0) throw new Error("Пустой силуэт или отсутствует альфа-канал");
      return {
        c,
        bbox: [x0, y0, x1 + 1, y1 + 1],
        originalSize: [im.width, im.height],
      };
    };
    const frames = [];
    for (const b64 of srcsB64) frames.push(clean(await load(b64)));
    const refH = frames[0].bbox[3] - frames[0].bbox[1];
    const hurtH = frames[2].bbox[3] - frames[2].bbox[1];
    const scale = refH / hurtH;
    const pad = 24;
    let outW = 0;
    let outH = 0;
    frames.forEach((f, i) => {
      const k = i === 0 ? 1 : scale;
      const w = (f.bbox[2] - f.bbox[0]) * k;
      const h = (f.bbox[3] - f.bbox[1]) * k;
      outW = Math.max(outW, w);
      outH = Math.max(outH, h);
    });
    outW = Math.ceil(outW + pad * 2);
    outH = Math.ceil(outH + pad * 2);
    const outs = frames.map((f, i) => {
      const [bx0, by0, bx1, by1] = f.bbox;
      const k = i === 0 ? 1 : scale;
      const bw = bx1 - bx0,
        bh = by1 - by0;
      const dw = bw * k,
        dh = bh * k;
      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const og = out.getContext("2d");
      og.imageSmoothingEnabled = true;
      og.imageSmoothingQuality = "high";
      og.drawImage(
        f.c,
        bx0,
        by0,
        bw,
        bh,
        outW / 2 - dw / 2,
        outH - pad - dh,
        dw,
        dh,
      );
      return { dataUrl: out.toDataURL("image/png") };
    });
    return {
      scale: +scale.toFixed(4),
      size: [outW, outH],
      originalSizes: frames.map((f) => f.originalSize),
      outs,
    };
  },
  { srcsB64: SRCS.map(b64) },
);
await browser.close();

STATES.forEach((state, i) => {
  const id = state === "base" ? "runner" : `runner_${state}`;
  const out = path.join(ROOT, "public", "assets", "gen", id + ".png");
  fs.writeFileSync(
    out,
    Buffer.from(result.outs[i].dataUrl.split(",")[1], "base64"),
  );
  const copy = path.join(ROOT, "assets-src", "generated", `gpt_${id}_v1.png`);
  fs.copyFileSync(SRCS[i], copy);
  const meta = {
    id,
    source: "GPT",
    prompt: PROMPTS[state],
    originalImport: "tmp/" + path.basename(SRCS[i]),
    createdAt: new Date(fs.statSync(SRCS[i]).mtime).toISOString(),
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(copy))
      .digest("hex"),
    originalSize: result.originalSizes[i],
    runtime: `public/assets/gen/${id}.png`,
    runtimeSize: result.size,
    processing: {
      pipeline: "scripts/process_runner_frames.mjs",
      commonScale: i === 0 ? 1 : result.scale,
      anchor: "feet baseline + horizontal center of runner.png",
      alphaBelow4Removed: true,
    },
    notes:
      "Кадр бегуна №13; общий масштаб по вертикальному кадру урона, широкие позы не растянуты.",
  };
  fs.writeFileSync(copy + ".json", JSON.stringify(meta, null, 2) + "\n");
  console.log(id, "->", result.size.join("x"));
});
console.log("common scale:", result.scale, "canvas:", result.size.join("x"));
