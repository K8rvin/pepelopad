import { describe, expect, it } from "vitest";
import {
  damageMultiplier,
  maxHpFor,
  maxStFor,
  playerSpeed,
  threatForDay,
  xpNeed,
} from "../src/systems/player.js";

const player = {
  lvl: 3,
  skills: { vit: 2, sta: 1, archer: 2, marksman: 3 },
};

describe("характеристики игрока", () => {
  it("вычисляет здоровье и выносливость", () => {
    expect(maxHpFor(player)).toBe(170);
    expect(maxStFor(player)).toBe(115);
  });

  it("учитывает энергетик и тип оружия", () => {
    expect(playerSpeed(player, 0)).toBeCloseTo(64 * 1.04);
    expect(playerSpeed(player, 10)).toBeCloseTo(64 * 1.04 * 1.25);
    expect(damageMultiplier(player, "bow")).toBeCloseTo(1.16);
    expect(damageMultiplier(player, "rifle")).toBeCloseTo(1.21);
  });

  it("вычисляет опыт и угрозу", () => {
    expect(xpNeed(1)).toBe(40);
    expect(xpNeed(3)).toBe(110);
    expect(threatForDay(1)).toBe(0);
    expect(threatForDay(5)).toBe(0.5);
    expect(threatForDay(20)).toBe(1);
  });
});
