export function collectQuestGrants(
  quests,
  given,
  matchesTarget,
  container = null,
) {
  const items = {};
  const granted = [];

  for (const quest of quests.filter(Boolean)) {
    for (const target of quest.targets || []) {
      const grant = target.grant || quest.grant;
      if (!grant) continue;
      if (
        target.wayId != null &&
        (!container || target.wayId !== container.wayId)
      )
        continue;
      if (!matchesTarget(target, container)) continue;
      const key =
        target.wayId != null
          ? `${quest.id}:way:${target.wayId}`
          : `${quest.id}:${target.bx},${target.by}`;
      if (given[key]) continue;
      given[key] = true;
      for (const [id, count] of grant) items[id] = (items[id] || 0) + count;
      granted.push(quest.id);
    }
  }

  return { items, granted };
}

export function questGrantLedger(Q, kind) {
  const key = kind === "side" ? "sideGiven" : "mainGiven";
  if (!Q[key]) Q[key] = {};
  return Q[key];
}
