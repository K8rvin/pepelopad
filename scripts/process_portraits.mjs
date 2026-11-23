import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORTRAITS = {
  oleg: "Портрет Олег.jfif",
  vera: "Портрет Вера.jfif",
  sanych: "Портрет Саныч.jfif",
  raya: "Портрет Рая.jfif",
  masha: "Портрет Маша.jfif",
  gg: "Портрет ГГ.jfif",
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [id, filename] of Object.entries(PORTRAITS)) {
  const source = path.join(ROOT, "tmp", filename);
  const result = await page.evaluate(async (base64) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "data:image/jpeg;base64," + base64;
    });
    const width = 384;
    const height = Math.round((width * image.height) / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    return {
      width,
      height,
      originalWidth: image.width,
      originalHeight: image.height,
      dataUrl: canvas.toDataURL("image/png"),
    };
  }, fs.readFileSync(source).toString("base64"));
  const runtime = path.join(
    ROOT,
    "public",
    "assets",
    "gen",
    `portrait_${id}.png`,
  );
  const original = path.join(
    ROOT,
    "assets-src",
    "generated",
    `gpt_portrait_${id}_v1.jfif`,
  );
  fs.writeFileSync(
    runtime,
    Buffer.from(result.dataUrl.split(",")[1], "base64"),
  );
  fs.copyFileSync(source, original);
  const metadata = {
    id: `portrait_${id}`,
    source: "GPT; изображение предоставлено пользователем",
    prompt: null,
    originalImport: `tmp/${filename}`,
    createdAt: new Date(fs.statSync(source).mtime).toISOString(),
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(original))
      .digest("hex"),
    originalSize: [result.originalWidth, result.originalHeight],
    runtime: `public/assets/gen/portrait_${id}.png`,
    runtimeSize: [result.width, result.height],
    processing: {
      pipeline: "scripts/process_portraits.mjs",
      width: 384,
      crop: false,
    },
  };
  fs.writeFileSync(
    original + ".json",
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    `${id}: ${result.originalWidth}x${result.originalHeight} -> ${result.width}x${result.height}`,
  );
}
await browser.close();
