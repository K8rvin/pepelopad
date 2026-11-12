import { describe, expect, it } from "vitest";
import {
  buildCostFor,
  buildLockFor,
  placementLock,
} from "../src/systems/building.js";

const skills = { builder: 0 };

describe("строительство", () => {
  it("уменьшает стоимость от навыка строителя", () => {
    expect(buildCostFor("barricade", skills)).toEqual({ wood: 4 });
    expect(buildCostFor("barricade", { builder: 2 })).toEqual({ wood: 4 });
    expect(buildCostFor("generator", { builder: 5 }).scrap).toBeLessThan(8);
  });

  it("проверяет чертёж и верстак", () => {
    expect(buildLockFor("turret", { bench: 3, learned: new Set() })).toBe(
      "нужен чертёж",
    );
    expect(buildLockFor("generator", { bench: 1, learned: new Set() })).toBe(
      "верстак ур.2",
    );
    expect(
      buildLockFor("barricade", { bench: 1, learned: new Set() }),
    ).toBeNull();
  });

  it("не разрешает размещение при препятствиях и нехватке ресурсов", () => {
    const base = {
      type: "barricade",
      tx: 1,
      ty: 1,
      P: { x: 0, y: 0, r: 5, skills },
      Z: [],
      bench: 1,
      learned: new Set(),
      solidAt: () => null,
      tileAt: () => 0,
      countItem: () => 0,
    };
    expect(placementLock(base)).toBe("Не хватает ресурсов");
    expect(placementLock({ ...base, solidAt: () => ({}) })).toBe(
      "Здесь не поставить",
    );
    expect(placementLock({ ...base, countItem: () => 10 })).toBeNull();
  });
});
