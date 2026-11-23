// Чанки земли 8×8 тайлов: запечка в offscreen-канвасы, отсев до запечки, LRU.
import { mulberry32 } from "../core/rng.js";
import { mkCanvas } from "../core/geo.js";
import { tileAt } from "../world/cityGen.js";
import { T_ASPHALT, T_SIDEWALK, TEXFILL, tileVariant } from "./tiles.js";
import { tex2x } from "./assets.js";

export const CH = 8; // тайлов на сторону чанка
const LRU_MAX = 600;
const TEXTURE_TILES = new Map();

function texturedTile(t, tx, ty) {
  const spec = TEXFILL[t];
  if (!spec) return null;
  const img = tex2x(spec.tex, spec.tint);
  if (!img) return null;
  const u = ((tx % 16) + 16) % 16;
  const v = ((ty % 16) + 16) % 16;
  const key = `${t}:${u}:${v}`;
  if (TEXTURE_TILES.has(key)) return TEXTURE_TILES.get(key);
  const canvas = mkCanvas(68, 36);
  const g = canvas.getContext("2d");
  g.beginPath();
  g.moveTo(34, 1);
  g.lineTo(67, 18);
  g.lineTo(34, 35);
  g.lineTo(1, 18);
  g.closePath();
  g.clip();
  g.setTransform(32, 16, -32, 16, 34, 2);
  g.drawImage(img, u * 64, v * 64, 64, 64, 0, 0, 1, 1);
  TEXTURE_TILES.set(key, canvas);
  return canvas;
}

export function createChunkCache() {
  return new Map();
}

// lite — дешёвая запечка только procedural-земли (без текстур, бордюров,
// теней и листвы): placeholder на время бюджетной дозапечки полного чанка
export function bakeChunk(city, groundSet, cx, cy, lite = false) {
  const c = mkCanvas(CH * 64 + 4, CH * 32 + 4);
  const g = c.getContext("2d");
  const ax = cx * CH,
    ay = cy * CH;
  // вершина ромба тайла (tx,ty) в локальных координатах канваса
  const local = (wx, wy) => ({
    x: (wx - wy - (ax - ay)) * 32 + CH * 32 + 2,
    y: (wx + wy - (ax + ay)) * 16 + 2,
  });

  for (let ty = ay; ty < ay + CH; ty++)
    for (let tx = ax; tx < ax + CH; tx++) {
      const t = tileAt(city, tx, ty);
      const p = local(tx, ty);
      const textured = lite ? null : texturedTile(t, tx, ty);
      if (textured) g.drawImage(textured, p.x - 34, p.y - 2);
      else g.drawImage(groundSet[t][tileVariant(tx, ty)], p.x - 34, p.y - 2);
    }

  // разметка осевых
  g.strokeStyle = "#b7a23c";
  g.lineWidth = 2;
  g.setLineDash([14, 12]);
  for (let ty = ay; ty < ay + CH; ty++)
    for (let tx = ax; tx < ax + CH; tx++) {
      const f =
        tx >= 0 && ty >= 0 && tx < city.SIZE && ty < city.SIZE
          ? city.gflag[ty * city.SIZE + tx]
          : 0;
      if (!f) continue;
      // флаг на тайле центра+1 (rx===4); осевая — на его левой кромке (x=tx / y=ty)
      const q1 = f === 2 ? local(tx, ty) : local(tx, ty);
      const q2 = f === 2 ? local(tx + 1, ty) : local(tx, ty + 1);
      g.beginPath();
      g.moveTo(q1.x, q1.y);
      g.lineTo(q2.x, q2.y);
      g.stroke();
    }
  g.setLineDash([]);

  // бордюры: кромка тротуара к проезжей части
  if (!lite)
    for (let ty = ay - 1; ty <= ay + CH; ty++)
      for (let tx = ax - 1; tx <= ax + CH; tx++) {
        if (tileAt(city, tx, ty) !== T_SIDEWALK) continue;
        const p = local(tx, ty);
        const edges = [
          [
            tileAt(city, tx, ty - 1) === T_ASPHALT,
            p.x,
            p.y - 16,
            p.x + 32,
            p.y,
          ],
          [
            tileAt(city, tx + 1, ty) === T_ASPHALT,
            p.x + 32,
            p.y,
            p.x,
            p.y + 16,
          ],
          [
            tileAt(city, tx, ty + 1) === T_ASPHALT,
            p.x,
            p.y + 16,
            p.x - 32,
            p.y,
          ],
          [
            tileAt(city, tx - 1, ty) === T_ASPHALT,
            p.x - 32,
            p.y,
            p.x,
            p.y - 16,
          ],
        ];
        for (const [hit, x1, y1, x2, y2] of edges) {
          if (!hit) continue;
          g.strokeStyle = "rgba(16,20,26,0.55)";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x1, y1 + 1);
          g.lineTo(x2, y2 + 1);
          g.stroke();
          g.strokeStyle = "#83868c";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x1, y1 - 1);
          g.lineTo(x2, y2 - 1);
          g.stroke();
        }
      }

  // тени зданий (солнце с NW → тень на SE) + AO у основания
  if (!lite)
    for (const b of city.buildings) {
      if (
        b.x + b.w + 4 < ax ||
        b.y + b.h + 4 < ay ||
        b.x - 1 > ax + CH ||
        b.y - 1 > ay + CH
      )
        continue;
      const Z = b.floors * 3;
      const off = { x: Z * 7, y: Z * 3.5 };
      const pts = [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h],
      ].map(([wx, wy]) => local(wx, wy));
      g.fillStyle = "rgba(16,20,26,0.30)";
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) g.lineTo(pts[i].x, pts[i].y);
      for (let i = 3; i >= 0; i--) g.lineTo(pts[i].x + off.x, pts[i].y + off.y);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(16,20,26,0.28)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(pts[3].x, pts[3].y + 2);
      g.lineTo(pts[2].x, pts[2].y + 2);
      g.lineTo(pts[1].x, pts[1].y + 2);
      g.stroke();
      // пепельные наносы у стен
      g.fillStyle = "rgba(194,190,178,0.13)";
      g.beginPath();
      g.moveTo(pts[3].x, pts[3].y + 7);
      g.lineTo(pts[2].x, pts[2].y + 7);
      g.lineTo(pts[2].x, pts[2].y + 12);
      g.lineTo(pts[3].x, pts[3].y + 12);
      g.closePath();
      g.fill();
    }

  // масляные пятна на дорогах (только без текстуры)
  const r = mulberry32(cx * 733 + cy * 91 + 1);
  if (!lite && !tex2x("asphalt", null))
    for (let i = 0; i < 4; i++) {
      const wx = ax + r() * CH,
        wy = ay + r() * CH;
      if (tileAt(city, wx | 0, wy | 0) !== T_ASPHALT) continue;
      const p = local(wx, wy);
      g.fillStyle = "rgba(14,16,20,0.35)";
      g.beginPath();
      g.ellipse(p.x, p.y, 10 + r() * 18, 4 + r() * 8, 0, 0, 7);
      g.fill();
    }
  // листва под деревьями
  if (!lite)
    for (const t of city.trees) {
      if (t.x < ax || t.x >= ax + CH || t.y < ay || t.y >= ay + CH) continue;
      const p = local(t.x, t.y);
      g.fillStyle = t.dead ? "rgba(90,74,56,0.4)" : "rgba(61,71,53,0.5)";
      for (let i = 0; i < 14; i++)
        g.fillRect(p.x - 24 + r() * 48, p.y - 10 + r() * 22, 2.5, 1.6);
    }
  return { canvas: c, sx: (ax - ay - CH) * 32 - 2, sy: (ax + ay) * 16 - 2 };
}

export function prewarmTextureTiles() {
  for (const t of Object.keys(TEXFILL))
    for (let v = 0; v < 16; v++)
      for (let u = 0; u < 16; u++) texturedTile(Number(t), u, v);
}

export function getChunk(city, groundSet, cache, cx, cy) {
  const k = cx + "," + cy;
  let ch = cache.get(k);
  if (!ch) {
    ch = bakeChunk(city, groundSet, cx, cy);
    cache.set(k, ch);
  }
  return ch;
}

// LRU: вытеснить самый дальний от камеры чанк
export function evictIfNeeded(cache, camSx, camSy) {
  if (cache.size <= LRU_MAX) return;
  let farKey = null,
    farD = -1;
  for (const [k, ch] of cache) {
    const d = Math.hypot(ch.sx + 256 - camSx, ch.sy + 128 - camSy);
    if (d > farD) {
      farD = d;
      farKey = k;
    }
  }
  if (farKey) cache.delete(farKey);
}
