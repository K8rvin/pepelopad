import { spawnZombie } from "./actors.js";
import { storySite } from "../world/storyLocations.js";
import { buildSolidIndex } from "../world/cityGen.js";

export function createSiege(saved = null) {
  return {
    active: false,
    finished: !!saved?.finished,
    wave: saved?.wave || 0,
    phase: saved?.phase || "idle",
    timer: 0,
    gateHp: saved?.gateHp ?? 100,
    gateMaxHp: saved?.gateMaxHp ?? 100,
    attempts: saved?.attempts || 0,
    gate: null,
  };
}

export function startSiege(siege, city, story, camps) {
  if (siege.active || siege.finished) return false;
  const motel = storySite(city, "motel");
  if (!motel) return false;
  siege.gateMaxHp =
    100 +
    (story.projects.includes("gate") ? 50 : 0) +
    (story.projects.includes("siege_gate") ? 80 : 0);
  siege.gateHp = siege.gateMaxHp;
  siege.gate = { x: motel.x + 15.5, y: motel.y + 20, w: 3, h: 0.35 };
  siege.active = true;
  siege.wave = 1;
  siege.phase = "combat";
  siege.attempts++;
  spawnWave(siege, city, story, camps);
  city.siegeGate = siege.gate;
  syncGate(siege, city);
  return true;
}

function spawnWave(siege, city, story, camps) {
  const site = storySite(city, "motel");
  const routeBonus = story.flags.route_cleared ? 1 : 0;
  const supplyBonus = story.flags.supply_route_ready ? 1 : 0;
  const school = camps.find((c) => c.id === "school");
  const allyBonus = (school?.trust || 0) >= 30 ? 1 : 0;
  const motel = camps.find((c) => c.id === "motel");
  const residentBonus = Math.min(
    2,
    Math.floor((motel?.rescued?.length || 0) / 2),
  );
  const noise = story.generatorOn ? 1 : 0;
  const base = [5, 7, 6][siege.wave - 1] || 6;
  const count = Math.max(
    3,
    base + noise - routeBonus - supplyBonus - allyBonus - residentBonus,
  );
  for (let i = 0; i < count; i++) {
    const x = site.x - 4 + (i % 4) * 2;
    const y = site.y + site.h + 24 + Math.floor(i / 4) * 2;
    const type =
      siege.wave === 3 && i === 0
        ? "brute"
        : siege.wave >= 2 && i % 3 === 0
          ? "runner"
          : "walker";
    const zombie = spawnZombie(city, x, y, type);
    if (!zombie) continue;
    zombie.questGroup = `motel_siege_${siege.wave}`;
    zombie.siege = true;
    zombie.tx = motel.x + 17;
    zombie.ty = motel.y + 20;
    zombie.alertT = 999;
  }
}

export function updateSiege(siege, city, dt, story, camps) {
  if (!siege.active) return null;
  if (siege.phase === "respite") {
    siege.timer -= dt;
    if (siege.timer <= 0) {
      siege.wave++;
      siege.phase = "combat";
      spawnWave(siege, city, story, camps);
      return { type: "wave", wave: siege.wave };
    }
    return null;
  }
  const gate = siege.gate;
  if (gate && siege.gateHp > 0) {
    for (const zombie of city.zombies) {
      if (zombie.dead || zombie.questGroup !== `motel_siege_${siege.wave}`)
        continue;
      const distance = Math.hypot(
        zombie.x - (gate.x + gate.w / 2),
        zombie.y - gate.y,
      );
      if (distance > 1.2) continue;
      zombie.gateAttackCd = (zombie.gateAttackCd || 0) - dt;
      if (zombie.gateAttackCd <= 0) {
        zombie.gateAttackCd = 1.1;
        siege.gateHp = Math.max(
          0,
          siege.gateHp - (zombie.type === "brute" ? 8 : 3),
        );
        zombie.attackT = 0.35;
      }
    }
    if (siege.gateHp <= 0) {
      for (const zombie of city.zombies) {
        if (zombie.dead || zombie.questGroup !== `motel_siege_${siege.wave}`)
          continue;
        zombie.siege = false;
        zombie.tx = gate.x + gate.w / 2;
        zombie.ty = gate.y - 8;
        zombie.alertT = 30;
        zombie.homeX = zombie.tx;
        zombie.homeY = zombie.ty;
      }
      syncGate(siege, city);
      return { type: "gateBroken" };
    }
  }
  const alive = city.zombies.some(
    (z) => !z.dead && z.questGroup === `motel_siege_${siege.wave}`,
  );
  if (alive) return null;
  if (siege.wave >= 3) {
    siege.active = false;
    siege.finished = true;
    siege.phase = "done";
    syncGate(siege, city);
    return { type: "defend", target: "motel_siege" };
  }
  siege.phase = "respite";
  siege.timer = 20;
  return { type: "respite", wave: siege.wave };
}

export function retrySiege(siege, city, story, camps) {
  if (!siege.active) return false;
  if (!siege.gate) {
    const motel = storySite(city, "motel");
    if (!motel) return false;
    siege.gate = { x: motel.x + 15.5, y: motel.y + 20, w: 3, h: 0.35 };
  }
  for (const zombie of city.zombies)
    if (zombie.questGroup === `motel_siege_${siege.wave}`) zombie.dead = true;
  siege.phase = "combat";
  siege.gateHp = siege.gateMaxHp;
  siege.timer = 0;
  spawnWave(siege, city, story, camps);
  syncGate(siege, city);
  return true;
}

function syncGate(siege, city) {
  if (!siege.gate) return;
  siege.gate.active = siege.active;
  siege.gate.hp = siege.gateHp;
  city.siegeGate = siege.gate;
  buildSolidIndex(city);
}
