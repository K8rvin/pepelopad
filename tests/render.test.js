import { describe, expect, it, vi } from "vitest";
import { screenToWorld, worldToScreen } from "../src/render/camera.js";
import { drawWeaponOverlay } from "../src/render/weaponRenderer.js";

describe("камера", () => {
  it("преобразует координаты в обе стороны", () => {
    const cam = { x: 100, y: 50 };
    const world = screenToWorld(400, 200, cam, 800, 400, 2);
    expect(world).toEqual({ x: 100, y: 50 });
    expect(worldToScreen(world.x, world.y, cam, 800, 400, 2)).toEqual({
      x: 400,
      y: 200,
    });
  });
});

describe("отрисовка оружия", () => {
  it("не изменяет игрока", () => {
    const P = {
      weapon: "bow",
      aim: 0.2,
      rl: 0.3,
      rlMax: 0.6,
      mags: { bow: 1 },
    };
    const before = JSON.stringify(P);
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    drawWeaponOverlay({ ctx, P, S: {}, SC: 3 });
    expect(JSON.stringify(P)).toBe(before);
  });
});
