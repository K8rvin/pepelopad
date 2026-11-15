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
        {
          id: 3,
          tags: { amenity: "school" },
          points: [
            [40, 40],
            [50, 40],
            [50, 50],
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
    expect(ctx.moveTo.mock.calls[0][0]).toBe(40);
    expect(ctx.moveTo.mock.calls.at(-1)[0]).toBe(0);
    expect(JSON.stringify(world)).toBe(before);
  });
});
