// Выживание: часы (день/ночь), голод, еда и медицина.
// 1 реальная секунда = 1 игровая минута (сутки = 24 мин).
export function createSurvival() {
  return {
    day: 1,
    tod: 8, // час суток, 0–24
    hunger: 100, // 100 = сыт
    timeSpeed: 1 / 60, // игровых часов в секунду
    lastSiegeDay: 0, // ночной приток зомби — раз в сутки
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

export function updateSurvival(S, combat, player, city, inv, dt, eatFn) {
  S.tod += dt * S.timeSpeed;
  if (S.tod >= 24) {
    S.tod -= 24;
    S.day++;
  }
  // голод: 100 за сутки; на нуле — ВРЕМЕННО без смерти (до балансировки еды)
  S.hunger = Math.max(0, S.hunger - (dt * 100) / 1440);
  // сытому (голод > 50) здоровье потихоньку восстанавливается
  if (S.hunger > 50 && !combat.dead && combat.playerHp > 0)
    combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + 0.15 * dt);
  // ночной приток: в 21:00 к игроку подтягивается группа
  if (S.tod >= 21 && S.tod < 21.1 && S.lastSiegeDay < S.day) {
    S.lastSiegeDay = S.day;
    let spawned = 0;
    for (const z of city.zombies) {
      if (spawned >= 5) break;
      if (z.dead) continue;
      const d = Math.hypot(z.x - player.x, z.y - player.y);
      if (d > 25 && d < 60) {
        z.tx = player.x;
        z.ty = player.y;
        z.retarget = 0;
        spawned++;
      }
    }
  }
}

// съесть тушёнку / перевязаться. Возвращает текст результата или null.
export function useConsumable(S, combat, inv, id, removeFn) {
  if (id === "can") {
    if (!removeFn("can", 1)) return null;
    S.hunger = Math.min(100, S.hunger + 40);
    return "Ты съел тушёнку. +40 сытости";
  }
  if (id === "meds") {
    if (combat.playerHp >= combat.playerMaxHp) return "Здоровье полное";
    if (!removeFn("meds", 1)) return null;
    combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + 30);
    return "Перевязка. +30 HP";
  }
  return null;
}
