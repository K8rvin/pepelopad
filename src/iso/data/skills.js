// Навыки и характеристики (данные отдельно от механик, правило AGENTS.md).
// Модель «учись делая»: навык получает XP за реальные действия игрока,
// характеристика — ATTR_SHARE доли XP связанных навыков (без отдельных хуков).
// Уровни: навыки 0–10, характеристики ATTR_START–10. Кривая: base·(2L+1).
export const MAX_LEVEL = 10;
export const ATTR_START = 2;
export const SKILL_XP_BASE = 40;
export const ATTR_XP_BASE = 60;
export const ATTR_SHARE = 0.5;

// attrs — какие характеристики кормятся XP этого навыка.
// Числовые поля — коэффициенты на уровень; комбинирует их systems/skills.js.
export const SKILLS = {
  archery: {
    name: "Стрельба",
    icon: "🏹",
    desc: "+4% урона и −5% разброса за уровень",
    attrs: ["agility", "perception"],
    dmg: 0.04,
    spread: 0.05,
  },
  athletics: {
    name: "Атлетика",
    icon: "🏃",
    desc: "+2,5% скорости передвижения за уровень",
    attrs: ["agility"],
    speed: 0.025,
  },
  survival: {
    name: "Выживание",
    icon: "🌙",
    desc: "−3% голода, +8% регенерации, +2 сытости от тушёнки за уровень",
    attrs: ["endurance"],
    hunger: 0.03,
    regen: 0.08,
    food: 2,
  },
  crafting: {
    name: "Крафт",
    icon: "🔧",
    desc: "+4% шанс бонусного выхода за уровень (до 40%)",
    attrs: ["strength"],
    bonus: 0.04,
    bonusCap: 0.4,
  },
  medicine: {
    name: "Медицина",
    icon: "🩹",
    desc: "+3 HP лечения бинтом за уровень",
    attrs: ["endurance"],
    heal: 3,
  },
  driving: {
    name: "Вождение",
    icon: "🚗",
    desc: "+3% разгон и руль, −2% расход, +4% таран за уровень",
    attrs: ["strength"],
    accel: 0.03,
    steer: 0.03,
    fuel: 0.02,
    fuelCap: 0.8,
    ram: 0.04,
  },
  scavenging: {
    name: "Поиск",
    icon: "🔦",
    desc: "+3% шанс бонусного лута за уровень (до 30%)",
    attrs: ["perception"],
    bonus: 0.03,
    bonusCap: 0.3,
  },
};

export const ATTRS = {
  strength: {
    name: "Сила",
    icon: "💪",
    desc: "+1 слот рюкзака за каждые 2 уровня; +3% урон тарана за уровень",
    carryPer: 2,
    carryStep: 1,
    ram: 0.03,
  },
  agility: {
    name: "Ловкость",
    icon: "🤸",
    desc: "+1,5% скорости; −2% время натяжения лука за уровень",
    speed: 0.015,
    charge: 0.02,
  },
  endurance: {
    name: "Выносливость",
    icon: "❤️",
    desc: "+4 макс. HP и −1% голода за уровень",
    hp: 4,
    hunger: 0.01,
  },
  perception: {
    name: "Восприятие",
    icon: "👁️",
    desc: "−3% разброса и +2% шанс бонусного лута за уровень",
    spread: 0.03,
    loot: 0.02,
  },
};
