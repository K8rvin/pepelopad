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
    expect(Object.keys(projection.sites)).toHaveLength(28);
    expect(projection.sites.gunstore.osmName).toBe("Хищник");
    expect(projection.sites.gunstore.ref).toBe("node/4100974890");
    expect(projection.sites.gunstore_host.ref).toBe("way/1540800271");
    expect(projection.sites.school5.ref).toBe("way/112438439");
    expect(projection.sites.camp_school.ref).toBe("way/1273891052");
    expect(projection.sites.residential.osmName).toBe("Библиотечная улица");
    expect(projection.sites.novoremeslennaya.osmName).toBe(
      "Новоремесленная улица",
    );
    expect(projection.blockForSite("origin")).toEqual({ bx: 0, by: 0 });
    const targets = projection.campaignTargets();
    expect(targets.m1.map((target) => target.wayId)).toEqual([
      112436180, 112439402, 112440509,
    ]);
    expect(targets.m2[1]).toMatchObject({
      wayId: 1540800271,
      hostSiteId: "gunstore_host",
      goal: "talk_gunstore",
    });
    expect(targets.m3[0].wayId).toBe(732739077);
    expect(targets.m4.map((target) => target.siteId)).toEqual([
      "police",
      "camp_school",
    ]);
    expect(targets.m5.map((target) => target.wayId)).toEqual([
      679764136, 112437649, 112399694, 1273891052,
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
