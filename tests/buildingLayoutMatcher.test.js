import { describe, expect, it } from "vitest";
import { BUILDING_LAYOUTS } from "../src/data/buildingLayouts.js";
import {
  buildingShapeFingerprint,
  matchBuildingLayout,
  matchShapeFingerprints,
  transformShape,
  transformShapePoint,
} from "../src/world/buildingLayoutMatcher.js";

const template = BUILDING_LAYOUTS[112436182];
const reference = template.footprint.points;

function candidate(points, overrides = {}) {
  return {
    id: "osm:999",
    wayId: 999,
    type: "apartments",
    tags: { building: "apartments", "building:levels": "9" },
    points,
    ...overrides,
  };
}

function gamePoints(points) {
  return points.map(([x, y]) => [x * 16, y * 16]);
}

function centroid(points) {
  return points.reduce(
    (sum, point) => [
      sum[0] + point[0] / points.length,
      sum[1] + point[1] / points.length,
    ],
    [0, 0],
  );
}

describe("fingerprints совпадающих жилых домов", () => {
  it("нормализует замыкание, поворот, перенос и физический масштаб", () => {
    const transform = {
        scale: 1.05,
        rotation: Math.PI / 3,
        translateX: 700,
        translateY: -1200,
      },
      transformed = gamePoints(transformShape(reference, transform)),
      first = buildingShapeFingerprint(gamePoints(reference)),
      second = buildingShapeFingerprint([...transformed, transformed[0]]),
      match = matchShapeFingerprints(first, second);
    expect(first.area).toBeCloseTo(1003.377, 3);
    expect(second.area / first.area).toBeCloseTo(1.05 ** 2, 8);
    expect(second.normalizedEdges).toHaveLength(first.normalizedEdges.length);
    for (let index = 0; index < first.normalizedEdges.length; index++)
      expect(second.normalizedEdges[index]).toBeCloseTo(
        first.normalizedEdges[index],
        12,
      );
    expect(match.turnMismatches).toBe(0);
    expect(match.scale).toBeCloseTo(1.05, 8);
    expect(match.maxEdgeDifference).toBeCloseTo(0, 8);
    const transformedCenter = centroid(
      transformShape(reference, match.transform),
    );
    expect(transformedCenter[0]).toBeCloseTo(centroid(second.points)[0], 8);
    expect(transformedCenter[1]).toBeCloseTo(centroid(second.points)[1], 8);
  });

  it("сопоставляет циклические последовательности поворотов в обеих обходах", () => {
    const rotated = [...reference.slice(4), ...reference.slice(0, 4)],
      forward = matchBuildingLayout(candidate(gamePoints(rotated))),
      reversedPoints = [...gamePoints(reference)].reverse(),
      reversed = matchBuildingLayout(candidate(reversedPoints));
    expect(forward).toMatchObject({ source: false, turnMismatches: 0 });
    expect(reversed).toMatchObject({
      source: false,
      turnMismatches: 0,
      winding: -1,
    });
  });

  it("применяет физическое преобразование к координатам", () => {
    expect(
      transformShapePoint([2, 3], {
        scale: 2,
        rotation: Math.PI / 2,
        translateX: 10,
        translateY: 20,
      })[0],
    ).toBeCloseTo(4);
    expect(
      transformShapePoint([2, 3], {
        scale: 2,
        rotation: Math.PI / 2,
        translateX: 10,
        translateY: 20,
      })[1],
    ).toBeCloseTo(24);
  });

  it("принимает реальную форму Репина 21", () => {
    const repina = [
      [0, 0],
      [0.815046432, 7.313776],
      [68.236256287, 0],
      [67.39183829, -6.90184],
      [66.584135577, -13.52538],
      [-0.785675178, -6.300712],
      [-2.680107218, -6.812784],
      [-6.902194145, -7.970512],
      [-10.529516098, -1.55848],
      [-4.391318176, -0.645656],
    ];
    const match = matchBuildingLayout(candidate(gamePoints(repina)));
    expect(match).toMatchObject({
      source: false,
      sourceWayId: 112436182,
      template: { id: "pilot-apartment" },
    });
    expect(match.areaRatio).toBeGreaterThan(0.97);
    expect(match.areaRatio).toBeLessThan(0.99);
  });
});

describe("отклонение неподходящих шаблонов", () => {
  it("отклоняет вырожденные и самопересекающиеся полигоны", () => {
    for (const points of [
      [],
      [
        [0, 0],
        [100, 0],
        [200, 0],
      ],
      [
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0],
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    ])
      expect(buildingShapeFingerprint(points)).toBeNull();
    expect(
      matchBuildingLayout(
        candidate(
          [
            [0, 0],
            [100, 0],
            [200, 0],
          ],
          { wayId: 112436182 },
        ),
      ),
    ).toBeNull();
  });

  it("отклоняет другую форму и несовместимый физический масштаб", () => {
    expect(
      matchBuildingLayout(
        candidate([
          [0, 0],
          [600, 0],
          [600, 300],
          [0, 300],
        ]),
      ),
    ).toBeNull();
    expect(
      matchBuildingLayout(
        candidate(gamePoints(reference).map(([x, y]) => [x * 2, y * 2])),
      ),
    ).toBeNull();
    const changed = gamePoints(reference);
    changed[3] = [changed[3][0] + 300, changed[3][1] + 200];
    expect(matchBuildingLayout(candidate(changed))).toBeNull();
  });

  it("требует жилой дом и необходимые этажи", () => {
    expect(
      matchBuildingLayout(
        candidate(gamePoints(reference), {
          type: "house",
          tags: { building: "house", "building:levels": "9" },
        }),
      ),
    ).toBeNull();
    expect(
      matchBuildingLayout(
        candidate(gamePoints(reference), {
          tags: { building: "apartments", "building:levels": "1" },
        }),
      ),
    ).toBeNull();
    expect(
      matchBuildingLayout(
        candidate(gamePoints(reference), {
          tags: { building: "apartments", "building:levels": "invalid" },
        }),
      ),
    ).toBeNull();
  });
});
