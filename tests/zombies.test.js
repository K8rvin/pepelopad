import { describe, expect, it } from "vitest";
import { createZombie, shouldAttackStructure } from "../src/systems/zombies.js";
import { ZT } from "../src/data/enemies.js";

const difficulty = { hp: 1, dmg: 1 };

describe("зомби", () => {
  it("создаёт обычного противника с параметрами типа", () => {
    const zombie = createZombie("walker", 0, 0, {}, difficulty, 0, () => 0.5);
    expect(zombie.type).toBe("walker");
    expect(zombie.hp).toBe(ZT.walker.hp);
    expect(zombie.elite).toBe(false);
    expect(zombie.st).toBe("wander");
  });

  it("усиливает элитного противника и сохраняет осады и рассадник", () => {
    const zombie = createZombie(
      "brute",
      4096,
      0,
      { elite: true, siege: true, nest: "nest" },
      difficulty,
      1,
      () => 0.5,
    );
    expect(zombie.hp).toBe(ZT.brute.hp * 1.5);
    expect(zombie.dmg).toBe(ZT.brute.dmg * 1.25);
    expect(zombie.siege).toBe(true);
    expect(zombie.nest).toBe("nest");
  });

  it("атакует постройку при блокировке по одной оси", () => {
    const zombie = { st: "chase" };
    const result = { bx: true, by: false, hit: { kind: "struct" } };
    expect(shouldAttackStructure(result, zombie)).toBe(true);
    expect(
      shouldAttackStructure({ ...result, hit: { kind: "tile" } }, zombie),
    ).toBe(false);
    expect(shouldAttackStructure(result, { st: "wander" })).toBe(false);
  });
});
