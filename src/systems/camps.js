import { d2 } from "../core/math.js";
import { ITEMS } from "../data/items.js";
import { CAMP_UPGRADES } from "../data/camps.js";

export function findCampNear(x, y, camps) {
  for (const camp of camps.values())
    if (d2(x, y, camp.x, camp.y) < 120 * 120) return camp;
  return null;
}

export function campUpgradeCost(id, level) {
  const cost = {};
  for (const item in CAMP_UPGRADES[id].cost)
    cost[item] = CAMP_UPGRADES[id].cost[item] * (level + 1);
  return cost;
}

export function campUpgradeLock(camp, id, countItem) {
  const level = camp.proj[id] || 0;
  if (level >= 3) return "Уже максимум";
  const cost = campUpgradeCost(id, level);
  for (const item in cost)
    if (countItem(item) < cost[item]) return "Не хватает ресурсов";
  return null;
}

export function applyCampUpgrade(camp, id) {
  camp.proj[id] = (camp.proj[id] || 0) + 1;
  camp.trust += 3;
  camp.level =
    1 + Math.floor(Object.values(camp.proj).reduce((a, b) => a + b, 0) / 3);
  return camp.proj[id];
}

export function donateToCamp(camp, count) {
  camp.trust += count;
}

export function tradeLock(camp, cost, countItem) {
  if (camp.trust < cost.trust) return "Недостаточно доверия";
  if (countItem(cost.item) < cost.n)
    return "Нужно: " + ITEMS[cost.item].n + " ×" + cost.n;
  return null;
}
