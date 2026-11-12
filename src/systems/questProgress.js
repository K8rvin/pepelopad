export function applyQuestEvent(progress, type, data) {
  const add = (key, value) => (progress[key] = (progress[key] || 0) + value);
  if (type === "loot") add(data.id, data.n);
  if (type === "kill") add("kills", 1);
  if (type === "bp") progress["bp_" + data.w] = 1;
  if (type === "craft") progress["craft_" + data.id] = 1;
  if (type === "build") add("build_" + data.t, 1);
  if (type === "nest") {
    add("nest", 1);
    if (data.mega) progress.mega = 1;
  }
  if (type === "siege") add("siege", 1);
  if (type === "car" && data.action === "repair") add("car_repair", 1);
  if (type === "camp") add("camp_talk", 1);
  if (type === "donate") add("donate", data.n);
  if (type === "camp_supply") add("supply_" + data.id, data.n);
  if (type === "project") {
    const key = "project_" + data.id;
    progress[key] = Math.max(progress[key] || 0, data.level);
  }
  if (type === "drive") add("drive", data.m);
  if (type === "deliver") add("deliver", 1);
  if (type === "rescue") add("rescue", 1);
  return progress;
}

export function goalsComplete(quest, progress) {
  return quest.goals.every(([id, target]) => (progress[id] || 0) >= target);
}

export function syncQuestProgress(
  quest,
  progress,
  { learned, owned, baseProj, stats },
) {
  for (const [id, target] of quest.goals) {
    if (id.startsWith("bp_") && learned.has(id.slice(3)))
      progress[id] = Math.max(progress[id] || 0, target);
    if (id.startsWith("craft_") && owned[id.slice(6)])
      progress[id] = Math.max(progress[id] || 0, target);
    if (id.startsWith("project_") && (baseProj[id.slice(8)] || 0) >= target) {
      progress[id] = Math.max(progress[id] || 0, target);
    }
    if (id === "drive" && stats.drive >= target)
      progress[id] = Math.max(progress[id] || 0, target);
  }
  return progress;
}
