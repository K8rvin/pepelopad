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
  fridge: [
    ["can", 1, 3, 0.9],
    ["can", 1, 2, 0.4],
    ["meds", 1, 1, 0.15],
  ],
  wardrobe: [
    ["cloth", 1, 3, 0.8],
    ["meds", 1, 1, 0.35],
    ["part", 1, 1, 0.2],
    ["knife", 1, 1, 0.12],
  ],
  shelf: [
    ["wood", 1, 2, 0.6],
    ["scrap", 1, 2, 0.5],
    ["part", 1, 1, 0.3],
    ["can", 1, 1, 0.35],
  ],
  crate: [
    ["scrap", 1, 2, 0.6],
    ["wood", 1, 2, 0.5],
    ["fuel", 1, 1, 0.2],
    ["bat", 1, 1, 0.1],
  ],
  sink: [
    ["can", 1, 2, 0.55],
    ["cloth", 1, 2, 0.55],
    ["meds", 1, 1, 0.2],
  ],
  nightstand: [
    ["cloth", 1, 2, 0.55],
    ["meds", 1, 1, 0.3],
    ["part", 1, 1, 0.15],
  ],
  dresser: [
    ["cloth", 1, 3, 0.8],
    ["meds", 1, 1, 0.25],
  ],
};

export const CONTAINER_NAMES = {
  dumpster: "мусорный контейнер",
  barrel: "бочка",
  fridge: "холодильник",
  wardrobe: "шкаф",
  shelf: "полка",
  crate: "ящик",
  sink: "кухонная тумба",
  nightstand: "прикроватная тумбочка",
  dresser: "комод",
};

export function createLoot(city) {
  // контейнеры мира: мусорки и бочки с координатами
  const containers = [];
  city.containers.forEach((c, i) =>
    containers.push({
      id: c.id || "dn" + i,
      kind: c.kind || "dumpster",
      name: c.name,
      x: c.x,
      y: c.y,
      src: c,
      fixedItems: c.fixedItems,
    }),
  );
  city.barrels.forEach((b, i) =>
    containers.push({ id: "br" + i, kind: "barrel", x: b.x, y: b.y, src: b }),
  );
  return {
    containers,
    interior: new Map(), // buildingId → контейнеры интерьера (регистрируются при входе)
    opened: new Map(), // id → [{id, n}] содержимое после первого обыска
    nearest: null,
  };
}

// регистрация контейнеров интерьера здания (при первом входе)
export function registerInterior(L, b, interior) {
  if (L.interior.has(b.id)) return;
  L.interior.set(
    b.id,
    interior.containers.map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      x: b.x + c.x,
      y: b.y + c.y,
      interior: true,
    })),
  );
}

// ближайший контейнер: улица всегда, интерьер — только внутри своего здания
export function nearestContainer(L, x, y, r = 1.6, insideB = null) {
  let best = null,
    bd = r;
  for (const c of L.containers) {
    if (c.src?.dead) continue; // снесённый машиной контейнер не обыскивается
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (insideB) {
    const arr = L.interior.get(insideB.id);
    if (arr)
      for (const c of arr) {
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
  }
  return best;
}

// содержимое контейнера: детерминировано по сиду id (без записи в состояние).
// bonusChance (навык поиска + восприятие) даёт доп. стак по каждой строке.
// Позволяет заранее знать, пуст ли контейнер (подсказка обыска не показывается).
export function containerItems(c, bonusChance = 0) {
  if (c.fixedItems) return c.fixedItems.map(([id, n]) => ({ id, n }));
  const seed = c.id
    .split("")
    .reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 5);
  const r = mulberry32(seed);
  // часть контейнеров изначально пуста (обыск им не предлагается)
  if (r() < 0.15) return [];
  const table = LOOT_TABLES[c.kind] || [];
  const items = [];
  for (const [id, mn, mx, chance] of table) {
    if (r() > chance) continue;
    items.push({ id, n: mn + Math.floor(r() * (mx - mn + 1)) });
    if (bonusChance > 0 && r() < bonusChance)
      items.push({ id, n: mn + Math.floor(r() * (mx - mn + 1)) });
  }
  return items;
}

// есть ли в контейнере остаток лута (для бейджа): обысканный — по остатку,
// нет — по детерминированной генерации. Пустые (в т.ч. исходно пустые) бейдж не носят.
export function containerHasLoot(L, c, bonusChance = 0) {
  if (L.opened.has(c.id)) return (L.opened.get(c.id) || []).some((s) => s);
  return containerItems(c, bonusChance).some((s) => s);
}

// содержимое фиксируется при первом обыске и сохраняется
export function openContainer(L, c, bonusChance = 0) {
  if (!L.opened.has(c.id)) L.opened.set(c.id, containerItems(c, bonusChance));
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
