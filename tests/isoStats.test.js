import { describe, it, expect } from "vitest";
import {
  createStats,
  deathPenalty,
  applyPenalty,
} from "../src/iso/systems/stats.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";

describe("статистика", () => {
  it("createStats: нули по умолчанию", () => {
    const s = createStats();
    expect(s).toEqual({
      distance: 0,
      arrowsFired: 0,
      itemsLooted: 0,
      crafts: 0,
      deaths: 0,
    });
  });
  it("createStats: восстанавливает сохранённое, недостающее — нули", () => {
    const s = createStats({ distance: 120, deaths: 2 });
    expect(s.distance).toBe(120);
    expect(s.deaths).toBe(2);
    expect(s.arrowsFired).toBe(0);
  });
});

describe("цена смерти", () => {
  it("четверть стака вниз, мелкие стаки не трогает", () => {
    const lost = deathPenalty([
      { id: "arrow", n: 12 }, // 3
      { id: "can", n: 3 }, // 0
      { id: "scrap", n: 8 }, // 2
      null,
    ]);
    expect(lost).toEqual([
      { id: "arrow", n: 3 },
      { id: "scrap", n: 2 },
    ]);
  });
  it("applyPenalty списывает ровно потери", () => {
    const inv = createInventory(24);
    addItem(inv, "arrow", 12);
    addItem(inv, "can", 2);
    applyPenalty(inv, deathPenalty(inv.slots));
    expect(countItem(inv, "arrow")).toBe(9);
    expect(countItem(inv, "can")).toBe(2);
  });
  it("пустой инвентарь — пустые потери", () => {
    expect(deathPenalty(createInventory(8).slots)).toEqual([]);
  });
});
