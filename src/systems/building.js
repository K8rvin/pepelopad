import { BUILDS } from "../data/world.js";
import { d2 } from "../core/math.js";

export function buildCostFor(type, skills) {
  const cost = {};
  const multiplier = Math.max(0.5, 1 - 0.08 * skills.builder);
  for (const id in BUILDS[type].cost)
    cost[id] = Math.max(1, Math.ceil(BUILDS[type].cost[id] * multiplier));
  return cost;
}

export function buildLockFor(type, { bench, learned }) {
  const definition = BUILDS[type];
  if (definition.bp && !learned.has(definition.bp)) return "нужен чертёж";
  if (definition.bench && bench < definition.bench)
    return "верстак ур." + definition.bench;
  return null;
}

export function placementLock({
  type,
  tx,
  ty,
  P,
  Z,
  bench,
  learned,
  countItem,
  solidAt,
  tileAt,
}) {
  const lock = buildLockFor(type, { bench, learned });
  if (lock) return lock;
  if (solidAt(tx, ty) || tileAt(tx, ty) === 10) return "Здесь не поставить";
  const cx = tx * 16 + 8;
  const cy = ty * 16 + 8;
  if (d2(P.x, P.y, cx, cy) < (P.r + 10) ** 2) return "Слишком близко";
  for (const zombie of Z)
    if (d2(zombie.x, zombie.y, cx, cy) < (zombie.r + 9) ** 2)
      return "Мешает гнилой";

  const cost = buildCostFor(type, P.skills);
  for (const id in cost)
    if (countItem(id) < cost[id]) return "Не хватает ресурсов";
  return null;
}
