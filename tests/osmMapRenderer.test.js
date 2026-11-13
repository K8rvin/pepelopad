import { describe, expect, it, vi } from "vitest";
import { renderOsmMap } from "../src/render/osmMapRenderer.js";

describe("отрисовка OSM-карты", () => {
  it("рисует полигоны зданий и линии дорог без изменения модели", () => {
    const world = {
      ways: [
        {
          id: 1,
          tags: { building: "yes" },
          points: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        },
        {
          id: 2,
          tags: { highway: "road" },
          points: [
            [0, 0],
            [20, 20],
          ],
        },
      ],
    };
    const before = JSON.stringify(world);
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    };
    renderOsmMap({
      ctx,
      world,
      cam: { x: 0, y: 0 },
      W: 400,
      H: 300,
      SC: 2,
      w2s: (x, y) => ({ x, y }),
    });
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(JSON.stringify(world)).toBe(before);
  });
});
