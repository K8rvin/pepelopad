// Выживание: часы (день/ночь), голод, еда и медицина.
// 1 реальная секунда = 1 игровая минута (сутки = 24 мин).
import { clamp, mulberry32 } from "../core/rng.js";
import { spawnZombie, alertZombie } from "./actors.js";
import { solidRectAt } from "../world/cityGen.js";
import { nightType } from "../data/zombies.js";

export function createSurvival() {
  return {
    day: 1,
    tod: 8, // час суток, 0–24
    hunger: 100, // 100 = сыт
    timeSpeed: 1 / 60, // игровых часов в секунду
    lastSiegeDay: 0, // ночной приток зомби — раз в сутки
    bossDone: false, // Матка приходит один раз (день 5)
    pendingBoss: null, // точка спавна Матки для main.js
  };
}

// 0 день, 1 глубокая ночь; рассвет 5–7, закат 19–21
export function darknessFor(tod) {
  if (tod >= 7 && tod <= 19) return 0;
  if (tod >= 21 || tod <= 5) return 1;
  if (tod > 19) return (tod - 19) / 2;
  return (7 - tod) / 2;
}

export function clockText(S) {
  const h = Math.floor(S.tod);
  const m = Math.floor((S.tod - h) * 60);
  return `День ${S.day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function updateSurvival(S, combat, player, city, inv, dt, mods = null) {
  S.tod += dt * S.timeSpeed;
  if (S.tod >= 24) {
    S.tod -= 24;
    S.day++;
  }
  // голод: 100 за сутки; на нуле — ВРЕМЕННО без смерти (до балансировки еды)
  S.hunger = Math.max(0, S.hunger - ((dt * 100) / 1440) * (mods?.hungerK ?? 1));
  // сытому (голод > 50) здоровье потихоньку восстанавливается
  if (S.hunger > 50 && !combat.dead && combat.playerHp > 0)
    combat.playerHp = Math.min(
      combat.playerMaxHp,
      combat.playerHp + 0.15 * (mods?.regenK ?? 1) * dt,
    );
  // ставки: голод на нуле — истощение; инфекция — лихорадка (лечится бинтом)
  if (!combat.dead) {
    if (S.hunger <= 0) combat.playerHp -= 1.5 * dt;
    if (player.infected) combat.playerHp -= 0.8 * dt;
    if (combat.playerHp <= 0) {
      combat.playerHp = 0;
      combat.dead = true;
      combat.deadT = 0;
    }
  }
  // ночной приток: в 21:00 вокруг игрока спавнится группа (тип по дню),
  // мёртвые переиспользуются — популяция не растёт бесконечно
  if (S.tod >= 21 && S.tod < 21.1 && S.lastSiegeDay < S.day) {
    S.lastSiegeDay = S.day;
    const r = mulberry32(S.day * 7919 + 17);
    const n = Math.min(10, 3 + S.day);
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2,
        d = 25 + r() * 35;
      const x = clamp(player.x + Math.cos(ang) * d, 2, city.SIZE - 2),
        y = clamp(player.y + Math.sin(ang) * d, 2, city.SIZE - 2);
      if (solidRectAt(city, x, y, 0.5)) continue;
      const z = spawnZombie(city, x, y, nightType(S.day, r()));
      if (z) alertZombie(z, player.x, player.y, 10);
    }
    // Матка приходит на 5-й день к больнице
    if (S.day >= 5 && !S.bossDone) {
      S.bossDone = true;
      const b = city.buildings.find((k) => k.poi === "Больница");
      S.pendingBoss = b
        ? { x: b.x + (b.doorU ?? b.w / 2), y: b.y + b.h + 2 }
        : { x: player.x + 30, y: player.y + 30 };
    }
  }
}

// съесть тушёнку / перевязаться. Возвращает текст результата или null.
export function useConsumable(
  S,
  combat,
  inv,
  id,
  removeFn,
  player,
  mods = null,
) {
  if (id === "can") {
    if (!removeFn("can", 1)) return null;
    const v = 40 + (mods?.foodBonus ?? 0);
    S.hunger = Math.min(100, S.hunger + v);
    return `Ты съел тушёнку. +${v} сытости`;
  }
  if (id === "meds") {
    if (combat.playerHp >= combat.playerMaxHp) return "Здоровье полное";
    if (!removeFn("meds", 1)) return null;
    const v = 30 + (mods?.healBonus ?? 0);
    combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + v);
    const cured = player?.infected;
    if (player) player.infected = false;
    return cured
      ? `Перевязка. +${v} HP, инфекция снята`
      : `Перевязка. +${v} HP`;
  }
  return null;
}
