import { describe, expect, it } from "vitest";
import {
  createRoadPopulation,
  populationTarget,
} from "../src/world/roadPopulation.js";
import { distanceToSegmentSquared } from "../src/world/osmCollision.js";

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
      expect(car.angle).toBe(0);
      expect(
        distanceToSegmentSquared(car.x, car.y, 0, 0, 1500, 0),
      ).toBeLessThanOrEqual(48 ** 2);
    }
    expect(population.spawnPointsNear(500, 0, 300).length).toBeGreaterThan(0);
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
