import { restoreSkills } from "../systems/skills.js";
import { createStats } from "../systems/stats.js";
import { createQuests } from "../systems/quests.js";
import { syncBaseBuilding } from "../systems/base.js";
import { PITCH } from "../world/cityGen.js";

const SKEY = "pepelopad_city_v6";
const OLD_KEYS = [
  "pepelopad_city_v5",
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
  interactions,
  survivors,
  siege,
}) {
  const data = {
    v: 6,
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
    combat: { playerHp: combat.playerHp, kills: combat.kills },
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
      level: z.level || 0,
      questGroup: z.questGroup || null,
      siege: !!z.siege,
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
      ? quests.states
        ? {
            states: quests.states,
            stages: quests.stages,
            progress: quests.progress,
            done: quests.done,
            failed: quests.failed,
            rewarded: quests.rewarded,
            pendingRewards: quests.pendingRewards,
            tracked: quests.tracked,
            i: quests.i,
            prog: quests.prog,
          }
        : { i: quests.i, prog: quests.prog, done: quests.done }
      : null,
    skills: skills ? { skills: skills.skills, attrs: skills.attrs } : null,
    camps: camps ? camps.map((c) => ({ ...c })) : null,
    base: base
      ? {
          ...base,
          storage: { slots: base.storage.slots, size: base.storage.size },
        }
      : null,
    story: story?.home
      ? {
          flags: story.flags,
          clues: story.clues,
          seen: story.seen,
          projects: story.projects,
          ending: story.ending,
          markRelation: story.markRelation,
          generatorOn: story.generatorOn,
          generatorFuel: story.generatorFuel,
          home: { unlocked: story.home.unlocked, storage: story.home.storage },
        }
      : null,
    stats: stats ? { ...stats } : null,
    interactions: interactions
      ? interactions.objects.map((o) => ({
          id: o.id,
          done: !!o.done,
          unlocked: !!o.unlocked,
          uses: o.uses || 0,
        }))
      : null,
    survivors: survivors
      ? survivors.map((s) => ({
          id: s.id,
          x: s.x,
          y: s.y,
          level: s.level || 0,
          hp: s.hp,
          state: s.state,
          campId: s.campId || null,
          walkPh: s.walkPh || 0,
        }))
      : null,
    siege: siege
      ? {
          active: !!siege.active,
          finished: !!siege.finished,
          wave: siege.phase === "respite" ? siege.wave + 1 : siege.wave,
          phase: "combat",
          gateHp: siege.gateHp,
          gateMaxHp: siege.gateMaxHp,
          attempts: siege.attempts || 0,
        }
      : null,
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
  if (data.v === 5) {
    data.v = 6;
    data.quests = null;
    data.story = null;
    data.interactions = null;
    data.survivors = null;
    data.siege = null;
  }
  return data;
}

export function loadGameData() {
  let raw = localStorage.getItem(SKEY);
  if (!raw)
    for (const key of OLD_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) break;
    }
  if (!raw) return null;
  try {
    const data = migrate(JSON.parse(raw));
    return data.v === 6 ? data : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!(
    localStorage.getItem(SKEY) ||
    OLD_KEYS.some((key) => localStorage.getItem(key))
  );
}

export function deleteSave() {
  localStorage.removeItem(SKEY);
  for (const key of OLD_KEYS) localStorage.removeItem(key);
}

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
    interactions,
    survivors,
    siege,
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
    if (data.quests.states) Object.assign(quests, createQuests(data.quests));
    else {
      quests.i = data.quests.i;
      quests.prog = data.quests.prog || {};
      quests.done = data.quests.done || [];
    }
  }
  if (skills) restoreSkills(skills, data.skills);
  if (base && data.base) {
    Object.assign(base, data.base);
    base.storage = {
      slots: data.base.storage.slots,
      size: data.base.storage.size,
    };
    syncBaseBuilding(base, city);
  }
  if (story && data.story) {
    story.flags = data.story.flags || {};
    story.clues = data.story.clues || [];
    story.seen = data.story.seen || {};
    story.projects = data.story.projects || [];
    story.ending = data.story.ending || null;
    story.markRelation = data.story.markRelation || 0;
    story.generatorOn = !!data.story.generatorOn;
    story.generatorFuel = data.story.generatorFuel || 0;
    story.home = {
      unlocked: !!data.story.home?.unlocked,
      storage: data.story.home?.storage || new Array(8).fill(null),
    };
  }
  if (stats) Object.assign(stats, createStats(data.stats));
  if (camps && data.camps)
    for (const saved of data.camps) {
      const camp = camps.find((c) => c.id === saved.id);
      if (!camp) continue;
      camp.trust = saved.trust || 0;
      camp.upgrades = saved.upgrades || [];
      camp.stock = saved.stock || [];
      camp.request = saved.request || null;
      camp.rescued = saved.rescued || [];
      camp.usedServiceDay = saved.usedServiceDay || 0;
    }
  if (interactions && data.interactions)
    for (const saved of data.interactions) {
      const object = interactions.objects.find((o) => o.id === saved.id);
      if (!object) continue;
      object.done = !!saved.done;
      object.unlocked = !!saved.unlocked;
      object.uses = saved.uses || 0;
    }
  if (survivors && data.survivors)
    for (const saved of data.survivors) {
      const survivor = survivors.find((s) => s.id === saved.id);
      if (!survivor) continue;
      survivor.x = saved.x;
      survivor.y = saved.y;
      survivor.level = saved.level || 0;
      survivor.hp = saved.hp;
      survivor.state = saved.state;
      survivor.campId = saved.campId || null;
      survivor.walkPh = saved.walkPh || 0;
    }
  if (siege && data.siege) {
    siege.active = !!data.siege.active;
    siege.finished = !!data.siege.finished;
    siege.wave = data.siege.wave || 0;
    siege.phase = data.siege.phase || "idle";
    siege.gateHp = data.siege.gateHp ?? 100;
    siege.gateMaxHp = data.siege.gateMaxHp ?? 100;
    siege.attempts = data.siege.attempts || 0;
    siege.gate = null;
  }
  for (const [i, saved] of (data.zombies || []).entries()) {
    const zombie = city.zombies[i];
    if (!zombie) continue;
    zombie.x = saved.x;
    zombie.y = saved.y;
    zombie.hp = saved.hp;
    zombie.dead = saved.dead;
    zombie.type = saved.type || "walker";
    zombie.level = saved.level || 0;
    zombie.questGroup = saved.questGroup || null;
    zombie.siege = !!saved.siege;
    zombie.tx = saved.x;
    zombie.ty = saved.y;
  }
  if (data.cars)
    data.cars.forEach((saved, i) => {
      const car = city.cars[i];
      if (!car) return;
      car.fuel = saved.fuel;
      car.hp = saved.hp;
      car.heading = saved.heading;
      car.x = saved.x;
      car.y = saved.y;
      if (saved.trunk)
        car.trunk = { slots: saved.trunk, size: saved.trunk.length };
    });
  if (data.windows)
    for (const [key, values] of data.windows)
      city.brokenWindows.set(Number(key), new Set(values));
  if (data.wrecked)
    for (const key of [
      "lamps",
      "fences",
      "containers",
      "barrels",
      "benches",
      "tires",
    ])
      for (const index of data.wrecked[key] || [])
        if (city[key][index]) city[key][index].dead = true;
}
