import { describe, it, expect } from "vitest";
import {
  createSurvival,
  updateSurvival,
  useConsumable,
} from "../src/iso/systems/survival.js";
import { createCombat } from "../src/iso/systems/combat.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import { repairCar } from "../src/iso/systems/vehicles.js";

const city = { zombies: [], buildings: [], SIZE: 100, solidGrid: new Map() };

describe("ставки выживания", () => {
  it("голод на нуле точит HP (истощение)", () => {
    const S = createSurvival();
    S.tod = 12;
    S.hunger = 0;
    const C = createCombat();
    const p = { infected: false };
    updateSurvival(S, C, p, city, createInventory(4), 1);
    expect(C.playerHp).toBeLessThan(100);
  });
  it("инфекция точит HP, бинт снимает её", () => {
    const S = createSurvival();
    S.tod = 12;
    S.hunger = 100;
    const C = createCombat();
    const p = { infected: true };
    updateSurvival(S, C, p, city, createInventory(4), 1);
    expect(C.playerHp).toBeLessThan(100);
    const inv = createInventory(4);
    addItem(inv, "meds", 1);
    const msg = useConsumable(
      S,
      C,
      inv,
      "meds",
      (i, n) => {
        const s = inv.slots.find((s) => s && s.id === i);
        if (s) s.n -= n;
        return true;
      },
      p,
    );
    expect(p.infected).toBe(false);
    expect(msg).toContain("инфекция снята");
  });
  it("сытость без инфекции не точит HP днём", () => {
    const S = createSurvival();
    S.tod = 12;
    S.hunger = 100;
    const C = createCombat();
    C.playerHp = 50;
    updateSurvival(S, C, { infected: false }, city, createInventory(4), 1);
    expect(C.playerHp).toBeGreaterThanOrEqual(50); // регенерация, не урон
  });
});

describe("ремонт машины", () => {
  it("деталь чинит остов (+40 ресурса)", () => {
    const car = { hp: 0, wreck: true };
    const inv = createInventory(4);
    addItem(inv, "part", 1);
    const ok = repairCar(
      car,
      (id) => countItem(inv, id),
      (id, n) => {
        const s = inv.slots.find((s) => s && s.id === id);
        if (s) s.n -= n;
      },
    );
    expect(ok).toBe(1);
    expect(car.hp).toBe(40);
    expect(car.wreck).toBe(false);
  });
  it("без детали не чинит", () => {
    const car = { hp: 10, wreck: false };
    const inv = createInventory(4);
    const ok = repairCar(
      car,
      (id) => countItem(inv, id),
      () => {},
    );
    expect(ok).toBe(0);
    expect(car.hp).toBe(10);
  });
});
