import { ALL_QUESTS } from "../data/quests.js";
import { CLUES } from "../data/storyObjects.js";
import {
  currentStage,
  goalDone,
  goalText,
  mainQuest,
  questProgress,
  questStatus,
} from "../systems/quests.js";

function questCard(Q, def, detailed = true) {
  const status = questStatus(Q, def.id);
  const stage = currentStage(Q, def);
  const prog = questProgress(Q, def.id);
  const goals =
    detailed && status === "active" && stage
      ? stage.goals
          .map(
            (g) =>
              `<div class="j-goal ${goalDone(g, prog) ? "done" : ""}">${goalDone(g, prog) ? "✓" : "▸"} ${goalText(g, prog)}</div>`,
          )
          .join("")
      : "";
  const track =
    def.kind === "side" && ["active", "available"].includes(status)
      ? `<button data-track="${def.id}">${Q.tracked === def.id ? "Не отслеживать" : "Отслеживать"}</button>`
      : "";
  return `<div class="j-quest"><div class="j-name">${def.name} <span class="dim">${status === "completed" ? "✓" : status === "failed" ? "не удалось" : ""}</span></div><div class="j-desc">${stage?.desc || def.desc}</div>${goals}${track}</div>`;
}

export function journalHtml({ quests, story, stats, survival, combat }) {
  const main = mainQuest(quests, ALL_QUESTS);
  const current = main
    ? questCard(quests, main)
    : `<div class="j-quest"><div class="j-name">Кампания завершена</div><div class="j-desc">Район продолжает жить с последствиями твоего выбора.</div></div>`;
  const chapters = ALL_QUESTS.filter((q) => q.kind === "main")
    .map((q) => {
      const status = questStatus(quests, q.id);
      return `<div class="j-chain ${status}"><span>${status === "completed" ? "✓" : status === "active" ? "▸" : "·"}</span> ${q.chapter} — ${q.name}</div>`;
    })
    .join("");
  const sides = ALL_QUESTS.filter(
    (q) =>
      q.kind === "side" &&
      ["available", "active"].includes(questStatus(quests, q.id)),
  );
  const completedSides = ALL_QUESTS.filter(
    (q) =>
      q.kind === "side" &&
      ["completed", "failed"].includes(questStatus(quests, q.id)),
  );
  const clues = story.clues
    .map(
      (id) =>
        `<div class="j-quest"><div class="j-name">${CLUES[id]?.title || id}</div><div class="j-desc">${CLUES[id]?.text || ""}</div></div>`,
    )
    .join("");
  const pending = quests.pendingRewards.length
    ? `<div class="j-desc">Ожидают места в рюкзаке: ${quests.pendingRewards.map((r) => `${r.id} ×${r.n}`).join(", ")}</div>`
    : "";
  const stat = (label, value) =>
    `<div class="j-stat"><span>${label}</span><b>${value}</b></div>`;
  return `
    <h3>Текущая основная цель</h3>${current}${pending}
    <h3>Кампания «Последний список»</h3><div class="j-list">${chapters}</div>
    <h3>Выжившие и поручения</h3>${sides.length ? sides.map((q) => questCard(quests, q)).join("") : '<div class="j-desc">Разговаривай с жителями поселений. Повторяемые поставки обновляются каждый день.</div>'}
    ${completedSides.length ? `<h3>Завершённые истории</h3>${completedSides.map((q) => questCard(quests, q, false)).join("")}` : ""}
    <h3>Улики</h3>${clues || '<div class="j-desc">Документы и свидетельства будут записываться здесь. Их не нужно носить в рюкзаке.</div>'}
    <h3>Статистика</h3><div class="j-stats">
      ${stat("День", survival.day)}${stat("Убито зомби", combat.kills)}${stat("Пройдено", (stats.distance / 1000).toFixed(2) + " км")}${stat("Выстрелов из лука", stats.arrowsFired)}${stat("Добыто предметов", stats.itemsLooted)}${stat("Создано предметов", stats.crafts)}${stat("Смертей", stats.deaths)}
    </div><div class="hint">J / Esc — закрыть</div>`;
}
