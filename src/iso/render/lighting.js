// Ночное освещение: half-res буфер, destination-out эллипсами 2:1, тёплый ореол,
// лунный холодный подъём силуэтов, светящиеся окна поверх затемнения.
import { mkCanvas } from "../core/geo.js";
import { w2s } from "../core/geo.js";
import { makeGlowSprite } from "./buildings.js";
import { buildingSprite } from "./buildings.js";

export function createLighting() {
  const lightCv = mkCanvas(2, 2);
  const warmCv = mkCanvas(2, 2);
  return {
    lightCv,
    lightCtx: lightCv.getContext("2d"),
    warmCv,
    warmCtx: warmCv.getContext("2d"),
    glowLamp: makeGlowSprite(288, 144, "rgba(255,255,255,0.95)"),
    glowPlayer: makeGlowSprite(440, 220, "rgba(255,255,255,0.8)"),
    glowWarmLamp: makeGlowSprite(288, 144, "rgba(255,180,92,0.55)"),
  };
}

export function fitLighting(L, W, H) {
  L.lightCv.width = W >> 1;
  L.lightCv.height = H >> 1;
  L.warmCv.width = W >> 1;
  L.warmCv.height = H >> 1;
}

export function renderNight({
  ctx,
  L,
  city,
  player,
  inside,
  toX,
  toY,
  zoom,
  W,
  H,
  camps,
}) {
  const s = 0.5; // half-res
  const g = L.lightCtx;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(10,14,24,0.72)";
  g.fillRect(0, 0, L.lightCv.width, L.lightCv.height);
  g.globalCompositeOperation = "destination-out";
  for (const l of city.lamps) {
    if (l.dead) continue;
    const p = w2s(l.x, l.y);
    const dx = (toX(p.x) - 144 * zoom) * s,
      dy = (toY(p.y) - 40 * zoom) * s;
    if (
      dx > L.lightCv.width ||
      dy > L.lightCv.height ||
      dx + 288 * zoom * s < 0 ||
      dy + 144 * zoom * s < 0
    )
      continue;
    g.drawImage(L.glowLamp, dx, dy, 288 * zoom * s, 144 * zoom * s);
  }
  const pp = w2s(player.x, player.y);
  // центр эллипса — на середине тела персонажа, а не на ступнях
  g.drawImage(
    L.glowPlayer,
    (toX(pp.x) - 220 * zoom) * s,
    (toY(pp.y) - 158 * zoom) * s,
    440 * zoom * s,
    220 * zoom * s,
  );
  // костры лагерей освещают округу
  if (camps)
    for (const c of camps) {
      const fp = w2s(c.x, c.y);
      g.drawImage(
        L.glowLamp,
        (toX(fp.x) - 144 * zoom) * s,
        (toY(fp.y) - 60 * zoom) * s,
        288 * zoom * s,
        144 * zoom * s,
      );
    }

  const wc = L.warmCtx;
  wc.globalCompositeOperation = "source-over";
  wc.fillStyle = "#000";
  wc.fillRect(0, 0, L.warmCv.width, L.warmCv.height);
  wc.globalCompositeOperation = "lighter";
  for (const l of city.lamps) {
    if (l.dead) continue;
    const p = w2s(l.x, l.y);
    const dx = (toX(p.x) - 144 * zoom) * s,
      dy = (toY(p.y) - 40 * zoom) * s;
    if (
      dx > L.warmCv.width ||
      dy > L.warmCv.height ||
      dx + 288 * zoom * s < 0 ||
      dy + 144 * zoom * s < 0
    )
      continue;
    wc.drawImage(L.glowWarmLamp, dx, dy, 288 * zoom * s, 144 * zoom * s);
  }
  if (camps)
    for (const c of camps) {
      const fp = w2s(c.x, c.y);
      wc.drawImage(
        L.glowWarmLamp,
        (toX(fp.x) - 144 * zoom) * s,
        (toY(fp.y) - 60 * zoom) * s,
        288 * zoom * s,
        144 * zoom * s,
      );
    }

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(L.lightCv, 0, 0, W, H);
  // холодная «лунная» подсветка силуэтов
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(60,76,110,0.14)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(L.warmCv, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = false;

  // светящиеся окна — после затемнения, их не гасим
  ctx.globalCompositeOperation = "lighter";
  for (const b of city.buildings) {
    if (b === inside) continue;
    const spr = buildingSprite(b);
    const ox = (b.x - b.y) * 32 + spr.minX,
      oy = (b.x + b.y) * 16 + spr.minY;
    const dx = toX(ox),
      dy = toY(oy);
    if (
      dx > W ||
      dy > H ||
      dx + spr.canvas.width * zoom < 0 ||
      dy + spr.canvas.height * zoom < 0
    )
      continue;
    ctx.drawImage(
      spr.litCanvas,
      dx,
      dy,
      spr.litCanvas.width * zoom,
      spr.litCanvas.height * zoom,
    );
  }
  ctx.globalCompositeOperation = "source-over";
}
