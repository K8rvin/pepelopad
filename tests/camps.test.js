import { describe, expect, it } from "vitest";
import {
  applyCampUpgrade,
  campUpgradeCost,
  campUpgradeLock,
  donateToCamp,
  findCampNear,
  tradeLock,
} from "../src/systems/camps.js";

describe("лагеря", () => {
  it("находит лагерь только в радиусе", () => {
    const camp = { x: 10, y: 10 };
    const camps = new Map([["camp", camp]]);
    expect(findCampNear(20, 20, camps)).toBe(camp);
    expect(findCampNear(300, 300, camps)).toBeNull();
  });

  it("увеличивает стоимость и уровень улучшения", () => {
    expect(campUpgradeCost("wall", 1)).toEqual({ wood: 16, scrap: 12 });
    const camp = { proj: {}, trust: 0, level: 1 };
    expect(applyCampUpgrade(camp, "wall")).toBe(1);
    expect(camp.trust).toBe(3);
    expect(campUpgradeLock(camp, "wall", () => 100)).toBeNull();
  });

  it("проверяет максимум и торговлю", () => {
    const camp = { proj: { wall: 3 }, trust: 1 };
    expect(campUpgradeLock(camp, "wall", () => 100)).toBe("Уже максимум");
    expect(tradeLock(camp, { item: "scrap", n: 6, trust: 2 }, () => 100)).toBe(
      "Недостаточно доверия",
    );
    expect(tradeLock(camp, { item: "scrap", n: 6, trust: 0 }, () => 0)).toBe(
      "Нужно: Металлолом ×6",
    );
  });

  it("добавляет доверие за пожертвование", () => {
    const camp = { trust: 0 };
    donateToCamp(camp, 3);
    expect(camp.trust).toBe(3);
  });
});
