import { describe, expect, it, vi } from "vitest";
import {
  drawSheetFrame,
  normalizeSprite,
  sheetDuration,
  sheetFrameIndex,
} from "../src/render/assets.js";

const sheet = {
  image: {},
  metadata: {
    frames: [
      { frame: { x: 0, y: 10, w: 20, h: 30 }, duration: 100 },
      { frame: { x: 20, y: 10, w: 20, h: 30 }, duration: 200 },
    ],
  },
};

describe("спрайт-листы", () => {
  it("вычисляет длительность и кадр по времени", () => {
    expect(sheetDuration(sheet)).toBe(0.3);
    expect(sheetFrameIndex(sheet, 0.05, false)).toBe(0);
    expect(sheetFrameIndex(sheet, 0.15, false)).toBe(1);
    expect(sheetFrameIndex(sheet, 0.31, false)).toBe(1);
    expect(sheetFrameIndex(sheet, 0.31, true)).toBe(0);
  });

  it("вырезает правильный кадр из атласа", () => {
    const ctx = { drawImage: vi.fn() };
    drawSheetFrame(ctx, sheet, 1, 1, 2, 100, 120);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      sheet.image,
      20,
      10,
      20,
      30,
      1,
      2,
      100,
      120,
    );
  });
});

describe("нормализация атласных спрайтов", () => {
  it("обрезает прозрачную рамку и сохраняет игровой размер", () => {
    const sourceContext = {
      drawImage: vi.fn(),
      getImageData: () => {
        const data = new Uint8ClampedArray(8 * 8 * 4);
        for (const [x, y] of [
          [2, 3],
          [5, 5],
        ])
          data[(x + y * 8) * 4 + 3] = 255;
        return { data };
      },
    };
    const outputContext = { drawImage: vi.fn() };
    const source = { width: 8, height: 8, getContext: () => sourceContext };
    const output = { width: 4, height: 4, getContext: () => outputContext };
    vi.stubGlobal("document", {
      createElement: vi
        .fn()
        .mockReturnValueOnce(source)
        .mockReturnValueOnce(output),
    });
    const image = { width: 8, height: 8 };
    const result = normalizeSprite(image, 4, 4);
    expect(result).toBe(output);
    expect(outputContext.imageSmoothingEnabled).toBe(false);
    expect(outputContext.drawImage).toHaveBeenCalledWith(
      source,
      2,
      3,
      4,
      3,
      0,
      0,
      4,
      4,
    );
    vi.unstubAllGlobals();
  });
});
