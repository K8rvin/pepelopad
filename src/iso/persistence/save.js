// Сохранения новой игры: версионированная схема, живые объекты не сериализуются.
// Город пересоздаётся из сида; сохраняется только дельта состояния.
// v3: навыки и характеристики (прогрессия «учись делая»).
// v4: одноэтажный пригород — карта несовместима с v3; мировые дельты и позиция
// сбрасываются, прогресс (навыки, квесты, инвентарь, сутки) сохраняется.
// v5: новые пригородные интерьеры; старые индексные ID внутренних контейнеров
// отделены от семантических ID комнат, мировой лут и остальной прогресс сохраняются.
import { restoreSkills } from "../systems/skills.js";
import { createStats } from "../systems/stats.js";
import { PITCH } from "../world/cityGen.js";

const SKEY = "pepelopad_city_v5";
const OLD_KEYS = [
  "pepelopad_city_v4",
  "pepelopad_city_v3",
  "pepelopad_city_v2",
  "pepelopad_city_v1",
];

export function saveGame({
  city,
  player,
  combat,
  survival,
  inv,
  loot,
  quests,
  skills,
  camps,
  base,
  story,
  stats,
}) {
  const data = {
    v: 5,
    savedAt: Date.now(),
    seed: city.seed,
    nb: city.nb,
    survival: {
      day: survival.day,
      tod: survival.tod,
      hunger: survival.hunger,
      lastSiegeDay: survival.lastSiegeDay,
      bossDone: !!survival.bossDone,
    },
    combat: {
      playerHp: combat.playerHp,
      kills: combat.kills,
    },
    player: {
      x: player.x,
      y: player.y,
      level: player.level,
      torch: !!player.torch,
      torchT: player.torchT || 0,
      weapon: player.weapon || "bow",
      stamina: player.stamina ?? 100,
      exhausted: !!player.exhausted,
      infected: !!player.infected,
    },
    inv: inv.slots,
    opened: [...loot.opened.entries()],
    zombies: city.zombies.map((z) => ({
      x: z.x,
      y: z.y,
      hp: z.hp,
      dead: !!z.dead,
      type: z.type || "walker",
    })),
    cars: city.cars.map((c) => ({
      fuel: c.fuel,
      hp: c.hp,
      heading: c.heading,
      x: c.x,
      y: c.y,
      trunk: c.trunk ? c.trunk.slots : null,
    })),
    windows: [...city.brokenWindows.entries()].map(([k, v]) => [k, [...v]]),
    quests: quests
      ? { i: quests.i, prog: quests.prog, done: quests.done }
      : null,
    skills: skills ? { skills: skills.skills, attrs: skills.attrs } : null,
    camps: camps ? camps.map((c) => ({ ...c })) : null,
    base: base
      ? {
          ...base,
          storage: { slots: base.storage.slots, size: base.storage.size },
        }
      : null,
    story: story ? { i: story.i, flags: story.flags } : null,
    stats: stats ? { ...stats } : null,
    wrecked: {
      lamps: city.lamps.map((l, i) => (l.dead ? i : -1)).filter((i) => i >= 0),
      fences: city.fences
        .map((f, i) => (f.dead ? i : -1))
        .filter((i) => i >= 0),
      containers: city.containers
        .map((c, i) => (c.dead ? i : -1))
        .filter((i) => i >= 0),
      barrels: city.barrels
        .map((b, i) => (b.dead ? i : -1))
        .filter((i) => i >= 0),
      benches: city.benches
        .map((b, i) => (b.dead ? i : -1))
        .filter((i) => i >= 0),
      tires: city.tires.map((t, i) => (t.dead ? i : -1)).filter((i) => i >= 0),
    },
  };
  localStorage.setItem(SKEY, JSON.stringify(data));
  return data;
}

// миграции: v1 → v2 (квесты), v2 → v3 (навыки), v3 → v4 (новая карта),
// v4 → v5 (семантические ID контейнеров новых интерьеров).
function migrate(data) {
  if (data.v === 1) {
    data.v = 2;
    data.quests = null;
  }
  if (data.v === 2) {
    data.v = 3;
    data.skills = null;
  }
  if (data.v === 3) {
    data.v = 4;
    data.zombies = [];
    data.cars = [];
    data.windows = [];
    data.opened = [];
    data.player = { x: PITCH + 42, y: PITCH + 42, level: 0 };
  }
  if (data.v === 4) {
    data.v = 5;
    data.opened = (data.opened || []).filter(
      ([id]) => !String(id).startsWith("int"),
    );
  }
  return data;
}

export function loadGameData() {
  let raw = localStorage.getItem(SKEY);
  if (!raw)
    for (const k of OLD_KEYS) {
      raw = localStorage.getItem(k);
      if (raw) break;
    }
  if (!raw) return null;
  try {
    const data = migrate(JSON.parse(raw));
    if (data.v !== 5) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!(
    localStorage.getItem(SKEY) || OLD_KEYS.some((k) => localStorage.getItem(k))
  );
}

export function deleteSave() {
  localStorage.removeItem(SKEY);
  for (const k of OLD_KEYS) localStorage.removeItem(k);
}

// применить загруженное состояние к живой игре (город уже создан из сида)
export function applySave(
  data,
  {
    city,
    player,
    combat,
    survival,
    inv,
    loot,
    quests,
    skills,
    camps,
    base,
    story,
    stats,
  },
) {
  survival.day = data.survival.day;
  survival.tod = data.survival.tod;
  survival.hunger = data.survival.hunger;
  survival.lastSiegeDay = data.survival.lastSiegeDay;
  survival.bossDone = !!data.survival.bossDone;
  combat.playerHp = data.combat.playerHp;
  combat.kills = data.combat.kills;
  combat.dead = false;
  player.x = data.player.x;
  player.y = data.player.y;
  player.level = data.player.level || 0;
  player.torch = !!data.player.torch;
  player.torchT = data.player.torchT || 0;
  player.weapon = data.player.weapon || "bow";
  player.stamina = data.player.stamina ?? 100;
  player.exhausted = !!data.player.exhausted;
  player.infected = !!data.player.infected;
  inv.slots = data.inv;
  inv.size = data.inv.length;
  loot.opened = new Map(data.opened);
  if (quests && data.quests) {
    quests.i = data.quests.i;
    quests.prog = data.quests.prog || {};
    quests.done = data.quests.done || [];
  }
  if (skills) restoreSkills(skills, data.skills);
  if (base && data.base) {
    Object.assign(base, data.base);
    base.storage = {
      slots: data.base.storage.slots,
      size: data.base.storage.size,
    };
  }
  if (story && data.story) {
    story.i = data.story.i || 0;
    story.flags = data.story.flags || {};
  }
  if (stats) Object.assign(stats, createStats(data.stats));
  if (camps && data.camps)
    for (const cs of data.camps) {
      const c = camps.find((k) => k.id === cs.id);
      if (!c) continue;
      c.trust = cs.trust || 0;
      c.upgrades = cs.upgrades || [];
      c.stock = cs.stock || [];
      c.request = cs.request || null;
      c.usedServiceDay = cs.usedServiceDay || 0;
    }
  data.zombies.forEach((zs, i) => {
    const z = city.zombies[i];
    if (!z) return;
    z.x = zs.x;
    z.y = zs.y;
    z.hp = zs.hp;
    z.dead = zs.dead;
    z.type = zs.type || "walker";
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
      if (cs.trunk) c.trunk = { slots: cs.trunk, size: cs.trunk.length };
    });
  if (data.windows)
    for (const [k, arr] of data.windows)
      city.brokenWindows.set(Number(k), new Set(arr));
  if (data.wrecked)
    for (const key of [
      "lamps",
      "fences",
      "containers",
      "barrels",
      "benches",
      "tires",
    ])
      for (const i of data.wrecked[key] || [])
        if (city[key][i]) city[key][i].dead = true;
}
