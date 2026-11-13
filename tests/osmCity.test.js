import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOsmWorld } from "../src/world/osmMap.js";
import { createOsmGameProjection } from "../src/world/osmPois.js";
import { createOsmCityModel } from "../src/world/osmCity.js";

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
    for (const container of first.containers)
      expect(container.id).toMatch(/^osm:/);
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

  it("находит вход в много блочную больницу по координатам двери", () => {
    const block = projection.blockForSite("hospital"),
      hospital = city.specials.get(`${block.bx},${block.by}`).building,
      doorBlock = {
        bx: Math.floor(
          ((hospital.x + Math.floor(hospital.w / 2) + 0.5) * 16) /
            projection.blockPixels,
        ),
        by: Math.floor(
          ((hospital.y + hospital.h + 0.5) * 16) / projection.blockPixels,
        ),
      };
    expect(doorBlock.by).not.toBe(block.by);
    expect(
      city
        .buildingsNearDoor(doorBlock.bx, doorBlock.by)
        .map((building) => building.wayId),
    ).toContain(123686711);
  });
});
