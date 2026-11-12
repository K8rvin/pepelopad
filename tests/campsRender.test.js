import { describe, expect, it, vi } from "vitest";
import { renderCampsAndVehicles } from "../src/render/campsAndVehicles.js";

describe("отрисовка развития лагеря", () => {
  it("показывает постройки и дополнительные палатки без изменения состояния", () => {
    const camp = {
      id: "camp",
      x: 0,
      y: 0,
      level: 3,
      proj: { wall: 2, garden: 2, tower: 1, clinic: 1 },
    };
    const before = JSON.stringify(camp);
    const S = {
      tent: "tent",
      fence: "fence",
      cont_garden: "garden",
      medstation: "clinic",
      fire: ["fire", "fire"],
      watchtower: "tower",
    };
    const ctx = { drawImage: vi.fn() };
    renderCampsAndVehicles({
      ctx,
      CAMPS: new Map([["camp", camp]]),
      CARS: new Map(),
      NPCS: [],
      cam: { x: 0, y: 0 },
      W: 1000,
      SC: 1,
      w2s: (x, y) => ({ x, y }),
      S,
      now: 0,
      carSpriteKey: () => "car",
      PT: [],
      rnd: () => 1,
    });
    const images = ctx.drawImage.mock.calls.map(([image]) => image);
    expect(images.filter((image) => image === "tent")).toHaveLength(6);
    expect(images.filter((image) => image === "fence")).toHaveLength(8);
    expect(images.filter((image) => image === "garden")).toHaveLength(2);
    expect(images.filter((image) => image === "clinic")).toHaveLength(1);
    expect(images.filter((image) => image === "tower")).toHaveLength(1);
    expect(JSON.stringify(camp)).toBe(before);
  });
});
