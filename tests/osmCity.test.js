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
    const origin = city.planBlock(0, 0, 42, new Map());
    expect(origin.special).toBe("origin");
    expect(origin.name).toBe("Волгоград I");
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

  it("показывает реальный адрес ближайшего здания и не выдумывает номер", () => {
    const addressed = [...city.buildings.values()].find(
      (building) =>
        building.tags["addr:street"] && building.tags["addr:housenumber"],
    );
    expect(addressed).toBeDefined();
    const center = {
      x: (addressed.bounds.minX + addressed.bounds.maxX) / 2,
      y: (addressed.bounds.minY + addressed.bounds.maxY) / 2,
    };
    expect(city.addressAt(center.x, center.y)).toEqual({
      district: city.districtNameAt(center.x, center.y),
      street: addressed.tags["addr:street"],
      houseNumber: addressed.tags["addr:housenumber"],
      wayId: addressed.wayId,
    });

    const unnumbered = [...city.buildings.values()].find(
      (building) =>
        building.tags["addr:street"] && !building.tags["addr:housenumber"],
    );
    expect(unnumbered).toBeDefined();
    const address = city.addressAt(
      (unnumbered.bounds.minX + unnumbered.bounds.maxX) / 2,
      (unnumbered.bounds.minY + unnumbered.bounds.maxY) / 2,
    );
    expect(address.street).toBe(unnumbered.tags["addr:street"]);
    expect(address.houseNumber).toBeNull();
    expect(address.wayId).toBe(unnumbered.wayId);
  });

  it("выбирает ближайший к жилому спавну супермаркет с полками", () => {
    const spawn = projection.worldToGame(projection.sites.residential),
      target = city.nearestSupermarketTarget(spawn.x, spawn.y);
    expect(target.wayId).toBe(112437649);
    expect(target.distance / projection.pixelsPerMeter).toBeLessThan(300);
    const block = city.planBlock(target.bx, target.by, 42, new Map()),
      shelves = block.containers.filter(
        (container) =>
          container.wayId === target.wayId && container.type === "shelf",
      );
    expect(shelves.length).toBeGreaterThanOrEqual(4);
    expect(new Set(shelves.map((shelf) => shelf.id)).size).toBe(shelves.length);
    for (const shelf of shelves) {
      expect(shelf.lootTable).toBe("market");
      expect(shelf.floorId).toBe("ground");
      expect(
        pointInPolygon(
          shelf.x * 16 + 8,
          shelf.y * 16 + 8,
          city.buildings.get(target.wayId).points,
        ),
      ).toBe(true);
    }
  });
});
