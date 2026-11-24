import { dialogueChoices } from "../systems/dialogue.js";
import { CHARACTERS } from "../data/characters.js";
import { SPRTEX } from "../render/assets.js";

function portraitSource(npcId) {
  const portraitId = { lena: "masha", dan: "gg" }[npcId] || npcId;
  const character = CHARACTERS.find((n) => n.id === npcId);
  const image =
    SPRTEX[`portrait_${portraitId}`] ||
    SPRTEX[`npc_${character?.sprite || npcId}`] ||
    SPRTEX.survivor;
  if (!image) return "";
  if (image.src) return image.src;
  return image.toDataURL ? image.toDataURL() : "";
}

export function createDialogueUI({ root, getContext, onChoice, onAdvance }) {
  let state = null;
  // клик по диалогу (кроме кнопок выбора) листает реплику, как E / Space
  root.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    onAdvance?.();
  });

  function render(D) {
    state = D;
    const c = D?.conversation;
    if (!c) {
      root.style.display = "none";
      root.innerHTML = "";
      return;
    }
    const last = D.line >= c.lines.length - 1;
    const choices = last ? dialogueChoices(D, getContext()) : [];
    const buttons = choices.length
      ? `<div class="dlg-choices">${choices.map((choice, i) => `<button data-di="${i}"><b>${i + 1}.</b> ${choice.text}</button>`).join("")}</div>`
      : last
        ? `<div class="hint">E / Space / Enter или клик — закрыть</div>`
        : `<div class="hint">E / Space / Enter или клик — дальше</div>`;
    const line = c.lines[D.line];
    const speaker = /^Дэн\s*:/.test(line) ? "dan" : c.npc;
    const character = CHARACTERS.find((n) => n.id === speaker);
    const portrait = portraitSource(speaker);
    root.innerHTML = `<div class="dlg-main"><div class="who">${c.title || c.npc}</div><div class="dlg-line">${line}</div>${buttons}</div><div class="dlg-portrait">${portrait ? `<img src="${portrait}" alt="${speaker === "dan" ? "Дэн" : character?.name || c.npc}" data-portrait="${speaker}">` : ""}</div>`;
    root.style.display = "grid";
    root.querySelectorAll("button[data-di]").forEach((button) => {
      button.addEventListener("click", () =>
        onChoice(choices[Number(button.dataset.di)]),
      );
    });
  }

  return {
    render,
    chooseByNumber(n) {
      const choices = dialogueChoices(state, getContext());
      if (choices[n]) onChoice(choices[n]);
    },
  };
}
