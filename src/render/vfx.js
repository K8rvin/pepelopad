import { sheetDuration, sheetFrameIndex, drawSheetFrame } from "./assets.js";

export function renderVfx({ ctx, effects, assets, now, w2s, SC }) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    const sheet = assets[effect.type];
    if (!sheet) continue;
    const elapsed = now - effect.start;
    if (elapsed >= sheetDuration(sheet)) {
      effects.splice(i, 1);
      continue;
    }
    const frame = sheetFrameIndex(sheet, elapsed, false);
    const s = w2s(effect.x, effect.y);
    const width = effect.r * SC * 2;
    const height = width * 0.8;
    drawSheetFrame(
      ctx,
      sheet,
      frame,
      s.x - width / 2,
      s.y - height * 0.65,
      width,
      height,
    );
  }
}
