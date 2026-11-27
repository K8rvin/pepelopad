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

export const PORTRAIT_FILES = {
  portrait_oleg: "assets/gen/portrait_oleg.png",
  portrait_vera: "assets/gen/portrait_vera.png",
  portrait_sanych: "assets/gen/portrait_sanych.png",
  portrait_raya: "assets/gen/portrait_raya.png",
  portrait_masha: "assets/gen/portrait_masha.png",
  portrait_gg: "assets/gen/portrait_gg.png",
};

export const MATKA_WALK_FRAMES = 8;

export const SPRITE_FILES = {
  tree: "assets/gen/tree_poplar.png", // GPT-замена Gemini-тополя (без белых карманов)
  tree_dead: "assets/gen/tree_dead.png",
  tree_dead_split: "assets/gen/tree_dead_split.png",
  tree_birch: "assets/gen/tree_birch.png",
  tree_birch_sparse: "assets/gen/tree_birch_sparse.png",
  bush_dusty: "assets/gen/bush_dusty.png",
  stump_old: "assets/gen/stump_old.png",
  branch_fallen: "assets/gen/branch_fallen.png",
  street_bus_stop: "assets/gen/street_bus_stop.png",
  street_mailbox: "assets/gen/street_mailbox.png",
  street_shopping_cart: "assets/gen/street_shopping_cart.png",
  street_road_sign: "assets/gen/street_road_sign.png",
  street_electric_cabinet: "assets/gen/street_electric_cabinet.png",
  street_barrier: "assets/gen/street_barrier.png",
  street_trash_pile: "assets/gen/street_trash_pile.png",
  billboard_empty: "assets/gen/billboard_empty.png",
  billboard_poster: "assets/gen/billboard_poster.png",
  billboard_torn: "assets/gen/billboard_torn.png",
  resident_man: "assets/gen/resident_man.png",
  resident_woman: "assets/gen/resident_woman.png",
  base_window_barricade: "assets/gen/base_window_barricade.png",
  base_door_barricade: "assets/gen/base_door_barricade.png",
  base_bed: "assets/gen/base_bed.png",
  base_medical: "assets/gen/base_medical.png",
  base_workbench: "assets/gen/base_workbench.png",
  base_storage: "assets/gen/base_storage.png",
  base_radio: "assets/gen/base_radio.png",
  zombie: "assets/gen/zombie.png",
  zombie_walk: "assets/gen/zombie_walk.png",
  zombie_hurt: "assets/gen/zombie_hurt.png",
  zombie_fall: "assets/gen/zombie_fall.png",
  zombie_attack: "assets/gen/zombie_attack.png",
  runner: "assets/gen/runner.png",
  runner_walk: "assets/gen/runner_walk.png",
  runner_hurt: "assets/gen/runner_hurt.png",
  runner_fall: "assets/gen/runner_fall.png",
  runner_attack: "assets/gen/runner_attack.png",
  brute: "assets/gen/brute.png",
  brute_walk: "assets/gen/brute_walk.png",
  brute_hurt: "assets/gen/brute_hurt.png",
  brute_fall: "assets/gen/brute_fall.png",
  brute_attack: "assets/gen/brute_attack.png",
  matka: "assets/gen/matka.png",
  matka_walk: "assets/gen/matka_walk.png",
  matka_hurt: "assets/gen/matka_hurt.png",
  matka_fall: "assets/gen/matka_fall.png",
  matka_attack: "assets/gen/matka_attack.png",
  matka_walk_0: "assets/gen/matka_walk_0.png",
  matka_walk_1: "assets/gen/matka_walk_1.png",
  matka_walk_2: "assets/gen/matka_walk_2.png",
  matka_walk_3: "assets/gen/matka_walk_3.png",
  matka_walk_4: "assets/gen/matka_walk_4.png",
  matka_walk_5: "assets/gen/matka_walk_5.png",
  matka_walk_6: "assets/gen/matka_walk_6.png",
  matka_walk_7: "assets/gen/matka_walk_7.png",
  survivor: "assets/gen/survivor.png",
  bench: "assets/gen/bench.png",
  dumpster: "assets/gen/dumpster.png",
  tires: "assets/gen/tires.png",
  barrel: "assets/gen/barrel.png",
  tent_olive: "assets/gen/tent_olive.png",
  tent_tan: "assets/gen/tent_tan.png",
  crate_wood: "assets/gen/crate_wood.png",
  barricade: "assets/gen/barricade.png",
  barricade_gate: "assets/gen/barricade_gate.png",
  generator: "assets/gen/generator.png",
  fire_0: "assets/gen/fire_0.png",
  fire_1: "assets/gen/fire_1.png",
  fire_2: "assets/gen/fire_2.png",
  win_intact: "assets/gen/win_intact.png",
  win_broken: "assets/gen/win_broken.png",
  win_lit: "assets/gen/win_lit.png",
  door_entry: "assets/gen/door_entry.png",
  survivor_bow_draw: "assets/gen/survivor_bow_draw.png",
  survivor_bow_release: "assets/gen/survivor_bow_release.png",
  survivor_walk: "assets/gen/survivor_walk.png",
  survivor_walk_front: "assets/gen/survivor_walk_front.png",
  survivor_walk_back: "assets/gen/survivor_walk_back.png",
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
  furn_floor_lamp: "assets/gen/furn_floor_lamp.png",
  furn_table_lamp: "assets/gen/furn_table_lamp.png",
  furn_chair: "assets/gen/furn_chair.png",
  furn_washer: "assets/gen/furn_washer.png",
  furn_dryer: "assets/gen/furn_dryer.png",
  decor_rug: "assets/gen/decor_rug.png",
  decor_painting: "assets/gen/decor_painting.png",
  decor_clock: "assets/gen/decor_clock.png",
  decor_curtains: "assets/gen/decor_curtains.png",
  decor_books: "assets/gen/decor_books.png",
  decor_clothes: "assets/gen/decor_clothes.png",
  decor_dishes: "assets/gen/decor_dishes.png",
  decor_teddy: "assets/gen/decor_teddy.png",
  decor_papers: "assets/gen/decor_papers.png",
};

function loadSet(files, target, onFile) {
  return Promise.all(
    Object.entries(files).map(
      ([k, src]) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            target[k] = img;
            onFile?.();
            res();
          };
          img.onerror = () => {
            onFile?.();
            res(); // fallback: процедурные спрайты
          };
          img.src = BASE + src;
        }),
    ),
  );
}

// onProgress(frac, kind): kind — набор, который ещё грузится (textures/sprites/portraits)
export async function loadAssets(onProgress) {
  const sets = [
    ["textures", TEX_FILES, TEX],
    ["sprites", SPRITE_FILES, SPRTEX],
    ["portraits", PORTRAIT_FILES, SPRTEX],
  ];
  const total = sets.reduce((n, [, f]) => n + Object.keys(f).length, 0);
  const done = { textures: 0, sprites: 0, portraits: 0 };
  let loaded = 0;
  const report = () => {
    const kind =
      sets.find(([k, f]) => done[k] < Object.keys(f).length)?.[0] ||
      "portraits";
    onProgress?.(loaded / total, kind);
  };
  await Promise.all(
    sets.map(([kind, files, target]) =>
      loadSet(files, target, () => {
        done[kind]++;
        loaded++;
        report();
      }),
    ),
  );
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
