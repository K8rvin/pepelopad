// Инвентарь: сетка слотов со стаками. Владелец состояния — этот модуль.
import { ITEMS } from "../data/items.js";

export function createInventory(slots = 24) {
  return { slots: new Array(slots).fill(null), size: slots }; // элемент: {id, n}
}

export function countItem(inv, id) {
  let n = 0;
  for (const s of inv.slots) if (s && s.id === id) n += s.n;
  return n;
}

// добавить; возвращает не влезшее количество
export function addItem(inv, id, n = 1) {
  const def = ITEMS[id];
  if (!def) return n;
  let left = n;
  // сначала досыпать в существующие стаки
  for (const s of inv.slots) {
    if (!s || s.id !== id || s.n >= def.stack) continue;
    const take = Math.min(def.stack - s.n, left);
    s.n += take;
    left -= take;
    if (!left) return 0;
  }
  // потом новые слоты
  for (let i = 0; i < inv.size && left > 0; i++) {
    if (inv.slots[i]) continue;
    const take = Math.min(def.stack, left);
    inv.slots[i] = { id, n: take };
    left -= take;
  }
  return left;
}

export function removeItem(inv, id, n = 1) {
  let left = n;
  for (let i = inv.size - 1; i >= 0 && left > 0; i--) {
    const s = inv.slots[i];
    if (!s || s.id !== id) continue;
    const take = Math.min(s.n, left);
    s.n -= take;
    left -= take;
    if (!s.n) inv.slots[i] = null;
  }
  return left === 0;
}
