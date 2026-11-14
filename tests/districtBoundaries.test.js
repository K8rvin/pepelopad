import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOsmWorld } from "../src/world/osmMap.js";
import { createOsmGameProjection } from "../src/world/osmPois.js";
import {
  createDistrictBoundaries,
  districtNameAt,
  stitchBoundaryRings,
} from "../src/world/districtBoundaries.js";

describe("границы районов", () => {
  it("соединяет outer ways, в том числе обратные", () => {
    const rings = stitchBoundaryRings([
      {
        points: [
          [0, 0],
          [10, 0],
        ],
      },
      {
        points: [
          [10, 10],
          [10, 0],
        ],
      },
      {
        points: [
          [10, 10],
          [0, 10],
        ],
      },
      {
        points: [
          [0, 10],
          [0, 0],
        ],
      },
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual(rings[0].at(-1));
  });

  it("использует настоящую границу Краснооктябрьского района", () => {
    const world = createOsmWorld(
        JSON.parse(
          readFileSync(
            new URL(
              "../public/assets/maps/volgograd-center.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
      projection = createOsmGameProjection(world),
      districts = createDistrictBoundaries(world, projection),
      spawn = projection.worldToGame(projection.sites.residential);
    expect(districts.some((district) => district.id === 4039466)).toBe(true);
    expect(districtNameAt(districts, spawn.x, spawn.y)).toBe(
      "Краснооктябрьский район",
    );
  });
});
