// Квесты: прогресс по событиям (kill/loot/visit), награды, цепочка.
// Владелец состояния — этот модуль; сохраняется в схеме.
import { ITEMS } from "../data/items.js";

export function createQuests(saved) {
  return saved
    ? { i: saved.i, prog: saved.prog || {}, done: saved.done || [] }
    : { i: 0, prog: {}, done: [] };
}

export function mainQuest(Q, quests) {
  return Q.i < quests.length ? quests[Q.i] : null;
}

// прогресс цели в тексте: "Убить гнилых · 2/3"
export function goalText(g, prog) {
  if (g.type === "kill")
    return `Убить гнилых · ${Math.min(prog.kills || 0, g.n)}/${g.n}`;
  if (g.type === "loot")
    return `${ITEMS[g.id]?.name || g.id} · ${Math.min(prog["loot_" + g.id] || 0, g.n)}/${g.n}`;
  if (g.type === "visit")
    return `${g.poi} · ${prog["visit_" + g.poi] ? "ок" : "—"}`;
  return "";
}

export function goalDone(g, prog) {
  if (g.type === "kill") return (prog.kills || 0) >= g.n;
  if (g.type === "loot") return (prog["loot_" + g.id] || 0) >= g.n;
  if (g.type === "visit") return !!prog["visit_" + g.poi];
  return false;
}

// событие; возвращает завершённый квест или null
export function qEvent(Q, quests, type, data = {}) {
  const q = mainQuest(Q, quests);
  if (!q) return null;
  if (type === "kill") Q.prog.kills = (Q.prog.kills || 0) + 1;
  if (type === "loot")
    Q.prog["loot_" + data.id] =
      (Q.prog["loot_" + data.id] || 0) + (data.n || 1);
  if (type === "visit") Q.prog["visit_" + data.poi] = true;
  if (q.goals.every((g) => goalDone(g, Q.prog))) {
    Q.done.push(q.id);
    Q.i++;
    Q.prog = {};
    return q;
  }
  return null;
}

// POI текущего квеста для маркера на карте/мире
export function questTargetPoi(Q, quests) {
  const q = mainQuest(Q, quests);
  if (!q) return null;
  const g = q.goals.find((g) => g.type === "visit" && !goalDone(g, Q.prog));
  return g ? g.poi : null;
}

// здание POI по имени
export function poiBuilding(city, name) {
  return city.buildings.find((b) => b.poi === name) || null;
}
