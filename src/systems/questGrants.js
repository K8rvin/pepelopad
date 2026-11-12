export function collectQuestGrants(quests, given, matchesTarget) {
  const items = {};
  const granted = [];

  for (const quest of quests.filter(Boolean)) {
    if (!quest.grant) continue;
    for (const target of quest.targets || []) {
      if (!matchesTarget(target)) continue;
      const key = `${quest.id}:${target.bx},${target.by}`;
      if (given[key]) continue;
      given[key] = true;
      for (const [id, count] of quest.grant)
        items[id] = (items[id] || 0) + count;
      granted.push(quest.id);
    }
  }

  return { items, granted };
}
