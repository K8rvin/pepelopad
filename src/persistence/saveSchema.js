import { VEHICLES } from "../data/vehicles.js";

export const SAVE_VERSION = 9;
export const CITY_ID = "volgograd-osm-1";

const V8_MAX_FUEL = {
  sedan: 100,
  blue: 110,
  taxi: 120,
  police: 100,
  ambulance: 130,
  truck: 160,
};

const copy = (value) => JSON.parse(JSON.stringify(value));

function migrateV8Vehicle(vehicle, base) {
  if (!vehicle || typeof vehicle !== "object") return vehicle;
  const type = vehicle.type || base?.type,
    def = VEHICLES[type] || VEHICLES.sedan,
    legacyMaxFuel = V8_MAX_FUEL[type] || V8_MAX_FUEL.sedan,
    oldMaxFuel =
      Number.isFinite(vehicle.maxFuel) && vehicle.maxFuel > 0
        ? vehicle.maxFuel
        : Number.isFinite(base?.maxFuel) && base.maxFuel > 0
          ? base.maxFuel
          : legacyMaxFuel,
    migrated = { ...vehicle, maxFuel: def.maxFuel };
  if (Number.isFinite(vehicle.fuel))
    migrated.fuel =
      Math.max(0, Math.min(1, vehicle.fuel / oldMaxFuel)) * def.maxFuel;
  return migrated;
}

function migrateV8Fuel(data) {
  const carsById = new Map(data.cars || []);
  return {
    cars: (data.cars || []).map(([id, car]) => [id, migrateV8Vehicle(car)]),
    OV: (data.OV || []).map(([key, override]) => [
      key,
      typeof key === "string" && key.startsWith("CAR")
        ? migrateV8Vehicle(override, carsById.get(key.slice(3)))
        : override,
    ]),
  };
}

function playerSnapshot(P) {
  return {
    x: P.x,
    y: P.y,
    r: P.r,
    hp: P.hp,
    st: P.st,
    hu: P.hu,
    armor: P.armor,
    xp: P.xp,
    lvl: P.lvl,
    sp: P.sp,
    skills: copy(P.skills),
    aim: P.aim,
    weapon: P.weapon,
    owned: copy(P.owned),
    mags: copy(P.mags),
    flash: P.flash,
  };
}

export function createSaveData(snapshot) {
  return {
    v: SAVE_VERSION,
    city: CITY_ID,
    seed: snapshot.seed,
    diff: snapshot.diff,
    day: snapshot.day,
    tod: snapshot.tod,
    playT: snapshot.playT,
    timeSpeed: snapshot.timeSpeed,
    lastSiegeDay: snapshot.lastSiegeDay,
    siegeWarnDay: snapshot.siegeWarnDay,
    dead: snapshot.dead,
    gateOpen: snapshot.gateOpen,
    P: playerSnapshot(snapshot.P),
    floor: snapshot.floor || null,
    inv: snapshot.inv.map((slot) => (slot ? { id: slot.id, n: slot.n } : null)),
    invSlots: snapshot.invSlots,
    hasSpear: snapshot.hasSpear,
    learned: [...snapshot.learned],
    bench: snapshot.bench,
    Q: copy(snapshot.Q),
    baseProj: copy(snapshot.baseProj),
    OV: copy([...snapshot.OV]),
    SM: copy([...snapshot.SMAP]),
    EX: [...snapshot.EX],
    cars: copy([...snapshot.CARS]),
    camps: copy([...snapshot.CAMPS]),
    stats: copy(snapshot.stats),
    J: copy(snapshot.J),
  };
}

export function validateSaveData(data) {
  if (!data || data.v !== SAVE_VERSION)
    throw new Error("Unsupported save version");
  if (!Number.isFinite(data.seed) || !data.diff || !data.P || !data.Q)
    throw new Error("Corrupted save data");
  for (const key of ["OV", "SM", "EX", "cars", "camps", "learned", "inv"]) {
    if (!Array.isArray(data[key]))
      throw new Error(`Corrupted save field: ${key}`);
  }
  return data;
}

export function migrateSave(data) {
  if (!data || typeof data !== "object") throw new Error("Corrupted save data");
  if (![3, 4, 5, 6, 7, 8, SAVE_VERSION].includes(data.v))
    throw new Error("Unsupported save version");
  const player = { ...data.P };
  let floor = data.floor || null;
  if (data.v === 6 && floor?.return) {
    player.x = floor.return.x;
    player.y = floor.return.y;
    floor = null;
  }
  const structures = (data.SM || []).filter(([, structure]) =>
    [6, 7].includes(data.v)
      ? !(
          structure.x >= 6 &&
          structure.x <= 25 &&
          structure.y >= 6 &&
          structure.y <= 25
        )
      : true,
  );
  const fuel = data.v === 8 ? migrateV8Fuel(data) : data;
  const migrated = {
    ...data,
    v: SAVE_VERSION,
    city:
      [6, 7, 8, SAVE_VERSION].includes(data.v) && data.city === CITY_ID
        ? CITY_ID
        : "legacy-procedural",
    P: player,
    floor,
    SM: structures,
    cars: fuel.cars,
    OV: fuel.OV,
    invSlots: data.invSlots || 30,
    hasSpear: Boolean(data.hasSpear),
    J: data.J || [],
    Q: { ...data.Q, sideProg: data.Q?.sideProg || {} },
  };
  return validateSaveData(migrated);
}

export function parseSave(text) {
  return migrateSave(JSON.parse(text));
}
