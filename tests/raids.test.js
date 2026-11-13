import { describe, expect, it } from "vitest";
import { RAIDS } from "../src/data/raids.js";
import {
  activeRaidId,
  raidDefinition,
  raidDistrictRules,
} from "../src/systems/raids.js";

describe("сюжетные рейды", () => {
  it("находит активный рейд только среди поручений", () => {
    expect(activeRaidId([{ raid: "fuel_convoy" }, { id: "side" }])).toBe(
      "fuel_convoy",
    );
    expect(activeRaidId([{ id: "side" }])).toBeNull();
  });

  it("применяет особые правила только в заданном районе", () => {
    expect(raidDistrictRules("fuel_convoy", "industrial")).toMatchObject({
      danger: 1.5,
      eliteChance: 0.35,
    });
    expect(raidDistrictRules("fuel_convoy", "residential")).toBeNull();
  });

  it("описывает полный рейд с грузом, сдачей и наградой", () => {
    const raid = raidDefinition("fuel_convoy");
    expect(raid.goals).toEqual([
      ["cargo", 3],
      ["deliver", 3],
    ]);
    expect(raid.grant).toEqual([["cargo", 3]]);
    expect(raid.reward.trust).toBeGreaterThan(0);
    expect(RAIDS.fuel_convoy.unlockMain).toBe(6);
  });
});
