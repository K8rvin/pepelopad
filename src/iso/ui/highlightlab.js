// Лаборатория подсветки цели: живое переключение вариантов в сессии,
// выбор — playtest-ом пользователя; после выбора лаборатория удаляется.
export const HIGHLIGHT_VARIANTS = [
  ["float", "Над целью (сейчас)"],
  ["ground", "Кольцо у основания"],
  ["outline", "Свечение силуэта"],
  ["frame", "Уголки рамки"],
  ["beam", "Столб света"],
];

export function createHighlightLab({ onPick } = {}) {
  const root = document.createElement("div");
  root.id = "hllab";
  root.hidden = true;
  root.innerHTML =
    `<div class="hl-title">Подсветка цели · F6</div>` +
    HIGHLIGHT_VARIANTS.map(
      ([id, name]) => `<button data-hl="${id}">${name}</button>`,
    ).join("");
  document.body.appendChild(root);
  root.addEventListener("click", (e) => {
    const id = e.target?.dataset?.hl;
    if (id) onPick?.(id);
  });
  function mark(id) {
    for (const b of root.querySelectorAll("button"))
      b.classList.toggle("on", b.dataset.hl === id);
  }
  return {
    toggle() {
      root.hidden = !root.hidden;
    },
    mark,
    get open() {
      return !root.hidden;
    },
  };
}
