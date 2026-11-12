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

  it("учитывает чертёж и оружие, полученные раньше задания", () => {
    const quest = MAIN[1];
    const progress = syncQuestProgress(
      quest,
      {},
      {
        learned: new Set(["crossbow"]),
        owned: { crossbow: true },
        baseProj: {},
        stats: { drive: 0 },
      },
    );
    expect(goalsComplete(quest, progress)).toBe(true);
  });

  it("учитывает построенный проект и пройденную дистанцию", () => {
    const radioQuest = MAIN[4];
    const progress = syncQuestProgress(
      radioQuest,
      { radiopart: 2 },
      {
        learned: new Set(),
        owned: {},
        baseProj: { radio: 1 },
        stats: { drive: 0 },
      },
    );
    expect(goalsComplete(radioQuest, progress)).toBe(true);

    const carQuest = MAIN[3];
    const carProgress = syncQuestProgress(
      carQuest,
      { car_repair: 1 },
      {
        learned: new Set(),
        owned: {},
        baseProj: {},
        stats: { drive: 350 },
      },
    );
    expect(goalsComplete(carQuest, carProgress)).toBe(true);
  });
});
