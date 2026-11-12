export function loadSprite(url, apply) {
  const image = new Image();
  image.addEventListener("load", () => apply(image));
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
