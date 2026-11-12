import { describe, expect, it } from "vitest";
import {
  shouldSkipZombieUpdate,
  shouldUnloadZombie,
  steerAroundObstacles,
} from "../src/systems/zombieNavigation.js";

describe("навигация и выгрузка зомби", () => {
  it("не меняет свободное направление", () => {
    const result = steerAroundObstacles(
      { x: 0, y: 0, r: 5, side: 1 },
      1,
      0,
      () => null,
    );
    expect(result).toEqual({ mx: 1, my: 0, side: 1 });
  });

  it("выбирает свободный обход вместо случайного бока", () => {
    const result = steerAroundObstacles(
      { x: 0, y: 0, r: 5, side: 1 },
      1,
      0,
      (x, y) => (x > 5 && Math.abs(y) < 8 ? { kind: "tile" } : null),
    );
    expect(result.my).toBeGreaterThan(0);
    expect(result.mx).toBeGreaterThan(0);
  });

  it("не обходит постройку, которую нужно атаковать", () => {
    const result = steerAroundObstacles(
      { x: 0, y: 0, r: 5, side: 1 },
      1,
      0,
      () => ({ kind: "struct" }),
    );
    expect(result).toEqual({ mx: 1, my: 0, side: 1 });
  });

  it("усыпляет далёкую охрану рассадника и выгружает её позже", () => {
    const nest = { nest: "nest" };
    expect(shouldSkipZombieUpdate(nest, 41 * 16)).toBe(true);
    expect(shouldUnloadZombie(nest, 60 * 16)).toBe(false);
    expect(shouldUnloadZombie(nest, 81 * 16)).toBe(true);
    expect(shouldUnloadZombie({}, 53 * 16)).toBe(true);
  });

  it("не выгружает и не усыпляет осадного зомби", () => {
    const siege = { siege: true, nest: "base" };
    expect(shouldSkipZombieUpdate(siege, 100 * 16)).toBe(false);
    expect(shouldUnloadZombie(siege, 100 * 16)).toBe(false);
  });
});
