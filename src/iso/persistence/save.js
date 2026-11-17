// Сохранения новой игры: версионированная схема, живые объекты не сериализуются.
// Город пересоздаётся из сида; сохраняется только дельта состояния.
const SKEY = "pepelopad_city_v2";

export function saveGame({
  city,
  player,
  combat,
  survival,
  inv,
  loot,
  quests,
}) {
  const data = {
    v: 2,
    savedAt: Date.now(),
    seed: city.seed,
    nb: city.nb,
    survival: {
      day: survival.day,
      tod: survival.tod,
      hunger: survival.hunger,
      lastSiegeDay: survival.lastSiegeDay,
    },
    combat: {
      playerHp: combat.playerHp,
      kills: combat.kills,
    },
    player: { x: player.x, y: player.y, level: player.level },
    inv: inv.slots,
    opened: [...loot.opened.entries()],
    zombies: city.zombies.map((z) => ({
      x: z.x,
      y: z.y,
      hp: z.hp,
      dead: !!z.dead,
    })),
    cars: city.cars.map((c) => ({
      fuel: c.fuel,
      hp: c.hp,
      heading: c.heading,
      x: c.x,
      y: c.y,
    })),
    windows: [...city.brokenWindows.entries()].map(([k, v]) => [k, [...v]]),
    quests: quests
      ? { i: quests.i, prog: quests.prog, done: quests.done }
      : null,
  };
  localStorage.setItem(SKEY, JSON.stringify(data));
  return data;
}

// миграция v1 → v2: появилось поле quests
function migrate(data) {
  if (data.v === 1) {
    data.v = 2;
    data.quests = null;
  }
  return data;
}

export function loadGameData() {
  const raw =
    localStorage.getItem(SKEY) || localStorage.getItem("pepelopad_city_v1");
  if (!raw) return null;
  try {
    const data = migrate(JSON.parse(raw));
    if (data.v !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!(
    localStorage.getItem(SKEY) || localStorage.getItem("pepelopad_city_v1")
  );
}

export function deleteSave() {
  localStorage.removeItem(SKEY);
  localStorage.removeItem("pepelopad_city_v1");
}

// применить загруженное состояние к живой игре (город уже создан из сида)
export function applySave(
  data,
  { city, player, combat, survival, inv, loot, quests },
) {
  survival.day = data.survival.day;
  survival.tod = data.survival.tod;
  survival.hunger = data.survival.hunger;
  survival.lastSiegeDay = data.survival.lastSiegeDay;
  combat.playerHp = data.combat.playerHp;
  combat.kills = data.combat.kills;
  combat.dead = false;
  player.x = data.player.x;
  player.y = data.player.y;
  player.level = data.player.level || 0;
  inv.slots = data.inv;
  loot.opened = new Map(data.opened);
  if (quests && data.quests) {
    quests.i = data.quests.i;
    quests.prog = data.quests.prog || {};
    quests.done = data.quests.done || [];
  }
  data.zombies.forEach((zs, i) => {
    const z = city.zombies[i];
    if (!z) return;
    z.x = zs.x;
    z.y = zs.y;
    z.hp = zs.hp;
    z.dead = zs.dead;
    z.tx = zs.x;
    z.ty = zs.y;
  });
  if (data.cars)
    data.cars.forEach((cs, i) => {
      const c = city.cars[i];
      if (!c) return;
      c.fuel = cs.fuel;
      c.hp = cs.hp;
      c.heading = cs.heading;
      c.x = cs.x;
      c.y = cs.y;
    });
  if (data.windows)
    for (const [k, arr] of data.windows)
      city.brokenWindows.set(Number(k), new Set(arr));
}
