import { describe, expect, it } from "vitest";
import { objectiveState } from "../src/iso/ui/objective.js";
import { createQuests } from "../src/iso/systems/quests.js";
import { ALL_QUESTS } from "../src/iso/data/quests.js";

describe("панель «что делать сейчас»", () => {
  it("текущий этап и цели главной миссии", () => {
    const q = createQuests();
    const s = objectiveState(q, ALL_QUESTS, "E — обыскать: ящик");
    expect(s.name).toBe("Первые правила");
    expect(s.desc).toBeTruthy();
    expect(s.goals.length).toBeGreaterThan(0);
    expect(s.goals.every((g) => g.done === false)).toBe(true);
    expect(s.hint).toBe("E — обыскать: ящик");
  });
  it("этап обыска: три цели с прогрессом", () => {
    const q = createQuests();
    q.stages.m00 = 1;
    const s = objectiveState(q, ALL_QUESTS, "");
    expect(s.goals).toHaveLength(3);
    expect(s.desc).toContain("Обыщи");
  });
  it("кампания завершена — панели нет", () => {
    const q = createQuests();
    for (const def of ALL_QUESTS.filter((d) => d.kind === "main")) {
      q.states[def.id] = "completed";
      q.done.push(def.id);
    }
    expect(objectiveState(q, ALL_QUESTS, "")).toBeNull();
  });
});
