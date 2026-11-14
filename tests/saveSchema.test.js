import { describe, expect, it } from "vitest";
import {
  CITY_ID,
  createSaveData,
  migrateSave,
  parseSave,
  SAVE_VERSION,
} from "../src/persistence/saveSchema.js";
import { normalizeVehicle } from "../src/systems/vehicles.js";

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

  it("переносит v6 из старой комнаты на сохранённую наружную позицию", () => {
    const old = {
      ...createSaveData(snapshot()),
      v: 6,
      floor: {
        buildingId: "hospital",
        floorId: "upper",
        return: { x: 120, y: 240 },
      },
    };
    const migrated = migrateSave(old);
    expect(migrated.city).toBe(CITY_ID);
    expect(migrated.P.x).toBe(120);
    expect(migrated.P.y).toBe(240);
    expect(migrated.floor).toBeNull();
  });

  it("удаляет структуры стартового Рубежа при миграции v7", () => {
    const old = {
      ...createSaveData(snapshot()),
      v: 7,
      SM: [
        ["16,16", { t: "fire", x: 16, y: 16 }],
        ["30,30", { t: "bench", x: 30, y: 30 }],
      ],
    };
    const migrated = migrateSave(old);
    expect(migrated.SM).toEqual([["30,30", { t: "bench", x: 30, y: 30 }]]);
    expect(migrated.city).toBe(CITY_ID);
  });

  it("мигрирует топливо v8 активных машин и CAR-переопределений", () => {
    const source = snapshot();
    source.CARS = new Map([
      [
        "truck",
        {
          id: "truck",
          type: "truck",
          fuel: 80,
          maxFuel: 160,
          hp: 177,
          engineHp: 65,
          tireHp: 70,
          trunk: [{ id: "wood", n: 2 }],
        },
      ],
    ]);
    source.OV = new Map([
      ["CARtruck", { fuel: 40, hp: 150, broken: true, locked: false }],
    ]);
    const migrated = migrateSave({ ...createSaveData(source), v: 8 });
    const truck = migrated.cars[0][1],
      override = migrated.OV[0][1];
    expect(migrated.v).toBe(9);
    expect(migrated.city).toBe(CITY_ID);
    expect(truck.fuel).toBe(60);
    expect(truck.maxFuel).toBe(120);
    expect(truck.hp).toBe(177);
    expect(truck.engineHp).toBe(65);
    expect(truck.tireHp).toBe(70);
    expect(truck.trunk).toEqual([{ id: "wood", n: 2 }]);
    expect(override.fuel).toBe(30);
    expect(override.maxFuel).toBe(120);
    expect(override.hp).toBe(150);
    expect(override.broken).toBe(true);
    expect(normalizeVehicle(truck).maxFuel).toBe(120);
  });

  it("использует старый класс бака, если v8 не хранил maxFuel", () => {
    const source = snapshot();
    source.CARS = new Map([
      ["car", { id: "car", type: "sedan", fuel: 50, hp: 80 }],
    ]);
    source.OV = new Map([["CARcar", { fuel: 25 }]]);
    const migrated = migrateSave({ ...createSaveData(source), v: 8 });
    expect(migrated.cars[0][1].fuel).toBe(26);
    expect(migrated.cars[0][1].maxFuel).toBe(52);
    expect(migrated.OV[0][1].fuel).toBe(13);
    expect(migrated.OV[0][1].maxFuel).toBe(52);
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
