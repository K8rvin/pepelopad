// Постоянная панель «что делать сейчас»: текущий этап главной миссии,
// прогресс целей и контекстная подсказка действия. Работает для всех квестов.
import {
  mainQuest,
  currentStage,
  questProgress,
  goalDone,
  goalText,
} from "../systems/quests.js";

export function objectiveState(quests, defs, hint) {
  const q = mainQuest(quests, defs);
  if (!q) return null;
  const stage = currentStage(quests, q);
  const prog = questProgress(quests, q.id);
  return {
    name: q.name,
    desc: stage?.desc || q.desc,
    goals: (stage?.goals || []).map((g) => ({
      label: goalText(g, prog),
      done: goalDone(g, prog),
    })),
    hint: hint || "",
  };
}

export function createObjective({ root }) {
  root.innerHTML =
    `<div class="obj-quest"></div>` +
    `<div class="obj-desc"></div>` +
    `<div class="obj-goals"></div>` +
    `<div class="obj-hint"></div>`;
  const qEl = root.querySelector(".obj-quest");
  const dEl = root.querySelector(".obj-desc");
  const gEl = root.querySelector(".obj-goals");
  const hEl = root.querySelector(".obj-hint");
  let last = "";
  function update(s) {
    if (!s) {
      root.hidden = true;
      last = "";
      return;
    }
    root.hidden = false;
    const key = JSON.stringify(s);
    if (key === last) return;
    last = key;
    qEl.textContent = s.name.toUpperCase();
    dEl.textContent = s.desc;
    gEl.innerHTML = s.goals
      .map(
        (g) =>
          `<span class="obj-goal${g.done ? " done" : ""}">${
            g.done ? "✓" : "•"
          } ${g.label}</span>`,
      )
      .join("");
    hEl.textContent = s.hint;
    hEl.hidden = !s.hint;
  }
  return { update };
}
