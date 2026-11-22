// Бой (спроектирован заново для изометрии, не порт старой игры).
// Лук: ЛКМ удерживать — натяжение (0→1 за 0.8 с), отпустить — выстрел.
// Стрела летит в мировых координатах, тихая; шум слышат зомби в 8 м.
// Зомби: кусают в контакте с кулдауном; урон игроку; кровь; смерть.
import { mulberry32 } from "../core/rng.js";
import { countItem, removeItem } from "./inventory.js";
import { ZTYPES } from "../data/zombies.js";
import { solidInteriorAt } from "../world/interiors.js";
import { moveActor } from "./actors.js";

let rng = mulberry32(7);
export function initCombat(seed) {
  rng = mulberry32(seed * 17 + 3);
}

export function createCombat() {
  return {
    playerHp: 100,
    playerMaxHp: 100,
    arrows: [], // {x, y, dx, dy, dist, alive}
    blood: [], // {x, y, r, t}
    corpses: [], // {x, y, t, pose}
    debris: [], // {x, y, vx, vy, t, col} — обломки снесённых объектов
    bowCharge: 0, // 0..1
    bowDrawing: false,
    releaseT: 0, // кадр отпускания тетивы после выстрела
    stuck: [], // {x, y, dx, dy, t, ttl} — воткнутые в мир стрелы
    meleeCd: 0, // кулдаун ближнего удара
    swingT: 0, // анимация замаха
    swingAng: 0, // курсор удара (мировой угол)
    hurtFlash: 0,
    shake: 0,
    dead: false,
    deadT: 0,
    kills: 0,
  };
}

export const FLIGHT_H = 0.9; // высота полёта стрелы, м (и прицеливания)
const BOW_CHARGE_TIME = 0.8;
const ARROW_SPEED = 35; // м/с
const ARROW_RANGE = 26; // м
const ZOMBIE_HP = 70;
const ZOMBIE_DMG = 9;
const ZOMBIE_ATTACK_CD = 1.2;

// цель в мировых координатах от мыши: инверсия на высоте полёта стрелы,
// а не на земле — иначе прицел в тело зомби систематически уводит стрелу вверх.
export function screenToWorld(mx, my, camS, W, H, zoom) {
  const sx = (mx - W / 2) / zoom + camS.x;
  const sy = (my - H / 2) / zoom + camS.y + FLIGHT_H * 32;
  return { x: sx / 64 + sy / 32, y: sy / 32 - sx / 64 };
}

export function updateCombat(
  C,
  city,
  player,
  aim,
  dt,
  now,
  protectedFlag = false,
  mods = null,
) {
  if (C.dead) {
    C.deadT += dt;
    return;
  }
  // натяжение лука (ловкость ускоряет)
  if (C.bowDrawing)
    C.bowCharge = Math.min(
      1,
      C.bowCharge + dt / (BOW_CHARGE_TIME * (mods?.chargeK ?? 1)),
    );
  // стрелы: подшаги ≤0,25 м — тонкие стены не проскакиваются за кадр
  const level = player.level || 0;
  for (const a of C.arrows) {
    if (!a.alive) continue;
    const move = ARROW_SPEED * dt;
    const n = Math.max(1, Math.ceil(move / 0.25));
    const sx = (a.dx * move) / n,
      sy = (a.dy * move) / n;
    for (let i = 0; i < n && a.alive; i++) {
      const nx = a.x + sx,
        ny = a.y + sy;
      a.dist += move / n;
      // стены и перегородки с проёмами дверей/разбитых окон; внутри здания
      // стрела летит свободно, пока не упёрлась в стену или мебель
      if (a.dist > ARROW_RANGE || solidInteriorAt(city, nx, ny, 0.05, level)) {
        a.alive = false;
        // воткнулась в стену/предмет — остаётся торчать (не на излёте дистанции)
        if (a.dist <= ARROW_RANGE)
          C.stuck.push({ x: nx, y: ny, dx: a.dx, dy: a.dy, t: 0, ttl: 30 });
        break;
      }
      // попадание: отрезок стрелы (на высоте 0,9 м) против экранного силуэта
      // зомби (колонка от ног до головы) — целимся в тело, а не в ноги
      for (const z of city.zombies) {
        if (z.dead) continue;
        if ((z.level || 0) !== level) continue;
        const zs = ZTYPES[z.type || "walker"].scale;
        const zx = (z.x - z.y) * 32,
          zy = (z.x + z.y) * 16;
        const ax = (a.x - a.y) * 32,
          ay = (a.x + a.y) * 16 - FLIGHT_H * 32;
        const bx = (nx - ny) * 32,
          by = (nx + ny) * 16 - FLIGHT_H * 32;
        if (
          segHitsRect(
            ax,
            ay,
            bx,
            by,
            zx - 16 * zs,
            zy - 74 * zs,
            zx + 16 * zs,
            zy,
          )
        ) {
          a.alive = false;
          C.onHit?.();
          // стрела остаётся в теле зомби (движется вместе с ним), временно
          (z.arrows ||= []).push({
            dx: a.dx,
            dy: a.dy,
            ox: nx - z.x,
            oy: ny - z.y,
            t: 0,
            ttl: 8,
          });
          hurtZombie(
            C,
            z,
            Math.round((34 + Math.floor(rng() * 17)) * (mods?.bowDmgK ?? 1)),
            a,
          );
          break;
        }
      }
      a.x = nx;
      a.y = ny;
    }
  }
  C.arrows = C.arrows.filter((a) => a.alive);
  // зомби атакуют
  if (!protectedFlag)
    for (const z of city.zombies) {
      if (z.dead) continue;
      if ((z.level || 0) !== (player.level || 0)) continue;
      const d = Math.hypot(z.x - player.x, z.y - player.y);
      if (d < 0.7) {
        z.attackCd = (z.attackCd || 0) - dt;
        if (z.attackCd <= 0) {
          z.attackCd = ZOMBIE_ATTACK_CD;
          z.attackT = 0.3; // кадр атаки/укуса
          C.playerHp -= ZTYPES[z.type || "walker"].dmg + Math.floor(rng() * 5);
          C.hurtFlash = 1;
          C.shake = 6;
          C.onHurt?.();
          if (C.playerHp <= 0) {
            C.playerHp = 0;
            C.dead = true;
            C.deadT = 0;
          }
        }
        // толкаем игрока слегка — только через коллизии, иначе вминает в перегородки
        const push = 0.4 * dt;
        moveActor(
          city,
          player,
          ((player.x - z.x) / Math.max(d, 0.01)) * push,
          ((player.y - z.y) / Math.max(d, 0.01)) * push,
        );
      }
    }
  // затухание эффектов
  C.hurtFlash = Math.max(0, C.hurtFlash - dt * 2.2);
  C.shake = Math.max(0, C.shake - dt * 18);
  C.noArrowsT = Math.max(0, (C.noArrowsT || 0) - dt);
  C.releaseT = Math.max(0, (C.releaseT || 0) - dt);
  C.meleeCd = Math.max(0, (C.meleeCd || 0) - dt);
  C.swingT = Math.max(0, (C.swingT || 0) - dt);
  for (const s of C.stuck) s.t += dt;
  C.stuck = C.stuck.filter((s) => s.t < s.ttl);
  for (const z of city.zombies)
    if (z.arrows) {
      for (const s of z.arrows) s.t += dt;
      z.arrows = z.arrows.filter((s) => s.t < s.ttl);
    }
  // кровь и трупы
  for (const b of C.blood) b.t += dt;
  C.blood = C.blood.filter((b) => b.t < 60);
  for (const c of C.corpses) c.t += dt;
  C.corpses = C.corpses.filter((c) => c.t < 6);
  for (const d of C.debris) {
    d.t += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= 0.9;
    d.vy *= 0.9;
  }
  C.debris = C.debris.filter((d) => d.t < 0.8);
}

function hurtZombie(C, z, dmg, arrow) {
  z.hp = (z.hp ?? ZOMBIE_HP) - dmg;
  z.hurtT = 0.3; // кадр получения урона
  // отброс по направлению стрелы (громилы и Матка почти не сдвигаются)
  const knock = 0.35 * ZTYPES[z.type || "walker"].knock;
  z.x += arrow.dx * knock;
  z.y += arrow.dy * knock;
  // зомби слышит/чует и идёт к источнику
  z.tx = arrow.x - arrow.dx * 2;
  z.ty = arrow.y - arrow.dy * 2;
  z.retarget = 0;
  C.blood.push({ x: z.x, y: z.y, r: 0.5 + rng() * 0.5, t: 0 });
  if (z.hp <= 0) {
    z.dead = true;
    C.kills++;
    C.corpses.push({ x: z.x, y: z.y, t: 0, pose: rng() < 0.5 ? 0 : 1 });
    C.blood.push({ x: z.x, y: z.y, r: 1.1 + rng() * 0.5, t: 0 });
    C.onKill?.("arrow", z);
  }
}

// отрезок против AABB (Liang-Barsky): экранный силуэт зомби
function segHitsRect(x1, y1, x2, y2, rx0, ry0, rx1, ry1) {
  let t0 = 0,
    t1 = 1;
  const dx = x2 - x1,
    dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rx0, rx1 - x1, y1 - ry0, ry1 - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// выстрел при отпускании ЛКМ; стрелы расходуются из инвентаря.
// Возвращает true, если стрела ушла (для XP стрельбы).
export function releaseBow(C, player, aim, inv, city, mods = null) {
  if (!C.bowDrawing) return false;
  C.bowDrawing = false;
  if (C.bowCharge < 0.15) {
    C.bowCharge = 0;
    return false; // слабый спуск — не стреляем
  }
  if (countItem(inv, "arrow") < 1) {
    C.bowCharge = 0;
    C.noArrowsT = 1.2; // подсказка «нет стрел»
    return false;
  }
  removeItem(inv, "arrow", 1);
  const dx = aim.x - player.x,
    dy = aim.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const spread = (1 - C.bowCharge) * 0.12 * (mods?.spreadK ?? 1);
  const ang = Math.atan2(dy, dx) + (rng() - 0.5) * spread;
  // вылет из лука: смещение от центра игрока к цели (а не из-под ног)
  C.arrows.push({
    x: player.x + (dx / d) * 0.45,
    y: player.y + (dy / d) * 0.45,
    dx: Math.cos(ang),
    dy: Math.sin(ang),
    dist: 0,
    alive: true,
  });
  C.bowCharge = 0;
  C.releaseT = 0.2; // кадр отпускания тетивы
  // шум: зомби в 8 м слышат и идут
  for (const z of city.zombies) {
    if (z.dead) continue;
    if (Math.hypot(z.x - player.x, z.y - player.y) < 8) {
      z.tx = player.x;
      z.ty = player.y;
      z.retarget = 0;
      z.alertT = 6;
      z.propagated = false;
    }
  }
  return true;
}

// ближний удар дугой перед игроком (кулаки/бита/нож). Возвращает число задетых.
// Шум привлекает зомби в радиусе weapon.noise; отброс зависит от типа зомби.
export function meleeAttack(C, player, aim, city, weapon, mods = null) {
  if (C.dead || C.meleeCd > 0) return 0;
  C.meleeCd = weapon.cd;
  C.swingT = 0.22;
  const ang = Math.atan2(aim.y - player.y, aim.x - player.x);
  C.swingAng = ang;
  const lvl = player.level || 0;
  let hits = 0;
  for (const z of city.zombies) {
    if (z.dead || (z.level || 0) !== lvl) continue;
    const dx = z.x - player.x,
      dy = z.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > weapon.range + 0.35) continue;
    let da = Math.abs(Math.atan2(dy, dx) - ang);
    if (da > Math.PI) da = 2 * Math.PI - da;
    if (da > 0.9) continue; // дуга ~±50°
    const dmg = Math.round(weapon.dmg * (mods?.meleeDmgK ?? 1));
    z.hp = (z.hp ?? ZOMBIE_HP) - dmg;
    z.hurtT = 0.3;
    const knock = weapon.knock * ZTYPES[z.type || "walker"].knock;
    z.x += (dx / Math.max(d, 0.01)) * knock;
    z.y += (dy / Math.max(d, 0.01)) * knock;
    z.tx = player.x;
    z.ty = player.y;
    z.retarget = 0;
    z.alertT = 6;
    z.propagated = false;
    C.blood.push({ x: z.x, y: z.y, r: 0.5 + rng() * 0.5, t: 0 });
    hits++;
    if (z.hp <= 0) {
      z.dead = true;
      C.kills++;
      C.corpses.push({ x: z.x, y: z.y, t: 0, pose: rng() < 0.5 ? 0 : 1 });
      C.blood.push({ x: z.x, y: z.y, r: 1.1 + rng() * 0.5, t: 0 });
      C.onKill?.("melee", z);
    }
  }
  for (const z of city.zombies) {
    if (z.dead) continue;
    if (Math.hypot(z.x - player.x, z.y - player.y) < weapon.noise) {
      z.tx = player.x;
      z.ty = player.y;
      z.retarget = 0;
      z.alertT = 6;
      z.propagated = false;
    }
  }
  return hits;
}

export function respawn(C, player, spawnX, spawnY) {
  C.playerHp = C.playerMaxHp;
  C.dead = false;
  C.deadT = 0;
  C.hurtFlash = 0;
  player.x = spawnX;
  player.y = spawnY;
}
