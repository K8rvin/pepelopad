import { describe, expect, it } from "vitest";
import {
  createRoadPopulation,
  populationTarget,
} from "../src/world/roadPopulation.js";
import { distanceToSegmentSquared } from "../src/world/osmCollision.js";
import { vehicleDefinition } from "../src/systems/vehicles.js";

const world = {
  ways: [
    {
      id: 10,
      tags: { highway: "residential", lanes: "2" },
      points: [
        [0, 0],
        [1500, 0],
      ],
    },
    {
      id: 11,
      tags: { building: "yes" },
      points: [
        [500, 200],
        [600, 200],
        [600, 300],
        [500, 300],
      ],
    },
  ],
};

describe("население дорог", () => {
  it("детерминированно ставит машины на дорогу по касательной", () => {
    const population = createRoadPopulation(world);
    expect(population.cars.length).toBeGreaterThan(0);
    expect(population.cars).toEqual(createRoadPopulation(world).cars);
    expect(new Set(population.cars.map((car) => car.id)).size).toBe(
      population.cars.length,
    );
    for (const car of population.cars) {
      const def = vehicleDefinition(car.type);
      expect(car.angle).toBe(0);
      expect(
        distanceToSegmentSquared(car.x, car.y, 0, 0, 1500, 0),
      ).toBeLessThanOrEqual(48 ** 2);
      expect(car.maxFuel).toBe(def.maxFuel);
      expect(car.fuel).toBeGreaterThanOrEqual(0);
      expect(car.fuel).toBeLessThanOrEqual(car.maxFuel * 0.75);
      if (def.humanPowered) expect(car.fuel).toBe(0);
      else expect(car.fuel).toBeGreaterThan(car.maxFuel * 0.08);
    }
    expect(population.spawnPointsNear(500, 0, 300).length).toBeGreaterThan(0);
  });

  it("распределяет по дорогам все классы транспорта", () => {
    const populatedWorld = {
      ways: Array.from({ length: 40 }, (_, index) => ({
        id: 100 + index,
        tags: { highway: "residential", lanes: "2" },
        points: [
          [0, index * 100],
          [3000, index * 100],
        ],
      })),
    };
    const types = new Set(
      createRoadPopulation(populatedWorld).cars.map((car) => car.type),
    );
    for (const type of ["motorcycle", "bicycle", "scooter"])
      expect(types.has(type)).toBe(true);
  });

  it("усиливает ночной и плотный город, но ограничивает нагрузку", () => {
    const base = {
      day: 3,
      night: false,
      difficulty: 1,
      districtDanger: 1,
      raidDanger: 1,
      density: 1,
      calm: 0,
      endless: false,
    };
    expect(populationTarget(base)).toBeGreaterThan(14);
    expect(populationTarget({ ...base, night: true })).toBeGreaterThan(
      populationTarget(base),
    );
    expect(populationTarget({ ...base, density: 2 })).toBeGreaterThan(
      populationTarget(base),
    );
    expect(
      populationTarget({ ...base, day: 100, night: true, density: 5 }),
    ).toBe(55);
  });
});
