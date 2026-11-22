import { describe, it, expect } from "vitest";
import { journalHtml } from "../src/iso/ui/journal.js";
import { createQuests } from "../src/iso/systems/quests.js";
import { createStory } from "../src/iso/systems/story.js";
import { createStats } from "../src/iso/systems/stats.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createCombat } from "../src/iso/systems/combat.js";

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

describe("журнал", () => {
  it("показывает текущий квест и статистику", () => {
    const html = journalHtml(ctx());
    expect(html).toContain("Осмотреться");
    expect(html).toContain("Текущая цель");
    expect(html).toContain("Статистика");
    expect(html).toContain("Личная история");
  });
  it("прогресс цели отражается", () => {
    const c = ctx();
    c.quests.prog.kills = 2;
    const html = journalHtml(c);
    expect(html).toContain("2/3");
  });
  it("выполненная цепочка — без текущего квеста", () => {
    const c = ctx();
    c.quests.i = 5;
    c.quests.done = ["m1", "m2", "m3", "m4", "m5"];
    const html = journalHtml(c);
    expect(html).toContain("Цепочка района выполнена");
  });
  it("статистика смерти и дистанции видна", () => {
    const c = ctx();
    c.stats.distance = 2500;
    c.stats.deaths = 3;
    const html = journalHtml(c);
    expect(html).toContain("2.50 км");
    expect(html).toContain("3");
  });
});
