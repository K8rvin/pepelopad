import { describe, expect, it, vi } from "vitest";
import { renderParticles } from "../src/render/particles.js";

describe("снаряды и частицы", () => {
  it("рисует стрелу спрайтом, а не трассой", () => {
    const arrowP = { width: 8, height: 3 };
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    renderParticles({
      ctx,
      PR: [{ type: "arrow", x: 0, y: 0, vx: 1, vy: 0 }],
      CL: [],
      PT: [],
      TX: [],
      ash: [],
      S: { arrowP },
      SC: 3,
      now: 0,
      w2s: (x, y) => ({ x, y }),
      rnd: Math.random,
      W: 100,
      H: 100,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(arrowP, -12, -3.5, 24, 7);
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });
});
