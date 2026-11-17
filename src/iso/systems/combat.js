// Бой (спроектирован заново для изометрии, не порт старой игры).
// Лук: ЛКМ удерживать — натяжение (0→1 за 0.8 с), отпустить — выстрел.
// Стрела летит в мировых координатах, тихая; шум слышат зомби в 8 м.
// Зомби: кусают в контакте с кулдауном; урон игроку; кровь; смерть.
import { mulberry32 } from "../core/rng.js";
import { countItem, removeItem } from "./inventory.js";

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
    bowCharge: 0, // 0..1
    bowDrawing: false,
    hurtFlash: 0,
    shake: 0,
    dead: false,
    deadT: 0,
    kills: 0,
  };
}

const BOW_CHARGE_TIME = 0.8;
const ARROW_SPEED = 35; // м/с
const ARROW_RANGE = 26; // м
const ZOMBIE_HP = 70;
const ZOMBIE_DMG = 11;
const ZOMBIE_ATTACK_CD = 1.2;

// цель в мировых координатах от мыши (inverse iso, земля z=0)
export function screenToWorld(mx, my, camS, W, H, zoom) {
  const sx = (mx - W / 2) / zoom + camS.x;
  const sy = (my - H / 2) / zoom + camS.y;
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
) {
  if (C.dead) {
    C.deadT += dt;
    return;
  }
  // натяжение лука
  if (C.bowDrawing)
    C.bowCharge = Math.min(1, C.bowCharge + dt / BOW_CHARGE_TIME);
  // стрелы
  for (const a of C.arrows) {
    if (!a.alive) continue;
    const nx = a.x + a.dx * ARROW_SPEED * dt,
      ny = a.y + a.dy * ARROW_SPEED * dt;
    a.dist += ARROW_SPEED * dt;
    if (a.dist > ARROW_RANGE || solidBuildingHit(city, nx, ny)) {
      a.alive = false;
      continue;
    }
    // попадание: отрезок (prev→new) против круга зомби — никакого туннелирования
    for (const z of city.zombies) {
      if (z.dead) continue;
      if (segmentHitsCircle(a.x, a.y, nx, ny, z.x, z.y, 0.45)) {
        a.alive = false;
        hurtZombie(C, z, 34 + Math.floor(rng() * 17), a);
        break;
      }
    }
    a.x = nx;
    a.y = ny;
  }
  C.arrows = C.arrows.filter((a) => a.alive);
  // зомби атакуют
  if (!protectedFlag)
    for (const z of city.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - player.x, z.y - player.y);
      if (d < 0.7) {
        z.attackCd = (z.attackCd || 0) - dt;
        if (z.attackCd <= 0) {
          z.attackCd = ZOMBIE_ATTACK_CD;
          C.playerHp -= ZOMBIE_DMG + Math.floor(rng() * 5);
          C.hurtFlash = 1;
          C.shake = 6;
          if (C.playerHp <= 0) {
            C.playerHp = 0;
            C.dead = true;
            C.deadT = 0;
          }
        }
        // толкаем игрока слегка
        const push = 0.4 * dt;
        player.x += ((player.x - z.x) / Math.max(d, 0.01)) * push;
        player.y += ((player.y - z.y) / Math.max(d, 0.01)) * push;
      }
    }
  // затухание эффектов
  C.hurtFlash = Math.max(0, C.hurtFlash - dt * 2.2);
  C.shake = Math.max(0, C.shake - dt * 18);
  C.noArrowsT = Math.max(0, (C.noArrowsT || 0) - dt);
  // кровь и трупы
  for (const b of C.blood) b.t += dt;
  C.blood = C.blood.filter((b) => b.t < 60);
  for (const c of C.corpses) c.t += dt;
  C.corpses = C.corpses.filter((c) => c.t < 6);
}

function hurtZombie(C, z, dmg, arrow) {
  z.hp = (z.hp ?? ZOMBIE_HP) - dmg;
  // отброс по направлению стрелы
  z.x += arrow.dx * 0.35;
  z.y += arrow.dy * 0.35;
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
    C.onKill?.();
  }
}

function solidBuildingHit(city, x, y) {
  // стрелы не пролетают сквозь здания
  for (const b of city.buildings)
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}

// расстояние от точки до отрезка (для хит-теста стрел)
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(cx - x1, cy - y1) < r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(cx - (x1 + t * dx), cy - (y1 + t * dy)) < r;
}

// выстрел при отпускании ЛКМ; стрелы расходуются из инвентаря
export function releaseBow(C, player, aim, inv) {
  if (!C.bowDrawing) return;
  C.bowDrawing = false;
  if (C.bowCharge < 0.15) {
    C.bowCharge = 0;
    return; // слабый спуск — не стреляем
  }
  if (countItem(inv, "arrow") < 1) {
    C.bowCharge = 0;
    C.noArrowsT = 1.2; // подсказка «нет стрел»
    return;
  }
  removeItem(inv, "arrow", 1);
  const dx = aim.x - player.x,
    dy = aim.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const spread = (1 - C.bowCharge) * 0.12;
  const ang = Math.atan2(dy, dx) + (rng() - 0.5) * spread;
  C.arrows.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(ang),
    dy: Math.sin(ang),
    dist: 0,
    alive: true,
  });
  C.bowCharge = 0;
  // шум: зомби в 8 м слышат и идут
  for (const z of city.zombies) {
    if (z.dead) continue;
    if (Math.hypot(z.x - player.x, z.y - player.y) < 8) {
      z.tx = player.x;
      z.ty = player.y;
      z.retarget = 0;
    }
  }
}

export function respawn(C, player, spawnX, spawnY) {
  C.playerHp = C.playerMaxHp;
  C.dead = false;
  C.deadT = 0;
  C.hurtFlash = 0;
  player.x = spawnX;
  player.y = spawnY;
}
