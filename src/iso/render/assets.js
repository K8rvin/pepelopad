// Загрузка ассетов: Gemini-текстуры (земля/стены) и спрайты с альфа-каналом.
// Текстуры раскладываются в бесшовную 2×2 зеркальную композицию с запечённой тонировкой.
import { mkCanvas } from "../core/geo.js";

export const TEX = {}; // плоские текстуры (после process_texture)
export const SPRTEX = {}; // спрайты с альфа (после process_sprite)

export const TEX_FILES = {
  asphalt: "/assets/textures/asphalt.png",
  dead_grass: "/assets/textures/dead_grass.png",
  dirt: "/assets/textures/dirt_ground.png",
  sidewalk: "/assets/textures/sidewalk.png",
  wood_floor: "/assets/textures/wood_floor.png",
  panel_wall: "/assets/textures/panel_wall.png",
  brick_wall: "/assets/textures/brick_wall.png",
  roof_felt: "/assets/textures/roof_felt.png",
};

export const SPRITE_FILES = {
  tree: "/assets/gen/tree_poplar.png",
  tree_dead: "/assets/gen/tree_dead.png",
  tree_birch: "/assets/gen/tree_birch.png",
  zombie: "/assets/gen/zombie.png",
  survivor: "/assets/gen/survivor.png",
  bench: "/assets/gen/bench.png",
  dumpster: "/assets/gen/dumpster.png",
  tires: "/assets/gen/tires.png",
  barrel: "/assets/gen/barrel.png",
  car_sedan: "/assets/gen/car_sedan.png",
  car_wreck: "/assets/gen/car_wreck.png",
  car_van: "/assets/gen/car_van.png",
};

function loadSet(files, target) {
  return Promise.all(
    Object.entries(files).map(
      ([k, src]) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            target[k] = img;
            res();
          };
          img.onerror = () => res(); // fallback: процедурные спрайты
          img.src = src;
        }),
    ),
  );
}

export async function loadAssets() {
  await Promise.all([loadSet(TEX_FILES, TEX), loadSet(SPRITE_FILES, SPRTEX)]);
}

// бесшовная 2×2 зеркальная композиция + запечённая multiply-тонировка
const tex2xCache = new Map();
export function tex2x(key, tint) {
  const ck = key + "|" + (tint || "");
  if (tex2xCache.has(ck)) return tex2xCache.get(ck);
  const img = TEX[key];
  if (!img) return null;
  const s = img.width;
  const c = mkCanvas(s * 2, s * 2);
  const g = c.getContext("2d");
  const quad = (fx, fy, ox, oy) => {
    g.save();
    g.translate(ox * s, oy * s);
    g.scale(fx ? -1 : 1, fy ? -1 : 1);
    g.drawImage(img, fx ? -s : 0, fy ? -s : 0);
    g.restore();
  };
  quad(0, 0, 0, 0);
  quad(1, 0, 1, 0);
  quad(0, 1, 0, 1);
  quad(1, 1, 1, 1);
  if (tint) {
    g.globalCompositeOperation = "multiply";
    g.fillStyle = tint;
    g.fillRect(0, 0, s * 2, s * 2);
    g.globalCompositeOperation = "source-over";
  }
  tex2xCache.set(ck, c);
  return c;
}
