import { clamp } from "../core/math.js";

export function maxHpFor(P) {
  return 120 + (P.lvl - 1) * 5 + P.skills.vit * 20;
}

export function maxStFor(P) {
  return 100 + P.skills.sta * 15;
}

export function playerSpeed(P, energyT) {
  return 64 * (1 + P.skills.sta * 0.04) * (energyT > 0 ? 1.25 : 1);
}

export function damageMultiplier(P, weapon) {
  let multiplier = 1;
  if (weapon === "bow" || weapon === "crossbow")
    multiplier += P.skills.archer * 0.08;
  else if (weapon) multiplier += P.skills.marksman * 0.07;
  return multiplier;
}

export function xpNeed(level) {
  return 40 + (level - 1) * 35;
}

export function threatForDay(day) {
  return clamp((day - 1) / 8, 0, 1);
}
