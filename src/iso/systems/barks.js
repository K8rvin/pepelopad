import { mulberry32 } from "../core/rng.js";
import { NPC_BARKS, ZOMBIE_BARKS } from "../data/barks.js";
import { sayActor } from "../ui/comic.js";

export function createBarks(seed = 1) {
  return {
    rng: mulberry32(seed * 73 + 19),
    states: new WeakMap(),
    cooldown: 4,
  };
}

function stateFor(B, actor, npc) {
  let state = B.states.get(actor);
  if (state) return state;
  state = {
    nextIdle: (npc ? 18 : 24) + B.rng() * (npc ? 35 : 42),
    nearCd: 8 + B.rng() * 12,
    dangerCd: 0,
    hurtCd: 0,
    alertCd: 0,
    wasNear: false,
    wasDanger: false,
    alertT: actor.alertT || 0,
    hurtT: actor.hurtT || 0,
    summonCd: actor.summonCd ?? null,
    recent: {},
  };
  B.states.set(actor, state);
  return state;
}

function pick(B, state, key, lines) {
  if (!lines?.length) return null;
  const recent = (state.recent[key] ||= []);
  const available = lines.filter((line) => !recent.includes(line));
  const pool = available.length ? available : lines;
  const text = pool[Math.floor(B.rng() * pool.length)];
  recent.push(text);
  if (recent.length > Math.min(3, lines.length - 1)) recent.shift();
  return text;
}

function speak(B, comic, actor, state, key, lines, kind, urgent = false) {
  if (B.cooldown > 0) return false;
  const text = pick(B, state, key, lines);
  if (!text) return false;
  const ttl = Math.min(3.6, 1.9 + text.length * 0.025);
  sayActor(comic, actor, text, kind, ttl);
  B.cooldown = urgent ? 2.4 : 5 + B.rng() * 3;
  return true;
}

function nearPlayer(actor, player, radius) {
  return (
    (actor.level || 0) === (player.level || 0) &&
    Math.hypot(actor.x - player.x, actor.y - player.y) <= radius
  );
}

function updateZombie(B, comic, z, player, dt) {
  if (z.dead) {
    B.states.delete(z);
    return;
  }
  if (!nearPlayer(z, player, 17)) return;
  const def = ZOMBIE_BARKS[z.type || "walker"];
  if (!def) return;
  const state = stateFor(B, z, false);
  state.nextIdle -= dt;
  state.hurtCd = Math.max(0, state.hurtCd - dt);
  state.alertCd = Math.max(0, state.alertCd - dt);

  const summoned =
    z.type === "boss" &&
    state.summonCd !== null &&
    (z.summonCd ?? 0) > state.summonCd + 1;
  const hurt = (z.hurtT || 0) > 0 && state.hurtT <= 0;
  const alerted = (z.alertT || 0) > 0 && state.alertT <= 0;
  state.summonCd = z.summonCd ?? null;
  state.hurtT = z.hurtT || 0;
  state.alertT = z.alertT || 0;

  if (summoned) {
    speak(B, comic, z, state, "special", def.special, "alert", true);
    return;
  }
  if (hurt && state.hurtCd <= 0) {
    state.hurtCd = 6;
    if (B.rng() < 0.24)
      speak(B, comic, z, state, "hurt", def.hurt, "alert", true);
    return;
  }
  if (alerted && state.alertCd <= 0) {
    state.alertCd = 9;
    if (B.rng() < (z.type === "boss" ? 0.8 : 0.42))
      speak(B, comic, z, state, "alert", def.alert, "alert", true);
    return;
  }
  if ((z.alertT || 0) > 0 || state.nextIdle > 0) return;
  state.nextIdle = 30 + B.rng() * 38;
  if (B.rng() < 0.65) {
    const idle = z.type === "boss" ? def.idle : def.idle.concat(def.special);
    speak(B, comic, z, state, "idle", idle, "think");
  }
}

function updatePerson(B, comic, actor, player, threats, dt) {
  if (actor.hidden || actor.state === "dead" || !nearPlayer(actor, player, 11))
    return;
  const def = NPC_BARKS[actor.id];
  if (!def) return;
  const state = stateFor(B, actor, true);
  state.nextIdle -= dt;
  state.nearCd = Math.max(0, state.nearCd - dt);
  state.dangerCd = Math.max(0, state.dangerCd - dt);

  const danger = threats.some(
    (z) =>
      (z.level || 0) === (actor.level || 0) &&
      Math.hypot(z.x - actor.x, z.y - actor.y) < 8,
  );
  const near = Math.hypot(actor.x - player.x, actor.y - player.y) < 3.6;
  const dangerStarted = danger && !state.wasDanger;
  const nearStarted = near && !state.wasNear;
  state.wasDanger = danger;
  state.wasNear = near;

  if (dangerStarted && state.dangerCd <= 0) {
    state.dangerCd = 18;
    speak(B, comic, actor, state, "danger", def.danger, "alert", true);
    return;
  }
  if (nearStarted && state.nearCd <= 0) {
    state.nearCd = 28;
    speak(B, comic, actor, state, "near", def.near, "say");
    return;
  }
  if (state.nextIdle > 0 || danger) return;
  state.nextIdle = 35 + B.rng() * 35;
  const personal = B.rng() < 0.4;
  speak(
    B,
    comic,
    actor,
    state,
    personal ? "personal" : "idle",
    personal ? def.personal : def.idle,
    "say",
  );
}

export function updateBarks(
  B,
  comic,
  { zombies = [], npcs = [], survivors = [], player },
  dt,
) {
  if (!player || dt <= 0) return;
  B.cooldown = Math.max(0, B.cooldown - dt);
  const threats = [];
  for (const z of zombies) {
    updateZombie(B, comic, z, player, dt);
    if (!z.dead && (z.alertT || 0) > 0 && nearPlayer(z, player, 20))
      threats.push(z);
  }
  for (const npc of npcs) updatePerson(B, comic, npc, player, threats, dt);
  for (const survivor of survivors) {
    const twin = npcs.find((npc) => npc.id === survivor.id && !npc.hidden);
    if (!twin) updatePerson(B, comic, survivor, player, threats, dt);
  }
}
