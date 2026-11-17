// Интерьеры (итерация 1 «Коробка» по docs/interiors-qwen.md):
// коридор вдоль длинной оси + нарезка комнат, дверь в фасаде, низкие перегородки 1 м.
// Коллизии — отрезки стен (не AABB-заливка footprint).
import { mulberry32 } from "../core/rng.js";

const cache = new Map(); // buildingId → interior

// сгенерировать планировку здания (детерминированно по id)
export function getInterior(city, b) {
  let it = cache.get(b.id);
  if (it) return it;
  const r = mulberry32(b.id * 7919 + 13);
  const w = Math.floor(b.w),
    h = Math.floor(b.h);
  const walls = []; // {x1,y1,x2,y2} в ЛОКАЛЬНЫХ метрах здания
  const rooms = [];

  // коридор вдоль длинной оси
  const wide = w >= h;
  const corrW = 2;
  let corrA, corrB; // коридорная полоса
  if (wide) {
    corrA = Math.floor(h / 2) - 1;
    corrB = corrA + corrW;
  } else {
    corrA = Math.floor(w / 2) - 1;
    corrB = corrA + corrW;
  }

  // нарезка полос на комнаты 8–11 м
  function sliceStrip(stripMin, stripMax, alongLen) {
    // возвращает границы комнат вдоль длинной оси
    const cuts = [1];
    let x = 1;
    while (alongLen - 1 - x > 11) {
      x += 8 + Math.floor(r() * 4);
      cuts.push(x);
    }
    cuts.push(alongLen - 1);
    return cuts;
  }

  if (wide) {
    // северная и южная полосы комнат, коридор посередине
    const cutsN = sliceStrip(1, corrA, w);
    const cutsS = sliceStrip(corrB, h - 1, w);
    // перегородки комнат (вертикальные)
    for (const cuts of [cutsN, cutsS])
      for (let i = 1; i < cuts.length - 1; i++) {
        const cx = cuts[i];
        if (cuts === cutsN) walls.push({ x1: cx, y1: 1, x2: cx, y2: corrA });
        else walls.push({ x1: cx, y1: corrB, x2: cx, y2: h - 1 });
      }
    // стены коридора с дверями в комнаты
    for (const [cuts, yWall, north] of [
      [cutsN, corrA, true],
      [cutsS, corrB, false],
    ]) {
      for (let i = 0; i + 1 < cuts.length; i++) {
        const x1 = cuts[i],
          x2 = cuts[i + 1];
        const doorX = Math.floor((x1 + x2) / 2);
        // стена с проёмом под дверь
        walls.push({ x1, y1: yWall, x2: doorX - 0.6, y2: yWall });
        walls.push({ x1: doorX + 0.6, y1: yWall, x2, y2: yWall });
        rooms.push({
          x1,
          y1: north ? 1 : corrB,
          x2,
          y2: north ? corrA : h - 1,
          doorX,
          doorY: yWall,
        });
      }
    }
    // торцы коридора
    walls.push({ x1: 1, y1: corrA, x2: 1, y2: corrB });
    walls.push({ x1: w - 1, y1: corrA, x2: w - 1, y2: corrB });
  } else {
    // высокое здание: коридор вертикальный
    const cutsW = sliceStrip(1, corrA, h);
    const cutsE = sliceStrip(corrB, w - 1, h);
    for (const cuts of [cutsW, cutsE])
      for (let i = 1; i < cuts.length - 1; i++) {
        const cy = cuts[i];
        if (cuts === cutsW) walls.push({ x1: 1, y1: cy, x2: corrA, y2: cy });
        else walls.push({ x1: corrB, y1: cy, x2: w - 1, y2: cy });
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
        rooms.push({
          x1: west ? 1 : corrB,
          y1,
          x2: west ? corrA : w - 1,
          y2,
          doorX: xWall,
          doorY,
        });
      }
    }
    walls.push({ x1: corrA, y1: 1, x2: corrB, y2: 1 });
    walls.push({ x1: corrA, y1: h - 1, x2: corrB, y2: h - 1 });
  }

  it = {
    walls,
    rooms,
    wide,
    corrA,
    corrB,
    doorU: b.doorU ?? Math.round(w / 2),
    // лестница в торце коридора (если этажей > 1): 2×3 м
    stairs:
      b.floors > 1
        ? wide
          ? { x: w - 4, y: corrA - 0.5, w: 3, h: 3 }
          : { x: corrA - 0.5, y: 1.5, w: 3, h: 3 }
        : null,
  };
  cache.set(b.id, it);
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
        if (inside)
          for (const sgm of it.walls)
            if (distToSeg(lx, ly, sgm.x1, sgm.y1, sgm.x2, sgm.y2) < r + 0.12)
              return true;
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
