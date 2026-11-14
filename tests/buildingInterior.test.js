import { describe, expect, it } from "vitest";
import {
  circleHitsInternalWalls,
  generateSupermarketInterior,
  getBuildingLayout,
  getBuildingLayouts,
} from "../src/world/buildingInterior.js";
import {
  createBuildingAccess,
  distanceToBuildingWalls,
  pointInPolygon,
} from "../src/world/buildingGeometry.js";

function distanceToFixture(x, y, fixture) {
  const cos = Math.cos(fixture.angle),
    sin = Math.sin(fixture.angle),
    dx = x - fixture.x,
    dy = y - fixture.y,
    localX = dx * cos + dy * sin,
    localY = -dx * sin + dy * cos,
    outsideX = Math.max(Math.abs(localX) - fixture.w / 2, 0),
    outsideY = Math.max(Math.abs(localY) - fixture.h / 2, 0);
  return Math.hypot(outsideX, outsideY);
}

function supermarket() {
  const building = {
    id: "osm:844049423",
    wayId: 844049423,
    type: "supermarket",
    points: [
      [0, 220],
      [220, 0],
      [440, 220],
      [220, 440],
      [0, 220],
    ],
  };
  building.openings = createBuildingAccess(building);
  return building;
}

function apartment() {
  const building = {
    id: "osm:112436182",
    wayId: 112436182,
    type: "apartments",
    tags: { building: "apartments", "building:levels": "9" },
    points: [
      [0, 48],
      [32, 0],
      [1000, 32],
      [1056, 112],
      [1024, 240],
      [0, 224],
      [0, 48],
    ],
  };
  building.openings = createBuildingAccess(building);
  return building;
}

describe("генерация интерьера супермаркета", () => {
  it("детерминированно создаёт стеллажи с рыночной добычей и стабильными ID", () => {
    const building = supermarket(),
      before = JSON.stringify(building),
      first = generateSupermarketInterior(building),
      second = generateSupermarketInterior(building);
    expect(first).toEqual(second);
    expect(JSON.stringify(building)).toBe(before);
    expect(first.fixtures.length).toBeGreaterThanOrEqual(4);
    expect(first.containers).toHaveLength(first.fixtures.length);
    expect(
      new Set(first.containers.map((container) => container.id)).size,
    ).toBe(first.containers.length);
    for (const container of first.containers) {
      expect(container).toMatchObject({
        type: "shelf",
        lootTable: "market",
        wayId: building.wayId,
        floorId: "ground",
      });
      expect(container.tileX).toBe(Math.floor(container.x / 16));
      expect(container.tileY).toBe(Math.floor(container.y / 16));
    }
  });

  it("соблюдает наружные стены, двери, лестницы и ширину проходов", () => {
    const building = supermarket(),
      stairs = [{ x: 220, y: 220 }],
      layout = generateSupermarketInterior(building, { stairs }),
      rows = new Map();
    expect(layout.fixtures.length).toBeGreaterThanOrEqual(4);
    for (const fixture of layout.fixtures) {
      for (const [x, y] of fixture.points) {
        expect(pointInPolygon(x, y, building.points)).toBe(true);
        expect(distanceToBuildingWalls(x, y, building.points)).toBeGreaterThan(
          23.999,
        );
      }
      for (const door of building.openings.filter(
        (opening) => opening.kind === "door",
      ))
        expect(distanceToFixture(door.x, door.y, fixture)).toBeGreaterThan(
          39.999,
        );
      for (const stair of stairs)
        expect(distanceToFixture(stair.x, stair.y, fixture)).toBeGreaterThan(
          39.999,
        );
      if (!rows.has(fixture.row)) rows.set(fixture.row, []);
      rows.get(fixture.row).push(fixture);
    }
    expect(rows.size).toBeGreaterThanOrEqual(2);
    const orderedRows = [...rows.values()].sort(
      (left, right) => left[0].row - right[0].row,
    );
    for (let index = 1; index < orderedRows.length; index++) {
      const previous = orderedRows[index - 1][0],
        current = orderedRows[index][0],
        nx = -Math.sin(previous.angle),
        ny = Math.cos(previous.angle),
        previousV = previous.x * nx + previous.y * ny,
        currentV = current.x * nx + current.y * ny;
      expect(Math.abs(currentV - previousV) - previous.h).toBeGreaterThan(
        39.999,
      );
      expect(current.angle).toBeCloseTo(previous.angle, 10);
    }
  });

  it("не создаёт объекты в маленьком или непригодном полигоне", () => {
    for (const building of [
      {
        wayId: 1,
        points: [
          [0, 0],
          [100, 0],
          [100, 40],
          [0, 40],
          [0, 0],
        ],
      },
      { wayId: 2, points: [] },
      null,
    ]) {
      const layout = generateSupermarketInterior(building);
      expect(layout.fixtures).toEqual([]);
      expect(layout.containers).toEqual([]);
    }
  });
});

describe("шаблон пилотного жилого дома", () => {
  it("создаёт первый и второй этажи по wayId без привязки к мировым координатам", () => {
    const building = apartment(),
      layouts = getBuildingLayouts(building),
      translated = {
        ...building,
        points: building.points.map(([x, y]) => [x + 5000, y - 3000]),
        openings: building.openings.map((opening) => ({
          ...opening,
          x: opening.x + 5000,
          y: opening.y - 3000,
        })),
      },
      translatedGround = getBuildingLayout(translated);
    expect(layouts.map((layout) => layout.floorId)).toEqual([
      "ground",
      "upper",
    ]);
    for (const layout of layouts) {
      expect(layout.wayId).toBe(112436182);
      expect(layout.internalWalls.length).toBeGreaterThan(0);
      expect(layout.doors.length).toBeGreaterThan(0);
      expect(layout.fixtures.length).toBeGreaterThan(0);
      expect(layout.containers.length).toBeGreaterThan(0);
      expect(
        layout.containers.every(
          (container) =>
            container.floorId === layout.floorId &&
            container.wayId === building.wayId,
        ),
      ).toBe(true);
      for (const fixture of layout.fixtures)
        for (const [x, y] of fixture.points)
          expect(pointInPolygon(x, y, building.points)).toBe(true);
    }
    expect(translatedGround.internalWalls.map((wall) => wall.id)).toEqual(
      layouts[0].internalWalls.map((wall) => wall.id),
    );
    expect(translatedGround.fixtures[0].x).toBeCloseTo(
      layouts[0].fixtures[0].x + 5000,
      8,
    );
    expect(translatedGround.fixtures[0].y).toBeCloseTo(
      layouts[0].fixtures[0].y - 3000,
      8,
    );
    expect(getBuildingLayout({ ...building, wayId: 123 })).toBeNull();
    expect(
      getBuildingLayout(
        { ...building, tags: { "building:levels": "1" } },
        "upper",
      ),
    ).toBeNull();
  });

  it("оставляет дверные проёмы и блокирует только сегменты внутренних стен", () => {
    const layout = getBuildingLayout(apartment()),
      wall = layout.internalWalls[0];
    expect(layout.doors.length).toBeGreaterThan(0);
    for (const door of layout.doors)
      expect(
        circleHitsInternalWalls(door.x, door.y, 4, layout.internalWalls),
      ).toBeNull();
    expect(
      circleHitsInternalWalls(
        (wall.x1 + wall.x2) / 2,
        (wall.y1 + wall.y2) / 2,
        4,
        layout.internalWalls,
      ),
    ).toBe(wall);
    expect(
      circleHitsInternalWalls(-1000, -1000, 4, layout.internalWalls),
    ).toBeNull();
  });

  it("не перекрывает лестницы стенами и мебелью", () => {
    const building = apartment(),
      stairs = [{ x: 510, y: 120 }],
      layout = getBuildingLayout(building, "ground", { stairs });
    for (const stair of stairs) {
      expect(
        circleHitsInternalWalls(stair.x, stair.y, 40, layout.internalWalls),
      ).toBeNull();
      for (const fixture of layout.fixtures)
        expect(distanceToFixture(stair.x, stair.y, fixture)).toBeGreaterThan(
          39.999,
        );
    }
  });
});
