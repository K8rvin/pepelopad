import { describe, expect, it } from "vitest";
import { moveStackToTrunk, takeStackFromTrunk } from "../src/systems/trunk.js";

describe("багажник", () => {
  it("переносит стек из рюкзака и освобождает слот", () => {
    const trunk = [];
    const slots = [{ id: "wood", n: 5 }];
    expect(moveStackToTrunk(trunk, slots, 0)).toBe(true);
    expect(trunk).toEqual([{ id: "wood", n: 5 }]);
    expect(slots).toEqual([null]);
  });

  it("не удаляет предмет из рюкзака при полном багажнике", () => {
    const trunk = Array.from({ length: 12 }, () => ({ id: "wood", n: 1 }));
    const slots = [{ id: "scrap", n: 2 }];
    expect(moveStackToTrunk(trunk, slots, 0)).toBe(false);
    expect(trunk).toHaveLength(12);
    expect(slots).toEqual([{ id: "scrap", n: 2 }]);
  });

  it("забирает стек с объединением одинаковых предметов", () => {
    const trunk = [{ id: "wood", n: 4 }];
    const slots = [{ id: "wood", n: 8 }, null];
    expect(takeStackFromTrunk(trunk, 0, slots, { st: 10 })).toEqual({
      added: 4,
      left: 0,
    });
    expect(slots).toEqual([
      { id: "wood", n: 10 },
      { id: "wood", n: 2 },
    ]);
    expect(trunk).toEqual([]);
  });

  it("возвращает остаток при полном рюкзаке", () => {
    const trunk = [{ id: "wood", n: 7 }];
    const slots = [{ id: "wood", n: 10 }];
    expect(takeStackFromTrunk(trunk, 0, slots, { st: 10 })).toEqual({
      added: 0,
      left: 7,
    });
    expect(slots).toEqual([{ id: "wood", n: 10 }]);
    expect(trunk).toEqual([]);
  });
});
