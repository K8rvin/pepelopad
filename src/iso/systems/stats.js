// Статистика выживания: счётчики для журнала и экрана смерти.
// Сохраняется аддитивно в схеме v4 (старые сейвы получают нули).
import { removeItem } from "./inventory.js";
import { ITEMS } from "../data/items.js";

export function createStats(saved) {
  return {
    distance: saved?.distance || 0, // метры пешком + за рулём
    arrowsFired: saved?.arrowsFired || 0,
    itemsLooted: saved?.itemsLooted || 0,
    crafts: saved?.crafts || 0,
    deaths: saved?.deaths || 0,
  };
}

// Цена смерти: четверть каждого стака (округление вниз). Предсказуемо, без RNG —
// игрок видит точный список потерь на экране смерти до возрождения.
export function deathPenalty(slots) {
  const lost = [];
  for (const s of slots) {
    if (!s || ITEMS[s.id]?.unique) continue;
    const n = Math.floor(s.n * 0.25);
    if (n > 0) lost.push({ id: s.id, n });
  }
  return lost;
}

export function applyPenalty(inv, lost) {
  for (const { id, n } of lost) removeItem(inv, id, n);
}
