// Жилые одноэтажные дома используют suburbInterior; POI и многоэтажные здания —
// прежний коридорный генератор. Коллизии — отрезки стен + AABB мебели.
import { mulberry32 } from "../core/rng.js";
import { suburbInterior } from "./suburbInterior.js";
import { storyInterior } from "./storyInteriors.js";

const cache = new Map(); // buildingId → interior

// зазор прохода: персонаж r=0,35 + поля = не ближе 0,9 м к препятствиям
const CLEAR = 1.1;

// сгенерировать планировку здания (детерминированно по id)
export function getInterior(city, b) {
  const key = `${b.id}f${b.floors}_${b.w}x${b.h}_${b.style}_${b.doorU}`;
  let it = cache.get(key);
  if (!it) {
    const residential =
      !b.locationId &&
      (b.style === "house" || b.style === "brick") &&
      b.floors === 1;
    it = b.locationId
      ? storyInterior(b)
      : residential
        ? suburbInterior(b)
        : corridorInterior(b);
    cache.set(key, it);
  }
  return it;
}

function corridorInterior(b) {
  const r = mulberry32(b.id * 7919 + 13);
  const w = Math.floor(b.w),
    h = Math.floor(b.h);
  const walls = [];
  const rooms = [];
  const furniture = []; // {kind, x, y, w, h, container?}
  const containers = []; // {id, kind, x, y}

  const wide = w >= h;
  const corrW = 2;
  let corrA, corrB;
  if (wide) {
    corrA = Math.floor(h / 2) - 1;
    corrB = corrA + corrW;
  } else {
    corrA = Math.floor(w / 2) - 1;
    corrB = corrA + corrW;
  }

  // нарезка на комнаты 8–11 м вдоль длинной оси; границы — от стены до стены
  function sliceStrip(len) {
    const cuts = [1];
    let x = 1;
    while (len - 1 - x > 11) {
      x += 8 + Math.floor(r() * 4);
      cuts.push(x);
    }
    cuts.push(len - 1);
    return cuts;
  }

  const ROLE_CYCLE = ["kitchen", "bedroom", "living", "storage"];

  function wallRoomWithFurniture(x1, y1, x2, y2, doorX, doorY, role) {
    // мебель по роли, зазоры от двери и углов
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2;
    const doorAlongX = doorY === y1 || doorY === y2 ? 1 : 0;
    const put = (kind, fx, fy, fw, fh, container) => {
      // не ближе CLEAR к дверному проёму
      if (
        Math.abs(fx + fw / 2 - doorX) < CLEAR + 0.4 &&
        Math.abs(fy + fh / 2 - doorY) < CLEAR + 0.4
      )
        return;
      furniture.push({ kind, x: fx, y: fy, w: fw, h: fh });
      if (container)
        containers.push({ id: null, kind, x: fx + fw / 2, y: fy + fh / 2 });
    };
    if (role === "kitchen") {
      put("fridge", x1 + 0.6, y1 + 0.3, 1.1, 0.8, true);
      put("table", mx - 0.8, my - 0.4, 1.6, 0.9, false);
    } else if (role === "bedroom") {
      put("bed", x1 + 0.5, y1 + 0.2, 2.0, 1.1, false);
      put("wardrobe", x2 - 1.6, y1 + 0.2, 1.2, 0.6, true);
    } else if (role === "living") {
      put("sofa", x1 + 0.5, y2 - 1.1, 2.0, 0.8, false);
      put("shelf", x2 - 1.5, y1 + 0.2, 1.2, 0.5, true);
    } else {
      put("shelf", x1 + 0.5, y1 + 0.2, 1.2, 0.5, true);
      put("shelf", x2 - 1.7, y2 - 0.8, 1.2, 0.5, true);
      put("crate", mx - 0.5, my - 0.4, 1.0, 0.8, true);
    }
  }

  if (wide) {
    const cutsN = sliceStrip(w);
    const cutsS = sliceStrip(w);
    // перегородки ВПЛОТНУЮ к фасаду (никаких щелей 1 м!)
    for (const cuts of [cutsN, cutsS])
      for (let i = 1; i < cuts.length - 1; i++) {
        const cx = cuts[i];
        if (cuts === cutsN) walls.push({ x1: cx, y1: 0, x2: cx, y2: corrA });
        else walls.push({ x1: cx, y1: corrB, x2: cx, y2: h });
      }
    // стены коридора на всю ширину с дверями 1,2 м в каждую комнату
    for (const [cuts, yWall, north] of [
      [cutsN, corrA, true],
      [cutsS, corrB, false],
    ]) {
      for (let i = 0; i + 1 < cuts.length; i++) {
        const x1 = cuts[i],
          x2 = cuts[i + 1];
        const doorX = Math.floor((x1 + x2) / 2);
        walls.push({ x1, y1: yWall, x2: doorX - 0.6, y2: yWall });
        walls.push({ x1: doorX + 0.6, y1: yWall, x2, y2: yWall });
        const role = ROLE_CYCLE[(north ? i : i + 2) % ROLE_CYCLE.length];
        rooms.push({
          x1,
          y1: north ? 0 : corrB,
          x2,
          y2: north ? corrA : h,
          doorX,
          doorY: yWall,
          role,
        });
        wallRoomWithFurniture(
          x1,
          north ? 0 : corrB,
          x2,
          north ? corrA : h,
          doorX,
          yWall,
          role,
        );
      }
    }
  } else {
    // высокое здание: коридор вертикальный, комнаты слева/справа
    const cutsW = sliceStrip(h);
    const cutsE = sliceStrip(h);
    for (const cuts of [cutsW, cutsE])
      for (let i = 1; i < cuts.length - 1; i++) {
        const cy = cuts[i];
        if (cuts === cutsW) walls.push({ x1: 0, y1: cy, x2: corrA, y2: cy });
        else walls.push({ x1: corrB, y1: cy, x2: w, y2: cy });
      }
    for (const [cuts, xWall, west] of [
      [cutsW, corrA, true],
      [cutsE, corrB, false],
    ]) {
      for (let i = 0; i + 1 < cuts.length; i++) {
        const y1 = cuts[i],
          y2 = cuts[i + 1];
        const doorY = Math.floor((y1 + y2) / 2);
        walls.push({ x1: xWall, y1, x2: xWall, y2: doorY - 0.6 });
        walls.push({ x1: xWall, y1: doorY + 0.6, x2: xWall, y2 });
        const role = ROLE_CYCLE[(west ? i : i + 2) % ROLE_CYCLE.length];
        rooms.push({
          x1: west ? 0 : corrB,
          y1,
          x2: west ? corrA : w,
          y2,
          doorX: xWall,
          doorY,
          role,
        });
        wallRoomWithFurniture(
          west ? 0 : corrB,
          y1,
          west ? corrA : w,
          y2,
          xWall,
          doorY,
          role,
        );
      }
    }
  }

  // id контейнеров
  containers.forEach((c, i) => (c.id = "int" + b.id + "_" + i));

  const it = {
    walls,
    rooms,
    furniture,
    containers,
    wide,
    corrA,
    corrB,
    doorU: b.doorU ?? Math.round(w / 2),
    stairs:
      b.floors > 1
        ? wide
          ? { x: w - 4, y: corrA - 0.5, w: 3, h: 3 }
          : { x: corrA - 0.5, y: 1.5, w: 3, h: 3 }
        : null,
  };
  return it;
}

// коллизия круга со стенами зданий поблизости: фасадные стены (с проёмом двери,
// работают с обеих сторон) + внутренние перегородки (только когда внутри).
export function solidInteriorAt(city, x, y, r, level = 0) {
  const cx = Math.floor(x / 16),
    cy = Math.floor(y / 16);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cell = city.buildingGrid?.get(cx + dx + "," + (cy + dy));
      if (!cell) continue;
      for (const b of cell) {
        if (
          x < b.x - r - 1 ||
          x > b.x + b.w + r + 1 ||
          y < b.y - r - 1 ||
          y > b.y + b.h + r + 1
        )
          continue;
        const it = getInterior(city, b);
        const lx = x - b.x,
          ly = y - b.y;
        const inside = lx >= 0 && lx < b.w && ly >= 0 && ly < b.h;
        // фасадные стены с проёмами: дверь (юг) + разбитые окна (юг/восток, только улица)
        const du = level > 0 ? -99 : it.doorU;
        const W = b.w,
          H = b.h;
        const broken = level === 0 ? city.brokenWindows?.get(b.id) : null;
        const southGaps = [[du, 0.7]];
        const eastGaps = [];
        if (broken)
          for (const key of broken) {
            const [face, u] = key.split(":");
            if (face === "S") southGaps.push([Number(u), 0.6]);
            else eastGaps.push([Number(u), 0.6]);
          }
        const ext = [
          [0, 0, W, 0], // север
          ...wallWithGaps(0, H, W, H, southGaps), // юг с дверью и разбитыми окнами
          [0, 0, 0, H], // запад
          ...wallWithGaps(W, 0, W, H, eastGaps), // восток с разбитыми окнами
        ];
        for (const [x1, y1, x2, y2] of ext)
          if (distToSeg(lx, ly, x1, y1, x2, y2) < r + 0.15) return true;
        for (const lock of city.storyLocks || []) {
          if (lock.buildingId !== b.id) continue;
          const object = city.storyObjects?.find((o) => o.id === lock.id);
          if (object?.unlocked) continue;
          if (distToSeg(lx, ly, lock.x1, lock.y1, lock.x2, lock.y2) < r + 0.12)
            return true;
        }
        if (inside) {
          for (const sgm of it.walls)
            if (distToSeg(lx, ly, sgm.x1, sgm.y1, sgm.x2, sgm.y2) < r + 0.12)
              return true;
          // мебель (AABB в локальных метрах)
          for (const f of it.furniture || [])
            if (
              lx > f.x - r &&
              lx < f.x + f.w + r &&
              ly > f.y - r &&
              ly < f.y + f.h + r
            )
              return true;
        }
      }
    }
  return false;
}

// позиции окон первого этажа на южной и восточной гранях (та же сетка, что в спрайте)
export function groundWindows(b) {
  const wins = [];
  const du = b.doorU ?? Math.round(b.w / 2);
  for (let u = 1.8; u < b.w - 1.8; u += 2.5) {
    if (Math.abs(u - du) < 1.6) continue; // над дверью окна нет
    wins.push({ face: "S", u, x: b.x + u, y: b.y + b.h });
  }
  for (let u = 1.8; u < b.h - 1.8; u += 2.5)
    wins.push({ face: "E", u, x: b.x + b.w, y: b.y + u });
  return wins;
}

// стена с проёмами: gaps = [[pos, halfWidth]] вдоль стены → массив отрезков
export function wallWithGaps(x1, y1, x2, y2, gaps) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!len) return [];
  const ux = (x2 - x1) / len,
    uy = (y2 - y1) / len;
  const segs = [];
  let cur = 0;
  for (const [pos, hw] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (pos + hw <= 0 || pos - hw >= len) continue; // вне стены
    if (pos - hw > cur)
      segs.push([
        x1 + ux * cur,
        y1 + uy * cur,
        x1 + ux * (pos - hw),
        y1 + uy * (pos - hw),
      ]);
    cur = Math.max(cur, pos + hw);
  }
  if (cur < len) segs.push([x1 + ux * cur, y1 + uy * cur, x2, y2]);
  return segs;
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// здание в точке (через пространственный индекс)
export function buildingAtPoint(city, x, y) {
  const k = Math.floor(x / 16) + "," + Math.floor(y / 16);
  const cell = city.buildingGrid?.get(k);
  if (cell)
    for (const b of cell)
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  return null;
}

// индекс зданий по клеткам 16 м (для интерьерных коллизий и промптов)
export function buildBuildingGrid(city) {
  city.buildingGrid = new Map();
  for (const b of city.buildings) {
    const x0 = Math.floor(b.x / 16),
      x1 = Math.floor((b.x + b.w) / 16);
    const y0 = Math.floor(b.y / 16),
      y1 = Math.floor((b.y + b.h) / 16);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const k = cx + "," + cy;
        if (!city.buildingGrid.has(k)) city.buildingGrid.set(k, []);
        city.buildingGrid.get(k).push(b);
      }
  }
}
