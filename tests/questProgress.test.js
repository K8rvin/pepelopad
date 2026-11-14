import { describe, expect, it } from "vitest";
import {
  applyQuestEvent,
  goalsComplete,
  syncQuestProgress,
} from "../src/systems/questProgress.js";
import { MAIN } from "../src/data/quests.js";

describe("прогресс заданий", () => {
  it("применяет игровые события к прогрессу", () => {
    const progress = {};
    applyQuestEvent(progress, "loot", { id: "can", n: 3 });
    applyQuestEvent(progress, "drive", { m: 25 });
    applyQuestEvent(progress, "nest", { mega: true });
    applyQuestEvent(progress, "project", { id: "radio", level: 1 });
    applyQuestEvent(progress, "camp_supply", { id: "bandage", n: 2 });
    expect(progress).toMatchObject({
      can: 3,
      drive: 25,
      nest: 1,
      mega: 1,
      project_radio: 1,
      supply_bandage: 2,
    });
  });

  it("проверяет выполнение всех целей", () => {
    const quest = {
      goals: [
        ["can", 4],
        ["cloth", 2],
      ],
    };
    expect(goalsComplete(quest, { can: 4, cloth: 1 })).toBe(false);
    expect(goalsComplete(quest, { can: 5, cloth: 2 })).toBe(true);
  });

  it("учитывает арбалет, собранный раньше задания", () => {
    const quest = MAIN[1];
    const progress = syncQuestProgress(
      quest,
      { talk_bartender: 1, talk_gunstore: 1 },
      {
        learned: new Set(["crossbow"]),
        owned: { crossbow: true },
        baseProj: {},
        stats: { drive: 0 },
      },
    );
    expect(goalsComplete(quest, progress)).toBe(true);
  });

  it("сохраняет синхронизацию проектов и дистанции для других заданий", () => {
    const radioQuest = { goals: [["project_radio", 1]] };
    const progress = syncQuestProgress(
      radioQuest,
      {},
      {
        learned: new Set(),
        owned: {},
        baseProj: { radio: 1 },
        stats: { drive: 0 },
      },
    );
    expect(goalsComplete(radioQuest, progress)).toBe(true);

    const carQuest = { goals: [["drive", 300]] };
    const carProgress = syncQuestProgress(
      carQuest,
      {},
      {
        learned: new Set(),
        owned: {},
        baseProj: {},
        stats: { drive: 350 },
      },
    );
    expect(goalsComplete(carQuest, carProgress)).toBe(true);
  });

  it("принимает сюжетное событие только с точным way и этапом", () => {
    const quest = {
      id: "m1",
      goals: [["visit_parents", 1]],
      targets: [{ event: "visit", goal: "visit_parents", wayId: 112436180 }],
    };
    const progress = {};
    applyQuestEvent(
      progress,
      "visit",
      { stage: "m2", goal: "visit_parents", wayId: 112436180 },
      quest,
    );
    applyQuestEvent(
      progress,
      "visit",
      { stage: "m1", goal: "visit_parents", wayId: 112439402 },
      quest,
    );
    expect(progress.visit_parents).toBeUndefined();
    applyQuestEvent(
      progress,
      "visit",
      { stage: "m1", goal: "visit_parents", wayId: 112436180 },
      quest,
    );
    expect(goalsComplete(quest, progress)).toBe(true);
  });

  it("не завершает возвращение в школу до спасения", () => {
    const quest = {
      id: "m5",
      goals: [
        ["school_rescue", 1],
        ["return_school", 1],
      ],
      targets: [
        { event: "rescue", goal: "school_rescue", wayId: 112399694 },
        {
          event: "visit",
          goal: "return_school",
          camp: "camp_school",
          requires: "school_rescue",
        },
      ],
    };
    const progress = {};
    applyQuestEvent(
      progress,
      "visit",
      { stage: "m5", goal: "return_school", camp: "camp_school" },
      quest,
    );
    expect(progress.return_school).toBeUndefined();
    applyQuestEvent(
      progress,
      "rescue",
      { stage: "m5", goal: "school_rescue", wayId: 112399694 },
      quest,
    );
    applyQuestEvent(
      progress,
      "visit",
      { stage: "m5", goal: "return_school", camp: "camp_school" },
      quest,
    );
    expect(goalsComplete(quest, progress)).toBe(true);
  });

  it("проверяет way и лагерь при выборе школьной ветки", () => {
    const quest = {
      id: "m6",
      goals: [["school_branch", 1]],
      targets: [
        {
          event: "camp",
          goal: "school_branch",
          camp: "camp_school",
          wayId: 1273891052,
        },
      ],
    };
    const progress = {};
    applyQuestEvent(
      progress,
      "camp",
      { stage: "m6", goal: "school_branch", camp: "camp_school" },
      quest,
    );
    expect(progress.school_branch).toBeUndefined();
    applyQuestEvent(
      progress,
      "camp",
      {
        stage: "m6",
        goal: "school_branch",
        camp: "camp_school",
        wayId: 1273891052,
      },
      quest,
    );
    expect(goalsComplete(quest, progress)).toBe(true);
  });
});
