import { describe, expect, it } from "vitest";
import {
  addToSpatialGrid,
  moveInSpatialGrid,
  nearInSpatialGrid,
  spatialKey,
} from "../src/world/spatialGrid.js";

const addCar = (grid, entities, id, x, y) => {
  const car = { id, x, y };
  entities.set(id, car);
  addToSpatialGrid(grid, car);
  return car;
};

describe("пространственный индекс", () => {
  it("работает с отрицательными координатами", () => {
    expect(spatialKey(-1, -1)).toBe("-1,-1");
    expect(spatialKey(128, 256)).toBe("1,2");
  });

  it("находит только сущности внутри радиуса", () => {
    const grid = new Map();
    const entities = new Map();
    addCar(grid, entities, "near", 20, 20);
    addCar(grid, entities, "far", 300, 300);
    expect(
      nearInSpatialGrid(grid, entities, 0, 0, 50).map((car) => car.id),
    ).toEqual(["near"]);
  });

  it("переносит сущность в новую ячейку и удаляет из прежней", () => {
    const grid = new Map();
    const entities = new Map();
    const car = addCar(grid, entities, "car", 20, 20);
    car.x = 200;
    moveInSpatialGrid(grid, car);
    expect(nearInSpatialGrid(grid, entities, 0, 0, 50)).toEqual([]);
    expect(nearInSpatialGrid(grid, entities, 200, 20, 20)).toEqual([car]);
  });
});
