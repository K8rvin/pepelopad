import { WEAPONS } from "../data/weapons.js";

export function getReloadTime(weapon, skills) {
  let time = weapon.rl * (1 - skills.reload * 0.06);
  if (weapon.auto) time *= 1 - skills.archer * 0.06;
  return time;
}

export function createShotProjectiles({
  x,
  y,
  aim,
  weaponId,
  damageMultiplier,
  random = Math.random,
}) {
  const weapon = WEAPONS[weaponId];
  const projectiles = [];

  for (let i = 0; i < weapon.pellets; i++) {
    const spread =
      (random() - 0.5) * 2 * weapon.spread +
      (weapon.pellets > 1
        ? (i - (weapon.pellets - 1) / 2) * weapon.spread * 0.7
        : 0);
    const angle = aim + spread;
    projectiles.push({
      x: x + Math.cos(aim) * 10,
      y: y + Math.sin(aim) * 10,
      vx: Math.cos(angle) * weapon.spd,
      vy: Math.sin(angle) * weapon.spd,
      dmg: weapon.dmg * damageMultiplier,
      type: weaponId === "bow" ? "arrow" : weaponId,
      from: "p",
      life: weapon.pellets > 1 ? 0.34 : 0.95,
      pierce: weapon.pierce,
      hit: new Set(),
    });
  }

  return projectiles;
}
