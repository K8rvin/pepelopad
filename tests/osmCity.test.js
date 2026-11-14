import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOsmWorld } from "../src/world/osmMap.js";
import { createOsmGameProjection } from "../src/world/osmPois.js";
import { createOsmCityModel } from "../src/world/osmCity.js";
import {
  circleHitsBuildingWalls,
  distanceToBuildingWalls,
  pointInPolygon,
} from "../src/world/buildingGeometry.js";

const world = createOsmWorld(
  JSON.parse(
    readFileSync(
      new URL("../public/assets/maps/volgograd-center.json", import.meta.url),
      "utf8",
    ),
  ),
);
const projection = createOsmGameProjection(world);
const city = createOsmCityModel(world, projection);

describe("игровая модель статичного Волгограда", () => {
  it("размещает специальные объекты по реальным координатам", () => {
    const base = city.planBlock(0, 0, 42, new Map());
    expect(base.special).toBe("base");
    expect(base.name).toBe("Рубеж у Волгограда I");
    const supermarketBlock = projection.blockForSite("supermarket");
    const supermarket = city.planBlock(
      supermarketBlock.bx,
      supermarketBlock.by,
      42,
      new Map(),
    );
    expect(supermarket.special).toBe("supermarket");
    expect(supermarket.buildings[0].name).toBe("Супермаркет «Калина»");
    expect(supermarket.buildings[0].wayId).toBe(844049423);
  });

  it("детерминированно создаёт контейнеры только у реальных зданий", () => {
    const block = projection.blockForSite("hospital"),
      first = city.planBlock(block.bx, block.by, 42, new Map()),
      second = city.planBlock(block.bx, block.by, 42, new Map());
    expect(first.buildings[0].wayId).toBe(123686711);
    expect(first.containers).toEqual(second.containers);
    expect(
      new Set(first.containers.map((container) => container.id)).size,
    ).toBe(first.containers.length);
    for (const container of first.containers) {
      expect(container.id).toMatch(/^osm:/);
      const x = container.x * 16 + 8,
        y = container.y * 16 + 8;
      expect(pointInPolygon(x, y, first.buildings[0].points)).toBe(true);
      expect(
        distanceToBuildingWalls(x, y, first.buildings[0].points),
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it("ставит лагеря на OSM-точки и растительность только на зелёных территориях", () => {
    const block = projection.blockForSite("camp_bridge"),
      camp = city.planBlock(block.bx, block.by, 42, new Map()).camp,
      expected = projection.worldToGame(projection.sites.camp_bridge);
    expect(camp.x).toBe(expected.x);
    expect(camp.y).toBe(expected.y);
    const parkBlock = projection.blockForSite("camp_farm"),
      park = city.planBlock(parkBlock.bx, parkBlock.by, 42, new Map());
    expect(park.props.length).toBeGreaterThan(0);
    for (const prop of park.props)
      expect(city.vegetationAt(prop.x * 16 + 8, prop.y * 16 + 8)).toBe(true);
  });

  it("пропускает реальные проёмы больницы и размещает лестницы внутри", () => {
    const block = projection.blockForSite("hospital"),
      hospital = city.specials.get(`${block.bx},${block.by}`).building,
      doors = hospital.openings.filter((opening) => opening.kind === "door");
    expect(doors.length).toBeGreaterThan(1);
    for (const door of doors)
      expect(circleHitsBuildingWalls(door.x, door.y, 5, hospital)).toBeNull();
    const stairs = city.stairsFor(hospital, "ground");
    expect(stairs.map((stair) => stair.target)).toEqual(["upper", "basement"]);
    for (const stair of stairs) {
      expect(pointInPolygon(stair.x, stair.y, hospital.points)).toBe(true);
      expect(city.buildingAt(stair.x, stair.y).wayId).toBe(123686711);
    }
  });
});
