export const SAVE_VERSION = 4;

const copy = (value) => JSON.parse(JSON.stringify(value));

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
  if (data.v !== 3 && data.v !== SAVE_VERSION)
    throw new Error("Unsupported save version");
  const migrated = {
    ...data,
    v: SAVE_VERSION,
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
