import {
  createInventory,
  addItem,
  removeItem,
  countItem,
} from "./inventory.js";
import { CLUES } from "../data/storyObjects.js";
import { MAIN_QUESTS } from "../data/quests.js";
import {
  acceptQuest,
  deliverQuest,
  forceCompleteQuest,
  gotoQuestStage,
  qEvent,
  currentStage,
  questStatus,
} from "./quests.js";

export function createStory(saved = null) {
  const home = createInventory(8);
  if (saved?.home?.storage) home.slots = saved.home.storage;
  return {
    flags: { ...(saved?.flags || {}) },
    clues: [...(saved?.clues || [])],
    seen: { ...(saved?.seen || {}) },
    projects: [...(saved?.projects || [])],
    ending: saved?.ending || null,
    markRelation: saved?.markRelation || 0,
    generatorOn: saved?.generatorOn ?? false,
    generatorFuel: saved?.generatorFuel ?? 0,
    home: { unlocked: !!saved?.home?.unlocked, storage: home.slots },
  };
}

export function storyDone(story) {
  return !!story.ending;
}

export function addClue(story, id) {
  if (!CLUES[id] || story.clues.includes(id)) return false;
  story.clues.push(id);
  return true;
}

export function conditionMatches(when, ctx) {
  if (!when) return true;
  if (when.any) return when.any.some((part) => conditionMatches(part, ctx));
  const { quests, story } = ctx;
  if (when.main) {
    const q = ctx.questDefs.find((def) => def.id === when.main);
    if (mainQuestId(ctx) !== when.main) return false;
    if (
      when.stage !== undefined &&
      (quests.stages[when.main] || 0) !== when.stage
    )
      return false;
    if (!q) return false;
  }
  if (when.mainNot && mainQuestId(ctx) === when.mainNot) return false;
  if (when.notMainBefore) {
    const current = mainQuestId(ctx);
    if (!current) return true;
    const index = current
      ? MAIN_QUESTS.findIndex((q) => q.id === current)
      : MAIN_QUESTS.length;
    if (index >= MAIN_QUESTS.findIndex((q) => q.id === when.notMainBefore))
      return false;
  }
  if (when.side) {
    if (questStatus(quests, when.side) !== "active") return false;
    if (
      when.stage !== undefined &&
      (quests.stages[when.side] || 0) !== when.stage
    )
      return false;
  }
  if (
    when.sideAvailable &&
    questStatus(quests, when.sideAvailable) !== "available"
  )
    return false;
  if (
    when.sideNotActive &&
    questStatus(quests, when.sideNotActive) === "active"
  )
    return false;
  if (when.sideDone && !quests.done.includes(when.sideDone)) return false;
  if (when.flag && !story.flags[when.flag]) return false;
  if (when.notFlag && story.flags[when.notFlag]) return false;
  if (when.anyFlag && !when.anyFlag.some((flag) => story.flags[flag]))
    return false;
  if (when.clue && !story.clues.includes(when.clue)) return false;
  if (when.home && !story.home.unlocked) return false;
  if (when.night !== undefined) {
    const night = ctx.survival.tod >= 20 || ctx.survival.tod < 6;
    if (night !== when.night) return false;
  }
  if (
    when.dead &&
    ctx.survivors?.find((s) => s.id === when.dead)?.state !== "dead"
  )
    return false;
  if (
    when.items &&
    !Object.entries(when.items).every(([id, n]) => countItem(ctx.inv, id) >= n)
  )
    return false;
  if (when.trust) {
    const camp = ctx.camps.find((c) => c.id === when.trust.camp);
    if (!camp || camp.trust < when.trust.n) return false;
  }
  if (when.deliverFor) {
    const found = ctx.questDefs.some((def) => {
      if (questStatus(quests, def.id) !== "active") return false;
      return (currentStage(quests, def)?.goals || []).some(
        (g) =>
          g.type === "deliver" &&
          (g.npc === when.deliverFor || g.npcs?.includes(when.deliverFor)),
      );
    });
    if (!found) return false;
  }
  return true;
}

function mainQuestId(ctx) {
  return (
    ctx.questDefs.find(
      (def) =>
        def.kind === "main" && questStatus(ctx.quests, def.id) === "active",
    )?.id || null
  );
}

function addProject(story, id, ctx) {
  if (!story.projects.includes(id)) story.projects.push(id);
  const camp = ctx.camps.find((c) => c.id === "motel");
  if (camp && !camp.upgrades.includes(id)) camp.upgrades.push(id);
  if (id === "generator") {
    story.generatorOn = true;
    story.generatorFuel = Math.max(story.generatorFuel, 2);
  }
}

export function applyStoryEffects(story, effects, ctx) {
  const output = { questResults: [], commands: [] };
  if (!effects) return output;
  const apply = (e) => {
    if (!e) return;
    if (e.flag) story.flags[e.flag] = true;
    if (e.flags) for (const flag of e.flags) story.flags[flag] = true;
    if (e.clue && addClue(story, e.clue))
      output.commands.push({ type: "clue", id: e.clue });
    if (e.trust) {
      const camp = ctx.camps.find((c) => c.id === e.trust.camp);
      if (camp) camp.trust += e.trust.n;
    }
    if (e.takeItems) {
      const entries = Object.entries(e.takeItems);
      if (!entries.every(([id, n]) => countItem(ctx.inv, id) >= n)) {
        output.commands.push({ type: "missing", items: e.takeItems });
        return;
      }
      for (const [id, n] of entries) removeItem(ctx.inv, id, n);
    }
    if (e.items) {
      for (const [id, n] of e.items) {
        const left = addItem(ctx.inv, id, n);
        if (left)
          ctx.quests.pendingRewards.push({ quest: "dialogue", id, n: left });
        if (n - left > 0)
          output.commands.push({ type: "items", id, n: n - left });
      }
    }
    if (e.startQuest && acceptQuest(ctx.quests, ctx.questDefs, e.startQuest))
      output.commands.push({ type: "accepted", id: e.startQuest });
    if (e.deliverQuest) {
      const result = deliverQuest(
        ctx.quests,
        ctx.questDefs,
        e.deliverQuest,
        e.npc,
        ctx.inv,
      );
      output.questResults.push(result);
      for (const delivery of result.deliveries) {
        apply(delivery.goal.effects);
        if (e.deliverQuest === "s_two_doses")
          story.flags[`dose_${delivery.npc}`] = true;
      }
      if (!result.ok)
        output.commands.push({
          type: "deliveryMissing",
          quest: e.deliverQuest,
        });
    }
    if (e.completeQuest)
      output.questResults.push(
        forceCompleteQuest(ctx.quests, ctx.questDefs, e.completeQuest),
      );
    if (e.gotoStage)
      gotoQuestStage(
        ctx.quests,
        ctx.questDefs,
        e.gotoStage.id,
        e.gotoStage.stage,
      );
    if (e.choice)
      output.questResults.push(
        qEvent(ctx.quests, ctx.questDefs, "choice", { target: e.choice }),
      );
    if (e.home) {
      story.home.unlocked = true;
      output.commands.push({ type: "home" });
    }
    if (e.project) addProject(story, e.project, ctx);
    if (e.mark) story.markRelation += e.mark;
    if (e.generatorOn !== undefined) story.generatorOn = e.generatorOn;
    if (e.follow) output.commands.push({ type: "follow", id: e.follow });
    if (e.spawnGroup)
      output.commands.push({ type: "spawnGroup", id: e.spawnGroup });
    if (e.openCamp) output.commands.push({ type: "openCamp", id: e.openCamp });
    if (e.stock) {
      const camp = ctx.camps.find((c) => c.id === e.stock.camp);
      if (camp)
        for (const [id, n] of e.stock.items)
          camp.stock.push({ id, n, cost: {}, minTrust: 0, free: true });
    }
    if (e.ending) {
      story.ending = e.ending;
      output.questResults.push(
        qEvent(ctx.quests, ctx.questDefs, "ending", { target: e.ending }),
      );
      output.commands.push({ type: "ending", id: e.ending });
    }
  };
  apply(effects);
  return output;
}

export function storyHud(story) {
  if (story.ending) return "◆ История завершена. Район помнит твой выбор.";
  return story.clues.length ? `Улики: ${story.clues.length}` : "";
}
