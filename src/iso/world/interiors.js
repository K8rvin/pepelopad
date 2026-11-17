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
  };
  cache.set(b.id, it);
  return it;
}

// коллизия круга со стенами зданий поблизости: фасадные стены (с проёмом двери,
// работают с обеих сторон) + внутренние перегородки (только когда внутри).
export function solidInteriorAt(city, x, y, r) {
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
        // фасадные стены с проёмом двери (юг, y = h)
        const du = it.doorU;
        const W = b.w,
          H = b.h;
        const ext = [
          [0, 0, W, 0], // север
          [0, H, du - 0.7, H], // юг левее двери
          [du + 0.7, H, W, H], // юг правее двери
          [0, 0, 0, H], // запад
          [W, 0, W, H], // восток
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
