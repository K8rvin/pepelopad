import { solidInteriorAt } from "../world/interiors.js";

export function noiseProfile(player) {
  const crouched = !!player.crouched;
  const moving = !!player.moving;
  const sprinting = !crouched && moving && !!player.sprinting;
  return {
    crouched,
    moving,
    sprinting,
    noiseRadius: crouched
      ? moving
        ? 2
        : 0.8
      : sprinting
        ? 9
        : moving
          ? 4
          : 1.5,
    visionK: crouched ? 0.6 : sprinting ? 1.25 : 1,
  };
}

export function hasLineOfSight(city, from, to) {
  const level = from.level || 0;
  if (level !== (to.level || 0)) return false;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.2) return true;
  const steps = Math.ceil(d / 0.25);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solidInteriorAt(city, from.x + dx * t, from.y + dy * t, 0.03, level))
      return false;
  }
  return true;
}
