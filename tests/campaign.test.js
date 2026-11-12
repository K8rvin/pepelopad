import { describe, expect, it } from "vitest";
import { createQuarryNest, prepareMegaQuest } from "../src/systems/campaign.js";

describe("кампания", () => {
  it("различает обычный карьер и Матку", () => {
    expect(createQuarryNest(140, -112, false)).toMatchObject({
      mega: false,
      tier: 3,
    });
    expect(createQuarryNest(140, -112, true)).toMatchObject({
      mega: true,
      tier: 3,
    });
  });

  it("создаёт Матку отдельно и сбрасывает только затронутые чанки", () => {
    const OV = new Map([["D5,-4", true]]);
    const PLAN = new Map([["5,-4", {}]]);
    const chunks = new Map([
      ["9,-7", { cx: 9, cy: -7, containers: [{ x: 1, y: 1 }] }],
      ["0,0", { cx: 0, cy: 0, containers: [{ x: 2, y: 2 }] }],
    ]);
    const CMAP = new Map([
      ["1,1", {}],
      ["2,2", {}],
    ]);
    const target = prepareMegaQuest(OV, PLAN, chunks, CMAP);
    expect(OV.get("F5,-4")).toEqual({ tier: 3, mega: true });
    expect(OV.has("D5,-4")).toBe(false);
    expect(PLAN.has("5,-4")).toBe(false);
    expect(chunks.has("9,-7")).toBe(false);
    expect(chunks.has("0,0")).toBe(true);
    expect(CMAP.has("1,1")).toBe(false);
    expect(CMAP.has("2,2")).toBe(true);
    expect(target).toEqual({ bx: 5, by: -4, label: "Логово Матки" });
  });
});
