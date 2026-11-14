import { describe, expect, it } from "vitest";
import { collectQuestGrants } from "../src/systems/questGrants.js";

const quests = [
  { id: "main", targets: [{ bx: 2, by: 0 }], grant: [["can", 4]] },
  { id: "side", targets: [{ bx: 2, by: 0 }], grant: [["cargo", 1]] },
];

describe("выдача сюжетных предметов", () => {
  it("выдаёт предметы основного и побочного задания", () => {
    const given = {};
    const result = collectQuestGrants(
      quests,
      given,
      (target) => target.bx === 2 && target.by === 0,
    );
    expect(result.items).toEqual({ can: 4, cargo: 1 });
    expect(result.granted).toEqual(["main", "side"]);
  });

  it("не выдаёт дубликат в другом контейнере того же квартала", () => {
    const given = {};
    const matches = (target) => target.bx === 2 && target.by === 0;
    collectQuestGrants(quests, given, matches);
    expect(collectQuestGrants(quests, given, matches).items).toEqual({});
  });

  it("разрешает награду один раз для каждой цели", () => {
    const quest = [
      {
        id: "radio",
        targets: [
          { bx: 1, by: 0 },
          { bx: 2, by: 0 },
        ],
        grant: [["radiopart", 1]],
      },
    ];
    const given = {};
    const first = collectQuestGrants(quest, given, (target) => target.bx === 1);
    const second = collectQuestGrants(
      quest,
      given,
      (target) => target.bx === 2,
    );
    expect(first.items).toEqual({ radiopart: 1 });
    expect(second.items).toEqual({ radiopart: 1 });
    expect(
      collectQuestGrants(quest, given, (target) => target.bx === 2).items,
    ).toEqual({});
  });

  it("работает и для цели лагеря", () => {
    const quest = [
      { id: "camp", targets: [{ bx: 4, by: 2 }], grant: [["medkit", 3]] },
    ];
    const result = collectQuestGrants(
      quest,
      {},
      (target) => target.bx === 4 && target.by === 2,
    );
    expect(result.items).toEqual({ medkit: 3 });
  });

  it("выдаёт предмет для wayId только в контейнере того же здания", () => {
    const quest = [
        {
          id: "apartment",
          targets: [{ wayId: 112436182 }],
          grant: [["note", 1]],
        },
      ],
      given = {},
      matches = () => true;
    expect(
      collectQuestGrants(quest, given, matches, { wayId: 112436181 }).items,
    ).toEqual({});
    expect(given).toEqual({});
    expect(
      collectQuestGrants(quest, given, matches, { wayId: 112436182 }).items,
    ).toEqual({ note: 1 });
    expect(given).toEqual({ "apartment:way:112436182": true });
    expect(
      collectQuestGrants(quest, given, matches, { wayId: 112436182 }).items,
    ).toEqual({});
  });

  it("различает прогресс целей в одном квартале по wayId", () => {
    const quest = [
        {
          id: "delivery",
          targets: [
            { bx: 2, by: 0, wayId: 101 },
            { bx: 2, by: 0, wayId: 202 },
          ],
          grant: [["cargo", 1]],
        },
      ],
      given = {},
      matches = () => true;
    expect(
      collectQuestGrants(quest, given, matches, { wayId: 101 }).items,
    ).toEqual({ cargo: 1 });
    expect(
      collectQuestGrants(quest, given, matches, { wayId: 202 }).items,
    ).toEqual({ cargo: 1 });
    expect(Object.keys(given)).toEqual([
      "delivery:way:101",
      "delivery:way:202",
    ]);
  });

  it("сохраняет прежние ключи и сигнатуру для блочных целей", () => {
    const given = {},
      quest = [
        { id: "legacy", targets: [{ bx: 3, by: 4 }], grant: [["can", 1]] },
      ];
    collectQuestGrants(quest, given, () => true, { wayId: 101 });
    expect(given).toEqual({ "legacy:3,4": true });
    expect(collectQuestGrants(quest, given, () => true).items).toEqual({});
  });
});
