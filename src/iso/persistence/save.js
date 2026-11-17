// Сохранения новой игры: версионированная схема, живые объекты не сериализуются.
// Город пересоздаётся из сида; сохраняется только дельта состояния.
const SKEY = "pepelopad_city_v1";

export function saveGame({ city, player, combat, survival, inv, loot }) {
  const data = {
    v: 1,
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
    player: { x: player.x, y: player.y },
    inv: inv.slots,
    opened: [...loot.opened.entries()],
    zombies: city.zombies.map((z) => ({
      x: z.x,
      y: z.y,
      hp: z.hp,
      dead: !!z.dead,
    })),
  };
  localStorage.setItem(SKEY, JSON.stringify(data));
  return data;
}

export function loadGameData() {
  const raw = localStorage.getItem(SKEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.v !== 1) return null; // миграции — при появлении v2
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!localStorage.getItem(SKEY);
}

export function deleteSave() {
  localStorage.removeItem(SKEY);
}

// применить загруженное состояние к живой игре (город уже создан из сида)
export function applySave(data, { city, player, combat, survival, inv, loot }) {
  survival.day = data.survival.day;
  survival.tod = data.survival.tod;
  survival.hunger = data.survival.hunger;
  survival.lastSiegeDay = data.survival.lastSiegeDay;
  combat.playerHp = data.combat.playerHp;
  combat.kills = data.combat.kills;
  combat.dead = false;
  player.x = data.player.x;
  player.y = data.player.y;
  inv.slots = data.inv;
  loot.opened = new Map(data.opened);
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
}
