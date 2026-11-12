import { describe, expect, it, vi } from "vitest";
import { renderLighting } from "../src/render/lighting.js";

const gradient = () => ({ addColorStop: vi.fn() });
const context = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  createRadialGradient: gradient,
  drawImage: vi.fn(),
});

describe("освещение", () => {
  it("не изменяет игровое состояние", () => {
    const P = { x: 10, y: 20, aim: 0, flash: true, inCar: null };
    const before = JSON.stringify(P);
    renderLighting({
      ctx: context(),
      lx: context(),
      LC: {},
      W: 800,
      H: 600,
      SC: 3,
      dark: 0.8,
      state: "play",
      P,
      CARS: new Map(),
      SMAP: new Map(),
      CAMPS: new Map(),
      visChunks: [],
      LG: [],
      now: 1,
      w2s: (x, y) => ({ x, y }),
    });
    expect(JSON.stringify(P)).toBe(before);
  });
});
