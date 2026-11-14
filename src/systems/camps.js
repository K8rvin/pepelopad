import { d2 } from "../core/math.js";
import { ITEMS } from "../data/items.js";
import { CAMP_DEFINITIONS, CAMP_UPGRADES } from "../data/camps.js";

export function createCampState(site, saved = null) {
  const definition = CAMP_DEFINITIONS[site.id] || {};
  return {
    ...site,
    leader: definition.leader || saved?.leader || "Лидер",
    specialization: definition.specialization || "Общие припасы",
    facilities: [...(definition.facilities || [])],
    residents: [...(definition.residents || [])],
    level: saved?.level || 1,
    trust: saved?.trust || 0,
    proj: {
      wall:
        saved?.proj?.wall || (definition.facilities?.includes("wall") ? 1 : 0),
      garden:
        saved?.proj?.garden ||
        (definition.facilities?.includes("garden") ? 1 : 0),
      tower:
        saved?.proj?.tower ||
        (definition.facilities?.includes("tower") ? 1 : 0),
      clinic:
        saved?.proj?.clinic ||
        (definition.facilities?.includes("clinic") ? 1 : 0),
    },
    quest: saved?.quest || null,
    branch: saved?.branch || null,
    missionDone: Boolean(saved?.missionDone),
    rescuedResidents: [...(saved?.rescuedResidents || [])],
  };
}

export function campSnapshot(camp) {
  return {
    level: camp.level,
    trust: camp.trust,
    proj: { ...camp.proj },
    quest: camp.quest || null,
    branch: camp.branch || null,
    missionDone: Boolean(camp.missionDone),
    rescuedResidents: [...(camp.rescuedResidents || [])],
  };
}

export function createCampMission(camp) {
  const definition = CAMP_DEFINITIONS[camp.id]?.mission;
  if (!definition || camp.missionDone) return null;
  return {
    ...definition,
    kind: "side",
    campMission: true,
    campId: camp.id,
    targets: [],
    goals: definition.goals.map((goal) => [...goal]),
    reward: {
      ...definition.reward,
      items: definition.reward.items.map((item) => [...item]),
    },
  };
}

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
  if (
    camp.id === "camp_school" &&
    ((camp.branch === "clinic" && id === "tower") ||
      (camp.branch === "watch" && id === "clinic"))
  )
    return "Выбрана другая ветвь";
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
