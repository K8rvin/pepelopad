import { describe, it, expect } from "vitest";
import { worldToMap, mapToWorld, clampView } from "../src/iso/ui/map.js";

describe("проекция карты", () => {
  const view = { cx: 100, cy: 200, scale: 2, w: 400, h: 300 };
  it("центр вида → центр экрана", () => {
    expect(worldToMap(100, 200, view)).toEqual({ x: 200, y: 150 });
  });
  it("worldToMap/mapToWorld — обратные", () => {
    const p = worldToMap(130, 240, view);
    const w = mapToWorld(p.x, p.y, view);
    expect(w.x).toBeCloseTo(130);
    expect(w.y).toBeCloseTo(240);
  });
  it("clampView: масштаб и центр в границах", () => {
    const v = clampView(
      { cx: -50, cy: 9999, scale: 100, w: 400, h: 300 },
      1458,
    );
    expect(v.cx).toBe(0);
    expect(v.cy).toBe(1458);
    expect(v.scale).toBe(4);
    const v2 = clampView(
      { cx: 10, cy: 10, scale: 0.001, w: 400, h: 300 },
      1458,
    );
    expect(v2.scale).toBe(0.04);
  });
});
