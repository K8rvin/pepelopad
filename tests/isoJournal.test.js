import { describe, expect, it } from "vitest";
import { journalHtml } from "../src/iso/ui/journal.js";
import { createQuests, goalKey } from "../src/iso/systems/quests.js";
import { createStory } from "../src/iso/systems/story.js";
import { createStats } from "../src/iso/systems/stats.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createCombat } from "../src/iso/systems/combat.js";
import { MAIN_QUESTS } from "../src/iso/data/quests.js";

function ctx(over = {}) {
  return {
    quests: createQuests(),
    story: createStory(),
    stats: createStats(),
    survival: createSurvival(),
    combat: createCombat(),
    ...over,
  };
}

describe("журнал кампании", () => {
  it("показывает основную цель, этапы, выживших и улики", () => {
    const html = journalHtml(ctx());
    expect(html).toContain("Голос на заправке");
    expect(html).toContain("Текущая основная цель");
    expect(html).toContain("Выжившие и поручения");
    expect(html).toContain("Улики");
  });

  it("показывает scoped-прогресс текущего этапа", () => {
    const context = ctx();
    context.quests.states.m00 = "completed";
    context.quests.states.m01 = "active";
    context.quests.stages.m01 = 2;
    const goal = MAIN_QUESTS.find((q) => q.id === "m01").stages[2].goals[0];
    context.quests.progress.m01 = { [goalKey(goal)]: 2 };
    expect(journalHtml(context)).toContain("2/3");
  });

  it("после финала оставляет свободную игру", () => {
    const context = ctx();
    context.quests.states.m00 = "completed";
    context.quests.states.m01 = "completed";
    context.quests.done = MAIN_QUESTS.map((q) => q.id);
    expect(journalHtml(context)).toContain("Кампания завершена");
  });

  it("показывает найденную улику и статистику", () => {
    const context = ctx();
    context.story.clues = ["mark_radio"];
    context.stats.distance = 2500;
    context.stats.deaths = 3;
    const html = journalHtml(context);
    expect(html).toContain("Голос в радио");
    expect(html).toContain("2.50 км");
    expect(html).toContain("3");
  });
});
