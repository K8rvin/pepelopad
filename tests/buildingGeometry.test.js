import { describe, expect, it } from "vitest";
import {
  circleHitsBuildingWalls,
  createBuildingAccess,
  distanceToBuildingWalls,
  pointInPolygon,
  projectToSegment,
} from "../src/world/buildingGeometry.js";

const diagonal = {
  id: 7,
  tags: { building: "yes" },
  points: [
    [0, 100],
    [100, 0],
    [200, 100],
    [100, 200],
    [0, 100],
  ],
};

describe("геометрия доступных зданий", () => {
  it("ставит двери и окна на диагональные рёбра с наружной нормалью", () => {
    const openings = createBuildingAccess(diagonal);
    expect(openings.some((opening) => opening.kind === "door")).toBe(true);
    expect(openings.some((opening) => opening.kind === "window")).toBe(true);
    for (const opening of openings) {
      const a = diagonal.points[opening.edgeIndex],
        b = diagonal.points[(opening.edgeIndex + 1) % diagonal.points.length],
        projected = projectToSegment(
          opening.x,
          opening.y,
          a[0],
          a[1],
          b[0],
          b[1],
        );
      expect(projected.distanceSquared).toBeCloseTo(0, 8);
      expect(
        pointInPolygon(
          opening.x + opening.nx * 3,
          opening.y + opening.ny * 3,
          diagonal.points,
        ),
      ).toBe(false);
    }
  });

  it("создаёт несколько дверей для большого здания", () => {
    const large = {
        id: 8,
        points: [
          [0, 0],
          [1000, 0],
          [1000, 1000],
          [0, 1000],
          [0, 0],
        ],
      },
      openings = createBuildingAccess(large);
    expect(openings.filter((opening) => opening.kind === "door")).toHaveLength(
      4,
    );
    expect(
      new Set(
        openings
          .filter((opening) => opening.kind === "door")
          .map((opening) => opening.edgeIndex),
      ).size,
    ).toBe(4);
  });

  it("блокирует стену, но пропускает дверной и оконный проём", () => {
    const way = { ...diagonal, openings: createBuildingAccess(diagonal) },
      door = way.openings.find((opening) => opening.kind === "door"),
      window = way.openings.find((opening) => opening.kind === "window");
    expect(circleHitsBuildingWalls(100, 100, 5, way)).toBeNull();
    expect(circleHitsBuildingWalls(door.x, door.y, 5, way)).toBeNull();
    expect(circleHitsBuildingWalls(window.x, window.y, 5, way)).toBeNull();
    expect(circleHitsBuildingWalls(7, 93, 5, way)).toBe(way);
    expect(distanceToBuildingWalls(100, 100, diagonal.points)).toBeGreaterThan(
      60,
    );
  });
});
