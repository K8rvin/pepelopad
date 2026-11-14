import { afterEach, describe, expect, it, vi } from "vitest";
import { createStructureSprites } from "../src/render/proceduralStructures.js";

afterEach(() => vi.unstubAllGlobals());

describe("процедурные спрайты транспорта", () => {
  it("создаёт прямые спрайты двухколёсных классов", () => {
    vi.stubGlobal("document", {
      createElement: () => {
        const context = {
          drawImage: vi.fn(),
          fillRect: vi.fn(),
        };
        return {
          width: 0,
          height: 0,
          getContext: () => context,
        };
      },
    });
    const sprites = {};
    createStructureSprites(sprites);
    expect(sprites.car_motorcycle).toMatchObject({ width: 20, height: 8 });
    expect(sprites.car_bicycle).toMatchObject({ width: 18, height: 6 });
    expect(sprites.car_scooter).toMatchObject({ width: 18, height: 7 });
  });
});
