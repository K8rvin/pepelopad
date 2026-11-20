import { describe, expect, it } from "vitest";
import { ZTYPES, nightType, ZOMBIE_CAP } from "../src/iso/data/zombies.js";
import {
  spawnZombie,
  alertZombie,
  alertNear,
  updateZombies,
  initActors,
} from "../src/iso/systems/actors.js";
import { createCity, buildSolidIndex } from "../src/iso/world/cityGen.js";
import { createSurvival, updateSurvival } from "../src/iso/systems/survival.js";
import {
  createCombat,
  initCombat,
  updateCombat,
} from "../src/iso/systems/combat.js";
import { createInventory } from "../src/iso/systems/inventory.js";

function emptyCity(seed = 1) {
  const city = createCity(seed, 1);
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

describe("типы зомби: данные и спавн", () => {
  it("смесь генерации: только ходоки и бегуны, hp по типу", () => {
    const city = createCity(11, 5);
    const types = new Set(city.zombies.map((z) => z.type));
    expect([...types].sort()).toEqual(["runner", "walker"]);
    for (const z of city.zombies) expect(z.hp).toBe(ZTYPES[z.type].hp);
  });

  it("ночная смесь: громилы только с 3-го дня", () => {
    expect(nightType(1, 0.05)).toBe("runner");
    expect(nightType(2, 0.05)).toBe("runner");
    expect(nightType(3, 0.05)).toBe("brute");
    expect(nightType(5, 0.5)).toBe("walker");
  });

  it("spawnZombie переиспользует мёртвых и держит капу", () => {
    const city = emptyCity();
    const a = spawnZombie(city, 10, 10, "runner");
    a.dead = true;
    const b = spawnZombie(city, 20, 20, "brute");
    expect(b).toBe(a);
    expect(b.type).toBe("brute");
    expect(b.hp).toBe(ZTYPES.brute.hp);
    expect(city.zombies.length).toBe(1);
    for (let i = 0; i < ZOMBIE_CAP + 50; i++)
      spawnZombie(city, 30 + i, 30, "walker");
    expect(city.zombies.length).toBe(ZOMBIE_CAP);
    expect(spawnZombie(city, 5, 5, "walker")).toBeNull();
  });
});

describe("стадность: тревога распространяется по соседям", () => {
  it("тревога одного зомби заражает соседей в 5 м, но не дальних", () => {
    initActors(3);
    const city = emptyCity();
    const near = spawnZombie(city, 10, 10, "walker");
    const far = spawnZombie(city, 40, 40, "walker");
    const player = { x: 10.5, y: 10.5, r: 0.35 };
    alertNear(city, 10, 10, 2, 6);
    expect(near.alertT).toBeGreaterThan(0);
    updateZombies(city, city.zombies, player, 0.1, 1);
    // сосед near (в 5 м от тревожного) получил тревогу; far — нет
    const mid = city.zombies.find((z) => z !== near && z !== far);
    expect(mid).toBeUndefined(); // только два зомби: проверим far
    expect(far.alertT ?? 0).toBe(0);
    // добавим соседа рядом с near и повторим распространение
    const nb = spawnZombie(city, 12, 10, "walker");
    near.propagated = false;
    near.alertT = 5;
    updateZombies(city, city.zombies, player, 0.1, 1);
    expect(nb.alertT).toBeGreaterThan(0);
    expect(nb.tx).toBe(near.tx);
  });

  it("бегун быстрее ходока на той же дистанции", () => {
    initActors(5);
    const city = emptyCity();
    const w = spawnZombie(city, 10, 10, "walker");
    const r = spawnZombie(city, 10, 14, "runner");
    const player = { x: 10, y: 30, r: 0.35 };
    alertZombie(w, player.x, player.y, 10);
    alertZombie(r, player.x, player.y, 10);
    const y0w = w.y,
      y0r = r.y;
    for (let i = 0; i < 60; i++)
      updateZombies(city, city.zombies, player, 1 / 60, 1);
    expect(r.y - y0r).toBeGreaterThan((w.y - y0w) * 1.5);
  });
});

describe("Матка: призыв и живучесть", () => {
  it("призывает ходоков каждые summonCd секунд", () => {
    initActors(7);
    const city = emptyCity();
    const boss = spawnZombie(city, 20, 20, "boss");
    // Manhattan-дистанция < 80: иначе зомби «спит» на границе пробуждения
    const player = { x: 55, y: 55, r: 0.35 };
    const n0 = city.zombies.length;
    for (let i = 0; i < 60 * 19; i++)
      updateZombies(city, city.zombies, player, 1 / 60, 1);
    expect(city.zombies.length).toBeGreaterThan(n0);
    expect(city.zombies.some((z) => z.type === "walker" && z !== boss)).toBe(
      true,
    );
  });

  it("ночь 5-го дня ставит pendingBoss у больницы", () => {
    const city = createCity(11, 9);
    const S = createSurvival();
    S.day = 5;
    S.tod = 20.99;
    S.lastSiegeDay = 4;
    const combat = { playerHp: 100, playerMaxHp: 100, dead: false };
    updateSurvival(S, combat, { x: 118, y: 118 }, city, createInventory(24), 1);
    expect(S.bossDone).toBe(true);
    expect(S.pendingBoss).toBeTruthy();
    const b = city.buildings.find((k) => k.poi === "Больница");
    expect(S.pendingBoss.y).toBeCloseTo(b.y + b.h + 2);
  });

  it("урон укуса и отброс зависят от типа", () => {
    initCombat(9);
    const city = emptyCity();
    const brute = spawnZombie(city, 10, 10, "brute");
    const C = createCombat();
    const player = { x: 10.3, y: 10, r: 0.35 };
    brute.attackCd = 0;
    updateCombat(C, city, player, { x: 0, y: 0 }, 0.05, 0, false);
    expect(C.playerHp).toBeLessThanOrEqual(100 - ZTYPES.brute.dmg);
    // отброс громилы мал
    initCombat(9);
    const C2 = createCombat();
    const x0 = brute.x;
    C2.arrows.push({ x: 9, y: 10, dx: 1, dy: 0, dist: 0, alive: true });
    updateCombat(C2, city, player, { x: 0, y: 0 }, 0.05, 0, true);
    expect(brute.x - x0).toBeLessThan(0.15);
  });
});
