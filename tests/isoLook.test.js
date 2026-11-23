import { describe, expect, it } from "vitest";
import { nearestInteraction } from "../src/iso/systems/interactions.js";
import { NIGHT_CONE } from "../src/iso/render/lighting.js";

const inter = (objs) => ({
  objects: objs.map((o) => ({ action: "interact", ...o })),
});

describe("E по взгляду персонажа", () => {
  it("объект в конусе взгляда важнее ближайшего вне конуса", () => {
    const i = inter([
      { id: "near", x: 0, y: 0.9 },
      { id: "looked", x: 1.7, y: 0 },
    ]);
    expect(nearestInteraction(i, 0, 0, {}).id).toBe("near");
    expect(nearestInteraction(i, 0, 0, {}, 2.1, { x: 1, y: 0 }).id).toBe(
      "looked",
    );
  });
  it("взгляд в пустоту — прежнее поведение по дистанции", () => {
    const i = inter([
      { id: "near", x: 0, y: 0.9 },
      { id: "far", x: 1.7, y: 0 },
    ]);
    expect(nearestInteraction(i, 0, 0, {}, 2.1, { x: -1, y: 0 }).id).toBe(
      "near",
    );
  });
  it("граница конуса ±60° включительно", () => {
    const i = inter([
      { id: "edge", x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) },
    ]);
    expect(nearestInteraction(i, 0, 0, {}, 2.1, { x: 1, y: 0 })?.id).toBe(
      "edge",
    );
  });
  it("ночной конус значительно больше прежнего 240×62", () => {
    expect(NIGHT_CONE.len).toBeGreaterThanOrEqual(500);
    expect(NIGHT_CONE.wid).toBeGreaterThanOrEqual(150);
  });
});
