import { describe, expect, it } from "vitest";
import {
  createFloorScene,
  floorContainers,
  floorTileAt,
} from "../src/world/floorScene.js";

describe("внутренняя сцена этажа", () => {
  it("создаёт лестницы только по существующим связям", () => {
    const ground = createFloorScene("hospital", "ground");
    expect(ground.stairs.map((stair) => stair.target)).toEqual(
      expect.arrayContaining(["upper", "basement", "outdoor"]),
    );
    const upper = createFloorScene("hospital", "upper");
    expect(upper.stairs.map((stair) => stair.target)).toEqual(["ground"]);
  });

  it("не создаёт несуществующий второй этаж оружейного", () => {
    const scene = createFloorScene("gunstore", "basement");
    expect(scene.stairs.map((stair) => stair.target)).toEqual(["ground"]);
  });

  it("возвращает стены за границей и контейнеры по координатам", () => {
    const scene = createFloorScene("apartments", "ground");
    expect(floorTileAt(scene, -1, 0)).toBe(6);
    expect(floorTileAt(scene, 0, 0)).toBe(6);
    expect(floorContainers(scene).size).toBe(scene.containers.length);
  });
});
