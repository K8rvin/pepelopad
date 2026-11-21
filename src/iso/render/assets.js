// Загрузка отобранных текстур и спрайтов с альфа-каналом.
// Текстуры раскладываются в бесшовную 2×2 зеркальную композицию с запечённой тонировкой.
// Пути относительные + BASE_URL: на GitHub Pages игра живёт в /pepelopad/,
// корневые "/assets/..." там уходили бы в корень домена и не грузились.
import { mkCanvas } from "../core/geo.js";
import { createFurnitureModel } from "./furnitureModels.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";

export const TEX = {}; // плоские текстуры (после process_texture)
export const SPRTEX = {}; // спрайты с альфа-каналом и процедурные fallback-модели

export const TEX_FILES = {
  asphalt: "assets/textures/asphalt.png",
  dead_grass: "assets/textures/dead_grass.png",
  dirt: "assets/textures/dirt_ground.png",
  sidewalk: "assets/textures/sidewalk.png",
  wood_floor: "assets/textures/wood_floor.png",
  panel_wall: "assets/textures/panel_wall.png",
  brick_wall: "assets/textures/brick_wall.png",
  roof_felt: "assets/textures/roof_felt.png",
  // пригород (фаза B): сайдинг и черепица; до генерации — процедурный fallback
  house_wall: "assets/textures/house_wall.png",
  roof_shingles: "assets/textures/roof_shingles.png",
};

// Машины рисуются процедурной iso-моделью (data/carShapes.js): турнтейбл-атласы
// Gemini не дали равномерной сетки курсов (этап 18), атласы больше не грузятся.

export const SPRITE_FILES = {
  tree: "assets/gen/tree_poplar.png",
  tree_dead: "assets/gen/tree_dead.png",
  tree_birch: "assets/gen/tree_birch.png",
  zombie: "assets/gen/zombie.png",
  survivor: "assets/gen/survivor.png",
  bench: "assets/gen/bench.png",
  dumpster: "assets/gen/dumpster.png",
  tires: "assets/gen/tires.png",
  barrel: "assets/gen/barrel.png",
  win_intact: "assets/gen/win_intact.png",
  win_broken: "assets/gen/win_broken.png",
  win_lit: "assets/gen/win_lit.png",
  door_entry: "assets/gen/door_entry.png",
  survivor_bow_draw: "assets/gen/survivor_bow_draw.png",
  survivor_walk: "assets/gen/survivor_walk.png",
  // survivor_walk_front / survivor_walk_back (шаг для хода S/W) добавляются
  // сюда вместе с файлами генерации пользователя; до этого вертикаль → B
  npc_oleg: "assets/gen/npc_oleg.png",
  npc_vera: "assets/gen/npc_vera.png",
  npc_sanych: "assets/gen/npc_sanych.png",
  npc_raya: "assets/gen/npc_raya.png",
  npc_masha: "assets/gen/npc_masha.png",
  // мебель интерьера (этап 18); до генерации — процедурные изо-коробки
  furn_fridge: "assets/gen/furn_fridge.png",
  furn_table: "assets/gen/furn_table.png",
  furn_bed: "assets/gen/furn_bed.png",
  furn_wardrobe: "assets/gen/furn_wardrobe.png",
  furn_sofa: "assets/gen/furn_sofa.png",
  furn_shelf: "assets/gen/furn_shelf.png",
  furn_crate: "assets/gen/furn_crate.png",
  furn_sink: "assets/gen/furn_sink.png",
  furn_stove: "assets/gen/furn_stove.png",
  furn_toilet: "assets/gen/furn_toilet.png",
  furn_bathtub: "assets/gen/furn_bathtub.png",
  furn_bathroom_sink: "assets/gen/furn_bathroom_sink.png",
  furn_nightstand: "assets/gen/furn_nightstand.png",
  furn_dresser: "assets/gen/furn_dresser.png",
  furn_armchair: "assets/gen/furn_armchair.png",
  furn_tv: "assets/gen/furn_tv.png",
  furn_bookcase: "assets/gen/furn_bookcase.png",
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
          img.src = BASE + src;
        }),
    ),
  );
}

export async function loadAssets() {
  await Promise.all([loadSet(TEX_FILES, TEX), loadSet(SPRITE_FILES, SPRTEX)]);
  for (const kind of ["chair", "floor_lamp", "table_lamp", "washer", "dryer"]) {
    const key = "furn_" + kind;
    if (!SPRTEX[key]) SPRTEX[key] = createFurnitureModel(kind);
  }
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
