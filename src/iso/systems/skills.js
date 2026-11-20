// Прогрессия «учись делая»: владелец состояния навыков и характеристик.
// XP приходит из игровых систем через gainXp (источники — в main.js).
// modifiers(S) — чистая производная для систем; ничего не мутирует.
import {
  SKILLS,
  ATTRS,
  MAX_LEVEL,
  ATTR_START,
  SKILL_XP_BASE,
  ATTR_XP_BASE,
  ATTR_SHARE,
} from "../data/skills.js";

export function xpToNext(level, base) {
  return base * (2 * level + 1);
}

export function createSkills() {
  const skills = {},
    attrs = {};
  for (const id of Object.keys(SKILLS)) skills[id] = { xp: 0, level: 0 };
  for (const id of Object.keys(ATTRS)) attrs[id] = { xp: 0, level: ATTR_START };
  return { skills, attrs };
}

// нейтральные модификаторы: системы работают без прогрессии как раньше
export const NEUTRAL_MODS = {
  speedK: 1,
  bowDmgK: 1,
  spreadK: 1,
  chargeK: 1,
  hungerK: 1,
  regenK: 1,
  foodBonus: 0,
  healBonus: 0,
  craftBonus: 0,
  lootBonus: 0,
  accelK: 1,
  steerK: 1,
  fuelK: 1,
  ramK: 1,
  carrySlots: 24,
  maxHp: 100,
};

function gain(st, amount, base, kind, id, events) {
  if (st.level >= MAX_LEVEL) return;
  st.xp += amount;
  while (st.level < MAX_LEVEL && st.xp >= xpToNext(st.level, base)) {
    st.xp -= xpToNext(st.level, base);
    st.level++;
    events.push({ kind, id, level: st.level });
  }
  if (st.level >= MAX_LEVEL) st.xp = 0;
}

// вернуть список повышений [{kind: 'skill'|'attr', id, level}] для тостов
export function gainXp(S, id, amount) {
  const events = [];
  const def = SKILLS[id];
  if (!def || !(amount > 0)) return events;
  gain(S.skills[id], amount, SKILL_XP_BASE, "skill", id, events);
  for (const a of def.attrs)
    gain(S.attrs[a], amount * ATTR_SHARE, ATTR_XP_BASE, "attr", a, events);
  return events;
}

export function modifiers(S) {
  const L = (id) => S.skills[id].level;
  const A = (id) => S.attrs[id].level - ATTR_START;
  const sk = SKILLS,
    at = ATTRS;
  return {
    speedK:
      (1 + sk.athletics.speed * L("athletics")) *
      (1 + at.agility.speed * A("agility")),
    bowDmgK: 1 + sk.archery.dmg * L("archery"),
    spreadK: Math.max(
      0.2,
      (1 - sk.archery.spread * L("archery")) *
        (1 - at.perception.spread * A("perception")),
    ),
    chargeK: Math.max(0.6, 1 - at.agility.charge * A("agility")),
    hungerK: Math.max(
      0.4,
      (1 - sk.survival.hunger * L("survival")) *
        (1 - at.endurance.hunger * A("endurance")),
    ),
    regenK: 1 + sk.survival.regen * L("survival"),
    foodBonus: sk.survival.food * L("survival"),
    healBonus: sk.medicine.heal * L("medicine"),
    craftBonus: Math.min(
      sk.crafting.bonusCap,
      sk.crafting.bonus * L("crafting"),
    ),
    lootBonus: Math.min(
      0.5,
      Math.min(sk.scavenging.bonusCap, sk.scavenging.bonus * L("scavenging")) +
        at.perception.loot * A("perception"),
    ),
    accelK: 1 + sk.driving.accel * L("driving"),
    steerK: 1 + sk.driving.steer * L("driving"),
    fuelK: Math.max(sk.driving.fuelCap, 1 - sk.driving.fuel * L("driving")),
    ramK:
      (1 + sk.driving.ram * L("driving")) *
      (1 + at.strength.ram * A("strength")),
    carrySlots:
      24 +
      Math.floor(A("strength") / at.strength.carryPer) * at.strength.carryStep,
    maxHp: 100 + at.endurance.hp * A("endurance"),
  };
}

// восстановление из сейва: только известные ID, уровни в допустимых границах
export function restoreSkills(S, data) {
  if (!data) return;
  for (const id of Object.keys(SKILLS)) {
    const d = data.skills?.[id];
    if (!d) continue;
    S.skills[id].level = Math.max(0, Math.min(MAX_LEVEL, d.level | 0));
    S.skills[id].xp = Math.max(0, Number(d.xp) || 0);
  }
  for (const id of Object.keys(ATTRS)) {
    const d = data.attrs?.[id];
    if (!d) continue;
    S.attrs[id].level = Math.max(ATTR_START, Math.min(MAX_LEVEL, d.level | 0));
    S.attrs[id].xp = Math.max(0, Number(d.xp) || 0);
  }
}
