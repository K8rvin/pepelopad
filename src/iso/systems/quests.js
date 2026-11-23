import { ITEMS } from "../data/items.js";
import { addItem, countItem, removeItem } from "./inventory.js";

export function createQuests(saved = null) {
  if (saved?.states)
    return {
      states: { ...saved.states },
      stages: { ...(saved.stages || {}) },
      progress: Object.fromEntries(
        Object.entries(saved.progress || {}).map(([id, p]) => [id, { ...p }]),
      ),
      done: [...(saved.done || [])],
      failed: [...(saved.failed || [])],
      rewarded: [...(saved.rewarded || [])],
      pendingRewards: (saved.pendingRewards || []).map((r) => ({ ...r })),
      tracked: saved.tracked || null,
      i: saved.i || 0,
      prog: { ...(saved.prog || {}) },
    };
  return {
    states: { m00: "active" },
    stages: {},
    progress: {},
    done: [],
    failed: [],
    rewarded: [],
    pendingRewards: [],
    tracked: null,
    i: 0,
    prog: {},
  };
}

export function questDef(quests, id) {
  return quests.find((q) => q.id === id) || null;
}

export function questStatus(Q, id) {
  return Q.states[id] || "locked";
}

export function questStageIndex(Q, id) {
  return Q.stages[id] || 0;
}

export function currentStage(Q, def) {
  return def?.stages?.[questStageIndex(Q, def.id)] || null;
}

export function questProgress(Q, id) {
  return (Q.progress[id] ||= {});
}

export function mainQuest(Q, quests) {
  if (!Q.states) return Q.i < quests.length ? quests[Q.i] : null;
  return (
    quests.find(
      (q) => q.kind === "main" && questStatus(Q, q.id) === "active",
    ) || null
  );
}

export function trackedQuest(Q, quests) {
  const tracked = questDef(quests, Q.tracked);
  if (tracked && questStatus(Q, tracked.id) === "active") return tracked;
  return (
    quests.find(
      (q) => q.kind === "side" && questStatus(Q, q.id) === "active",
    ) || null
  );
}

export function trackQuest(Q, quests, id) {
  const def = questDef(quests, id);
  if (!def || def.kind !== "side") return false;
  if (!["available", "active"].includes(questStatus(Q, id))) return false;
  Q.tracked = Q.tracked === id ? null : id;
  return true;
}

export function goalKey(g) {
  return (
    g.key ||
    [
      g.type,
      g.target || g.id || g.group || g.zombieType || "any",
      g.npc || (g.npcs || []).join("|"),
    ].join(":")
  );
}

export function goalDone(g, prog = {}) {
  const key = goalKey(g);
  if (prog[key] !== undefined) return prog[key] >= (g.n || 1);
  if (g.type === "kill" && prog.kills !== undefined)
    return prog.kills >= (g.n || 1);
  if (g.type === "collect" && prog[`loot_${g.id}`] !== undefined)
    return prog[`loot_${g.id}`] >= (g.n || 1);
  if (g.type === "visit" && g.poi) return !!prog[`visit_${g.poi}`];
  return false;
}

export function goalText(g, prog = {}) {
  const name = g.label || ITEMS[g.id]?.name || g.target || g.id || g.poi;
  const done = goalDone(g, prog);
  if ((g.n || 1) <= 1) return `${name} · ${done ? "ок" : "—"}`;
  const value = Math.min(Number(prog[goalKey(g)]) || 0, g.n);
  return `${name} · ${value}/${g.n}`;
}

function goalMatches(g, type, data) {
  if (g.alt && goalMatches(g.alt, type, data)) return true;
  if (g.type === "collect")
    return ["collect", "loot"].includes(type) && data.id === g.id;
  if (g.type === "kill") {
    if (type !== "kill") return false;
    if (g.group && data.group !== g.group) return false;
    if (g.zombieType && data.zombieType !== g.zombieType) return false;
    return true;
  }
  if (g.type === "deliver")
    return (
      type === "deliver" &&
      data.id === g.id &&
      (data.npc === g.npc || g.npcs?.includes(data.npc))
    );
  if (g.type === "deliverVehicle")
    return type === "deliverVehicle" && data.vehicle === g.target;
  if (g.type === "rescue")
    return (
      type === "rescue" &&
      data.id === g.target &&
      (!g.camp || data.camp === g.camp)
    );
  if (g.type === "visit")
    return type === "visit" && (data.target === g.target || data.poi === g.poi);
  if (
    [
      "talk",
      "interact",
      "repair",
      "build",
      "defend",
      "load",
      "choice",
      "ending",
      "craft",
      "practice",
      "search",
    ].includes(g.type)
  )
    return (
      type === g.type &&
      (g.target === "any" || data.target === g.target || data.id === g.target)
    );
  return false;
}

function syncLegacy(Q, quests) {
  const main = mainQuest(Q, quests);
  const mains = quests.filter((q) => q.kind === "main");
  Q.i = main ? mains.indexOf(main) : mains.length;
  Q.prog = main ? { ...questProgress(Q, main.id) } : {};
}

function complete(Q, quests, def, result) {
  if (questStatus(Q, def.id) === "completed") return;
  Q.states[def.id] = "completed";
  if (!Q.done.includes(def.id)) Q.done.push(def.id);
  if (def.next) {
    Q.states[def.next] = "active";
    Q.stages[def.next] = 0;
    const nextDef = quests.find((q) => q.id === def.next);
    if (nextDef) result.started.push(nextDef);
  }
  result.completed.push(def);
  syncLegacy(Q, quests);
}

function settle(Q, quests, def, result) {
  while (questStatus(Q, def.id) === "active") {
    const stage = currentStage(Q, def);
    if (
      !stage ||
      !stage.goals.every((g) => goalDone(g, questProgress(Q, def.id)))
    )
      break;
    if (questStageIndex(Q, def.id) >= def.stages.length - 1) {
      complete(Q, quests, def, result);
      break;
    }
    Q.stages[def.id] = questStageIndex(Q, def.id) + 1;
    Q.progress[def.id] = {};
    result.advanced.push({ quest: def, stage: Q.stages[def.id] });
  }
  syncLegacy(Q, quests);
}

function emptyResult() {
  return { completed: [], advanced: [], started: [], deliveries: [] };
}

export function qEvent(Q, quests, type, data = {}) {
  const result = emptyResult();
  for (const def of quests) {
    if (questStatus(Q, def.id) !== "active") continue;
    const stage = currentStage(Q, def);
    if (!stage) continue;
    const prog = questProgress(Q, def.id);
    let changed = false;
    for (const goal of stage.goals) {
      if (goalDone(goal, prog) || !goalMatches(goal, type, data)) continue;
      const key = goalKey(goal);
      const amount = Math.max(1, data.n || 1);
      prog[key] = Math.min(goal.n || 1, (prog[key] || 0) + amount);
      changed = true;
    }
    if (changed) settle(Q, quests, def, result);
  }
  syncLegacy(Q, quests);
  return result;
}

export function deliverQuest(Q, quests, id, npc, inv) {
  const def = questDef(quests, id);
  const result = emptyResult();
  if (!def || questStatus(Q, id) !== "active") return { ...result, ok: false };
  const stage = currentStage(Q, def);
  const prog = questProgress(Q, id);
  let ok = false;
  for (const goal of stage?.goals || []) {
    if (goal.type !== "deliver" || goalDone(goal, prog)) continue;
    if (goal.npc !== npc && !goal.npcs?.includes(npc)) continue;
    const left = (goal.n || 1) - (prog[goalKey(goal)] || 0);
    const take = Math.min(left, countItem(inv, goal.id));
    if (take <= 0) continue;
    removeItem(inv, goal.id, take);
    prog[goalKey(goal)] = (prog[goalKey(goal)] || 0) + take;
    result.deliveries.push({ goal, npc, n: take });
    ok = true;
  }
  if (ok) settle(Q, quests, def, result);
  return { ...result, ok };
}

export function acceptQuest(Q, quests, id) {
  const def = questDef(quests, id);
  if (!def || def.kind !== "side") return false;
  if (!["locked", "available"].includes(questStatus(Q, id))) return false;
  Q.states[id] = "active";
  Q.stages[id] = 0;
  Q.progress[id] = {};
  if (!Q.tracked) Q.tracked = id;
  return true;
}

export function forceCompleteQuest(Q, quests, id) {
  const def = questDef(quests, id);
  const result = emptyResult();
  if (!def || questStatus(Q, id) !== "active") return result;
  complete(Q, quests, def, result);
  return result;
}

export function gotoQuestStage(Q, quests, id, stage) {
  const def = questDef(quests, id);
  if (!def || questStatus(Q, id) !== "active") return false;
  if (stage < 0 || stage >= def.stages.length) return false;
  Q.stages[id] = stage;
  Q.progress[id] = {};
  syncLegacy(Q, quests);
  return true;
}

export function failQuest(Q, id) {
  if (questStatus(Q, id) !== "active") return false;
  Q.states[id] = "failed";
  if (!Q.failed.includes(id)) Q.failed.push(id);
  return true;
}

export function refreshQuestAvailability(Q, quests) {
  for (const def of quests) {
    if (def.kind !== "side" || questStatus(Q, def.id) !== "locked") continue;
    if (!def.unlock || Q.done.includes(def.unlock.main))
      Q.states[def.id] = "available";
  }
}

export function claimQuestReward(Q, def, inv) {
  if (Q.rewarded.includes(def.id)) return { added: [], pending: [] };
  Q.rewarded.push(def.id);
  const added = [];
  const pending = [];
  for (const [id, n] of def.reward || []) {
    const left = addItem(inv, id, n);
    const took = n - left;
    if (took) added.push([id, took]);
    if (left) {
      const old = Q.pendingRewards.find(
        (r) => r.quest === def.id && r.id === id,
      );
      if (old) old.n += left;
      else Q.pendingRewards.push({ quest: def.id, id, n: left });
      pending.push([id, left]);
    }
  }
  return { added, pending };
}

export function claimPendingRewards(Q, inv) {
  const claimed = [];
  for (const reward of Q.pendingRewards) {
    const left = addItem(inv, reward.id, reward.n);
    const took = reward.n - left;
    reward.n = left;
    if (took) claimed.push([reward.id, took]);
  }
  Q.pendingRewards = Q.pendingRewards.filter((r) => r.n > 0);
  return claimed;
}

export function questTarget(Q, quests, id = null) {
  const def = id ? questDef(quests, id) : mainQuest(Q, quests);
  if (!def || questStatus(Q, def.id) !== "active") return null;
  const stage = currentStage(Q, def);
  // обыск конкретных ящиков важнее общей точки сайта: маркер ведёт к ящику
  const search = stage?.goals.find(
    (g) =>
      g.type === "search" && g.target && !goalDone(g, questProgress(Q, def.id)),
  );
  if (search) return { container: search.target, name: search.label };
  if (stage?.target) return stage.target;
  const goal = stage?.goals.find((g) => !goalDone(g, questProgress(Q, def.id)));
  if (!goal) return null;
  if (goal.target) {
    if (goal.type === "talk" || goal.type === "rescue")
      return { npc: goal.target };
    if (["interact", "repair", "build", "load"].includes(goal.type))
      return { object: goal.target };
    return { site: goal.target };
  }
  return null;
}

export function questTargetPoi(Q, quests) {
  const q = Q.states
    ? mainQuest(Q, quests)
    : Q.i < quests.length
      ? quests[Q.i]
      : null;
  if (!q) return null;
  const prog = Q.states ? questProgress(Q, q.id) : Q.prog;
  const goals = Q.states ? currentStage(Q, q)?.goals || [] : q.goals;
  const g = goals.find(
    (goal) => goal.type === "visit" && !goalDone(goal, prog),
  );
  return g?.poi || null;
}

export function poiBuilding(city, name) {
  return city.buildings.find((b) => b.poi === name) || null;
}
