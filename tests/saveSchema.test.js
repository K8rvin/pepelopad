import { describe, expect, it } from "vitest";
import {
  CITY_ID,
  createSaveData,
  migrateSave,
  parseSave,
  SAVE_VERSION,
} from "../src/persistence/saveSchema.js";

const snapshot = () => ({
  seed: 42,
  diff: "easy",
  day: 2,
  tod: 12,
  playT: 100,
  timeSpeed: 1,
  lastSiegeDay: 0,
  siegeWarnDay: 0,
  dead: false,
  gateOpen: false,
  P: {
    x: 1,
    y: 2,
    r: 5,
    hp: 100,
    st: 100,
    hu: 100,
    armor: 0,
    xp: 0,
    lvl: 1,
    sp: 0,
    skills: {},
    aim: 0,
    weapon: "bow",
    owned: {},
    mags: {},
    flash: true,
    inCar: "car",
  },
  inv: [{ id: "wood", n: 3 }, null],
  invSlots: 30,
  hasSpear: false,
  learned: new Set(["crossbow"]),
  bench: 1,
  Q: { main: 0, side: [], sideProg: {} },
  baseProj: {},
  OV: new Map([["A", { value: 1 }]]),
  SMAP: new Map(),
  EX: new Set(["0,0"]),
  CARS: new Map(),
  CAMPS: new Map(),
  stats: { kills: 0 },
  J: [],
});

describe("схема сохранения", () => {
  it("создаёт отдельный снимок текущей версии", () => {
    const source = snapshot();
    const data = createSaveData(source);
    expect(data.v).toBe(SAVE_VERSION);
    expect(data.city).toBe(CITY_ID);
    expect(data.P.inCar).toBeUndefined();
    expect(data.inv).toEqual([{ id: "wood", n: 3 }, null]);
    expect(data.OV).toEqual([["A", { value: 1 }]]);
    source.P.skills.vit = 5;
    expect(data.P.skills).toEqual({});
  });

  it("мигрирует сохранение v3", () => {
    const data = createSaveData(snapshot());
    const old = { ...data, v: 3, invSlots: undefined, J: undefined };
    const migrated = migrateSave(old);
    expect(migrated.v).toBe(SAVE_VERSION);
    expect(migrated.invSlots).toBe(30);
    expect(migrated.J).toEqual([]);
    expect(migrated.Q.sideProg).toEqual({});
  });

  it("мигрирует v4 и назначает наружный уровень", () => {
    const old = { ...createSaveData(snapshot()), v: 4 };
    const migrated = migrateSave(old);
    expect(migrated.v).toBe(SAVE_VERSION);
    expect(migrated.floor).toBeNull();
  });

  it("помечает координаты v5 как несовместимый процедурный город", () => {
    const migrated = migrateSave({ ...createSaveData(snapshot()), v: 5 });
    expect(migrated.v).toBe(SAVE_VERSION);
    expect(migrated.city).toBe("legacy-procedural");
  });

  it("читает сохранение из JSON", () => {
    const data = createSaveData(snapshot());
    expect(parseSave(JSON.stringify(data)).seed).toBe(42);
  });

  it("отклоняет повреждённые и неподдерживаемые данные", () => {
    expect(() => parseSave("{}")).toThrow();
    expect(() => migrateSave({ v: 999 })).toThrow("Unsupported save version");
  });
});
