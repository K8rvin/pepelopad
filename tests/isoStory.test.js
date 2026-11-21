import { describe, expect, it, beforeEach } from "vitest";
import {
  createStory,
  storyDone,
  currentBeat,
  storyNpcPos,
  storyNear,
  applyChoice,
  storyHud,
} from "../src/iso/systems/story.js";
import { STORY } from "../src/iso/data/story.js";
import { createCity } from "../src/iso/world/cityGen.js";
import { createCamps } from "../src/iso/systems/camps.js";
import { createBase, foundBase } from "../src/iso/systems/base.js";
import { createInventory, countItem } from "../src/iso/systems/inventory.js";
import {
  saveGame,
  loadGameData,
  applySave,
} from "../src/iso/persistence/save.js";
import { createSkills } from "../src/iso/systems/skills.js";
import { createLoot } from "../src/iso/systems/loot.js";
import { createSurvival } from "../src/iso/systems/survival.js";

function mockStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

const city = createCity(11, 9);
const camps = createCamps(city);

describe("история «Маша»: биты, позиции, выборы", () => {
  it("первый бит — Олег в парковом лагере", () => {
    const s = createStory();
    expect(currentBeat(s).id).toBe("s1");
    const park = camps.find((c) => c.id === "park");
    const p = storyNpcPos(s, city, camps);
    expect(p.x).toBeCloseTo(park.x + 1);
    const near = storyNear(s, city, camps, { x: p.x + 1, y: p.y + 1 });
    expect(near.beat.id).toBe("s1");
    expect(storyNear(s, city, camps, { x: p.x + 50, y: p.y })).toBeNull();
  });

  it("выбор даёт доверие/флаг и продвигает бит", () => {
    const s = createStory();
    const inv = createInventory(24);
    const park = camps.find((c) => c.id === "park");
    const ch = applyChoice(s, 0, { inv, camps, base: createBase() });
    expect(ch.text).toContain("найду");
    expect(park.trust).toBe(6);
    expect(s.flags.promised).toBe(true);
    expect(s.i).toBe(1);
    expect(currentBeat(s).id).toBe("s2");
  });

  it("выбор «вылечить» добавляет жителя основанной базы", () => {
    const s = createStory();
    s.i = 3; // подвал
    const base = createBase();
    foundBase(base, city, { x: 118, y: 118 });
    const inv = createInventory(24);
    applyChoice(s, 1, { inv, camps, base });
    expect(s.flags.cure).toBe(true);
    expect(base.residents).toBe(1);
    expect(s.i).toBe(4);
  });

  it("история завершается после всех битов", () => {
    const s = createStory();
    const inv = createInventory(24);
    const base = createBase();
    for (let i = 0; i < STORY.length; i++)
      applyChoice(s, 0, { inv, camps, base });
    expect(storyDone(s)).toBe(true);
    expect(currentBeat(s)).toBeNull();
    expect(storyHud(s)).toContain("завершена");
  });
});

describe("история в сейве v5", () => {
  beforeEach(() => mockStorage());
  const saveState = () => {
    const c = createCity(11, 3);
    return {
      city: c,
      player: { x: 5, y: 6, level: 0 },
      combat: { playerHp: 90, kills: 0, dead: false },
      survival: createSurvival(),
      inv: createInventory(24),
      loot: createLoot(c),
      quests: { i: 0, prog: {}, done: [] },
      skills: createSkills(),
      camps: createCamps(c),
      base: createBase(),
      story: createStory(),
    };
  };

  it("прогресс и флаги истории переживают перезагрузку", () => {
    const st = saveState();
    st.story.i = 2;
    st.story.flags = { promised: true, hope: true };
    saveGame(st);
    const fresh = saveState();
    applySave(loadGameData(), fresh);
    expect(fresh.story.i).toBe(2);
    expect(fresh.story.flags.hope).toBe(true);
  });
});
