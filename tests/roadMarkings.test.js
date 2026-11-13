import { describe, expect, it, vi } from "vitest";
import {
  drawHorizontalRoadLine,
  drawVerticalRoadLine,
} from "../src/render/roadMarkings.js";

describe("дорожная разметка", () => {
  it("использует одинаковую толщину линий в обоих направлениях", () => {
    const g = { fillRect: vi.fn(), fillStyle: "" };
    drawVerticalRoadLine(g, 8, 0, "#fff");
    drawHorizontalRoadLine(g, 0, 8, "#fff");
    expect(g.fillRect).toHaveBeenNthCalledWith(1, 7, 0, 2, 16);
    expect(g.fillRect).toHaveBeenNthCalledWith(2, 0, 7, 16, 2);
  });
});
