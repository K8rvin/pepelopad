// Празднование повышения навыка/характеристики: владелец состояния — очередь
// баннеров и мировые искры. Рендер только читает sparks; DOM обновляется здесь
// один раз при старте баннера. Звук и баннер запускает main по событию старта.
import { SKILLS, ATTRS } from "../data/skills.js";
import { mulberry32 } from "../core/rng.js";

export const LEVELUP_DUR = 2.6;
const SPARK_N = 26;

export function createLevelUp() {
  return { queue: [], active: null, t: 0, sparks: [] };
}

// ev: {kind, id, level} из gainXp; x/y — позиция игрока в момент получения XP
export function pushLevelUp(L, ev, x, y) {
  L.queue.push({ ...ev, x, y });
}

// продвинуть время; вернуть событие только что стартовавшего баннера (для
// звука и DOM) либо null. Искры живут в мировых координатах, гаснут по life.
export function updateLevelUp(L, dt) {
  let started = null;
  if (L.active) {
    L.t += dt;
    if (L.t >= LEVELUP_DUR) L.active = null;
  }
  if (!L.active && L.queue.length) {
    L.active = L.queue.shift();
    L.t = 0;
    started = L.active;
    const r = mulberry32(
      L.active.level * 977 +
        L.active.id.length * 131 +
        (L.active.kind === "attr" ? 7 : 1),
    );
    for (let i = 0; i < SPARK_N; i++) {
      const a = r() * Math.PI * 2,
        sp = 0.3 + r() * 0.9;
      L.sparks.push({
        x: L.active.x,
        y: L.active.y,
        z: 0.2 + r() * 0.8,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vz: 1.4 + r() * 2.2,
        t: 0,
        life: 0.7 + r() * 0.7,
        gold: r() < 0.7,
      });
    }
  }
  for (const s of L.sparks) {
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.vz -= 2.2 * dt;
  }
  L.sparks = L.sparks.filter((s) => s.t < s.life && s.z >= 0);
  return started;
}

// баннер: иконка, имя, новый уровень и что он даёт (desc из данных)
export function showLevelUpBanner(ev) {
  const el = document.getElementById("levelup");
  if (!el) return;
  const def = ev.kind === "skill" ? SKILLS[ev.id] : ATTRS[ev.id];
  if (!def) return;
  el.innerHTML =
    `<div class="lu-card">` +
    `<div class="lu-kind">${ev.kind === "skill" ? "НАВЫК ПОВЫШЕН" : "ХАРАКТЕРИСТИКА ПОВЫШЕНА"}</div>` +
    `<div class="lu-name">${def.icon} ${def.name}</div>` +
    `<div class="lu-level">УРОВЕНЬ ${ev.level}</div>` +
    `<div class="lu-desc">${def.desc}</div>` +
    `</div>`;
  el.classList.remove("show");
  void el.offsetWidth; // перезапуск CSS-анимации
  el.classList.add("show");
}
