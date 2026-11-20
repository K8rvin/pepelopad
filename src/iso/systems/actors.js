// Движение и простейшее поведение: WASD от экрана (в изометрии экранная ось =
// диагональ мира), зомби бродят и идут к игроку вблизи. Коллизии через solidGrid.
// Случайность поведения — seeded RNG (не глобальный Math.random).
import { clamp, mulberry32 } from "../core/rng.js";
import { solidRectAt } from "../world/cityGen.js";
import { buildingAtPoint, getInterior } from "../world/interiors.js";
import { ZTYPES, ZOMBIE_CAP } from "../data/zombies.js";

let rng = mulberry32(1);
export function initActors(seed) {
  rng = mulberry32(seed);
}

export function moveActor(city, a, dx, dy) {
  const lvl = a.level || 0;
  if (!solidRectAt(city, a.x + dx, a.y, a.r, null, lvl)) a.x += dx;
  if (!solidRectAt(city, a.x, a.y + dy, a.r, null, lvl)) a.y += dy;
  a.x = clamp(a.x, 1, city.SIZE - 1);
  a.y = clamp(a.y, 1, city.SIZE - 1);
}

export function updatePlayer(
  city,
  player,
  keys,
  dt,
  mods = null,
  onMove = null,
) {
  const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const iy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  if (ix || iy) {
    const run = !!keys.ShiftLeft;
    const sp = (run ? 5.4 : 3.2) * (mods?.speedK ?? 1) * dt;
    const wx = ix + iy,
      wy = iy - ix;
    const n = Math.hypot(wx, wy);
    moveActor(city, player, (wx / n) * sp, (wy / n) * sp);
    player.animT += dt * 7;
    player.pose = Math.floor(player.animT) % 2;
    onMove?.(sp, run);
  }
}

// спавн зомби типа: переиспользует мёртвых (капа популяции), иначе push
export function spawnZombie(city, x, y, type = "walker") {
  const t = ZTYPES[type] || ZTYPES.walker;
  let z = city.zombies.find((k) => k.dead);
  if (!z) {
    if (city.zombies.length >= ZOMBIE_CAP) return null;
    z = {};
    city.zombies.push(z);
  }
  z.x = x;
  z.y = y;
  z.r = 0.35;
  z.type = type;
  z.hp = t.hp;
  z.dead = false;
  z.pose = 0;
  z.animT = rng() * 5;
  z.tx = x;
  z.ty = y;
  z.retarget = 0;
  z.alertT = 0;
  z.homeX = x;
  z.homeY = y;
  return z;
}

// тревога: цель + таймер; стадность разнесёт её по соседям в updateZombies
export function alertZombie(z, x, y, t = 6) {
  z.tx = x;
  z.ty = y;
  z.alertT = t;
  z.propagated = false;
}

export function alertNear(city, x, y, radius, t = 6) {
  for (const z of city.zombies) {
    if (z.dead) continue;
    if (Math.hypot(z.x - x, z.y - y) < radius) alertZombie(z, x, y, t);
  }
}

export function updateZombies(city, zombies, player, dt, speedK = 1) {
  const night = speedK > 1;
  for (const z of zombies) {
    if (z.dead) continue;
    // дальние зомби спят (не видны на экране)
    if (Math.abs(z.x - player.x) + Math.abs(z.y - player.y) > 80) continue;
    const t = ZTYPES[z.type || "walker"];
    z.retarget -= dt;
    if (z.alertT > 0) {
      z.alertT -= dt;
      // стадность: свежеиспечённая тревога заражает соседей в 5 м
      if (!z.propagated) {
        z.propagated = true;
        for (const o of zombies) {
          if (o === z || o.dead || o.alertT > 0) continue;
          if (Math.hypot(o.x - z.x, o.y - z.y) < 5)
            alertZombie(o, z.tx, z.ty, 4);
        }
      }
    }
    const dp = Math.hypot(player.x - z.x, player.y - z.y);
    const chaseR = night ? t.chaseNight : t.chaseDay;
    if (dp < chaseR) {
      // цель ведём постоянно, но тревогу (и её распространение) запускаем один раз
      if (z.alertT <= 0) alertZombie(z, player.x, player.y, 6);
      else {
        z.tx = player.x;
        z.ty = player.y;
      }
    } else if (z.alertT <= 0 && z.retarget <= 0) {
      z.retarget = 2 + rng() * 4;
      // поводок: блуждают вокруг точки спавна, не стекаются со временем
      const hx = z.homeX ?? z.x,
        hy = z.homeY ?? z.y;
      z.tx = clamp(hx + (rng() - 0.5) * 24, 2, city.SIZE - 2);
      z.ty = clamp(hy + (rng() - 0.5) * 24, 2, city.SIZE - 2);
    }
    // Матка призывает ходоков каждые summonCd секунд
    if (t.summonCd) {
      z.summonCd = (z.summonCd ?? t.summonCd) - dt;
      if (z.summonCd <= 0) {
        z.summonCd = t.summonCd;
        for (let i = 0; i < 2; i++)
          spawnZombie(
            city,
            clamp(z.x + (rng() - 0.5) * 6, 2, city.SIZE - 2),
            clamp(z.y + (rng() - 0.5) * 6, 2, city.SIZE - 2),
            "walker",
          );
      }
    }
    // навигация в зданиях: снаружи — к двери, внутри при застревании — через
    // коридор; лестницы поднимают зомби за игроком на его этаж
    let tx = z.tx,
      ty = z.ty;
    const zb = buildingAtPoint(city, z.x, z.y);
    const pb = buildingAtPoint(city, player.x, player.y);
    const sameLvl = (z.level || 0) === (player.level || 0);
    if (pb) {
      const it = getInterior(city, pb);
      // лестницы поднимают зомби за игроком даже при разных этажах
      if (it.stairs && (player.level || 0) > (z.level || 0)) {
        const sx = pb.x + it.stairs.x + it.stairs.w / 2,
          sy = pb.y + it.stairs.y + it.stairs.h / 2;
        if (Math.hypot(z.x - sx, z.y - sy) < 1.5) z.level = player.level;
      }
      if (sameLvl) {
        const doorX = pb.x + it.doorU,
          doorY = pb.y + pb.h;
        if (zb !== pb) {
          if (Math.hypot(z.x - doorX, z.y - doorY) > 1.2) {
            tx = doorX;
            ty = doorY + 0.6;
          }
        } else if (z.detourT > 0) {
          tx = pb.x + pb.w / 2;
          ty = pb.y + (it.corrA + it.corrB) / 2;
        }
      }
    }
    if (z.detourT > 0) z.detourT -= dt;
    const dx = tx - z.x,
      dy = ty - z.y,
      d = Math.hypot(dx, dy);
    const moved = Math.hypot(z.x - (z.px ?? z.x), z.y - (z.py ?? z.y));
    if (d > 0.3) {
      moveActor(
        city,
        z,
        (dx / d) * t.speed * speedK * dt,
        (dy / d) * t.speed * speedK * dt,
      );
      z.animT += dt * 4 * speedK;
      z.pose = Math.floor(z.animT) % 2;
      if (moved < 0.01 && zb) {
        z.stuck = (z.stuck || 0) + dt;
        if (z.stuck > 0.5) {
          z.detourT = 1.2;
          z.stuck = 0;
        }
      } else z.stuck = 0;
    }
    z.px = z.x;
    z.py = z.y;
  }
}
