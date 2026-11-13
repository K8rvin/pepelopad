import { describe, expect, it } from "vitest";
import {
  boundsOfWays,
  createOsmWorld,
  osmWayWidth,
  wayCategory,
} from "../src/world/osmMap.js";

describe("статичная OSM-модель", () => {
  it("различает здания, дороги, воду, рельсы и растительность", () => {
    expect(wayCategory({ building: "yes" })).toBe("building");
    expect(wayCategory({ highway: "residential" })).toBe("road");
    expect(wayCategory({ railway: "rail" })).toBe("railway");
    expect(wayCategory({ natural: "water" })).toBe("water");
    expect(wayCategory({ leisure: "park" })).toBe("vegetation");
  });

  it("использует метрическую ширину дороги и одинаковые полосы", () => {
    const twoLanes = { tags: { highway: "residential", lanes: "2" } };
    expect(osmWayWidth(twoLanes)).toBe(96);
    expect(osmWayWidth({ tags: { highway: "residential", lanes: "2" } })).toBe(
      96,
    );
    expect(osmWayWidth({ tags: { highway: "footway" } })).toBe(24);
    expect(osmWayWidth({ tags: { railway: "rail" } })).toBe(32);
  });

  it("считает границы и индексирует чанки", () => {
    const world = createOsmWorld({
      metadata: { name: "test" },
      nodes: [],
      relations: [],
      ways: [
        {
          id: 1,
          tags: { building: "yes" },
          points: [
            [0, 0],
            [300, 20],
          ],
        },
        { id: 2, tags: { highway: "road" }, points: [[-10, 30]] },
      ],
    });
    expect(world.bounds).toEqual({
      minX: -10,
      minY: 0,
      maxX: 300,
      maxY: 30,
    });
    expect(world.chunks.get("0,0").ways.has(1)).toBe(true);
    expect(world.chunks.get("1,0").ways.has(1)).toBe(true);
    expect(world.chunks.get("-1,0").ways.has(2)).toBe(true);
  });
});
