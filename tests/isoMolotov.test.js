import { describe, expect, it } from "vitest";
import {
  createCombat,
  initCombat,
  throwMolotov,
  throwTarget,
  updateCombat,
} from "../src/iso/systems/combat.js";
import { WEAPONS } from "../src/iso/data/weapons.js";
import { ITEMS } from "../src/iso/data/items.js";
import { RECIPES } from "../src/iso/data/recipes.js";
import {
  addItem,
  countItem,
  createInventory,
} from "../src/iso/systems/inventory.js";
import { craft } from "../src/iso/systems/craft.js";
import { buildSolidIndex, createCity } from "../src/iso/world/cityGen.js";

const playerAt = (x = 0, y = 0, level = 0) => ({ x, y, level, r: 0.35 });
const zombieAt = (x, y, hp = 70, level = 0) => ({
  x,
  y,
  hp,
  level,
  type: "walker",
  dead: false,
});
const cityWith = (zombies = []) => ({ zombies });

function step(C, city, player, seconds, dt = 0.05) {
  for (let left = seconds; left > 1e-8;) {
    const d = Math.min(dt, left);
    updateCombat(C, city, player, { x: 4, y: 0 }, d, 0, false);
    left -= d;
  }
}

function throwAndExplode(C, city, player, inv, aim = { x: 4, y: 0 }) {
  expect(throwMolotov(C, player, aim, inv, city)).toBe(true);
  for (let i = 0; i < 100 && C.fires.length === 0; i++)
    updateCombat(C, city, player, aim, 0.01, i * 0.01, false);
  expect(C.throwables).toHaveLength(0);
  expect(C.fires).toHaveLength(1);
}

describe("коктейль Молотова: данные и крафт", () => {
  it("предмет, оружие и рецепт согласованы", () => {
    const recipe = RECIPES.find((r) => r.id === "molotov");
    expect(ITEMS.molotov.stack).toBe(5);
    expect(WEAPONS.molotov.kind).toBe("throwable");
    expect(recipe.out).toEqual({ id: "molotov", n: 1 });
    expect(recipe.inputs).toEqual({ fuel: 1, cloth: 1 });
    const inv = createInventory();
    addItem(inv, "fuel", 1);
    addItem(inv, "cloth", 1);
    expect(craft(inv, recipe)).toBe(true);
    expect(countItem(inv, "molotov")).toBe(1);
    expect(countItem(inv, "fuel")).toBe(0);
    expect(countItem(inv, "cloth")).toBe(0);
  });

  it("точка броска ограничена дальностью и не совпадает с игроком", () => {
    expect(throwTarget(playerAt(), { x: 30, y: 0 })).toEqual({
      x: WEAPONS.molotov.range,
      y: 0,
      distance: WEAPONS.molotov.range,
    });
    expect(throwTarget(playerAt(), { x: 0, y: 0 }).distance).toBe(0.75);
  });
});

describe("бросок и огненная зона", () => {
  it("тратит один предмет, держит кулдаун и создаёт огонь в точке падения", () => {
    initCombat(7);
    const C = createCombat();
    const inv = createInventory();
    const player = playerAt();
    const city = cityWith();
    addItem(inv, "molotov", 2);
    throwAndExplode(C, city, player, inv);
    expect(countItem(inv, "molotov")).toBe(1);
    expect(C.fires[0]).toMatchObject({ x: 4, y: 0, level: 0 });
    expect(C.fires[0].duration).toBe(WEAPONS.molotov.duration);
    expect(C.throwCd).toBeGreaterThan(0);
    expect(throwMolotov(C, player, { x: 6, y: 0 }, inv, city)).toBe(false);
    expect(countItem(inv, "molotov")).toBe(1);
    step(C, city, player, 0.8);
    expect(throwMolotov(C, player, { x: 8, y: 0 }, inv, city)).toBe(true);
    expect(countItem(inv, "molotov")).toBe(0);
  });

  it("наносит удар и периодический урон только в радиусе и на своём этаже", () => {
    initCombat(7);
    const C = createCombat();
    const inv = createInventory();
    const player = playerAt();
    const inside = zombieAt(4, 0);
    const outside = zombieAt(8, 0);
    const upstairs = zombieAt(4, 0, 70, 1);
    const city = cityWith([inside, outside, upstairs]);
    addItem(inv, "molotov", 1);
    throwAndExplode(C, city, player, inv);
    expect(inside.hp).toBe(70 - WEAPONS.molotov.impactDmg);
    expect(inside.burnT).toBeGreaterThan(0);
    expect(outside.hp).toBe(70);
    expect(upstairs.hp).toBe(70);
    step(C, city, player, 0.55);
    expect(inside.hp).toBe(
      70 - WEAPONS.molotov.impactDmg - WEAPONS.molotov.burnDmg,
    );
    step(C, city, player, 0.5);
    expect(inside.hp).toBe(
      70 - WEAPONS.molotov.impactDmg - WEAPONS.molotov.burnDmg * 2,
    );
    expect(outside.hp).toBe(70);
    expect(upstairs.hp).toBe(70);
  });

  it("смерть от огня засчитывается один раз с источником fire", () => {
    initCombat(7);
    const C = createCombat();
    const inv = createInventory();
    const player = playerAt();
    const target = zombieAt(4, 0, WEAPONS.molotov.impactDmg);
    const city = cityWith([target]);
    const kills = [];
    C.onKill = (source, z) => kills.push({ source, z });
    addItem(inv, "molotov", 1);
    throwAndExplode(C, city, player, inv);
    step(C, city, player, 1);
    expect(target.dead).toBe(true);
    expect(C.kills).toBe(1);
    expect(C.corpses).toHaveLength(1);
    expect(kills).toEqual([{ source: "fire", z: target }]);
  });

  it("огонь опасен для игрока, но не достаёт с другого этажа", () => {
    const C = createCombat();
    const player = playerAt();
    const city = cityWith();
    C.fires.push({
      x: 0,
      y: 0,
      level: 0,
      radius: WEAPONS.molotov.radius,
      t: 0,
      duration: 8,
      nextTick: 0.5,
      seed: 0,
    });
    step(C, city, player, 0.55);
    expect(C.playerHp).toBe(100 - WEAPONS.molotov.burnDmg);
    player.level = 1;
    step(C, city, player, 0.55);
    expect(C.playerHp).toBe(100 - WEAPONS.molotov.burnDmg);
  });

  it("шум разрыва привлекает зомби вне зоны поражения, огонь затухает", () => {
    initCombat(7);
    const C = createCombat();
    const inv = createInventory();
    const player = playerAt();
    const hears = zombieAt(14, 0);
    const far = zombieAt(20, 0);
    const city = cityWith([hears, far]);
    addItem(inv, "molotov", 1);
    throwAndExplode(C, city, player, inv);
    expect(hears.alertT).toBe(6);
    expect(hears.tx).toBe(4);
    expect(hears.hp).toBe(70);
    expect(far.alertT).toBeUndefined();
    step(C, city, player, 8.1);
    expect(C.fires).toHaveLength(0);
  });

  it("бутылка разбивается о глухую стену, не поражая дальнюю комнату", () => {
    initCombat(7);
    const city = createCity(11, 3);
    buildSolidIndex(city);
    const b = city.buildings.find((b) => b.h >= 8);
    const x = b.x + 1.5;
    const south = b.y + b.h;
    city.zombies = [zombieAt(x, south - 5)];
    const C = createCombat();
    const inv = createInventory();
    const player = playerAt(x, south + 3);
    addItem(inv, "molotov", 1);
    throwAndExplode(C, city, player, inv, { x, y: south - 5 });
    expect(C.fires[0].y).toBeGreaterThan(south);
    expect(city.zombies[0].hp).toBe(70);
  });
});
