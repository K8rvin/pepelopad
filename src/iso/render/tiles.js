// Процедурные тайлы земли (fallback, если текстуры не загрузились) и типы.
import { mulberry32, h2 } from "../core/rng.js";
import {
  PAL,
  mkCanvas,
  diamondPath,
  TW,
  TH,
  TILE_PAD,
  TILE_CX,
  TILE_CY,
} from "../core/geo.js";

export const T_GRASS = 0,
  T_DIRT = 1,
  T_ASPHALT = 2,
  T_SIDEWALK = 3,
  T_FLOOR = 4,
  T_SAND = 5,
  T_PATH = 6;

// земля со сплошной текстурной заливкой: ключ TEX + multiply-тонировка в палитру
export const TEXFILL = {
  [T_ASPHALT]: { tex: "asphalt", tint: "#5a616b" },
  [T_GRASS]: { tex: "dead_grass", tint: "#a09c80" },
  [T_DIRT]: { tex: "dirt", tint: null },
  [T_SIDEWALK]: { tex: "sidewalk", tint: "#9a9da2" },
  [T_FLOOR]: { tex: "wood_floor", tint: null },
  [T_PATH]: { tex: "dirt", tint: "#9a9278" },
  [T_SAND]: { tex: "dirt", tint: "#b0a888" },
};

function speckle(g, r, n, colors, sizeMin = 1, sizeMax = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle =
      colors[Math.min(colors.length - 1, Math.floor(r() * colors.length))];
    const s = sizeMin + r() * (sizeMax - sizeMin);
    g.fillRect(4 + r() * 60, 4 + r() * 28, s, s * 0.7);
  }
}

function makeTile(base, flecks, r, opts = {}) {
  const c = mkCanvas(TW + TILE_PAD * 2, TH + TILE_PAD * 2);
  const g = c.getContext("2d");
  diamondPath(g);
  g.fillStyle = base;
  g.fill();
  g.save();
  diamondPath(g);
  g.clip();
  speckle(g, r, opts.speckles ?? 26, flecks, 1, 2.4);
  if (opts.crack && r() < (opts.crackChance ?? 0.5)) {
    g.strokeStyle = "rgba(16,20,26,0.5)";
    g.lineWidth = 1;
    g.beginPath();
    let x = 10 + r() * 44,
      y = 8 + r() * 16;
    g.moveTo(x, y);
    for (let i = 0; i < 3; i++) {
      x += (r() - 0.5) * 18;
      y += r() * 7;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  if (opts.patch && r() < 0.3) {
    g.fillStyle = "rgba(16,20,26,0.18)";
    g.beginPath();
    g.ellipse(12 + r() * 44, 10 + r() * 16, 4 + r() * 7, 2 + r() * 3, 0, 0, 7);
    g.fill();
  }
  g.restore();
  return c;
}

export function makeGroundSet() {
  const set = {};
  const defs = [
    [
      T_GRASS,
      PAL.grass,
      ["#5d5c3b", "#75744c", "#525138", "#6a6944"],
      { speckles: 30 },
    ],
    [T_DIRT, "#57503c", ["#4a4433", "#645c46", "#3f3a2c"], { speckles: 30 }],
    [
      T_ASPHALT,
      PAL.asphalt,
      ["#33383e", "#42474e", "#2f3339", "#4a4f56"],
      { speckles: 34, crack: true, patch: true },
    ],
    [
      T_SIDEWALK,
      "#63666b",
      ["#585b60", "#6e7176", "#4f5257"],
      { speckles: 20, crack: true, crackChance: 0.1 },
    ],
    [T_FLOOR, "#5d4a33", ["#54422d", "#685238", "#4c3b28"], { speckles: 18 }],
    [T_SAND, "#8a7f63", ["#7d7356", "#968a6c", "#6f6549"], { speckles: 24 }],
    [T_PATH, "#4e4a3c", ["#453f33", "#585244", "#3e392e"], { speckles: 26 }],
  ];
  for (const [id, base, flecks, opts] of defs) {
    set[id] = [];
    for (let v = 0; v < 4; v++)
      set[id].push(
        makeTile(base, flecks, mulberry32(id * 100 + v * 17 + 5), opts),
      );
  }
  // доски пола — горизонтальные полосы поверх
  for (const t of set[T_FLOOR]) {
    const g = t.getContext("2d");
    g.strokeStyle = "rgba(30,24,16,0.55)";
    g.lineWidth = 1;
    for (let y = 6; y < 34; y += 7) {
      g.beginPath();
      g.moveTo(Math.max(0, TILE_CX - 16 - (y - TILE_CY + 16)), y);
      g.lineTo(Math.min(68, TILE_CX + 16 + (y - TILE_CY + 16)), y);
      g.stroke();
    }
  }
  return set;
}

// выбор варианта тайла детерминированно
export function tileVariant(tx, ty) {
  return Math.floor(h2(tx, ty, 9) * 4);
}
