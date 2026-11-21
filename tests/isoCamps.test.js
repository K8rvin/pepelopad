import { describe, expect, it, beforeEach } from "vitest";
import {
  createCamps,
  campDef,
  campNear,
  trustLevel,
  residents,
  donate,
  buy,
  deliver,
  build,
  service,
  newDay,
} from "../src/iso/systems/camps.js";
import { TRUST_LEVELS } from "../src/iso/data/camps.js";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import { createCombat } from "../src/iso/systems/combat.js";
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

describe("лагеря: создание и доверие", () => {
  it("три лагеря у POI, склад и поручение на старте", () => {
    const camps = createCamps(city);
    expect(camps.length).toBe(3);
    for (const c of camps) {
      expect(c.stock.length).toBeGreaterThan(0);
      expect(c.request).toBeTruthy();
    }
    const school = camps.find((c) => c.id === "school");
    const b = city.buildings.find((k) => k.poi === "Школа");
    expect(school.y).toBeGreaterThan(b.y + b.h);
    expect(campNear(camps, school.x + 1, school.y + 1)).toBe(school);
  });

  it("уровни доверия по порогам и жители", () => {
    const c = createCamps(city)[0];
    expect(trustLevel(c)).toBe(0);
    c.trust = TRUST_LEVELS[1];
    expect(trustLevel(c)).toBe(1);
    c.trust = TRUST_LEVELS[3];
    expect(trustLevel(c)).toBe(3);
    expect(residents(c)).toBe(5);
  });

  it("пожертвование ресурсов растит доверие по ценности", () => {
    const c = createCamps(city)[0];
    const inv = createInventory(24);
    addItem(inv, "wood", 3);
    addItem(inv, "meds", 1);
    expect(donate(c, inv, "wood", 3)).toBe(3);
    expect(countItem(inv, "wood")).toBe(0);
    expect(donate(c, inv, "meds", 1)).toBe(3);
    expect(c.trust).toBe(6);
    expect(donate(c, inv, "arrow", 1)).toBe(0); // стрелы не жертвуем
  });
});

describe("лагеря: торговля, поручения, постройки", () => {
  it("покупка списывает ресурсы и уменьшает склад; гейт по доверию", () => {
    const camps = createCamps(city);
    const park = camps.find((c) => c.id === "park");
    const inv = createInventory(24);
    // fuel требует доверия 1
    const fuelIdx = park.stock.findIndex((s) => s.id === "fuel");
    addItem(inv, "scrap", 2);
    expect(buy(park, inv, fuelIdx)).toBe(false);
    park.trust = TRUST_LEVELS[1];
    expect(buy(park, inv, fuelIdx)).toBe(true);
    expect(countItem(inv, "fuel")).toBe(1);
    expect(countItem(inv, "scrap")).toBe(0);
    expect(park.stock[fuelIdx].n).toBe(1);
    expect(buy(park, inv, fuelIdx)).toBe(false); // ресурсов больше нет
  });

  it("поручение: доставка списывает предметы, даёт доверие и награду", () => {
    const c = createCamps(city)[0];
    const inv = createInventory(24);
    const req = c.request;
    expect(deliver(c, inv)).toBe(false);
    addItem(inv, req.id, req.n);
    expect(deliver(c, inv)).toBe(true);
    expect(countItem(inv, req.id)).toBe(0);
    expect(c.trust).toBe(req.trust);
    expect(c.request).toBeNull();
    for (const [id, n] of req.reward) expect(countItem(inv, id)).toBe(n);
  });

  it("постройка списывает ресурсы; повторно не строится", () => {
    const c = createCamps(city)[0];
    const inv = createInventory(24);
    const up = campDef(c).upgrades[0];
    expect(build(c, inv, 0)).toBe(false);
    for (const [id, n] of Object.entries(up.cost)) addItem(inv, id, n);
    expect(build(c, inv, 0)).toBe(true);
    expect(c.upgrades).toContain(up.id);
    expect(build(c, inv, 0)).toBe(false);
  });

  it("лазарет лечит раз в день и только построенный", () => {
    const c = createCamps(city)[0];
    const combat = createCombat();
    combat.playerHp = 50;
    expect(service(c, combat, 1)).toBe(false);
    const inv = createInventory(24);
    for (const [id, n] of Object.entries(campDef(c).upgrades[0].cost))
      addItem(inv, id, n);
    build(c, inv, 0);
    expect(service(c, combat, 1)).toBe(true);
    expect(combat.playerHp).toBe(80);
    expect(service(c, combat, 1)).toBe(false);
    combat.playerHp = 50;
    expect(service(c, combat, 2)).toBe(true);
  });

  it("новый день обновляет склад и производство построек", () => {
    const c = createCamps(city)[0];
    const inv = createInventory(24);
    for (const [id, n] of Object.entries(campDef(c).upgrades[1].cost))
      addItem(inv, id, n);
    build(c, inv, 1); // огород: +2 тушёнки/день
    const before = c.stock.find((s) => s.id === "can" && s.free);
    expect(before).toBeUndefined();
    newDay([c], 2);
    const produced = c.stock.find((s) => s.free && s.id === "can");
    expect(produced.n).toBe(2);
    expect(c.request).toBeTruthy();
  });
});

describe("лагеря в сейве v5", () => {
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
    };
  };

  it("доверие, постройки и склад переживают перезагрузку", () => {
    const st = saveState();
    const camp = st.camps[0];
    camp.trust = 42;
    camp.upgrades = ["lazaret"];
    saveGame(st);
    const loaded = loadGameData();
    const fresh = saveState();
    applySave(loaded, fresh);
    const c2 = fresh.camps[0];
    expect(c2.trust).toBe(42);
    expect(c2.upgrades).toContain("lazaret");
    expect(c2.stock.length).toBe(camp.stock.length);
  });
});
