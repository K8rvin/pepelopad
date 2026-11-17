// Лут: контейнеры мира (мусорки, бочки), содержимое генерируется по сиду
// контейнера при первом обыске и хранится в состоянии. Таблицы — данные.
import { mulberry32 } from "../core/rng.js";

// таблица лута по типам контейнеров: [itemId, min, max, шанс]
const LOOT_TABLES = {
  dumpster: [
    ["scrap", 1, 4, 0.8],
    ["cloth", 1, 3, 0.6],
    ["wood", 1, 3, 0.5],
    ["can", 1, 2, 0.35],
    ["meds", 1, 1, 0.2],
    ["arrow", 2, 6, 0.4],
  ],
  barrel: [
    ["fuel", 1, 3, 0.5],
    ["scrap", 1, 2, 0.5],
    ["part", 1, 1, 0.25],
  ],
};

export function createLoot(city) {
  // контейнеры мира: мусорки и бочки с координатами
  const containers = [];
  city.containers.forEach((c, i) =>
    containers.push({ id: "dn" + i, kind: "dumpster", x: c.x, y: c.y }),
  );
  city.barrels.forEach((b, i) =>
    containers.push({ id: "br" + i, kind: "barrel", x: b.x, y: b.y }),
  );
  return {
    containers,
    opened: new Map(), // id → [{id, n}] содержимое после первого обыска
    nearest: null, // ближайший в зоне досягаемости (для подсказки)
  };
}

// ближайший контейнер в пределах r
export function nearestContainer(L, x, y, r = 1.6) {
  let best = null,
    bd = r;
  for (const c of L.containers) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// содержимое контейнера: генерируется один раз по сиду id
export function openContainer(L, c) {
  if (!L.opened.has(c.id)) {
    const seed = c.id
      .split("")
      .reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 5);
    const r = mulberry32(seed);
    const table = LOOT_TABLES[c.kind] || [];
    const items = [];
    for (const [id, mn, mx, chance] of table) {
      if (r() > chance) continue;
      items.push({ id, n: mn + Math.floor(r() * (mx - mn + 1)) });
    }
    L.opened.set(c.id, items);
  }
  return L.opened.get(c.id);
}

// забрать предмет из контейнера; addFn(id, n) → сколько НЕ влезло; возвращает {id, took}
export function takeFrom(L, c, index, addFn) {
  const items = L.opened.get(c.id);
  if (!items || !items[index]) return { id: null, took: 0 };
  const stack = items[index];
  const left = addFn(stack.id, stack.n);
  const took = stack.n - left;
  stack.n = left;
  if (!stack.n) items[index] = null;
  return { id: stack.id, took };
}

// забрать всё; возвращает список [id, взято]
export function takeAll(L, c, addFn) {
  const items = L.opened.get(c.id);
  if (!items) return [];
  const taken = [];
  for (let i = 0; i < items.length; i++) {
    const stack = items[i];
    if (!stack) continue;
    const left = addFn(stack.id, stack.n);
    const took = stack.n - left;
    if (took > 0) taken.push([stack.id, took]);
    stack.n = left;
    if (!stack.n) items[i] = null;
  }
  return taken;
}
