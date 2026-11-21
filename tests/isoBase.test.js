import { describe, expect, it, beforeEach } from "vitest";
import {
  createBase,
  canFound,
  foundBase,
  buildStructure,
  baseCapacity,
  baseDefense,
  baseNewDay,
  baseRaid,
} from "../src/iso/systems/base.js";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import {
  saveGame,
  loadGameData,
  applySave,
} from "../src/iso/persistence/save.js";
import { createSkills } from "../src/iso/systems/skills.js";
import { createLoot } from "../src/iso/systems/loot.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createCamps } from "../src/iso/systems/camps.js";

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

describe("база: основание и постройки", () => {
  it("основание только на открытом газоне вне зданий", () => {
    const b = createBase();
    const grass = { x: 118, y: 118 }; // центр парка, газон
    expect(canFound(b, city, grass)).toBe(true);
    const bld = city.buildings[0];
    expect(
      canFound(b, city, { x: bld.x + bld.w / 2, y: bld.y + bld.h / 2 }),
    ).toBe(false);
    expect(foundBase(b, city, grass)).toBe(true);
    expect(b.founded).toBe(true);
    expect(foundBase(b, city, grass)).toBe(false); // уже основана
  });

  it("постройки списывают ресурсы, склад/места/защита растут", () => {
    const b = createBase();
    foundBase(b, city, { x: 118, y: 118 });
    const inv = createInventory(24);
    expect(buildStructure(b, inv, 0)).toBe(false); // нет ресурсов
    addItem(inv, "wood", 6);
    addItem(inv, "scrap", 4);
    expect(buildStructure(b, inv, 0)).toBe(true); // баррикады
    expect(baseDefense(b)).toBe(2);
    addItem(inv, "wood", 8);
    addItem(inv, "cloth", 4);
    expect(buildStructure(b, inv, 1)).toBe(true); // жилой модуль
    expect(baseCapacity(b)).toBe(4);
    addItem(inv, "wood", 6);
    addItem(inv, "scrap", 2);
    const slots0 = b.storage.size;
    expect(buildStructure(b, inv, 2)).toBe(true); // склад
    expect(b.storage.size).toBe(slots0 + 8);
  });
});

describe("база: жители, производство, рейды", () => {
  it("житель приходит при месте и еде; постройки и жители производят", () => {
    const b = createBase();
    foundBase(b, city, { x: 118, y: 118 });
    addItem(b.storage, "can", 2);
    baseNewDay(b, 2);
    expect(b.residents).toBe(1);
    expect(countItem(b.storage, "can")).toBe(1); // съел одну
    expect(countItem(b.storage, "scrap")).toBe(1); // житель произвёл
    // грядка производит тушёнку
    const inv = createInventory(24);
    addItem(inv, "wood", 4);
    addItem(inv, "cloth", 2);
    buildStructure(b, inv, 3);
    baseNewDay(b, 3);
    expect(countItem(b.storage, "can")).toBeGreaterThanOrEqual(2);
  });

  it("рейд слабее с защитой и жителями; раз в день", () => {
    const b = createBase();
    foundBase(b, city, { x: 118, y: 118 });
    const c2 = createCity(11, 3);
    const n0 = baseRaid(b, c2, 1);
    expect(n0).toBeGreaterThan(0);
    expect(baseRaid(b, c2, 1)).toBe(0); // повторно в тот же день нет
    const b2 = createBase();
    foundBase(b2, city, { x: 118, y: 118 });
    b2.structures = ["barricade", "barricade"];
    b2.residents = 2;
    const nDef = baseRaid(b2, createCity(11, 3), 1);
    expect(nDef).toBeLessThan(n0);
  });
});

describe("база в сейве v5", () => {
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
    };
  };

  it("основание, постройки, жители и склад переживают перезагрузку", () => {
    const st = saveState();
    foundBase(st.base, st.city, { x: 118, y: 118 });
    st.base.structures = ["barricade"];
    st.base.residents = 1;
    addItem(st.base.storage, "can", 3);
    saveGame(st);
    const fresh = saveState();
    applySave(loadGameData(), fresh);
    expect(fresh.base.founded).toBe(true);
    expect(fresh.base.structures).toContain("barricade");
    expect(fresh.base.residents).toBe(1);
    expect(countItem(fresh.base.storage, "can")).toBe(3);
  });
});
