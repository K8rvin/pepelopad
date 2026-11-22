// Журнал: текущая цель, цепочка квестов, личная история, статистика.
// Чистый билдер HTML — состояние только читает.
import { QUESTS } from "../data/quests.js";
import { STORY, STORY_NPC_NAMES } from "../data/story.js";
import { mainQuest, goalText, goalDone } from "../systems/quests.js";

export function journalHtml({ quests, story, stats, survival, combat }) {
  const cur = mainQuest(quests, QUESTS);
  const curHtml = cur
    ? `<div class="j-quest">
        <div class="j-name">${cur.name}</div>
        <div class="j-desc">${cur.desc}</div>
        ${cur.goals
          .map(
            (g) =>
              `<div class="j-goal ${goalDone(g, quests.prog) ? "done" : ""}">${
                goalDone(g, quests.prog) ? "✓" : "▸"
              } ${goalText(g, quests.prog)}</div>`,
          )
          .join("")}
        <div class="j-reward">Награда: ${cur.reward
          .map(([id, n]) => `${id} ×${n}`)
          .join(", ")}</div>
      </div>`
    : '<div class="j-desc">Цепочка района выполнена. Выживай и развивай базу.</div>';

  const chain = QUESTS.map((q, i) => {
    const done = quests.done.includes(q.id);
    const active = i === quests.i;
    return `<div class="j-chain ${done ? "done" : active ? "active" : "locked"}">
      <span>${done ? "✓" : active ? "▸" : "·"}</span> ${q.name}
      <em>${q.desc}</em></div>`;
  }).join("");

  const storyHtml = STORY.map((b, i) => {
    const done = i < story.i;
    const active = i === story.i;
    return `<div class="j-chain ${done ? "done" : active ? "active" : "locked"}">
      <span>${done ? "✓" : active ? "▸" : "·"}</span> ${b.title}
      <em>${STORY_NPC_NAMES[b.npc]}</em></div>`;
  }).join("");

  const stat = (label, val) =>
    `<div class="j-stat"><span>${label}</span><b>${val}</b></div>`;
  const statsHtml = `
    ${stat("День", survival.day)}
    ${stat("Убито зомби", combat.kills)}
    ${stat("Пройдено", (stats.distance / 1000).toFixed(2) + " км")}
    ${stat("Выстрелов из лука", stats.arrowsFired)}
    ${stat("Добыто предметов", stats.itemsLooted)}
    ${stat("Создано предметов", stats.crafts)}
    ${stat("Смертей", stats.deaths)}`;

  return `
    <h3>Текущая цель</h3>${curHtml}
    <h3>Цепочка района</h3><div class="j-list">${chain}</div>
    <h3>Личная история</h3><div class="j-list">${storyHtml}</div>
    <h3>Статистика</h3><div class="j-stats">${statsHtml}</div>
    <div class="hint">J / Esc — закрыть</div>`;
}
