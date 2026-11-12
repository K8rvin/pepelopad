import { describe, expect, it, vi } from "vitest";
import {
  drawSheetFrame,
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
