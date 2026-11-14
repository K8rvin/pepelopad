import { describe, expect, it } from "vitest";
import { findNearestFreePosition } from "../src/systems/recovery.js";

describe("аварийное освобождение", () => {
  it("находит ближайшую свободную точку без изменения других данных", () => {
    const point = findNearestFreePosition(
      100,
      100,
      (x, y) => Math.hypot(x - 100, y - 100) >= 15,
    );
    expect(point).not.toBeNull();
    expect(Math.hypot(point.x - 100, point.y - 100)).toBe(16);
  });

  it("возвращает null, если свободного места нет в радиусе", () => {
    expect(
      findNearestFreePosition(0, 0, () => false, { maxRadius: 32 }),
    ).toBeNull();
  });
});
