import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOsmWorld } from "../src/world/osmMap.js";
import {
  centerOfPoints,
  createOsmGameProjection,
  resolveOsmReference,
} from "../src/world/osmPois.js";

const city = createOsmWorld(
  JSON.parse(
    readFileSync(
      new URL("../public/assets/maps/volgograd-center.json", import.meta.url),
      "utf8",
    ),
  ),
);

describe("реальные POI Волгограда", () => {
  it("находит центр геометрии и внешний контур отношения", () => {
    expect(
      centerOfPoints([
        [0, 0],
        [10, 20],
      ]),
    ).toEqual({ x: 5, y: 10 });
    const pavlov = resolveOsmReference(city, "relation/20144900");
    expect(pavlov.name).toBe("Дом Павлова");
    expect(Number.isFinite(pavlov.x)).toBe(true);
    expect(Number.isFinite(pavlov.y)).toBe(true);
  });

  it("разрешает все привязки кампании к существующим OSM ID", () => {
    const projection = createOsmGameProjection(city);
    expect(Object.keys(projection.sites)).toHaveLength(14);
    expect(projection.sites.gunstore.osmName).toBe("Защита");
    expect(projection.blockForSite("base")).toEqual({ bx: 0, by: 0 });
    const targets = projection.campaignTargets();
    expect(targets.m1[0].siteId).toBe("supermarket");
    expect(targets.m5.map((target) => target.siteId)).toEqual([
      "police",
      "warehouse",
    ]);
    expect(targets.m10[0].osmName).toBe("Мамаев курган");
    for (const questTargets of Object.values(targets))
      for (const target of questTargets) {
        expect(Number.isInteger(target.bx)).toBe(true);
        expect(Number.isInteger(target.by)).toBe(true);
        expect(Number.isFinite(target.x)).toBe(true);
        expect(Number.isFinite(target.y)).toBe(true);
      }
  });

  it("обратимо преобразует метры OSM и игровые пиксели", () => {
    const projection = createOsmGameProjection(city),
      original = projection.sites.hospital,
      game = projection.worldToGame(original),
      restored = projection.gameToWorld(game);
    expect(game.x).toBeGreaterThan(projection.blockPixels * 30);
    expect(restored.x).toBeCloseTo(original.x, 8);
    expect(restored.y).toBeCloseTo(original.y, 8);
  });
});
