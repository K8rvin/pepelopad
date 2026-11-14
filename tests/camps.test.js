import { describe, expect, it } from "vitest";
import {
  applyCampUpgrade,
  campUpgradeCost,
  campUpgradeLock,
  createCampMission,
  createCampState,
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

  it("восстанавливает изменяемое состояние без старых координат", () => {
    const camp = createCampState(
      { id: "camp_school", name: "Школа", x: 100, y: 200 },
      {
        x: 999,
        y: 999,
        trust: 7,
        branch: "watch",
        proj: { wall: 2, tower: 1 },
      },
    );
    expect(camp).toMatchObject({
      x: 100,
      y: 200,
      trust: 7,
      branch: "watch",
      specialization: "Убежище и спасение",
    });
    expect(camp.proj).toMatchObject({ wall: 2, tower: 1 });
    expect(camp.residents).toContain("Надежда");
  });

  it("выдаёт детерминированное поручение один раз и блокирует другую ветвь", () => {
    const camp = createCampState({ id: "camp_bridge", x: 0, y: 0 });
    const first = createCampMission(camp);
    expect(createCampMission(camp)).toEqual(first);
    expect(first.goals).toEqual([["supply_medkit", 2]]);
    camp.missionDone = true;
    expect(createCampMission(camp)).toBeNull();

    const school = createCampState({ id: "camp_school", x: 0, y: 0 });
    school.branch = "clinic";
    expect(campUpgradeLock(school, "tower", () => 100)).toBe(
      "Выбрана другая ветвь",
    );
    expect(campUpgradeLock(school, "clinic", () => 100)).toBeNull();
  });
});
