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

// архетипы зданий (общий спрайт на архетип — типовая застройка)
const ARCH_ROW = [
  { w: 30, h: 12, floors: 2, style: "panel" },
  { w: 24, h: 12, floors: 3, style: "panel" },
  { w: 20, h: 14, floors: 1, style: "brick" }, // магазин
];
const ARCH_COL = [{ w: 12, h: 24, floors: 3, style: "brick" }];
const ARCH_KIOSK = { w: 6, h: 5, floors: 1, style: "kiosk" };

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
        city.cars.push({
          x: rx0 + 5.9,
          y: d,
          axis: "y",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]),
          wreck: r() < 0.3,
        });
      if (r() < 0.55)
        city.cars.push({
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
  buildSolidIndex(city);
  // зомби: не внутри твёрдых тел
  let placed = 0,
    guard = 0;
  const target = nb * nb + 80;
  while (placed < target && guard++ < target * 20) {
    const zx = 14 + r() * (SIZE - 28),
      zy = 14 + r() * (SIZE - 28);
    if (solidRectAt(city, zx, zy, 0.5)) continue;
    city.zombies.push({
      x: zx,
      y: zy,
      r: 0.35,
      pose: placed % 2,
      animT: r() * 5,
      tx: 0,
      ty: 0,
      retarget: 0,
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
  // северная и южная стороны — горизонтальные дома
  for (const side of [0, 1]) {
    if (r() < 0.15) continue;
    const by = side === 0 ? by0 + 1 : by0 + BLOCK - 13;
    let x = bx0 + 2 + Math.floor(r() * 4);
    while (x < bx0 + BLOCK - 22) {
      const arch = r() < 0.12 ? ARCH_ROW[2] : pick(r, ARCH_ROW.slice(0, 2));
      if (x + arch.w > bx0 + BLOCK - 2) break;
      city.buildings.push({
        id: city.buildings.length,
        x,
        y: by,
        ...arch,
        doorU: Math.round(arch.w / 2),
      });
      if (r() < 0.5)
        city.containers.push({ x: x + arch.w / 2 + 3, y: by + arch.h + 1.4 });
      if (r() < 0.3)
        city.barrels.push({ x: x + 2 + r() * arch.w, y: by + arch.h + 1.2 });
      x += arch.w + 3 + Math.floor(r() * 8);
    }
  }
  // западная и восточная стороны — торцевые вертикальные
  for (const side of [0, 1]) {
    if (r() < 0.4) continue;
    const bx = side === 0 ? bx0 + 1 : bx0 + BLOCK - 13;
    let y = by0 + 15 + Math.floor(r() * 5);
    while (y < by0 + BLOCK - 26) {
      const arch = ARCH_COL[0];
      if (y + arch.h > by0 + BLOCK - 2) break;
      city.buildings.push({
        id: city.buildings.length,
        x: bx,
        y,
        ...arch,
        doorU: 6,
      });
      y += arch.h + 4 + Math.floor(r() * 8);
    }
  }
  genCourtyard(city, bx0, by0, r);
  if (r() < 0.45) {
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

function genCourtyard(city, bx0, by0, r) {
  const cx0 = bx0 + 16,
    cy0 = by0 + 16,
    cs = BLOCK - 34;
  const { ground, SIZE } = city;
  // дорожки крестом
  const mid = Math.floor(cs / 2);
  for (let i = 0; i < cs; i++)
    for (const o of [-1, 0, 1]) {
      const gx = cx0 + i,
        gy = cy0 + mid + o;
      if (ground[gy * SIZE + gx] === T_GRASS) ground[gy * SIZE + gx] = T_PATH;
      const gx2 = cx0 + mid + o,
        gy2 = cy0 + i;
      if (ground[gy2 * SIZE + gx2] === T_GRASS)
        ground[gy2 * SIZE + gx2] = T_PATH;
    }
  const feature = r();
  if (feature < 0.4) {
    // детская площадка с рабицей
    const px = cx0 + 6,
      py = cy0 + 6;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    city.fences.push(
      { x0: px, y0: py, x1: px + 3, y1: py, axis: "x" },
      { x0: px + 5, y0: py, x1: px + 8, y1: py, axis: "x" },
      { x0: px, y0: py + 8, x1: px + 8, y1: py + 8, axis: "x" },
      { x0: px, y0: py, x1: px, y1: py + 8, axis: "y" },
      { x0: px + 8, y0: py, x1: px + 8, y1: py + 8, axis: "y" },
    );
    city.benches.push({ x: px + 10.5, y: py + 3 }, { x: px + 10.5, y: py + 6 });
  } else if (feature < 0.65) {
    // парковка во дворе
    for (let i = 0; i < 4; i++)
      if (r() < 0.7)
        city.cars.push({
          x: cx0 + 4 + i * 6,
          y: cy0 + 4,
          axis: "y",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283"]),
          wreck: r() < 0.4,
        });
    city.tires.push({ x: cx0 + 20, y: cy0 + 6 });
  }
  // деревья во дворе
  const nTrees = 3 + Math.floor(r() * 4);
  for (let i = 0; i < nTrees; i++) {
    const tx = cx0 + 2 + r() * (cs - 4),
      ty = cy0 + 2 + r() * (cs - 4);
    if (Math.abs(tx - cx0 - mid) < 2.5 || Math.abs(ty - cy0 - mid) < 2.5)
      continue; // не на дорожках
    city.trees.push({ x: tx, y: ty, dead: r() < 0.3, v: Math.floor(r() * 3) });
  }
  // деревья вдоль улиц квартала
  for (let i = 0; i < 3; i++) {
    if (r() < 0.6)
      city.trees.push({
        x: bx0 - 4.5 + r(),
        y: by0 + 8 + r() * (BLOCK - 16),
        dead: r() < 0.35,
        v: Math.floor(r() * 3),
      });
    if (r() < 0.6)
      city.trees.push({
        x: bx0 + 8 + r() * (BLOCK - 16),
        y: by0 - 4.5 + r(),
        dead: r() < 0.35,
        v: Math.floor(r() * 3),
      });
  }
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
    put(bx0 + 11, by0 + 8, 40, 20, 2, "brick", "Школа");
    const px = bx0 + 11,
      py = by0 + 36;
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 28; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    city.fences.push(
      { x0: px, y0: py, x1: px + 28, y1: py, axis: "x" },
      { x0: px, y0: py + 20, x1: px + 12, y1: py + 20, axis: "x" },
      { x0: px + 16, y0: py + 20, x1: px + 28, y1: py + 20, axis: "x" },
      { x0: px, y0: py, x1: px, y1: py + 20, axis: "y" },
      { x0: px + 28, y0: py, x1: px + 28, y1: py + 20, axis: "y" },
    );
  } else if (kind === "hospital") {
    put(bx0 + 13, by0 + 10, 36, 18, 4, "panel", "Больница");
    for (let i = 0; i < 4; i++)
      city.trees.push({
        x: bx0 + 10 + r() * 42,
        y: by0 + 34 + r() * 20,
        dead: false,
        v: i % 3,
      });
    city.containers.push({ x: bx0 + 29, y: by0 + 30 });
  } else if (kind === "supermarket") {
    put(bx0 + 17, by0 + 6, 28, 16, 1, "brick", "Супермаркет");
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 30; x++)
        ground[(by0 + 26 + y) * SIZE + bx0 + 16 + x] = T_ASPHALT;
    for (let i = 0; i < 5; i++)
      if (r() < 0.8)
        city.cars.push({
          x: bx0 + 19 + i * 5.4,
          y: by0 + 30,
          axis: "y",
          color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]),
          wreck: r() < 0.35,
        });
    city.lamps.push({ x: bx0 + 18, y: by0 + 44 }, { x: bx0 + 44, y: by0 + 44 });
  } else if (kind === "police") {
    put(bx0 + 19, by0 + 12, 24, 12, 2, "panel", "Полиция");
    city.cars.push({
      x: bx0 + 24,
      y: by0 + 27,
      axis: "x",
      color: "#3a4a5c",
      wreck: false,
    });
    city.fences.push({
      x0: bx0 + 19,
      y0: by0 + 30,
      x1: bx0 + 43,
      y1: by0 + 30,
      axis: "x",
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
    for (let i = 0; i < 22; i++)
      city.trees.push({
        x: bx0 + 3 + r() * (BLOCK - 6),
        y: by0 + 3 + r() * (BLOCK - 6),
        dead: r() < 0.4,
        v: Math.floor(r() * 3),
      });
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
function addSolid(city, x, y, w, h, kind) {
  const x0 = Math.floor(x / SOLID_CELL),
    x1 = Math.floor((x + w) / SOLID_CELL);
  const y0 = Math.floor(y / SOLID_CELL),
    y1 = Math.floor((y + h) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const k = cx + "," + cy;
      if (!city.solidGrid.has(k)) city.solidGrid.set(k, []);
      city.solidGrid.get(k).push({ x, y, w, h, kind });
    }
}
function buildSolidIndex(city) {
  city.solidGrid = new Map();
  for (const b of city.buildings)
    addSolid(city, b.x, b.y, b.w, b.h, "building");
  for (const c of city.cars)
    addSolid(
      city,
      c.x,
      c.y,
      c.axis === "x" ? 4.4 : 1.8,
      c.axis === "x" ? 1.8 : 4.4,
      "car",
    );
  for (const t of city.trees)
    addSolid(city, t.x - 0.4, t.y - 0.4, 0.8, 0.8, "tree");
  for (const l of city.lamps)
    addSolid(city, l.x - 0.15, l.y - 0.15, 0.3, 0.3, "lamp");
  for (const f of city.fences)
    addSolid(
      city,
      f.x0,
      f.y0 - (f.axis === "x" ? 0.05 : 0),
      f.axis === "x" ? f.x1 - f.x0 : 0.1,
      f.axis === "x" ? 0.1 : f.y1 - f.y0,
      "fence",
    );
}

export function solidRectAt(city, x, y, r) {
  const x0 = Math.floor((x - r) / SOLID_CELL),
    x1 = Math.floor((x + r) / SOLID_CELL);
  const y0 = Math.floor((y - r) / SOLID_CELL),
    y1 = Math.floor((y + r) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const cell = city.solidGrid.get(cx + "," + cy);
      if (!cell) continue;
      for (const s of cell) {
        if (s.kind === "tree") {
          if (Math.hypot(x - (s.x + 0.4), y - (s.y + 0.4)) < 0.5 + r)
            return true;
        } else if (
          x > s.x - r &&
          x < s.x + s.w + r &&
          y > s.y - r &&
          y < s.y + s.h + r
        )
          return true;
      }
    }
  return false;
}

export function tileAt(city, x, y) {
  if (x < 0 || y < 0 || x >= city.SIZE || y >= city.SIZE) return T_GRASS;
  return city.ground[(y | 0) * city.SIZE + (x | 0)];
}
