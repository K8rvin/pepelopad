// Генератор компактного города (этап 16.2).
// Нормативы: дорога 8 м + тротуары 3 м с двух сторон, квартал 62×62 м,
// периметральная застройка, дворы с площадками/парковкой, POI-кварталы.
import { mulberry32, pick } from "../core/rng.js";
import {
  T_GRASS,
  T_ASPHALT,
  T_SIDEWALK,
  T_PATH,
  T_SAND,
  T_FLOOR,
} from "../render/tiles.js";
import { buildBuildingGrid, solidInteriorAt } from "./interiors.js";
import { ZTYPES, GEN_RUNNER_CHANCE } from "../data/zombies.js";

export const ROAD = 8,
  SW = 3,
  BLOCK = 62,
  PITCH = ROAD + SW + BLOCK + SW; // 76

// сюжетные POI: ключ "bk,bl" (индексы квартала)
export const POIS = {
  "1,1": "park",
  "2,2": "supermarket",
  "3,6": "school",
  "6,2": "hospital",
  "5,3": "police",
  "0,1": "gas",
};

// архетипы зданий (общий спрайт на архетип — типовая застройка).
// Пригород (директива 20.11.2026): одноэтажные дома, открытые газоны, без заборов;
// двухэтажки вернутся на позднем этапе.
const ARCH_HOUSE = [
  { w: 11, h: 9, floors: 1, style: "house" },
  { w: 13, h: 8, floors: 1, style: "brick" },
  { w: 9, h: 8, floors: 1, style: "house" },
];
const ARCH_HOUSE_V = { w: 8, h: 11, floors: 1, style: "brick" };
const ARCH_KIOSK = { w: 6, h: 5, floors: 1, style: "kiosk" };
const CAR_COLORS = ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"];

export function createCity(seed = 11, nb = 19) {
  const SIZE = nb * PITCH + ROAD + SW * 2;
  const ground = new Uint8Array(SIZE * SIZE);
  const gflag = new Uint8Array(SIZE * SIZE); // 1=осевая вдоль Y, 2=вдоль X
  const city = {
    seed,
    nb,
    SIZE,
    ground,
    gflag,
    buildings: [],
    trees: [],
    lamps: [],
    benches: [],
    containers: [],
    tires: [],
    barrels: [],
    cars: [],
    fences: [],
    zombies: [],
    solidGrid: new Map(),
    brokenWindows: new Map(), // buildingId → Set("S:4.3" | "E:6.8") — разбитые окна
  };

  const r = mulberry32(seed);
  // земля
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const rx = x % PITCH,
        ry = y % PITCH;
      const onRoadX = rx < ROAD,
        onRoadY = ry < ROAD;
      let t = T_GRASS;
      if (onRoadX || onRoadY) t = T_ASPHALT;
      else if (
        rx < ROAD + SW ||
        ry < ROAD + SW ||
        rx >= PITCH - SW ||
        ry >= PITCH - SW
      )
        t = T_SIDEWALK;
      ground[y * SIZE + x] = t;
      if (rx === 4 && !onRoadY) gflag[y * SIZE + x] = 1;
      if (ry === 4 && !onRoadX) gflag[y * SIZE + x] = 2;
    }
  // кварталы
  for (let bk = 0; bk < nb; bk++)
    for (let bl = 0; bl < nb; bl++) {
      const bx0 = bk * PITCH + ROAD + SW,
        by0 = bl * PITCH + ROAD + SW;
      const poi = POIS[bk + "," + bl];
      if (poi)
        genPoiBlock(
          city,
          bx0,
          by0,
          poi,
          mulberry32(seed * 3000 + bk * 91 + bl * 7),
        );
      else genBlock(city, bx0, by0, mulberry32(seed * 1000 + bk * 91 + bl * 7));
    }
  // уличные машины и фонари вдоль дорог
  for (let k = 0; k <= nb; k++) {
    const rx0 = k * PITCH;
    for (let d = 18; d < SIZE - 10; d += 26 + Math.floor(r() * 18)) {
      if (d % PITCH < 12 || d % PITCH > PITCH - 4) continue; // не на перекрёстках
      if (r() < 0.55)
        pushCar(city, {
          x: rx0 + 5.9,
          y: d,
          axis: "y",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]),
          wreck: r() < 0.3,
        });
      if (r() < 0.55)
        pushCar(city, {
          x: d,
          y: rx0 + 5.9,
          axis: "x",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]),
          wreck: r() < 0.3,
        });
    }
    for (let d = 14; d < SIZE - 6; d += 26) {
      if (d % PITCH < ROAD + SW + 1 && d % PITCH < ROAD + 2) continue;
      city.lamps.push({ x: rx0 + ROAD + 1.6, y: d });
      city.lamps.push({ x: d, y: rx0 + ROAD + 1.6 });
    }
  }
  buildBuildingGrid(city);
  buildSolidIndex(city);
  // зомби: не внутри твёрдых тел и не у спавна (стартовые 60 м безопасны).
  // Популяция ~12/квартал: половина — стаями вокруг случайных точек,
  // иначе равномерный фон; дальние спят, поэтому кадр не дорожает.
  const spawnSafe = { x: PITCH + 11 + 31, y: PITCH + 11 + 31, r: 60 };
  let placed = 0,
    guard = 0;
  const target = nb * nb * 12 + 120;
  const centers = [];
  for (let i = 0; i < Math.floor((nb * nb) / 3); i++)
    centers.push({ x: 14 + r() * (SIZE - 28), y: 14 + r() * (SIZE - 28) });
  while (placed < target && guard++ < target * 30) {
    let zx, zy;
    if (centers.length && r() < 0.55) {
      const c = centers[Math.floor(r() * centers.length)];
      zx = c.x + (r() - 0.5) * 16;
      zy = c.y + (r() - 0.5) * 16;
    } else {
      zx = 14 + r() * (SIZE - 28);
      zy = 14 + r() * (SIZE - 28);
    }
    if (zx < 14 || zy < 14 || zx > SIZE - 14 || zy > SIZE - 14) continue;
    if (solidRectAt(city, zx, zy, 0.5)) continue;
    if (Math.hypot(zx - spawnSafe.x, zy - spawnSafe.y) < spawnSafe.r) continue;
    const zt = r() < GEN_RUNNER_CHANCE ? "runner" : "walker";
    city.zombies.push({
      x: zx,
      y: zy,
      r: 0.35,
      type: zt,
      hp: ZTYPES[zt].hp,
      pose: placed % 2,
      animT: r() * 5,
      tx: 0,
      ty: 0,
      retarget: 0,
      homeX: zx,
      homeY: zy,
    });
    placed++;
  }
  // полы внутри зданий
  for (const b of city.buildings)
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) ground[y * SIZE + x] = T_FLOOR;
  return city;
}

function genBlock(city, bx0, by0, r) {
  const { ground, SIZE } = city;
  // южный ряд: двери к южной улице, подъездные дорожки с машинами
  let x = bx0 + 3 + Math.floor(r() * 3);
  while (x < bx0 + BLOCK - 14) {
    const arch = pick(r, ARCH_HOUSE);
    if (x + arch.w > bx0 + BLOCK - 3) break;
    const y = by0 + BLOCK - arch.h - 2;
    addHouse(city, x, y, arch, r);
    const dx = x + arch.w - 4;
    for (let yy = y + arch.h; yy < by0 + BLOCK + SW + 2; yy++)
      for (let xx = dx; xx < dx + 3; xx++) ground[yy * SIZE + xx] = T_ASPHALT;
    if (r() < 0.6)
      pushCar(city, {
        x: dx + 0.6,
        y: y + arch.h + 1,
        axis: "y",
        color: pick(r, CAR_COLORS),
        wreck: r() < 0.25,
      });
    if (r() < 0.5) city.containers.push({ x: dx - 1.2, y: y + arch.h + 0.8 });
    x += arch.w + 6 + Math.floor(r() * 6);
  }
  // северный ряд: двери к общему газону, дорожка от двери
  x = bx0 + 4 + Math.floor(r() * 4);
  while (x < bx0 + BLOCK - 14) {
    if (r() < 0.2) {
      x += 12;
      continue;
    }
    const arch = pick(r, ARCH_HOUSE);
    if (x + arch.w > bx0 + BLOCK - 3) break;
    addHouse(city, x, by0 + 2, arch, r);
    x += arch.w + 7 + Math.floor(r() * 6);
  }
  // западная и восточная кромки — по одному дому
  for (const side of [0, 1]) {
    if (r() < 0.5) continue;
    const bx = side === 0 ? bx0 + 2 : bx0 + BLOCK - 10;
    addHouse(city, bx, by0 + 24 + Math.floor(r() * 8), ARCH_HOUSE_V, r);
  }
  genGreen(city, bx0, by0, r);
  if (r() < 0.25) {
    const kx = bx0 + 16 + Math.floor(r() * 30),
      ky = r() < 0.5 ? by0 + BLOCK - 6 : by0 + 2;
    city.buildings.push({
      id: city.buildings.length,
      x: kx,
      y: ky,
      ...ARCH_KIOSK,
      doorU: 3,
    });
  }
}

// дом + дорожка от двери на газон; бочка у стены
function addHouse(city, x, y, arch, r) {
  const { ground, SIZE } = city;
  city.buildings.push({
    id: city.buildings.length,
    x,
    y,
    ...arch,
    doorU: Math.round(arch.w / 2),
  });
  const du = x + Math.round(arch.w / 2);
  for (let yy = y + arch.h; yy < y + arch.h + 3; yy++)
    ground[yy * SIZE + du] = T_PATH;
  if (r() < 0.3) city.barrels.push({ x: x + 1, y: y + arch.h + 0.8 });
}

// общий газон квартала: площадка/пикник БЕЗ заборов, деревья на траве
function genGreen(city, bx0, by0, r) {
  const cx0 = bx0 + 16,
    cy0 = by0 + 16,
    cs = BLOCK - 34;
  const { ground, SIZE } = city;
  const feature = r();
  if (feature < 0.35) {
    // детская площадка: песок и скамейки, открытый газон вокруг
    const px = cx0 + 6,
      py = cy0 + 6;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    city.benches.push({ x: px + 10.5, y: py + 3 }, { x: px + 10.5, y: py + 6 });
  } else if (feature < 0.6) {
    // пикник-зона
    city.benches.push(
      { x: cx0 + 10, y: cy0 + 10 },
      { x: cx0 + 16, y: cy0 + 14 },
    );
    city.barrels.push({ x: cx0 + 13, y: cy0 + 12 });
    if (r() < 0.5) city.tires.push({ x: cx0 + 20, y: cy0 + 6 });
  }
  // деревья на газоне — только на траве
  const nTrees = 4 + Math.floor(r() * 4);
  for (let i = 0; i < nTrees * 2; i++) {
    const tx = cx0 + 2 + r() * (cs - 4),
      ty = cy0 + 2 + r() * (cs - 4);
    if (ground[(ty | 0) * SIZE + (tx | 0)] !== T_GRASS) continue;
    city.trees.push({ x: tx, y: ty, dead: r() < 0.3, v: Math.floor(r() * 3) });
  }
  // деревья у края квартала — только на траве внутри квартала (не на тротуаре!)
  for (let i = 0; i < 3; i++) {
    if (r() < 0.6) {
      const tx = bx0 + 2 + r(),
        ty = by0 + 8 + r() * (BLOCK - 16);
      if (
        ground[(ty | 0) * SIZE + (tx | 0)] === T_GRASS &&
        !buildingAt(city, tx, ty)
      )
        city.trees.push({
          x: tx,
          y: ty,
          dead: r() < 0.35,
          v: Math.floor(r() * 3),
        });
    }
    if (r() < 0.6) {
      const tx = bx0 + 8 + r() * (BLOCK - 16),
        ty = by0 + 2 + r();
      if (
        ground[(ty | 0) * SIZE + (tx | 0)] === T_GRASS &&
        !buildingAt(city, tx, ty)
      )
        city.trees.push({
          x: tx,
          y: ty,
          dead: r() < 0.35,
          v: Math.floor(r() * 3),
        });
    }
  }
}

// есть ли здание в точке (с запасом)
function buildingAt(city, x, y) {
  return city.buildings.some(
    (b) => x > b.x - 1 && x < b.x + b.w + 1 && y > b.y - 1 && y < b.y + b.h + 1,
  );
}

// машина не в здании (с запасом 0,8 м) — защита генерации
function pushCar(city, car) {
  const w = car.axis === "x" ? CAR_LEN : CAR_WID,
    h = car.axis === "x" ? CAR_WID : CAR_LEN,
    m = 0.8;
  const bad = city.buildings.some(
    (b) =>
      car.x < b.x + b.w + m &&
      car.x + w > b.x - m &&
      car.y < b.y + b.h + m &&
      car.y + h > b.y - m,
  );
  if (!bad) city.cars.push(car);
}

// POI-кварталы
function genPoiBlock(city, bx0, by0, kind, r) {
  const { ground, SIZE } = city;
  const put = (x, y, w, h, floors, style, name) => {
    city.buildings.push({
      id: city.buildings.length,
      x,
      y,
      w,
      h,
      floors,
      style,
      doorU: Math.round(w / 2),
      poi: name,
    });
  };
  if (kind === "school") {
    put(bx0 + 11, by0 + 8, 40, 20, 1, "brick", "Школа");
    const px = bx0 + 11,
      py = by0 + 36;
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 28; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    // школьный двор открытый, без забора (директива 20.11.2026)
    city.benches.push({ x: px + 30, y: py + 6 }, { x: px + 30, y: py + 12 });
  } else if (kind === "hospital") {
    put(bx0 + 13, by0 + 10, 36, 18, 1, "panel", "Больница");
    for (let i = 0; i < 4; i++) {
      const tx = bx0 + 10 + r() * 42,
        ty = by0 + 34 + r() * 20;
      if (ground[(ty | 0) * SIZE + (tx | 0)] !== T_GRASS) continue;
      city.trees.push({ x: tx, y: ty, dead: false, v: i % 3 });
    }
    city.containers.push({ x: bx0 + 29, y: by0 + 30 });
  } else if (kind === "supermarket") {
    put(bx0 + 17, by0 + 6, 28, 16, 1, "brick", "Супермаркет");
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 30; x++)
        ground[(by0 + 26 + y) * SIZE + bx0 + 16 + x] = T_ASPHALT;
    for (let i = 0; i < 5; i++)
      if (r() < 0.8)
        pushCar(city, {
          x: bx0 + 19 + i * 5.4,
          y: by0 + 30,
          axis: "y",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]),
          kind: i % 3 === 1 ? "van" : "sedan", // у супермаркета чаще фургоны (без трат rng)
          wreck: r() < 0.35,
        });
    city.lamps.push({ x: bx0 + 18, y: by0 + 44 }, { x: bx0 + 44, y: by0 + 44 });
  } else if (kind === "police") {
    put(bx0 + 19, by0 + 12, 24, 12, 1, "panel", "Полиция");
    pushCar(city, {
      x: bx0 + 24,
      y: by0 + 27,
      axis: "x",
      color: "#3a4a5c",
      wreck: false,
    });
  } else if (kind === "gas") {
    put(bx0 + 10, by0 + 10, 8, 6, 1, "kiosk", "АЗС");
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 24; x++)
        ground[(by0 + 24 + y) * SIZE + bx0 + 8 + x] = T_ASPHALT;
    city.containers.push(
      { x: bx0 + 14, y: by0 + 28 },
      { x: bx0 + 24, y: by0 + 28 },
    );
    city.lamps.push({ x: bx0 + 8, y: by0 + 24 }, { x: bx0 + 32, y: by0 + 24 });
  } else if (kind === "park") {
    for (let y = 0; y < BLOCK; y++)
      for (let x = 0; x < BLOCK; x++)
        if (x % 24 < 2 || y % 24 < 2) {
          const gx = bx0 + x,
            gy = by0 + y;
          if (ground[gy * SIZE + gx] === T_GRASS)
            ground[gy * SIZE + gx] = T_PATH;
        }
    for (let i = 0; i < 22; i++) {
      const tx = bx0 + 3 + r() * (BLOCK - 6),
        ty = by0 + 3 + r() * (BLOCK - 6);
      if (ground[(ty | 0) * SIZE + (tx | 0)] !== T_GRASS) continue;
      city.trees.push({
        x: tx,
        y: ty,
        dead: r() < 0.4,
        v: Math.floor(r() * 3),
      });
    }
    city.benches.push(
      { x: bx0 + 20, y: by0 + 20 },
      { x: bx0 + 40, y: by0 + 42 },
      { x: bx0 + 42, y: by0 + 18 },
    );
    city.lamps.push({ x: bx0 + 14, y: by0 + 14 }, { x: bx0 + 48, y: by0 + 48 });
  }
}

// пространственный индекс твёрдых тел (коллизии за O(1))
export const SOLID_CELL = 16;

// габариты машины: длина вдоль курса, ширина поперёк
export const CAR_LEN = 4.4,
  CAR_WID = 1.8;

// AABB по курсу (квантование до доминирующей оси; турнтейбл-рендер плавный)
export function carDims(car) {
  const h = car.heading ?? (car.axis === "x" ? 0 : Math.PI / 2);
  return Math.abs(Math.cos(h)) >= Math.abs(Math.sin(h))
    ? { w: CAR_LEN, h: CAR_WID }
    : { w: CAR_WID, h: CAR_LEN };
}

export function carCenter(car) {
  const { w, h } = carDims(car);
  return { x: car.x + w / 2, y: car.y + h / 2 };
}

function addSolid(city, x, y, w, h, kind, ref = null) {
  const x0 = Math.floor(x / SOLID_CELL),
    x1 = Math.floor((x + w) / SOLID_CELL);
  const y0 = Math.floor(y / SOLID_CELL),
    y1 = Math.floor((y + h) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const k = cx + "," + cy;
      if (!city.solidGrid.has(k)) city.solidGrid.set(k, []);
      city.solidGrid.get(k).push({ x, y, w, h, kind, ref });
    }
}
export function buildSolidIndex(city) {
  city.solidGrid = new Map();
  // здания НЕ в сетке: их стены проверяет solidInteriorAt (фасад с дверью + перегородки)
  for (const c of city.cars) {
    const { w, h } = carDims(c);
    addSolid(city, c.x, c.y, w, h, "car", c);
  }
  for (const t of city.trees)
    addSolid(city, t.x - 0.4, t.y - 0.4, 0.8, 0.8, "tree", t);
  for (const l of city.lamps)
    if (!l.dead) addSolid(city, l.x - 0.15, l.y - 0.15, 0.3, 0.3, "lamp", l);
  for (const f of city.fences)
    if (!f.dead)
      addSolid(
        city,
        f.x0,
        f.y0 - (f.axis === "x" ? 0.05 : 0),
        f.axis === "x" ? f.x1 - f.x0 : 0.1,
        f.axis === "x" ? 0.1 : f.y1 - f.y0,
        "fence",
        f,
      );
  // мелкие сбиваемые машиной объекты
  for (const p of city.containers)
    if (!p.dead) addSolid(city, p.x - 0.6, p.y - 0.4, 1.2, 0.8, "prop", p);
  for (const p of city.barrels)
    if (!p.dead) addSolid(city, p.x - 0.3, p.y - 0.3, 0.6, 0.6, "prop", p);
  for (const p of city.benches)
    if (!p.dead) addSolid(city, p.x - 0.8, p.y - 0.3, 1.6, 0.6, "prop", p);
  for (const p of city.tires)
    if (!p.dead) addSolid(city, p.x - 0.4, p.y - 0.3, 0.8, 0.6, "prop", p);
}

// первое твёрдое тело в точке (для сноса машиной нужен kind/ref)
export function solidHitAt(city, x, y, r, excludeRef = null, level = 0) {
  if (solidInteriorAt(city, x, y, r, level)) return { kind: "wall" };
  const x0 = Math.floor((x - r) / SOLID_CELL),
    x1 = Math.floor((x + r) / SOLID_CELL);
  const y0 = Math.floor((y - r) / SOLID_CELL),
    y1 = Math.floor((y + r) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const cell = city.solidGrid.get(cx + "," + cy);
      if (!cell) continue;
      for (const s of cell) {
        if (excludeRef && s.ref === excludeRef) continue;
        if (s.kind === "tree") {
          if (Math.hypot(x - (s.x + 0.4), y - (s.y + 0.4)) < 0.5 + r) return s;
        } else if (
          x > s.x - r &&
          x < s.x + s.w + r &&
          y > s.y - r &&
          y < s.y + s.h + r
        )
          return s;
      }
    }
  return null;
}

export function solidRectAt(city, x, y, r, excludeRef = null, level = 0) {
  return !!solidHitAt(city, x, y, r, excludeRef, level);
}

export function tileAt(city, x, y) {
  if (x < 0 || y < 0 || x >= city.SIZE || y >= city.SIZE) return T_GRASS;
  return city.ground[(y | 0) * city.SIZE + (x | 0)];
}
