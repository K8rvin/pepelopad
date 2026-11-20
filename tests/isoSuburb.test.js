import { describe, expect, it, beforeEach } from "vitest";
import {
  createCity,
  buildSolidIndex,
  solidRectAt,
  PITCH,
  POIS,
} from "../src/iso/world/cityGen.js";
import { occludesPlayer } from "../src/iso/render/renderer.js";
import { tileAt } from "../src/iso/world/cityGen.js";
import { T_GRASS } from "../src/iso/render/tiles.js";
import {
  saveGame,
  loadGameData,
  applySave,
} from "../src/iso/persistence/save.js";
import { createSkills, gainXp } from "../src/iso/systems/skills.js";
import { createInventory } from "../src/iso/systems/inventory.js";
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

describe("пригород: одноэтажная застройка без заборов", () => {
  const city = createCity(11, 9);

  it("все здания одноэтажные (двухэтажки — поздний этап)", () => {
    expect(city.buildings.length).toBeGreaterThan(50);
    for (const b of city.buildings) expect(b.floors).toBe(1);
  });

  it("заборов нет вообще: открытые газоны и школьный двор", () => {
    expect(city.fences).toEqual([]);
  });

  it("POI-кварталы на месте (квесты не ломаются)", () => {
    for (const key of Object.keys(POIS)) {
      const [bk, bl] = key.split(",").map(Number);
      const bx0 = bk * PITCH + 11,
        by0 = bl * PITCH + 11;
      const poi = city.buildings.find(
        (b) =>
          b.poi && b.x >= bx0 && b.x < bx0 + 62 && b.y >= by0 && b.y < by0 + 62,
      );
      if (POIS[key] === "park") continue; // парк без зданий
      expect(poi, `POI ${POIS[key]} в ${key}`).toBeTruthy();
    }
  });

  it("есть дома со стилем house и кирпичные; машины на подъездных дорожках", () => {
    expect(city.buildings.some((b) => b.style === "house")).toBe(true);
    expect(city.buildings.some((b) => b.style === "brick")).toBe(true);
    // машины внутри квартала (не на уличной сетке) — подъездные дорожки
    const inBlock = city.cars.filter((c) => {
      const rx = c.x % PITCH,
        ry = c.y % PITCH;
      return rx > 11 && rx < 73 && ry > 11 && ry < 73;
    });
    expect(inBlock.length).toBeGreaterThan(5);
  });

  it("деревья только на траве, не на дорогах и тротуарах", () => {
    for (const t of city.trees)
      expect(tileAt(city, t.x, t.y), `дерево ${t.x},${t.y}`).toBe(T_GRASS);
  });

  it("детерминированность по сиду", () => {
    const a = createCity(23, 5),
      b = createCity(23, 5);
    expect(JSON.stringify(a.buildings)).toBe(JSON.stringify(b.buildings));
    expect(JSON.stringify(a.cars)).toBe(JSON.stringify(b.cars));
  });

  it("спавн не внутри здания и проходим", () => {
    const sx = PITCH + 42,
      sy = PITCH + 42;
    for (const b of city.buildings)
      expect(sx > b.x && sx < b.x + b.w && sy > b.y && sy < b.y + b.h).toBe(
        false,
      );
    buildSolidIndex(city);
    expect(solidRectAt(city, sx, sy, 0.35)).toBe(false);
  });
});

describe("видимость: здание фейдится, когда прячет игрока", () => {
  const b = { x: 10, y: 10, w: 10, h: 8, floors: 1 };

  it("игрок за северной стеной — здание перекрывает", () => {
    expect(occludesPlayer(b, 15, 6)).toBe(true);
    expect(occludesPlayer(b, 12, 9)).toBe(true);
  });

  it("игрок перед южной/восточной стеной — не фейдим (актёр поверх)", () => {
    expect(occludesPlayer(b, 15, 22)).toBe(false);
    expect(occludesPlayer(b, 25, 15)).toBe(false);
  });

  it("игрок далеко за зданием (выше крыши на экране) — не фейдим", () => {
    expect(occludesPlayer(b, 15, -20)).toBe(false);
  });

  it("игрок сбоку вне экрана спрайта — не фейдим", () => {
    expect(occludesPlayer(b, 40, 12)).toBe(false);
  });
});

describe("сейв v4: миграция с несовместимой карты v3", () => {
  beforeEach(() => mockStorage());

  const saveState = () => {
    const city = createCity(11, 3);
    return {
      city,
      player: { x: 5, y: 6, level: 0 },
      combat: { playerHp: 90, kills: 3, dead: false },
      survival: createSurvival(),
      inv: createInventory(24),
      loot: createLoot(city),
      quests: { i: 1, prog: { a: 2 }, done: ["m1"] },
      skills: createSkills(),
    };
  };

  it("v3 → v4: мировые дельты и позиция сброшены, прогресс сохранён", () => {
    const st = saveState();
    gainXp(st.skills, "archery", 500);
    const data = saveGame(st);
    localStorage.removeItem("pepelopad_city_v4");
    data.v = 3;
    data.zombies = [{ x: 1, y: 2, hp: 70, dead: false }];
    data.cars = [{ fuel: 10, hp: 100, heading: 0, x: 3, y: 4 }];
    data.windows = [["1", ["S:4.3"]]];
    data.opened = [["dn0", [{ id: "can", n: 1 }]]];
    data.player = { x: 500, y: 500, level: 2 };
    localStorage.setItem("pepelopad_city_v3", JSON.stringify(data));
    const loaded = loadGameData();
    expect(loaded.v).toBe(4);
    expect(loaded.zombies).toEqual([]);
    expect(loaded.cars).toEqual([]);
    expect(loaded.windows).toEqual([]);
    expect(loaded.opened).toEqual([]);
    expect(loaded.player).toEqual({ x: PITCH + 42, y: PITCH + 42, level: 0 });
    const fresh = saveState();
    applySave(loaded, fresh);
    expect(fresh.skills.skills.archery.level).toBe(
      st.skills.skills.archery.level,
    );
    expect(fresh.quests.done).toEqual(["m1"]);
    expect(fresh.player.x).toBe(PITCH + 42);
  });
});
