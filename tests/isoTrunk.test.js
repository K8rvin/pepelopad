import { describe, expect, it, beforeEach } from "vitest";
import {
  openTrunk,
  TRUNK_SLOTS,
  initVehicles,
} from "../src/iso/systems/vehicles.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import { createCity } from "../src/iso/world/cityGen.js";
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

describe("багажник: ёмкость и перекладывание", () => {
  it("седан 8 слотов, фургон 12, у остова багажника нет", () => {
    expect(openTrunk({ kind: "sedan" }).size).toBe(TRUNK_SLOTS.sedan);
    expect(openTrunk({ kind: "van" }).size).toBe(TRUNK_SLOTS.van);
    expect(openTrunk({ wreck: true })).toBeNull();
  });

  it("повторное открытие возвращает то же хранилище", () => {
    const car = { kind: "sedan" };
    const a = openTrunk(car);
    addItem(a, "can", 2);
    expect(openTrunk(car)).toBe(a);
    expect(countItem(a, "can")).toBe(2);
  });

  it("перекладывание стака целиком через addItem (как в UI)", () => {
    const car = { kind: "van" };
    const tr = openTrunk(car);
    const inv = createInventory(24);
    addItem(inv, "arrow", 12);
    // рюкзак → багажник
    const left = addItem(tr, "arrow", 12);
    expect(left).toBe(0);
    inv.slots[0] = null;
    expect(countItem(tr, "arrow")).toBe(12);
    // багажник → рюкзак
    const s = tr.slots[0];
    const left2 = addItem(inv, s.id, s.n);
    expect(left2).toBe(0);
    tr.slots[0] = null;
    expect(countItem(inv, "arrow")).toBe(12);
  });

  it("переполнение багажника оставляет остаток в рюкзаке", () => {
    const tr = openTrunk({ kind: "sedan" }); // 8 слотов, arrow stack 40
    const inv = createInventory(24);
    addItem(inv, "wood", 20 * 9); // 9 стаков по 20 — не влезет в 8 слотов
    const s = inv.slots[0];
    const left = addItem(tr, "wood", 20 * 9);
    expect(left).toBe(20); // один стак не влез
    expect(countItem(tr, "wood")).toBe(160);
    expect(s).toBeTruthy();
  });
});

describe("багажник в сейве v6", () => {
  beforeEach(() => mockStorage());

  const saveState = () => {
    const city = createCity(11, 3);
    initVehicles(city);
    return {
      city,
      player: { x: 5, y: 6, level: 0 },
      combat: { playerHp: 90, kills: 0, dead: false },
      survival: createSurvival(),
      inv: createInventory(24),
      loot: createLoot(city),
      quests: { i: 0, prog: {}, done: [] },
      skills: createSkills(),
    };
  };

  it("содержимое багажника переживает перезагрузку", () => {
    const st = saveState();
    const car = st.city.cars.find((c) => !c.wreck);
    const tr = openTrunk(car);
    addItem(tr, "can", 3);
    addItem(tr, "fuel", 5);
    saveGame(st);
    const loaded = loadGameData();
    expect(loaded.v).toBe(6);
    const fresh = saveState();
    applySave(loaded, fresh);
    const car2 = fresh.city.cars[car.vid];
    expect(car2.trunk).toBeTruthy();
    expect(countItem(car2.trunk, "can")).toBe(3);
    expect(countItem(car2.trunk, "fuel")).toBe(5);
  });

  it("сейв без багажника загружается с пустым trunk", () => {
    const st = saveState();
    const data = saveGame(st);
    data.cars = data.cars.map((c) => ({ ...c, trunk: null }));
    localStorage.setItem("pepelopad_city_v6", JSON.stringify(data));
    const fresh = saveState();
    applySave(loadGameData(), fresh);
    for (const c of fresh.city.cars) expect(c.trunk).toBeNull();
  });
});
