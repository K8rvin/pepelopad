// Обработка набора врага: стойка, шаг, урон, необязательное падение и атака.
// Дополнительный GIF распаковывается в PNG-кадры с общим масштабом стойки.
// Запуск: node scripts/process_enemy_frames.mjs <kind> <base> <walk> <hurt> <fall|-> <attack> [walk.gif]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const [kind, base, walk, hurt, fall, attack, gif] = process.argv.slice(2, 9);
if (!kind || !base || !walk || !hurt || !fall || !attack) {
  console.error(
    "usage: node scripts/process_enemy_frames.mjs <kind> <base> <walk> <hurt> <fall|-> <attack> [walk.gif]",
  );
  process.exit(1);
}
const sources = [
  ["base", base],
  ["walk", walk],
  ["hurt", hurt],
  ...(fall === "-" ? [] : [["fall", fall]]),
  ["attack", attack],
];
const prompts = {
  brute: {
    base: "Громила, тяжёлая стойка, RGBA.",
    walk: "Громила, тяжёлый шаг вправо, RGBA.",
    hurt: "Громила, отклонение корпуса от удара, RGBA.",
    fall: "Громила, падение набок, RGBA.",
    attack: "Громила, двуручный удар вправо, RGBA.",
  },
  matka: {
    base: "Матка, стойка с поднятой головой, RGBA.",
    walk: "Матка, медленный шаг вправо, RGBA.",
    hurt: "Матка, отклонение и поднятые руки от удара, RGBA.",
    fall: "Матка, падение набок, RGBA.",
    attack: "Матка, выпад с двумя руками вправо, RGBA.",
  },
};
if (!prompts[kind]) {
  console.error(`unknown enemy kind: ${kind}`);
  process.exit(1);
}

const gifDir = path.join(ROOT, ".cache", "enemy_frames", kind);
let gifFiles = [];
let gifMeta = null;
if (gif) {
  fs.mkdirSync(gifDir, { recursive: true });
  gifMeta = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,nb_frames,duration,r_frame_rate",
        "-of",
        "json",
        gif,
      ],
      { encoding: "utf8" },
    ),
  ).streams[0];
  execFileSync(
    "ffmpeg",
    ["-y", "-i", gif, path.join(gifDir, "frame_%02d.png")],
    {
      stdio: "ignore",
    },
  );
  const count = Number(gifMeta.nb_frames);
  gifFiles = Array.from({ length: count }, (_, i) =>
    path.join(gifDir, `frame_${String(i + 1).padStart(2, "0")}.png`),
  );
}

const b64 = (file) => fs.readFileSync(file).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ staticB64, gifB64 }) => {
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
      if (x1 < 0) throw new Error("empty silhouette");
      g.putImageData(id, 0, 0);
      return {
        c,
        bbox: [x0, y0, x1 + 1, y1 + 1],
        originalSize: [im.width, im.height],
      };
    };
    const frames = [];
    for (const b64 of staticB64) frames.push(clean(await load(b64)));
    const gifFrames = [];
    for (const b64 of gifB64) gifFrames.push(clean(await load(b64)));
    const baseH = frames[0].bbox[3] - frames[0].bbox[1];
    const hurtH = frames[2].bbox[3] - frames[2].bbox[1];
    const scale = baseH / hurtH;
    const gifMaxH = Math.max(...gifFrames.map((f) => f.bbox[3] - f.bbox[1]), 0);
    const gifScale = gifFrames.length ? baseH / gifMaxH : 1;
    const scaled = [
      ...frames.map((f, i) => ({ f, k: i === 0 ? 1 : scale })),
      ...gifFrames.map((f) => ({ f, k: gifScale, gif: true })),
    ];
    const pad = 24;
    let outW = 0,
      outH = 0;
    for (const { f, k } of scaled) {
      outW = Math.max(outW, (f.bbox[2] - f.bbox[0]) * k);
      outH = Math.max(outH, (f.bbox[3] - f.bbox[1]) * k);
    }
    outW = Math.ceil(outW + pad * 2);
    outH = Math.ceil(outH + pad * 2);
    const outs = scaled.map(({ f, k }) => {
      const [bx0, by0, bx1, by1] = f.bbox;
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
      return out.toDataURL("image/png");
    });
    return {
      scale: +scale.toFixed(4),
      gifScale: +gifScale.toFixed(4),
      size: [outW, outH],
      originalSizes: [...frames, ...gifFrames].map((f) => f.originalSize),
      outs,
    };
  },
  {
    staticB64: sources.map(([, file]) => b64(file)),
    gifB64: gifFiles.map(b64),
  },
);
await browser.close();

const writePng = (file, dataUrl) =>
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
const metadata = (id, source, prompt, original, runtimeSize) => ({
  id,
  source: "GPT",
  prompt,
  originalImport: "tmp/" + path.basename(original),
  createdAt: new Date(fs.statSync(original).mtime).toISOString(),
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex"),
  originalSize: null,
  runtime: `public/assets/gen/${id}.png`,
  runtimeSize,
});

sources.forEach(([state, original], i) => {
  const id = state === "base" ? kind : `${kind}_${state}`;
  const runtime = path.join(ROOT, "public", "assets", "gen", id + ".png");
  writePng(runtime, result.outs[i]);
  const copy = path.join(ROOT, "assets-src", "generated", `gpt_${id}_v1.png`);
  fs.copyFileSync(original, copy);
  const meta = metadata(id, copy, prompts[kind][state], original, result.size);
  meta.originalSize = result.originalSizes[i];
  meta.processing = {
    pipeline: "scripts/process_enemy_frames.mjs",
    commonScale: i === 0 ? 1 : result.scale,
    anchor: "feet baseline + horizontal center",
    alphaBelow4Removed: true,
  };
  if (
    kind === "matka" &&
    state === "hurt" &&
    path.basename(original) === "matka_fall.png"
  )
    meta.notes =
      "Исходный tmp/matka_fall.png визуально является отклонением от удара; использован как hurt, не как падение.";
  fs.writeFileSync(copy + ".json", JSON.stringify(meta, null, 2) + "\n");
  console.log(id, "->", result.size.join("x"));
});

gifFiles.forEach((original, i) => {
  const id = `${kind}_walk_${i}`;
  const outIndex = sources.length + i;
  const runtime = path.join(ROOT, "public", "assets", "gen", id + ".png");
  writePng(runtime, result.outs[outIndex]);
  const copy = path.join(ROOT, "assets-src", "generated", `gpt_${id}_v1.png`);
  fs.copyFileSync(original, copy);
  const meta = metadata(
    id,
    copy,
    `Матка, кадр ${i + 1} из ${gifFiles.length} цикла ходьбы из GIF.`,
    gif,
    result.size,
  );
  meta.originalSize = result.originalSizes[outIndex];
  meta.processing = {
    pipeline: "scripts/process_enemy_frames.mjs + ffmpeg",
    sourceGif: gif,
    frame: i + 1,
    frames: gifFiles.length,
    duration: Number(gifMeta.duration),
    fps: gifMeta.r_frame_rate,
    commonScale: result.gifScale,
    anchor: "feet baseline + horizontal center",
    alphaBelow4Removed: true,
  };
  fs.writeFileSync(copy + ".json", JSON.stringify(meta, null, 2) + "\n");
  console.log(id, "->", result.size.join("x"));
});

if (gif) {
  const copy = path.join(
    ROOT,
    "assets-src",
    "generated",
    `gpt_${kind}_walk_animation_v1.gif`,
  );
  fs.copyFileSync(gif, copy);
  const meta = {
    id: `${kind}_walk_animation`,
    source: "GPT",
    prompt: "Матка, экспериментальный GIF цикла ходьбы, 8 кадров.",
    originalImport: "tmp/" + path.basename(gif),
    createdAt: new Date(fs.statSync(gif).mtime).toISOString(),
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(copy))
      .digest("hex"),
    originalSize: [gifMeta.width, gifMeta.height],
    frames: gifFiles.length,
    duration: Number(gifMeta.duration),
    fps: gifMeta.r_frame_rate,
    runtimeFrames: gifFiles.map(
      (_, i) => `public/assets/gen/${kind}_walk_${i}.png`,
    ),
  };
  fs.writeFileSync(copy + ".json", JSON.stringify(meta, null, 2) + "\n");
}
console.log(
  `${kind}: static scale ${result.scale}, GIF scale ${result.gifScale}, canvas ${result.size.join("x")}`,
);
