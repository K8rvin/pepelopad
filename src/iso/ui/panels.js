// DOM-интерфейс: панель рюкзака и панель обыска. Отделён от игрового цикла.
import { ITEMS } from "../data/items.js";

export function createUI({
  getInventory,
  getLootState,
  onTake,
  onTakeAll,
  onClose,
}) {
  const root = document.getElementById("ui");
  let mode = null; // null | 'inv' | 'loot'
  let lootTarget = null;

  function close() {
    mode = null;
    lootTarget = null;
    root.innerHTML = "";
    root.style.display = "none";
    onClose?.();
  }

  function isOpen() {
    return mode !== null;
  }

  function slotHtml(s) {
    if (!s) return `<div class="slot"></div>`;
    const def = ITEMS[s.id];
    return `<div class="slot" title="${def.name}"><span class="ic">${def.icon}</span><span class="n">${s.n}</span></div>`;
  }

  function invPanel() {
    const inv = getInventory();
    return `<div class="panel"><h3>Рюкзак</h3><div class="grid">${inv.slots.map(slotHtml).join("")}</div>
      <div class="hint">I / Tab / Esc — закрыть</div></div>`;
  }

  function lootPanel() {
    const inv = getInventory();
    const items = getLootState(lootTarget) || [];
    const rows = items
      .map((s, i) =>
        s
          ? `<div class="loot-row" data-i="${i}"><span class="ic">${ITEMS[s.id].icon}</span> ${ITEMS[s.id].name} ×${s.n} <button data-i="${i}">взять</button></div>`
          : "",
      )
      .join("");
    return `<div class="panel"><h3>Обыск: ${lootTarget.kind === "dumpster" ? "мусорный контейнер" : "бочка"}</h3>
      <div class="loot-list">${rows || '<div class="dim">пусто</div>'}</div>
      <button id="takeAll">Взять всё</button>
      <h3>Рюкзак</h3><div class="grid">${inv.slots.map(slotHtml).join("")}</div>
      <div class="hint">E / Esc — закрыть</div></div>`;
  }

  function render() {
    if (!mode) return;
    root.innerHTML = mode === "inv" ? invPanel() : lootPanel();
    root.style.display = "flex";
    if (mode === "loot") {
      root.querySelectorAll(".loot-row button").forEach((b) =>
        b.addEventListener("click", () => {
          onTake(lootTarget, Number(b.dataset.i));
          render();
        }),
      );
      root.querySelector("#takeAll")?.addEventListener("click", () => {
        onTakeAll(lootTarget);
        render();
      });
    }
  }

  return {
    close,
    isOpen,
    render,
    openInventory() {
      mode = "inv";
      render();
    },
    openLoot(c) {
      mode = "loot";
      lootTarget = c;
      render();
    },
  };
}
