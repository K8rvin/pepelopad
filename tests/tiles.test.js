import { describe, expect, it } from "vitest";
import {
  createTerrainTiles,
  stampBase,
  stampBuilding,
  stampProps,
} from "../src/world/tiles.js";

describe("тайлы чанков", () => {
  it("создаёт одинаковую местность для одинакового сида", () => {
    const first = createTerrainTiles(-2, 3, 42);
    expect(createTerrainTiles(-2, 3, 42)).toEqual(first);
    expect(createTerrainTiles(-2, 3, 43)).not.toEqual(first);
  });

  it("размечает дороги и перекрёстки", () => {
    const tiles = createTerrainTiles(0, 0, 1);
    expect(tiles[0]).toBe(2);
    expect(tiles[2 + 5 * 16]).toBe(28);
    expect(tiles[5 + 2 * 16]).toBe(27);
    expect(tiles[4 + 5 * 16]).toBe(3);
  });

  it("размещает зебру вне перекрёстка", () => {
    const tiles = createTerrainTiles(0, 0, 1);
    expect(tiles[2 + 12 * 16]).toBe(29);
    expect(tiles[12 + 2 * 16]).toBe(29);
    expect(tiles[2 + 2 * 16]).toBe(2);
  });

  it("не заменяет дорогу и тротуар деревьями и камнями", () => {
    const tiles = createTerrainTiles(0, 0, 1);
    const chunk = { cx: 0, cy: 0 };
    const props = [];
    for (let i = 0; i < 100; i++)
      props.push({
        type: i % 2 ? "tree" : "rock",
        x: i % 16,
        y: Math.floor(i / 16),
      });
    stampProps(tiles, chunk, props);
    expect(tiles[2 + 5 * 16]).toBe(28);
    expect(tiles[4 + 5 * 16]).toBe(3);
    expect(tiles[2 + 12 * 16]).toBe(29);
  });

  it("не оставляет деревья внутри здания", () => {
    for (let seed = 0; seed < 20; seed++) {
      const tiles = createTerrainTiles(0, 0, seed);
      const chunk = { cx: 0, cy: 0 };
      const props = [];
      for (let i = 0; i < 100; i++)
        props.push({ type: "tree", x: i % 16, y: Math.floor(i / 16) });
      stampProps(tiles, chunk, props);
      stampBuilding(tiles, chunk, { type: "house", x: 0, y: 0, w: 7, h: 6 });
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 7; x++) expect(tiles[x + y * 16]).not.toBe(14);
      }
    }
  });

  it("оставляет проход в доме на базе", () => {
    const tiles = new Uint8Array(256);
    stampBase(tiles, { cx: 0, cy: 0 });
    expect(tiles[11 + 13 * 16]).toBe(4);
  });
});
