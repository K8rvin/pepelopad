import { describe, expect, it, vi } from "vitest";
import { renderGuidance } from "../src/render/guidance.js";

describe("компас и прицел", () => {
  it("не изменяет игрока или цель мыши", () => {
    const P = { x: 0, y: 0, inCar: null };
    const mouse = { x: 50, y: 50 };
    const beforeP = JSON.stringify(P);
    const beforeMouse = JSON.stringify(mouse);
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
    };
    renderGuidance({
      ctx,
      state: "play",
      P,
      W: 100,
      H: 100,
      SC: 3,
      w2s: (x, y) => ({ x, y }),
      target: null,
      mouse,
      isTouch: false,
      Z: [],
      recoil: 0,
    });
    expect(JSON.stringify(P)).toBe(beforeP);
    expect(JSON.stringify(mouse)).toBe(beforeMouse);
  });
});
