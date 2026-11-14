import { describe, expect, it } from "vitest";
import {
  advanceRailVehicle,
  createRailPopulation,
  pointAlongRoute,
  railVehicleParts,
} from "../src/world/railPopulation.js";

const route = {
  points: [
    [0, 0],
    [100, 0],
    [150, 50],
  ],
  length: 150,
};

describe("рельсовый транспорт", () => {
  it("движется по полилинии и поворачивается по касательной", () => {
    expect(pointAlongRoute(route, 50)).toMatchObject({ x: 50, y: 0, angle: 0 });
    const corner = pointAlongRoute(route, 125);
    expect(corner.x).toBeCloseTo(117.6777, 3);
    expect(corner.y).toBeCloseTo(17.6777, 3);
    expect(corner.angle).toBeCloseTo(Math.PI / 4);
  });

  it("меняет направление на концах и не заворачивает вагоны через конец", () => {
    const vehicle = {
      route,
      distance: 140,
      speed: 60,
      direction: 1,
      carriages: 2,
      id: "train",
    };
    advanceRailVehicle(vehicle, 1);
    expect(vehicle.distance).toBe(150);
    expect(vehicle.direction).toBe(-1);
    const parts = railVehicleParts({ ...vehicle, distance: 10, direction: 1 });
    expect(Math.min(...parts.map((part) => part.x))).toBe(0);
    expect(parts).toHaveLength(3);
  });

  it("использует реальные railway=train и light_rail=tram маршруты", () => {
    const world = {
      ways: [
        {
          id: 1,
          tags: { railway: "rail" },
          points: [
            [0, 0],
            [1000, 0],
          ],
        },
        {
          id: 2,
          tags: { railway: "light_rail" },
          points: [
            [0, 100],
            [1000, 100],
          ],
        },
        {
          id: 3,
          tags: { highway: "road" },
          points: [
            [0, 200],
            [1000, 200],
          ],
        },
      ],
    };
    const vehicles = createRailPopulation(world);
    expect(vehicles.map((vehicle) => vehicle.kind).sort()).toEqual([
      "train",
      "tram",
    ]);
    for (const vehicle of vehicles) {
      const point = pointAlongRoute(vehicle.route, vehicle.distance);
      expect(vehicle.x).toBe(point.x);
      expect(vehicle.y).toBe(point.y);
    }
  });
});
