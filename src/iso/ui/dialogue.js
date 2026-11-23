import { dialogueChoices } from "../systems/dialogue.js";

export function createDialogueUI({ root, getContext, onChoice }) {
  let state = null;

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
        ? `<div class="hint">E / Enter — закрыть</div>`
        : `<div class="hint">E / Enter — дальше</div>`;
    root.innerHTML = `<div class="who">${c.title || c.npc}</div><div>${c.lines[D.line]}</div>${buttons}`;
    root.style.display = "block";
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
