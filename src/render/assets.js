export function normalizeSprite(image, width, height) {
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext("2d");
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;
  let left = source.width,
    top = source.height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++)
      if (pixels[(x + y * source.width) * 4 + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) return image;

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.drawImage(
    source,
    left,
    top,
    right - left + 1,
    bottom - top + 1,
    0,
    0,
    width,
    height,
  );
  return output;
}

export function loadSprite(url, apply, size) {
  const image = new Image();
  image.addEventListener("load", () => {
    if (size) apply(normalizeSprite(image, size[0], size[1]));
    else apply(image);
  });
  image.src = url;
  return image;
}

export async function loadSpriteSheet(url, apply) {
  const image = new Image();
  const loaded = new Promise((resolve, reject) => {
    image.addEventListener("load", resolve);
    image.addEventListener("error", reject);
  });
  image.src = url;
  const [metadata] = await Promise.all([
    fetch(url.replace(/\.png$/, ".json")).then((response) => {
      if (!response.ok) throw new Error(`Asset metadata: ${response.status}`);
      return response.json();
    }),
    loaded,
  ]);
  const sheet = { image, metadata };
  apply(sheet);
  return sheet;
}

export function sheetDuration(sheet) {
  return (
    sheet.metadata.frames.reduce((total, frame) => total + frame.duration, 0) /
    1000
  );
}

export function sheetFrameIndex(sheet, time, loop) {
  const frames = sheet.metadata.frames;
  let local = Math.max(0, time);
  const duration = sheetDuration(sheet);
  if (loop && duration > 0) local %= duration;
  let elapsed = 0;
  for (let i = 0; i < frames.length; i++) {
    elapsed += frames[i].duration / 1000;
    if (local < elapsed) return i;
  }
  return frames.length - 1;
}

export function drawSheetFrame(ctx, sheet, index, x, y, w, h) {
  const frame = sheet.metadata.frames[index].frame;
  ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
}
