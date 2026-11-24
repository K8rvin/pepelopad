import { npcWeaponDef } from "../data/weapons.js";
import { buildingAtPoint } from "../world/interiors.js";
import { alertNear, faceDir, moveActor } from "./actors.js";
import { hitZombieMelee } from "./combat.js";

export const DEFENSE_RANGE = 6;
const DEFENSE_SPEED = 1.6;

function clearTarget(actor) {
  actor.defending = false;
  actor.defenseTarget = null;
  actor.defenseAnchor = null;
}

function nearPlayer(actor, player) {
  return (
    !player || Math.abs(actor.x - player.x) + Math.abs(actor.y - player.y) <= 80
  );
}

function sameSpace(city, actor, z) {
  return (
    (actor.level || 0) === (z.level || 0) &&
    buildingAtPoint(city, actor.x, actor.y) === buildingAtPoint(city, z.x, z.y)
  );
}

function validTarget(actor, z, city) {
  if (!z || z.dead || !sameSpace(city, actor, z)) return false;
  const anchor = actor.defenseAnchor;
  return !anchor || Math.hypot(z.x - anchor.x, z.y - anchor.y) <= DEFENSE_RANGE;
}

function nearestTarget(actor, city) {
  let best = null;
  let bestDistance = DEFENSE_RANGE;
  for (const z of city.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - actor.x, z.y - actor.y);
    if (d >= bestDistance || !sameSpace(city, actor, z)) continue;
    best = z;
    bestDistance = d;
  }
  return best;
}

function updateActor(actor, city, combat, dt, eligible) {
  const wasDefending = actor.defending;
  actor.meleeCd = Math.max(0, (actor.meleeCd || 0) - dt);
  actor.swingT = Math.max(0, (actor.swingT || 0) - dt);
  actor.hurtT = Math.max(0, (actor.hurtT || 0) - dt);
  actor.defenseScanT = Math.max(0, (actor.defenseScanT || 0) - dt);
  if (!eligible) {
    clearTarget(actor);
    if (wasDefending) actor.moving = false;
    return;
  }
  let target = actor.defenseTarget;
  if (!validTarget(actor, target, city)) {
    const hadTarget = !!target;
    clearTarget(actor);
    target = null;
    if (hadTarget || actor.defenseScanT <= 0) {
      target = nearestTarget(actor, city);
      actor.defenseScanT = 0.18 + (actor.id.charCodeAt(0) % 4) * 0.025;
    }
    if (target) {
      actor.defenseTarget = target;
      actor.defenseAnchor = { x: actor.x, y: actor.y };
    }
  }
  if (!target) {
    if (wasDefending) actor.moving = false;
    return;
  }
  const weapon = npcWeaponDef(actor.weapon);
  actor.defending = true;
  const dx = target.x - actor.x,
    dy = target.y - actor.y;
  const d = Math.hypot(dx, dy);
  const f = faceDir((dx - dy) * 32, (dx + dy) * 16, actor.face, actor.dir);
  actor.face = f.face;
  actor.dir = f.dir;
  actor.moving = false;
  if (d > weapon.range * 0.8) {
    const ox = actor.x,
      oy = actor.y;
    const step = Math.min(DEFENSE_SPEED * dt, d);
    moveActor(city, actor, (dx / d) * step, (dy / d) * step);
    const moved = Math.hypot(actor.x - ox, actor.y - oy);
    actor.moving = moved > 0.0001;
    actor.walkPh = (actor.walkPh || 0) + Math.min(moved, 0.1) * Math.PI;
  }
  if (d > weapon.range + 0.35 || actor.meleeCd > 0) return;
  actor.meleeCd = weapon.cd;
  actor.swingT = 0.22;
  actor.swingWeapon = weapon.id;
  actor.swingAng = Math.atan2(dy, dx);
  hitZombieMelee(combat, actor, target, weapon, "npc");
  alertNear(city, actor.x, actor.y, weapon.noise);
}

export function updateDefense({
  city,
  player = null,
  npcs = [],
  survivors = [],
  combat,
  dt,
  dialogueNpc = null,
}) {
  for (const n of npcs)
    updateActor(
      n,
      city,
      combat,
      dt,
      nearPlayer(n, player) &&
        !n.hidden &&
        n.id !== dialogueNpc &&
        !!npcWeaponDef(n.weapon),
    );
  for (const s of survivors) {
    const hasNpcDouble = npcs.some((n) => n.id === s.id && !n.hidden);
    const eligible =
      nearPlayer(s, player) &&
      !s.hidden &&
      s.state !== "dead" &&
      ["following", "waiting", "rescued"].includes(s.state) &&
      !hasNpcDouble &&
      !!npcWeaponDef(s.weapon);
    updateActor(s, city, combat, dt, eligible);
  }
}
