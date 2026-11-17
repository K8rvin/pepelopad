// DOM-интерфейс: рюкзак (действия по клику на ячейку), обыск, крафт.
// Отделён от игрового цикла.
import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";

export function createUI({
  getInventory,
  getLootState,
  onTake,
  onTakeAll,
  onUse,
  onDrop,
  onCraft,
  canCraft,
  onClose,
}) {
  const root = document.getElementById("ui");
  let mode = null; // null | 'inv' | 'loot' | 'craft'
  let lootTarget = null;
  let ctxSlot = -1; // слот с открытым контекстным меню

  function close() {
    mode = null;
    lootTarget = null;
    ctxSlot = -1;
    root.innerHTML = "";
    root.style.display = "none";
    onClose?.();
  }

  function isOpen() {
    return mode !== null;
  }

  // действия предмета по клику на ячейку
  function slotActions(s, i) {
    if (ctxSlot !== i || !s) return "";
    const def = ITEMS[s.id];
    const btns = [];
    if (s.id === "can")
      btns.push(`<button data-act="use">Съесть (+40 сытости)</button>`);
    if (s.id === "meds")
      btns.push(`<button data-act="use">Перевязать (+30 HP)</button>`);
    btns.push(`<button data-act="drop">Выбросить</button>`);
    return `<div class="ctxmenu" data-slot="${i}">${btns.join("")}</div>`;
  }

  function slotHtml(s, i) {
    const sel = ctxSlot === i ? " sel" : "";
    if (!s) return `<div class="slot"></div>`;
    const def = ITEMS[s.id];
    return `<div class="slot${sel}" data-slot="${i}" title="${def.name}"><span class="ic">${def.icon}</span><span class="n">${s.n}</span>${slotActions(s, i)}</div>`;
  }

  function invPanel() {
    const inv = getInventory();
    return `<div class="panel"><h3>Рюкзак</h3><div class="grid">${inv.slots.map(slotHtml).join("")}</div>
      <div class="hint">клик по предмету — действия · I / Tab / Esc — закрыть</div></div>`;
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
      <div class="hint">клик по предмету — действия · E / Esc — закрыть</div></div>`;
  }

  function craftPanel() {
    const rows = RECIPES.map((r) => {
      const ok = canCraft(r);
      const ins = Object.entries(r.inputs)
        .map(([id, n]) => `${ITEMS[id].icon} ${n}`)
        .join(" + ");
      return `<div class="loot-row ${ok ? "" : "dim"}"><span class="ic">${ITEMS[r.out.id].icon}</span> ${r.name} <span class="dim">(${ins})</span>
        <button class="craft" data-id="${r.id}" ${ok ? "" : "disabled"}>создать</button></div>`;
    }).join("");
    return `<div class="panel"><h3>Крафт</h3><div class="loot-list">${rows}</div>
      <div class="hint">C / Esc — закрыть</div></div>`;
  }

  function render() {
    if (!mode) return;
    root.innerHTML =
      mode === "inv"
        ? invPanel()
        : mode === "craft"
          ? craftPanel()
          : lootPanel();
    root.style.display = "flex";
    // слоты: клик → контекстное меню действий
    root.querySelectorAll(".slot[data-slot]").forEach((el) =>
      el.addEventListener("click", (e) => {
        const i = Number(el.dataset.slot);
        const actBtn = e.target.closest("button[data-act]");
        if (actBtn) {
          const inv = getInventory();
          const s = inv.slots[i];
          if (s) {
            if (actBtn.dataset.act === "use") onUse?.(s.id);
            if (actBtn.dataset.act === "drop") onDrop?.(i);
          }
          ctxSlot = -1;
        } else {
          ctxSlot = ctxSlot === i ? -1 : i;
        }
        render();
      }),
    );
    if (mode === "loot") {
      root.querySelectorAll(".loot-row button:not(.craft)").forEach((b) =>
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
    if (mode === "craft") {
      root.querySelectorAll("button.craft").forEach((b) =>
        b.addEventListener("click", () => {
          onCraft?.(b.dataset.id);
          render();
        }),
      );
    }
  }

  return {
    close,
    isOpen,
    render,
    openInventory() {
      mode = "inv";
      ctxSlot = -1;
      render();
    },
    openLoot(c) {
      mode = "loot";
      lootTarget = c;
      ctxSlot = -1;
      render();
    },
    openCraft() {
      mode = "craft";
      ctxSlot = -1;
      render();
    },
  };
}
