import { describe, expect, it, vi } from "vitest";
import { renderHome } from "../src/render/homeRenderer.js";

const gradient = () => ({ addColorStop: vi.fn() });
const context = () => ({
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: gradient,
  strokeRect: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  ellipse: vi.fn(),
  fill: vi.fn(),
});

describe("отрисовка пролога", () => {
  it("не изменяет игровое состояние", () => {
    const HOME = {
      w: 22,
      h: 14,
      t: new Uint8Array(22 * 14),
      furn: [],
      objs: [{ x: 160, y: 35 }],
    };
    const P = { x: 168, y: 184 };
    const beforeHome = JSON.stringify(HOME);
    const beforePlayer = JSON.stringify(P);
    renderHome({
      ctx: context(),
      W: 1280,
      H: 720,
      HOME,
      TI: [],
      S: {},
      SC: 3,
      homeAfter: false,
      homeRain: 0,
      homeStage: 0,
      dialogActive: false,
      homeFlash: 0,
      P,
    });
    expect(JSON.stringify(HOME)).toBe(beforeHome);
    expect(JSON.stringify(P)).toBe(beforePlayer);
  });
});
