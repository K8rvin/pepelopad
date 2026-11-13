import { describe, expect, it } from "vitest";
import {
  paintBuildingDetail,
  paintGroundDetail,
  paintRoadBorder,
  paintRoadMarkings,
} from "../src/render/osmDetails.js";

function fakeContext() {
  const operations = [],
    target = { globalAlpha: 1 };
  return {
    operations,
    ctx: new Proxy(target, {
      get(object, property) {
        if (property in object) return object[property];
        return (...args) => operations.push([property, ...args]);
      },
      set(object, property, value) {
        object[property] = value;
        if (["fillStyle", "strokeStyle", "lineWidth"].includes(property))
          operations.push([property, value]);
        return true;
      },
    }),
  };
}

describe("детализированная OSM-отрисовка", () => {
  it("детерминированно текстурирует землю без Math.random", () => {
    const render = (seed) => {
      const { ctx, operations } = fakeContext();
      paintGroundDetail({
        ctx,
        cam: { x: 0, y: 0 },
        W: 128,
        H: 128,
        SC: 1,
        w2s: (x, y) => ({ x, y }),
        seed,
      });
      return operations;
    };
    expect(render(42)).toEqual(render(42));
    expect(render(42)).not.toEqual(render(43));
  });

  it("рисует кровлю и вентиляцию внутри сохранённого контура", () => {
    const { ctx, operations } = fakeContext(),
      way = {
        id: 17,
        tags: { building: "yes", "roof:colour": "grey" },
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ],
      },
      before = JSON.stringify(way);
    paintBuildingDetail({ ctx, way, SC: 1, w2s: (x, y) => ({ x, y }) });
    expect(operations.some(([name]) => name === "clip")).toBe(true);
    expect(operations.some(([name]) => name === "strokeRect")).toBe(true);
    expect(operations.at(-1)).toEqual(["restore"]);
    expect(JSON.stringify(way)).toBe(before);
  });

  it("добавляет бордюр и центральную разметку без изменения ширины полос", () => {
    const { ctx, operations } = fakeContext(),
      way = {
        id: 1,
        tags: { highway: "residential", lanes: "2" },
        points: [
          [0, 0],
          [100, 0],
        ],
      };
    paintRoadBorder({ ctx, way, SC: 1, w2s: (x, y) => ({ x, y }) });
    expect(operations).toContainEqual(["lineWidth", 112]);
    paintRoadMarkings({ ctx, way, SC: 1, w2s: (x, y) => ({ x, y }) });
    expect(operations).toContainEqual(["setLineDash", [24, 20]]);
  });
});
