import { describe, expect, it } from "vitest";
import { VEHICLES } from "../src/data/vehicles.js";
import {
  advanceTravelClock,
  estimateStoryTravel,
  storyTravelLock,
} from "../src/systems/storyTravel.js";

function fixture() {
  const player = { x: 0, y: 0, inCar: "car" },
    car = {
      id: "car",
      fuel: 20,
      hp: 100,
      engineHp: 100,
      tireHp: 100,
      broken: false,
      locked: false,
      dead: false,
    };
  return {
    mapOpen: true,
    siege: null,
    target: { x: 2000 * 16, y: 0 },
    player,
    car,
    definition: VEHICLES.sedan,
  };
}

describe("сюжетное путешествие", () => {
  it("оценивает расход по 1,25 дистанции и время при 50 км/ч", () => {
    const data = fixture();
    const estimate = estimateStoryTravel(
      data.player,
      data.target,
      data.definition,
    );
    expect(estimate.straightMeters).toBe(2000);
    expect(estimate.routeMeters).toBe(2500);
    expect(estimate.fuel).toBeCloseTo(0.2);
    expect(estimate.hours).toBeCloseTo(0.05);
    expect(storyTravelLock(data)).toBeNull();
  });

  it("запрещает поездку для близкой цели, осады и вне большой карты", () => {
    const data = fixture();
    data.target = { x: 1200 * 16, y: 0 };
    expect(storyTravelLock(data)).toBe("Цель ближе 1200 м");
    data.target = { x: 2000 * 16, y: 0 };
    data.siege = {};
    expect(storyTravelLock(data)).toBe(
      "Во время осады нельзя покинуть позицию",
    );
    data.siege = null;
    data.mapOpen = false;
    expect(storyTravelLock(data)).toBe(
      "Быстрое путешествие доступно только на большой карте",
    );
  });

  it("требует текущую исправную машину и достаточный запас топлива", () => {
    const data = fixture();
    data.player.inCar = null;
    expect(storyTravelLock(data)).toBe("Сядь в текущий автомобиль");
    data.player.inCar = "car";
    data.car.broken = true;
    expect(storyTravelLock(data)).toBe("Автомобиль не на ходу");
    data.car.broken = false;
    data.car.fuel = 0.1;
    expect(storyTravelLock(data)).toBe("Недостаточно топлива");
  });

  it("переносит часы через полночь", () => {
    expect(advanceTravelClock({ day: 2, tod: 23.5 }, 2)).toEqual({
      day: 3,
      tod: 1.5,
    });
  });
});
