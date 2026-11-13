import { describe, expect, it } from "vitest";
import {
  buildingFits,
  carTileFits,
  cityRadiusAt,
  crosswalkAt,
  districtOf,
  pavedAt,
  roadAt,
  specialBlock,
} from "../src/world/city.js";

describe("генерация города", () => {
  it("возвращает одинаковые районы для одинакового сида", () => {
    for (const seed of [1, 42, 987654321]) {
      for (let by = -12; by <= 12; by++) {
        for (let bx = -12; bx <= 12; bx++) {
          expect(districtOf(bx, by, seed)).toBe(districtOf(bx, by, seed));
          expect(cityRadiusAt(bx, by, seed)).toBeGreaterThanOrEqual(9);
        }
      }
    }
  });

  it("сохраняет специальные кварталы и дом игрока", () => {
    expect(districtOf(0, 0, 42)).toBe("home");
    expect(specialBlock(0, 0)).toBe("base");
    expect(specialBlock(2, 0)).toBe("supermarket");
    expect(specialBlock(5, -4)).toBe("quarry");
    expect(specialBlock(100, 100)).toBeUndefined();
  });

  it("определяет дороги также для отрицательных координат", () => {
    expect(roadAt(0, 10)).toBe(true);
    expect(roadAt(-28, -5)).toBe(true);
    expect(roadAt(5, 5)).toBe(false);
  });

  it("не разрешает объекты на дороге и тротуаре", () => {
    expect(pavedAt(2, 5)).toBe(true);
    expect(pavedAt(4, 5)).toBe(true);
    expect(pavedAt(27, 5)).toBe(true);
    expect(pavedAt(5, 5)).toBe(false);
  });

  it("размещает зебру только в середине квартала", () => {
    expect(crosswalkAt(2, 12)).toBe(true);
    expect(crosswalkAt(12, 2)).toBe(true);
    expect(crosswalkAt(2, 2)).toBe(false);
    expect(crosswalkAt(-26, -16)).toBe(true);
  });

  it("не разрешает пересечения зданий с учётом отступа", () => {
    const buildings = [{ x: 5, y: 5, w: 10, h: 8 }];
    expect(buildingFits(buildings, 7, 7, 2, 1)).toBe(false);
    expect(buildingFits(buildings, 15, 5, 2, 1)).toBe(false);
    expect(buildingFits(buildings, 16, 5, 2, 1)).toBe(true);
  });

  it("не разрешает пересекающиеся места автомобилей", () => {
    const tiles = [[10, 10]];
    expect(carTileFits(tiles, 11, 11)).toBe(false);
    expect(carTileFits(tiles, 12, 12)).toBe(true);
    expect(carTileFits(tiles, 13, 10)).toBe(true);
  });
});
