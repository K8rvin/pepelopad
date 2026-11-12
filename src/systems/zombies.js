import { ZT } from "../data/enemies.js";

export function createZombie(
  type,
  x,
  y,
  options,
  DIFF,
  threat,
  random = Math.random,
) {
  const definition = ZT[type];
  const distance = Math.hypot(Math.floor(x / 256), Math.floor(y / 256));
  const elite =
    options.elite !== undefined
      ? options.elite
      : distance > 8 && random() < 0.12 * threat;
  const hpMultiplier = DIFF.hp * (elite ? 1.5 : 1);
  const damageMultiplier = DIFF.dmg * (elite ? 1.25 : 1);

  return {
    type,
    x,
    y,
    r: definition.r,
    hp: definition.hp * hpMultiplier,
    max: definition.hp * hpMultiplier,
    spd: definition.spd * (elite ? 1.05 : 1),
    dmg: definition.dmg * damageMultiplier,
    xp: Math.round(definition.xp * (elite ? 1.5 : 1)),
    sight: definition.sight,
    cd: definition.cd,
    atk: 0,
    st: "wander",
    tx: x,
    ty: y,
    wt: random() * 2,
    mem: 0,
    elite,
    siege: !!options.siege,
    nest: options.nest || null,
    side: 0,
    sideT: 0,
    screamed: false,
    fleeT: 0,
    chargeT: 0,
    chargeCd: 0,
    spitCd: random() * 2,
    flash: 0,
    bob: random() * 6,
    vx: 0,
    vy: 0,
  };
}

export function shouldAttackStructure(result, zombie) {
  return result.hit?.kind === "struct" && zombie.st === "chase";
}
