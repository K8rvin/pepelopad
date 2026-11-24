// Движение и простейшее поведение: WASD от экрана (в изометрии экранная ось =
// диагональ мира), зомби бродят и идут к игроку или людям вблизи. Коллизии через solidGrid.
// Случайность поведения — seeded RNG (не глобальный Math.random).
import { clamp, mulberry32 } from "../core/rng.js";
import { solidRectAt } from "../world/cityGen.js";
import { buildingAtPoint, getInterior } from "../world/interiors.js";
import { ZTYPES, ZOMBIE_CAP } from "../data/zombies.js";

let rng = mulberry32(1);
export function initActors(seed) {
  rng = mulberry32(seed);
}

// метров на полный цикл походки (два шага): фаза считается от дистанции,
// поэтому бег мельтешит чаще ходьбы, а стояние на месте не анимируется
export const STRIDE = 2.0;

// Экранный курс с мёртвой зоной и гистерезисом. При строгом W/S экранный
// sdx = dx−dy ≈ 0 (шум округления ±1e-16): без мёртвой зоны знак шума
// зеркалит спрайт каждый кадр, без гистерезиса дребезжит набор кадров.
export function faceDir(sdx, sdy, prevFace = 1, prevDir = "right") {
  const ax = Math.abs(sdx),
    ay = Math.abs(sdy);
  let dir = prevDir;
  if (ax > ay * 1.2) dir = sdx >= 0 ? "right" : "left";
  else if (ay > ax * 1.2) dir = sdy >= 0 ? "down" : "up";
  const face = ax > 1e-4 ? (sdx >= 0 ? 1 : -1) : prevFace;
  return { face, dir };
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
  player.moving = !!(ix || iy);
  if (ix || iy) {
    // спринт тратит стамину; на нуле — истощение, пока не восстановится >30
    const run =
      !!keys.ShiftLeft && !player.exhausted && (player.stamina ?? 100) > 0;
    player.stamina = Math.max(
      0,
      Math.min(100, (player.stamina ?? 100) + (run ? -22 : 9) * dt),
    );
    if (player.stamina <= 0) player.exhausted = true;
    if (player.exhausted && player.stamina > 30) player.exhausted = false;
    const sp = (run ? 5.4 : 3.2) * (mods?.speedK ?? 1) * dt;
    const wx = ix + iy,
      wy = iy - ix;
    const n = Math.hypot(wx, wy);
    const ox = player.x,
      oy = player.y;
    moveActor(city, player, (wx / n) * sp, (wy / n) * sp);
    // фаза шага от реальной дистанции: упёрся в стену — походка не мельтешит
    const step = Math.hypot(player.x - ox, player.y - oy);
    player.moving = step > 1e-4;
    // экранный курс (sx=(x−y)·32, sy=(x+y)·16): направление для покадровых
    // походок (профиль/фронт/спина) и зеркаления профиля
    if (player.moving) {
      const sdx = player.x - ox - (player.y - oy);
      const sdy = player.x - ox + (player.y - oy);
      const fd = faceDir(sdx, sdy, player.face, player.dir);
      player.face = fd.face;
      player.dir = fd.dir;
    }
    // кламп приращения фазы: скачок dt (запечка чанка) не должен мельтешить кадры
    player.walkPh =
      (player.walkPh || 0) + (Math.min(step, 0.1) / STRIDE) * Math.PI * 2;
    player.animT += dt * 7;
    player.pose = Math.floor(player.animT) % 2;
    onMove?.(sp, run);
  } else {
    player.stamina = Math.min(100, (player.stamina ?? 100) + 14 * dt);
    if (player.exhausted && player.stamina > 30) player.exhausted = false;
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
  z.walkPh = rng() * Math.PI * 2; // разнобой походки в стае
  z.tx = x;
  z.ty = y;
  z.retarget = 0;
  z.alertT = 0;
  z.questGroup = null;
  z.siege = false;
  z.winding = false;
  z.attackCd = 0;
  z.level = 0;
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

export function updateZombies(
  city,
  zombies,
  player,
  dt,
  speedK = 1,
  inCar = false,
  survivors = [],
  npcs = [],
) {
  const night = speedK > 1;
  for (const z of zombies) {
    if (z.dead) continue;
    z.hurtT = Math.max(0, (z.hurtT || 0) - dt);
    z.attackT = Math.max(0, (z.attackT || 0) - dt);
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
    let target = player;
    let dp = Math.hypot(player.x - z.x, player.y - z.y);
    for (const survivor of survivors) {
      if (survivor.hidden || !["following", "waiting"].includes(survivor.state))
        continue;
      const sd = Math.hypot(survivor.x - z.x, survivor.y - z.y);
      if (sd < dp && sd < 18) {
        target = survivor;
        dp = sd;
      }
    }
    for (const n of npcs) {
      if (n.hidden || (n.level || 0) !== (z.level || 0)) continue;
      const nd = Math.hypot(n.x - z.x, n.y - z.y);
      if (nd < dp && nd < 18) {
        target = n;
        dp = nd;
      }
    }
    const gate = city.siegeGate;
    const gateDistance = gate
      ? Math.hypot(gate.x + gate.w / 2 - z.x, gate.y - z.y)
      : Infinity;
    if (z.siege && gate?.active && gate.hp > 0 && gateDistance > 1.0) {
      z.tx = gate.x + gate.w / 2;
      z.ty = gate.y;
      target = { x: z.tx, y: z.ty, level: 0 };
      dp = 0;
    }
    const chaseR = night ? t.chaseNight : t.chaseDay;
    if (dp < chaseR) {
      // цель ведём постоянно, но тревогу (и её распространение) запускаем один раз
      if (z.alertT <= 0) alertZombie(z, target.x, target.y, 6);
      else {
        z.tx = target.x;
        z.ty = target.y;
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
    const pb = buildingAtPoint(city, target.x, target.y);
    const sameLvl = (z.level || 0) === (target.level || 0);
    if (pb) {
      const it = getInterior(city, pb);
      // лестницы поднимают зомби за игроком даже при разных этажах
      if (it.stairs && (target.level || 0) > (z.level || 0)) {
        const sx = pb.x + it.stairs.x + it.stairs.w / 2,
          sy = pb.y + it.stairs.y + it.stairs.h / 2;
        if (Math.hypot(z.x - sx, z.y - sy) < 1.5) z.level = target.level;
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
    // moved — смещение ЗА ЭТОТ кадр (до/после moveActor): раньше сравнивалось
    // с px/py конца прошлого кадра и всегда было 0 → зомби «скользили» без
    // походки, а детектор застревания в зданиях срабатывал постоянно
    let moved = 0;
    if (d > 0.3) {
      const ox = z.x,
        oy = z.y;
      moveActor(
        city,
        z,
        (dx / d) * t.speed * speedK * dt,
        (dy / d) * t.speed * speedK * dt,
      );
      moved = Math.hypot(z.x - ox, z.y - oy);
      if (moved > 1e-4) {
        const sdx = z.x - ox - (z.y - oy);
        const sdy = z.x - ox + (z.y - oy);
        const fd = faceDir(sdx, sdy, z.face, z.dir);
        z.face = fd.face;
        z.dir = fd.dir;
      }
      z.walkPh =
        (z.walkPh || 0) + (Math.min(moved, 0.1) / STRIDE) * Math.PI * 2;
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
    z.moving = d > 0.3 && moved > 0.001;
  }
}
