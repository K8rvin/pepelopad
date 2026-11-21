import { describe, expect, it } from "vitest";
import { reconcileStreetDepths } from "../src/iso/render/streetDepth.js";

const entry = (name, base, depth, left, top, right, bottom) => ({
  name,
  base,
  depth,
  bounds: { left, top, right, bottom },
});

const order = (entries) =>
  [...entries]
    .sort((a, b) => a.depth - b.depth || a.base - b.base)
    .map((entry) => entry.name);

describe("согласование глубины уличных объектов", () => {
  it("скамейка за деревом остаётся раньше даже при большем building boost", () => {
    const result = reconcileStreetDepths([
      entry("bench", 10, 30, 0, 0, 20, 20),
      entry("tree", 20, 10, 10, 5, 30, 25),
    ]);
    expect(result.map((entry) => entry.depth)).toEqual([30, 30]);
    expect(order(result)).toEqual(["bench", "tree"]);
  });

  it("скамейка перед деревом рисуется позже при boost дерева", () => {
    const result = reconcileStreetDepths([
      entry("tree", 10, 30, 0, 0, 20, 20),
      entry("bench", 20, 10, 10, 5, 30, 25),
    ]);
    expect(order(result)).toEqual(["tree", "bench"]);
  });

  it("максимум распространяется по цепочке пересечений", () => {
    const result = reconcileStreetDepths([
      entry("a", 10, 10, 0, 0, 11, 10),
      entry("b", 20, 40, 10, 0, 21, 10),
      entry("c", 30, 20, 20, 0, 31, 10),
    ]);
    expect(result.map((entry) => entry.depth)).toEqual([40, 40, 40]);
    expect(order(result)).toEqual(["a", "b", "c"]);
  });

  it("непересекающиеся entries не меняются и входной массив не мутирует", () => {
    const input = [
      entry("a", 10, 15, 0, 0, 10, 10),
      entry("b", 20, 25, 20, 20, 30, 30),
    ];
    const snapshot = structuredClone(input);
    const result = reconcileStreetDepths(input);
    expect(result.map((entry) => entry.depth)).toEqual([15, 25]);
    expect(input).toEqual(snapshot);
  });
});
