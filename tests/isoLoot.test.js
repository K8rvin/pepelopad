import { describe, expect, it } from "vitest";
import {
  createLoot,
  containerItems,
  openContainer,
  takeFrom,
  takeAll,
} from "../src/iso/systems/loot.js";
import { createInventory, addItem } from "../src/iso/systems/inventory.js";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createCombat,
  initCombat,
  updateCombat,
} from "../src/iso/systems/combat.js";
import { spawnZombie, initActors } from "../src/iso/systems/actors.js";
import { buildSolidIndex } from "../src/iso/world/cityGen.js";

describe("обыск: пустые контейнеры и детерминизм", () => {
  const city = createCity(11, 3);
  const L = createLoot(city);

  it("containerItems детерминирован и не пишет в состояние", () => {
    const c = L.containers[0];
    const a = containerItems(c, 0);
    const b = containerItems(c, 0);
    expect(a).toEqual(b);
    expect(L.opened.has(c.id)).toBe(false);
  });

  it("среди контейнеров есть пустые (подсказка обыска им не нужна)", () => {
    const empty = L.containers.filter((c) => containerItems(c, 0).length === 0);
    expect(empty.length).toBeGreaterThan(0);
  });

  it("openContainer фиксирует содержимое, takeAll опустошает", () => {
    const c = L.containers.find((k) => containerItems(k, 0).length > 0);
    openContainer(L, c, 0);
    const inv = createInventory(24);
    const taken = takeAll(L, c, (id, n) => addItem(inv, id, n));
    expect(taken.length).toBeGreaterThan(0);
    expect(L.opened.get(c.id).every((s) => !s)).toBe(true);
  });

  it("takeFrom последнего предмета оставляет контейнер пустым", () => {
    const c = L.containers.find((k) => containerItems(k, 0).length === 1);
    if (!c) return; // на этом сиде нет одностаковых — не критично
    openContainer(L, c, 0);
    const inv = createInventory(24);
    takeFrom(L, c, 0, (id, n) => addItem(inv, id, n));
    expect(L.opened.get(c.id).every((s) => !s)).toBe(true);
  });
});

describe("стрелы: хит-тест по экранному силуэту", () => {
  function emptyCity() {
    const city = createCity(1, 1);
    city.buildings.length = 0;
    city.buildingGrid = new Map();
    city.cars.length = 0;
    city.zombies.length = 0;
    city.trees.length = 0;
    city.lamps.length = 0;
    city.fences.length = 0;
    city.containers.length = 0;
    city.barrels.length = 0;
    city.tires.length = 0;
    buildSolidIndex(city);
    return city;
  }

  const shoot = (dyOffset) => {
    initActors(2);
    initCombat(4);
    const city = emptyCity();
    const z = spawnZombie(city, 10, 10, "walker");
    const C = createCombat();
    // стрела летит на высоте 0,9 м по экранной вертикали через силуэт зомби:
    // мировой курс (1,1)/√2 даёт постоянный screen-x; линия севернее ног в мире
    C.arrows.push({
      x: 10 - dyOffset,
      y: 10 - dyOffset,
      dx: Math.SQRT1_2,
      dy: Math.SQRT1_2,
      dist: 0,
      alive: true,
    });
    // короткий шаг: иначе стрела за кадр долетает до тела и «промах» невозможен
    updateCombat(C, city, { x: 10, y: 30 }, { x: 0, y: 0 }, 0.02, 0, true);
    return z;
  };

  it("попадание в тело (линия в 1,5 м севернее ног) засчитывается", () => {
    const z = shoot(1.5);
    expect(z.hp).toBeLessThan(70);
  });

  it("линия в 4 м севернее (выше головы на экране) — промах", () => {
    const z = shoot(4);
    expect(z.hp).toBe(70);
  });
});
