import { describe, expect, it, beforeEach } from "vitest";
import {
  createSkills,
  gainXp,
  modifiers,
  restoreSkills,
  xpToNext,
  NEUTRAL_MODS,
} from "../src/iso/systems/skills.js";
import {
  SKILLS,
  ATTRS,
  MAX_LEVEL,
  ATTR_START,
  SKILL_XP_BASE,
  ATTR_XP_BASE,
} from "../src/iso/data/skills.js";
import {
  createInventory,
  addItem,
  countItem,
  removeItem,
  resizeInventory,
} from "../src/iso/systems/inventory.js";
import { craft } from "../src/iso/systems/craft.js";
import { RECIPES } from "../src/iso/data/recipes.js";
import { createLoot, openContainer } from "../src/iso/systems/loot.js";
import {
  createCombat,
  initCombat,
  updateCombat,
} from "../src/iso/systems/combat.js";
import { createCity, buildSolidIndex } from "../src/iso/world/cityGen.js";
import { initVehicles, updateVehicle } from "../src/iso/systems/vehicles.js";
import { updatePlayer } from "../src/iso/systems/actors.js";
import {
  createSurvival,
  updateSurvival,
  useConsumable,
} from "../src/iso/systems/survival.js";
import {
  saveGame,
  loadGameData,
  applySave,
  hasSave,
  deleteSave,
} from "../src/iso/persistence/save.js";

// минимальный пустой город (как в isoVehicles.test.js)
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

const combatStub = () => ({
  shake: 0,
  blood: [],
  corpses: [],
  kills: 0,
  onKill: null,
});

// localStorage-мок для тестов сейвов (vitest, node-окружение)
function mockStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

describe("прогрессия: XP и уровни", () => {
  it("новая игра: 8 навыков ур. 0, 4 характеристики ур. 2", () => {
    const S = createSkills();
    expect(Object.keys(S.skills)).toEqual(Object.keys(SKILLS));
    expect(Object.keys(S.attrs)).toEqual(Object.keys(ATTRS));
    for (const st of Object.values(S.skills))
      expect(st).toEqual({ xp: 0, level: 0 });
    for (const st of Object.values(S.attrs))
      expect(st).toEqual({ xp: 0, level: ATTR_START });
  });

  it("порог уровня: 39 XP мало, 40 — уровень 1", () => {
    const S = createSkills();
    expect(gainXp(S, "archery", 39)).toEqual([]);
    expect(S.skills.archery.level).toBe(0);
    const ev = gainXp(S, "archery", 1);
    expect(S.skills.archery.level).toBe(1);
    expect(S.skills.archery.xp).toBe(0);
    expect(ev).toContainEqual({ kind: "skill", id: "archery", level: 1 });
  });

  it("переполнение XP повышает несколько уровней сразу", () => {
    const S = createSkills();
    // пороги 40 + 120 + 200 = 360 → уровень 3
    const ev = gainXp(S, "archery", 360);
    expect(S.skills.archery.level).toBe(3);
    expect(S.skills.archery.xp).toBe(0);
    expect(ev.filter((e) => e.kind === "skill").map((e) => e.level)).toEqual([
      1, 2, 3,
    ]);
  });

  it("потолок 10: XP не уходит за предел, навык больше не растёт", () => {
    const S = createSkills();
    gainXp(S, "archery", 1e6);
    expect(S.skills.archery.level).toBe(MAX_LEVEL);
    expect(S.skills.archery.xp).toBe(0);
    const ev = gainXp(S, "archery", 1e6);
    expect(ev.filter((e) => e.kind === "skill")).toEqual([]);
    expect(S.skills.archery.level).toBe(MAX_LEVEL);
  });

  it("характеристики получают 50% XP связанных навыков", () => {
    const S = createSkills();
    gainXp(S, "archery", 100);
    expect(S.attrs.agility.xp).toBe(50);
    expect(S.attrs.perception.xp).toBe(50);
    expect(S.attrs.strength.xp).toBe(0);
    expect(S.attrs.endurance.xp).toBe(0);
  });

  it("характеристика повышает уровень по своей кривой (300 от ур. 2)", () => {
    const S = createSkills();
    const ev = gainXp(S, "athletics", 600); // agility +300
    expect(S.attrs.agility.level).toBe(3);
    expect(ev).toContainEqual({ kind: "attr", id: "agility", level: 3 });
    expect(xpToNext(2, ATTR_XP_BASE)).toBe(300);
    expect(xpToNext(0, SKILL_XP_BASE)).toBe(40);
  });

  it("неизвестный навык и неположительный XP игнорируются", () => {
    const S = createSkills();
    expect(gainXp(S, "nope", 100)).toEqual([]);
    expect(gainXp(S, "archery", 0)).toEqual([]);
    expect(gainXp(S, "archery", -5)).toEqual([]);
  });
});

describe("модификаторы", () => {
  it("стартовая прогрессия даёт нейтральные модификаторы", () => {
    expect(modifiers(createSkills())).toEqual(NEUTRAL_MODS);
  });

  it("стрельба 5: +20% урона, −25% разброса", () => {
    const S = createSkills();
    S.skills.archery.level = 5;
    const m = modifiers(S);
    expect(m.bowDmgK).toBeCloseTo(1.2);
    expect(m.spreadK).toBeCloseTo(0.75);
  });

  it("Сила растит рюкзак: ур. 4 → 25 слотов, ур. 10 → 28", () => {
    const S = createSkills();
    S.attrs.strength.level = 4;
    expect(modifiers(S).carrySlots).toBe(25);
    S.attrs.strength.level = 10;
    expect(modifiers(S).carrySlots).toBe(28);
  });

  it("Выносливость 6: макс. HP 116", () => {
    const S = createSkills();
    S.attrs.endurance.level = 6;
    expect(modifiers(S).maxHp).toBe(116);
  });

  it("вождение 10: разгон +30%, расход на полу 0.8", () => {
    const S = createSkills();
    S.skills.driving.level = 10;
    const m = modifiers(S);
    expect(m.accelK).toBeCloseTo(1.3);
    expect(m.fuelK).toBeCloseTo(0.8);
  });

  it("бонусы крафта и лута ограничены потолками", () => {
    const S = createSkills();
    S.skills.crafting.level = 10;
    S.skills.scavenging.level = 10;
    S.attrs.perception.level = 10;
    const m = modifiers(S);
    expect(m.craftBonus).toBeCloseTo(0.4);
    expect(m.lootBonus).toBeCloseTo(0.46); // 0.3 (поиск) + 0.16 (восприятие)
  });
});

describe("рюкзак: рост от Силы", () => {
  it("resizeInventory добавляет пустые слоты, не трогая предметы", () => {
    const inv = createInventory(24);
    addItem(inv, "can", 3);
    resizeInventory(inv, 26);
    expect(inv.size).toBe(26);
    expect(inv.slots.length).toBe(26);
    expect(countItem(inv, "can")).toBe(3);
    expect(inv.slots[25]).toBeNull();
    resizeInventory(inv, 20); // уменьшение не поддерживается — игнор
    expect(inv.size).toBe(26);
  });
});

describe("крафт и лут: бонусы прогрессии", () => {
  it("бонусный выход крафта зависит от roll (детерминированно)", () => {
    const r = RECIPES.find((x) => x.id === "arrows");
    const invA = createInventory(24);
    addItem(invA, "wood", 2);
    addItem(invA, "scrap", 1);
    expect(craft(invA, r, 0.5, () => 0)).toBe(true);
    expect(countItem(invA, "arrow")).toBe(7); // 6 + бонус
    const invB = createInventory(24);
    addItem(invB, "wood", 2);
    addItem(invB, "scrap", 1);
    expect(craft(invB, r, 0.5, () => 0.99)).toBe(true);
    expect(countItem(invB, "arrow")).toBe(6);
  });

  it("бонусный лут детерминирован и фиксируется при первом обыске", () => {
    const city = { containers: [{ x: 1, y: 1 }], barrels: [] };
    const L0 = createLoot(city);
    const L1 = createLoot(city);
    const c = L0.containers[0];
    const base = openContainer(L0, c, 0);
    const bonus = openContainer(L1, c, 1);
    const sum = (arr) => arr.filter(Boolean).reduce((a, s) => a + s.n, 0);
    expect(sum(bonus)).toBeGreaterThanOrEqual(sum(base));
    // повторный обыск с другим шансом не перегенерирует содержимое
    const again = openContainer(L1, c, 0);
    expect(again).toBe(bonus);
  });
});

describe("бой: модификаторы прогрессии", () => {
  const battleCity = () => ({ buildings: [], zombies: [] });

  it("ловкость ускоряет натяжение лука", () => {
    const run = (chargeK) => {
      const C = createCombat();
      C.bowDrawing = true;
      updateCombat(
        C,
        battleCity(),
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        0.4,
        0,
        false,
        { chargeK },
      );
      return C.bowCharge;
    };
    expect(run(1)).toBeCloseTo(0.5);
    expect(run(0.5)).toBeCloseTo(1);
  });

  it("урон стрелы масштабируется bowDmgK; попадание и убийство дают события", () => {
    const shoot = (bowDmgK, zHp) => {
      initCombat(5); // один сид → одинаковый базовый ролл урона
      const C = createCombat();
      const hits = [],
        kills = [];
      C.onHit = () => hits.push(1);
      C.onKill = (src) => kills.push(src);
      const city = battleCity();
      city.zombies.push({ x: 1, y: 0, hp: zHp, dead: false });
      C.arrows.push({ x: 0, y: 0, dx: 1, dy: 0, dist: 0, alive: true });
      updateCombat(C, city, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.05, 0, false, {
        bowDmgK,
      });
      return { z: city.zombies[0], hits, kills };
    };
    const a = shoot(1, 70);
    const b = shoot(2, 70);
    const dmgA = 70 - a.z.hp;
    expect(dmgA).toBeGreaterThan(0);
    expect(70 - b.z.hp).toBeGreaterThanOrEqual(dmgA * 2 - 1);
    expect(a.hits.length).toBe(1);
    const c = shoot(1, 1);
    expect(c.z.dead).toBe(true);
    expect(c.kills).toEqual(["arrow"]);
  });
});

describe("вождение: модификаторы прогрессии", () => {
  const drive = (mods, frames = 120) => {
    const city = emptyCity();
    city.cars.push({ x: 40, y: 40, axis: "x", wreck: false });
    initVehicles(city);
    const car = city.cars[0];
    car.fuel = 40;
    let meters = 0;
    for (let i = 0; i < frames; i++)
      updateVehicle(
        city,
        car,
        { KeyW: true },
        { x: 0, y: 0 },
        combatStub(),
        1 / 60,
        mods,
        (m) => (meters += m),
      );
    return { car, meters };
  };

  it("fuelK 0.5 вдвое снижает расход на той же дистанции", () => {
    const a = drive(null);
    const b = drive({ fuelK: 0.5 });
    expect(40 - b.car.fuel).toBeCloseTo((40 - a.car.fuel) * 0.5, 6);
    expect(b.meters).toBeGreaterThan(0);
    expect(a.meters).toBeCloseTo(b.meters, 6);
  });

  it("accelK 2 быстрее разгоняет", () => {
    const a = drive(null, 60);
    const b = drive({ accelK: 2 }, 60);
    expect(b.car.v).toBeGreaterThan(a.car.v * 1.5);
  });

  it("таран: ramK удваивает урон, убийство помечается источником ram", () => {
    const ram = (ramK) => {
      const city = emptyCity();
      city.cars.push({ x: 40, y: 39.5, axis: "x", wreck: false });
      initVehicles(city);
      const car = city.cars[0];
      car.v = 10;
      const z = { x: 44, y: 40.4, hp: 100, dead: false };
      city.zombies.push(z);
      const combat = combatStub();
      const kills = [];
      combat.onKill = (src) => kills.push(src);
      updateVehicle(city, car, {}, { x: 0, y: 0 }, combat, 1 / 60, { ramK });
      return { z, kills };
    };
    const a = ram(1);
    expect(a.z.dead).toBe(false); // 100 − 90 = 10
    expect(a.kills).toEqual([]);
    const b = ram(2);
    expect(b.z.dead).toBe(true); // 100 − 180
    expect(b.kills).toEqual(["ram"]);
  });
});

describe("выживание: модификаторы прогрессии", () => {
  it("hungerK 0.5 вдвое замедляет голод, regenK 2 ускоряет регенерацию", () => {
    const run = (mods) => {
      const S = createSurvival();
      const combat = { playerHp: 50, playerMaxHp: 100, dead: false };
      updateSurvival(
        S,
        combat,
        { x: 0, y: 0 },
        { zombies: [] },
        createInventory(24),
        60,
        mods,
      );
      return { hunger: S.hunger, hp: combat.playerHp };
    };
    const a = run(null);
    const b = run({ hungerK: 0.5, regenK: 2 });
    expect(100 - b.hunger).toBeCloseTo((100 - a.hunger) * 0.5, 6);
    expect(b.hp - 50).toBeCloseTo((a.hp - 50) * 2, 6);
  });

  it("тушёнка и бинт лечат сильнее с бонусами навыков", () => {
    const S = createSurvival();
    S.hunger = 50;
    const combat = { playerHp: 50, playerMaxHp: 100, dead: false };
    const inv = createInventory(24);
    addItem(inv, "can", 1);
    addItem(inv, "meds", 1);
    const rm = (id, n) => removeItem(inv, id, n);
    const msgCan = useConsumable(S, combat, inv, "can", rm, {}, { foodBonus: 10 });
    expect(S.hunger).toBe(100); // 50 + 40 + 10
    expect(msgCan).toContain("+50");
    const msgMeds = useConsumable(S, combat, inv, "meds", rm, {}, { healBonus: 9 });
    expect(combat.playerHp).toBe(89); // 50 + 30 + 9
    expect(msgMeds).toContain("+39");
  });
});

describe("движение: модификаторы прогрессии", () => {
  it("speedK 2 удваивает шаг, onMove сообщает метры и бег", () => {
    const run = (mods) => {
      const city = emptyCity();
      const player = { x: 10, y: 10, r: 0.35, animT: 0, pose: 0 };
      const moves = [];
      updatePlayer(
        city,
        player,
        { KeyW: true, ShiftLeft: true },
        0.1,
        mods,
        (m, isRun) => moves.push([m, isRun]),
      );
      return { d: Math.hypot(player.x - 10, player.y - 10), moves };
    };
    const a = run(null);
    const b = run({ speedK: 2 });
    expect(b.d).toBeCloseTo(a.d * 2, 6);
    expect(a.moves[0][1]).toBe(true);
    expect(a.moves[0][0]).toBeCloseTo(0.54, 6); // 5.4 м/с · 0.1 с
  });
});

describe("сейвы v3: навыки и миграции", () => {
  const saveState = () => {
    const city = emptyCity(11);
    city.nb = 19;
    return {
      city,
      player: { x: 5, y: 6, level: 0 },
      combat: { playerHp: 90, kills: 3, dead: false },
      survival: createSurvival(),
      inv: createInventory(24),
      loot: createLoot(city),
      quests: { i: 0, prog: {}, done: [] },
      skills: createSkills(),
    };
  };

  beforeEach(() => mockStorage());

  it("saveGame пишет v5, прогрессия переживает перезагрузку", () => {
    const st = saveState();
    gainXp(st.skills, "archery", 500);
    saveGame(st);
    const data = loadGameData();
    expect(data.v).toBe(5);
    const fresh = saveState();
    applySave(data, fresh);
    expect(fresh.skills.skills.archery.level).toBe(
      st.skills.skills.archery.level,
    );
    expect(fresh.skills.skills.archery.xp).toBe(st.skills.skills.archery.xp);
    expect(fresh.skills.attrs.agility.xp).toBe(st.skills.attrs.agility.xp);
  });

  it("миграция v2 → v5: старый сейв получает стартовую прогрессию", () => {
    const st = saveState();
    const data = saveGame(st);
    localStorage.removeItem("pepelopad_city_v5"); // эмуляция старого сейва
    data.v = 2;
    delete data.skills;
    localStorage.setItem("pepelopad_city_v2", JSON.stringify(data));
    const loaded = loadGameData();
    expect(loaded.v).toBe(5);
    expect(loaded.skills).toBeNull();
    const fresh = saveState();
    applySave(loaded, fresh);
    expect(fresh.skills.skills.archery.level).toBe(0);
    expect(fresh.skills.attrs.strength.level).toBe(ATTR_START);
  });

  it("миграция v1 → v5 через v2/v3", () => {
    const st = saveState();
    const data = saveGame(st);
    localStorage.removeItem("pepelopad_city_v5"); // эмуляция старого сейва
    data.v = 1;
    delete data.skills;
    delete data.quests;
    localStorage.setItem("pepelopad_city_v1", JSON.stringify(data));
    const loaded = loadGameData();
    expect(loaded.v).toBe(5);
    expect(loaded.quests).toBeNull();
    expect(loaded.skills).toBeNull();
  });

  it("restoreSkills клампует повреждённые уровни и XP", () => {
    const S = createSkills();
    restoreSkills(S, {
      skills: { archery: { level: 99, xp: -5 }, unknown: { level: 5, xp: 0 } },
      attrs: { strength: { level: 0, xp: 10 } },
    });
    expect(S.skills.archery.level).toBe(MAX_LEVEL);
    expect(S.skills.archery.xp).toBe(0);
    expect(S.attrs.strength.level).toBe(ATTR_START);
    expect(S.attrs.strength.xp).toBe(10);
    expect(S.skills.unknown).toBeUndefined();
  });

  it("hasSave видит старые ключи, deleteSave чистит все", () => {
    expect(hasSave()).toBe(false);
    localStorage.setItem("pepelopad_city_v1", "{}");
    expect(hasSave()).toBe(true);
    deleteSave();
    expect(hasSave()).toBe(false);
    expect(localStorage.getItem("pepelopad_city_v1")).toBeNull();
  });
});
