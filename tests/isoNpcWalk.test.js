import { describe, it, expect } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import { createNpcs, syncNpcs, updateNpcs } from "../src/iso/systems/npcs.js";

const setup = () => {
  const city = createCity(11);
  const survivors = [];
  const story = { flags: {}, ending: "open", markRelation: 1 };
  const quests = { states: {}, done: [] };
  const survival = { tod: 8 };
  const npcs = createNpcs(city, 32, [], survivors, story);
  syncNpcs(npcs, city, [], survivors, story, quests, survival);
  return { city, npcs, survivors, story, quests, survival };
};

describe("переходы NPC пешком", () => {
  it("sync ставит цель без телепорта, update ведёт пешком с походкой", () => {
    const { city, npcs, survivors, story, quests, survival } = setup();
    const mark = npcs.find((n) => n.id === "mark");
    const x0 = mark.x,
      y0 = mark.y;
    survival.tod = 13; // смена фазы не должна телепортировать
    syncNpcs(npcs, city, [], survivors, story, quests, survival);
    expect(mark.x).toBe(x0);
    expect(mark.y).toBe(y0);
    // пустой город: коллизий нет, переход гарантированно проходим
    const open = { SIZE: city.SIZE, buildings: [], solidGrid: new Map() };
    mark.tx = x0 + 3;
    mark.ty = y0;
    mark.snapNext = false;
    let moved = false;
    for (let i = 0; i < 60; i++) {
      updateNpcs(npcs, open, 1 / 60);
      if (mark.moving) moved = true;
    }
    expect(moved).toBe(true);
    expect(mark.walkPh).toBeGreaterThan(0);
    expect(mark.face).toBe(1);
    expect(Math.hypot(mark.x - x0, mark.y - y0)).toBeGreaterThan(0.2);
  });

  it("скрытый NPC снапится в цель при появлении, а не идёт через карту", () => {
    const { city, npcs, survivors, story, quests, survival } = setup();
    const nina = npcs.find((n) => n.id === "nina");
    expect(nina.hidden).toBe(true);
    survivors.push({ id: "nina", state: "rescued" });
    syncNpcs(npcs, city, [], survivors, story, quests, survival);
    expect(nina.hidden).toBe(false);
    updateNpcs(npcs, city, 1 / 60);
    expect(nina.x).toBe(nina.tx);
    expect(nina.y).toBe(nina.ty);
    expect(nina.moving).toBe(false);
  });

  it("достигнув цели, NPC стоит ровно", () => {
    const { city, npcs } = setup();
    const n = npcs[0];
    n.tx = n.x;
    n.ty = n.y;
    n.snapNext = false;
    updateNpcs(npcs, city, 1 / 60);
    expect(n.moving).toBe(false);
  });
});
