import { describe, expect, it } from "vitest";
import {
  circleHitsPolygon,
  osmSolidAt,
  pointInPolygon,
} from "../src/world/osmCollision.js";

const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const world = {
  ways: [
    { id: 1, tags: { building: "yes" }, points: square },
    {
      id: 2,
      tags: { highway: "road" },
      points: [
        [20, 0],
        [30, 0],
      ],
    },
    {
      id: 3,
      tags: { natural: "water" },
      points: [
        [40, 0],
        [50, 0],
        [50, 10],
        [40, 10],
      ],
    },
  ],
};

describe("коллизии OSM-геометрии", () => {
  it("определяет точку внутри и снаружи полигона", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });

  it("учитывает радиус у края здания", () => {
    expect(circleHitsPolygon(-1, 5, 2, square)).toBe(true);
    expect(circleHitsPolygon(-3, 5, 2, square)).toBe(false);
  });

  it("блокирует здания и воду, но не дороги", () => {
    expect(osmSolidAt(5, 5, world)?.id).toBe(1);
    expect(osmSolidAt(25, 0, world)).toBeNull();
    expect(osmSolidAt(45, 5, world)?.id).toBe(3);
  });
});
