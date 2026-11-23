import { SURVIVORS } from "../data/survivors.js";
import { storyPoint } from "../world/storyLocations.js";
import { conditionMatches } from "./story.js";
import { moveActor } from "./actors.js";
import { buildingAtPoint, getInterior } from "../world/interiors.js";

export function createSurvivors(city, saved = null) {
  return SURVIVORS.flatMap((def) => {
    const point = storyPoint(city, def);
    if (!point) return [];
    const old = saved?.find((s) => s.id === def.id);
    return [
      {
        ...def,
        x: old?.x ?? point.x,
        y: old?.y ?? point.y,
        level: old?.level || 0,
        r: 0.32,
        hp: old?.hp ?? def.hp ?? 60,
        maxHp: def.hp ?? 60,
        state: old?.state || "stranded",
        campId: old?.campId || null,
        hidden: true,
        moving: false,
        walkPh: old?.walkPh || 0,
      },
    ];
  });
}

export function survivorVisible(survivor, ctx) {
  if (["following", "waiting", "rescued", "dead"].includes(survivor.state))
    return true;
  return conditionMatches(survivor.when, ctx);
}

export function syncSurvivors(survivors, ctx) {
  for (const survivor of survivors)
    survivor.hidden = !survivorVisible(survivor, ctx);
}

export function survivorNear(survivors, x, y, radius = 2.2) {
  let best = null;
  let distance = radius;
  for (const survivor of survivors) {
    if (survivor.hidden || ["rescued", "dead"].includes(survivor.state))
      continue;
    const d = Math.hypot(survivor.x - x, survivor.y - y);
    if (d < distance) {
      best = survivor;
      distance = d;
    }
  }
  return best;
}

export function toggleSurvivor(survivor) {
  if (!survivor || ["rescued", "dead"].includes(survivor.state)) return false;
  survivor.state = survivor.state === "following" ? "waiting" : "following";
  survivor.leftNotified = false;
  return survivor.state;
}

export function followingSurvivor(survivors) {
  return survivors.find((s) => s.state === "following") || null;
}

export function hurtSurvivor(survivor, damage) {
  if (!survivor || ["dead", "rescued"].includes(survivor.state)) return false;
  survivor.hp = Math.max(0, survivor.hp - damage);
  if (survivor.hp > 0) return false;
  survivor.state = "dead";
  survivor.moving = false;
  return true;
}

function rescueDestination(def, camp) {
  return !def.destinations || def.destinations.includes(camp.id);
}

export function updateSurvivors(
  survivors,
  city,
  player,
  camps,
  dt,
  inCar = false,
) {
  const events = [];
  for (const survivor of survivors) {
    if (survivor.hidden) continue;
    if (survivor.state === "rescued") {
      const camp = camps.find((c) => c.id === survivor.campId);
      if (camp) {
        const index = camp.rescued?.indexOf(survivor.id) || 0;
        survivor.x = camp.x - 2 + Math.max(0, index) * 1.4;
        survivor.y = camp.y + 3;
      }
      continue;
    }
    if (survivor.state !== "following") continue;
    if (inCar) {
      survivor.state = "waiting";
      survivor.leftNotified = true;
      events.push({ type: "leftBehind", survivor });
      continue;
    }
    let tx = player.x;
    let ty = player.y;
    const pb = buildingAtPoint(city, player.x, player.y);
    const sb = buildingAtPoint(city, survivor.x, survivor.y);
    if (pb && sb !== pb) {
      const interior = getInterior(city, pb);
      tx = pb.x + interior.doorU;
      ty = pb.y + pb.h + 0.7;
    } else if (pb && survivor.detourT > 0) {
      const interior = getInterior(city, pb);
      tx = pb.x + pb.w / 2;
      ty = pb.y + (interior.corrA + interior.corrB) / 2;
    }
    survivor.detourT = Math.max(0, (survivor.detourT || 0) - dt);
    const dx = tx - survivor.x;
    const dy = ty - survivor.y;
    const distance = Math.hypot(dx, dy);
    const playerDistance = Math.hypot(
      player.x - survivor.x,
      player.y - survivor.y,
    );
    if (playerDistance > 25) {
      survivor.state = "waiting";
      survivor.leftNotified = true;
      events.push({ type: "leftBehind", survivor });
      continue;
    }
    survivor.moving = false;
    if (distance > 1.6) {
      const ox = survivor.x;
      const oy = survivor.y;
      const step = Math.min(3.6 * dt, distance);
      moveActor(city, survivor, (dx / distance) * step, (dy / distance) * step);
      const moved = Math.hypot(survivor.x - ox, survivor.y - oy);
      survivor.moving = moved > 0.0001;
      survivor.walkPh += Math.min(moved, 0.1) * Math.PI;
      if (moved < 0.005 && sb) {
        survivor.stuck = (survivor.stuck || 0) + dt;
        if (survivor.stuck > 0.5) {
          survivor.detourT = 1.3;
          survivor.stuck = 0;
        }
      } else survivor.stuck = 0;
    }
    for (const camp of camps) {
      if (!rescueDestination(survivor, camp)) continue;
      if (Math.hypot(survivor.x - camp.x, survivor.y - camp.y) > 6) continue;
      survivor.state = "rescued";
      survivor.campId = camp.id;
      camp.rescued ||= [];
      if (!camp.rescued.includes(survivor.id)) camp.rescued.push(survivor.id);
      events.push({ type: "rescue", survivor, camp });
      break;
    }
  }
  return events;
}
