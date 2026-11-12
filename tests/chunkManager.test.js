import { describe, expect, it, vi } from "vitest";
import { createChunkManager } from "../src/world/chunkManager.js";
import { K } from "../src/core/math.js";

const makeManager = (seed = 42) => {
  const chunks = new Map();
  const CMAP = new Map();
  const OV = new Map();
  const stats = { pois: 0 };
  const planBlock = vi.fn((bx, by) => ({
    k: K(bx, by),
    props: [],
    buildings: [],
    containers:
      bx === 0 && by === 0 ? [{ x: 1, y: 1, id: "box", type: "crate" }] : [],
    cars: [],
    camp: null,
    nest: null,
    special: null,
    poi: null,
    name: null,
  }));
  const manager = createChunkManager({
    chunks,
    CMAP,
    OV,
    CAMPS: new Map(),
    cnv: () => ({}),
    planBlock,
    ensureCars: vi.fn(),
    initCamp: vi.fn(),
    paintChunk: vi.fn(),
    getSeed: () => seed,
    getState: () => "menu",
    getPlayer: () => ({ x: 0, y: 0 }),
    getStats: () => stats,
    getZombies: () => [],
    gainXP: vi.fn(),
    toast: vi.fn(),
    spawnGuards: vi.fn(),
  });
  return { chunks, CMAP, OV, stats, planBlock, manager };
};

describe("менеджер чанков", () => {
  it("кэширует чанк и регистрирует контейнеры", () => {
    const { chunks, CMAP, manager, planBlock } = makeManager();
    const first = manager.getChunk(0, 0);
    expect(manager.getChunk(0, 0)).toBe(first);
    expect(chunks.size).toBe(1);
    expect(CMAP.has("1,1")).toBe(true);
    expect(planBlock.mock.calls.length).toBeGreaterThan(0);
    const calls = planBlock.mock.calls.length;
    manager.getChunk(0, 0);
    expect(planBlock.mock.calls.length).toBe(calls);
  });

  it("детерминированно создаёт тайлы по сиду", () => {
    const first = makeManager(42).manager.genChunk(1, 1).t;
    const second = makeManager(42).manager.genChunk(1, 1).t;
    const different = makeManager(43).manager.genChunk(1, 1).t;
    expect(first).toEqual(second);
    expect(first).not.toEqual(different);
  });

  it("выгружает самый дальний чанк при превышении лимита", () => {
    const { chunks, CMAP, manager } = makeManager();
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 10; x++) manager.getChunk(x, y);
    }
    expect(chunks.size).toBe(90);
    manager.getChunk(10, 10);
    expect(chunks.size).toBe(90);
    expect(chunks.has("10,10")).toBe(false);
    expect(CMAP.has("1,1")).toBe(true);
  });
});
