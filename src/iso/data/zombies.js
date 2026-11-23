// Типы зомби (данные отдельно от механик, этап 17 «поведение врагов»).
// chase — радиус погони днём/ночью, м; speed — м/с; knock — множитель отброса
// от стрелы; scale/tint — визуальная дифференциация в рендере.
export const ZTYPES = {
  walker: {
    name: "Ходок",
    hp: 70,
    speed: 0.85,
    dmg: 9,
    chaseDay: 7,
    chaseNight: 10,
    knock: 1,
    scale: 1,
    tint: null,
  },
  runner: {
    name: "Бегун",
    hp: 45,
    speed: 1.8,
    dmg: 7,
    chaseDay: 10,
    chaseNight: 13,
    knock: 1.2,
    scale: 0.92,
    // кадр бега поверх нормализации к стойке: бег читается крупнее, не «усадка»
    runScale: 1.06,
    tint: "rgba(150,60,40,0.28)",
  },
  brute: {
    name: "Громила",
    hp: 260,
    speed: 0.55,
    dmg: 22,
    chaseDay: 6,
    chaseNight: 8,
    knock: 0.25,
    scale: 1.28,
    tint: "rgba(60,70,50,0.35)",
  },
  boss: {
    name: "Матка",
    hp: 900,
    speed: 0.45,
    dmg: 30,
    chaseDay: 8,
    chaseNight: 10,
    knock: 0,
    scale: 1.6,
    tint: "rgba(120,40,60,0.4)",
    summonCd: 18,
  },
};

// смесь при генерации города: бегун ~12%, остальные ходоки
export const GEN_RUNNER_CHANCE = 0.12;

// смесь ночного притока по дню: громилы с 3-го дня
export function nightType(day, roll) {
  if (day >= 3 && roll < 0.15) return "brute";
  if (roll < 0.45) return "runner";
  return "walker";
}

// капа runtime-спавна поверх стартовой популяции (~12/квартал)
export const ZOMBIE_CAP = 6000;
