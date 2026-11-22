// DOM-интерфейс: рюкзак (действия по клику на ячейку), обыск, крафт, персонаж.
// Отделён от игрового цикла.
import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { CONTAINER_NAMES } from "../systems/loot.js";
import { iconHtml } from "../render/icons.js";
import { journalHtml } from "./journal.js";
import {
  SKILLS,
  ATTRS,
  MAX_LEVEL,
  SKILL_XP_BASE,
  ATTR_XP_BASE,
} from "../data/skills.js";
import { xpToNext } from "../systems/skills.js";
import { countItem } from "../systems/inventory.js";
import { campDef, trustLevel, residents, canAfford } from "../systems/camps.js";
import { TRUST_NAMES, DON_VALUES } from "../data/camps.js";
import { baseCapacity, baseDefense } from "../systems/base.js";
import { BASE_STRUCTURES } from "../data/base.js";

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
  getSkills,
  getMods,
  onTrunkTake,
  onTrunkPut,
  onCampBuy,
  onCampDonate,
  onCampDeliver,
  onCampBuild,
  onCampService,
  getBase,
  onBaseFound,
  onBaseBuild,
  onBaseTake,
  onBasePut,
  getJournal,
}) {
  const root = document.getElementById("ui");
  let mode = null; // null | 'inv' | 'loot' | 'craft' | 'char' | 'trunk' | 'camp' | 'base' | 'journal'
  let lootTarget = null;
  let trunkCar = null;
  let campTarget = null;
  let ctxSlot = -1; // слот с открытым контекстным меню

  function close() {
    mode = null;
    lootTarget = null;
    trunkCar = null;
    campTarget = null;
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
    const m = getMods?.();
    const btns = [];
    if (s.id === "can")
      btns.push(
        `<button data-act="use">Съесть (+${40 + (m?.foodBonus ?? 0)} сытости)</button>`,
      );
    if (s.id === "meds")
      btns.push(
        `<button data-act="use">Перевязать (+${30 + (m?.healBonus ?? 0)} HP)</button>`,
      );
    if (s.id === "torch")
      btns.push(`<button data-act="use">Зажечь / погасить</button>`);
    btns.push(`<button data-act="drop">Выбросить</button>`);
    return `<div class="ctxmenu" data-slot="${i}">${btns.join("")}</div>`;
  }

  function slotHtml(s, i) {
    const sel = ctxSlot === i ? " sel" : "";
    if (!s) return `<div class="slot"></div>`;
    const def = ITEMS[s.id];
    return `<div class="slot${sel}" data-slot="${i}" title="${def.name}">${iconHtml(s.id, 24)}<span class="n">${s.n}</span>${slotActions(s, i)}</div>`;
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
          ? `<div class="loot-row" data-i="${i}">${iconHtml(s.id, 18)} ${ITEMS[s.id].name} ×${s.n} <button data-i="${i}">взять</button></div>`
          : "",
      )
      .join("");
    return `<div class="panel"><h3>Обыск: ${CONTAINER_NAMES[lootTarget.kind] || lootTarget.kind}</h3>
      <div class="loot-list">${rows || '<div class="dim">пусто</div>'}</div>
      <button id="takeAll">Взять всё</button>
      <h3>Рюкзак</h3><div class="grid">${inv.slots.map(slotHtml).join("")}</div>
      <div class="hint">клик по предмету — действия · E / Esc — закрыть</div></div>`;
  }

  function craftPanel() {
    const rows = RECIPES.map((r) => {
      const ok = canCraft(r);
      const ins = Object.entries(r.inputs)
        .map(([id, n]) => `${iconHtml(id, 14)} ${n}`)
        .join(" + ");
      return `<div class="loot-row ${ok ? "" : "dim"}">${iconHtml(r.out.id, 18)} ${r.name} <span class="dim">(${ins})</span>
        <button class="craft" data-id="${r.id}" ${ok ? "" : "disabled"}>создать</button></div>`;
    }).join("");
    return `<div class="panel"><h3>Крафт</h3><div class="loot-list">${rows}</div>
      <div class="hint">C / Esc — закрыть</div></div>`;
  }

  function charPanel() {
    const S = getSkills();
    const row = (def, st, base) => {
      const max = st.level >= MAX_LEVEL;
      const pct = max
        ? 100
        : Math.min(100, Math.floor((st.xp / xpToNext(st.level, base)) * 100));
      return `<div class="skill-row"><span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="lv">${max ? "МАКС" : "ур. " + st.level}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="ds">${def.desc}</span></div>`;
    };
    return `<div class="panel wide"><h3>Характеристики</h3>
      ${Object.entries(ATTRS)
        .map(([id, a]) => row(a, S.attrs[id], ATTR_XP_BASE))
        .join("")}
      <h3>Навыки</h3>
      ${Object.entries(SKILLS)
        .map(([id, s]) => row(s, S.skills[id], SKILL_XP_BASE))
        .join("")}
      <div class="hint">Навыки растут от действий: стрельба, бег, крафт, обыск, вождение, лечение, пережитые ночи. P / Esc — закрыть</div></div>`;
  }

  function trunkPanel() {
    const tr = trunkCar.trunk;
    const inv = getInventory();
    const grid = (slots, side) =>
      slots
        .map((s, i) => {
          if (!s)
            return `<div class="slot" data-side="${side}" data-slot="${i}"></div>`;
          const def = ITEMS[s.id];
          return `<div class="slot" data-side="${side}" data-slot="${i}" title="${def.name}">${iconHtml(s.id, 24)}<span class="n">${s.n}</span></div>`;
        })
        .join("");
    return `<div class="panel wide"><h3>Багажник (${tr.size} слотов)</h3>
      <div class="grid">${grid(tr.slots, "trunk")}</div>
      <h3>Рюкзак</h3><div class="grid">${grid(inv.slots, "inv")}</div>
      <div class="hint">клик по предмету — переложить стак целиком · T / Esc — закрыть</div></div>`;
  }

  function campPanel() {
    const c = campTarget;
    const def = campDef(c);
    const inv = getInventory();
    const lv = trustLevel(c);
    const cost = (ct) =>
      Object.entries(ct || {})
        .map(([id, n]) => `${iconHtml(id, 14)}${n}`)
        .join(" ") || "бесплатно";
    const rows = c.stock
      .map((s, i) => {
        if (s.n <= 0) return "";
        const gate = lv < (s.minTrust || 0);
        const ok = !gate && canAfford(inv, s.cost || {});
        return `<div class="loot-row ${ok ? "" : "dim"}">${iconHtml(s.id, 18)} ${ITEMS[s.id].name} ×${s.n} <span class="dim">(${cost(s.cost)})</span>
        <button data-camp="buy" data-i="${i}" ${ok ? "" : "disabled"}>${gate ? `доверие ${s.minTrust}` : "купить"}</button></div>`;
      })
      .join("");
    const req = c.request;
    const reqHtml = req
      ? `<div class="loot-row">${iconHtml(req.id, 18)} ${ITEMS[req.id].name} ×${req.n} <span class="dim">→ +${req.trust} доверия, ${req.reward.map(([id, n]) => `${iconHtml(id, 14)}${n}`).join(" ")}</span>
        <button data-camp="deliver" ${canAfford(inv, { [req.id]: req.n }) ? "" : "disabled"}>отдать</button></div>`
      : '<div class="dim">Поручений нет — загляни завтра.</div>';
    const don = Object.keys(DON_VALUES)
      .map((id) => {
        const have = countItem(inv, id);
        return `<button data-camp="donate" data-id="${id}" ${have ? "" : "disabled"} title="${ITEMS[id].name}">${iconHtml(id, 16)}+${DON_VALUES[id]}</button>`;
      })
      .join(" ");
    const ups = def.upgrades
      .map((u, i) => {
        const built = c.upgrades.includes(u.id);
        const ok = !built && canAfford(inv, u.cost);
        return `<div class="loot-row ${built || ok ? "" : "dim"}"><span class="nm">${u.name}</span> <span class="dim">${u.desc} (${cost(u.cost)})</span>
        <button data-camp="build" data-i="${i}" ${ok ? "" : "disabled"}>${built ? "построено" : "строить"}</button></div>`;
      })
      .join("");
    const heal = def.upgrades.find((u) => u.service === "heal");
    const healHtml =
      heal && c.upgrades.includes(heal.id)
        ? `<button data-camp="service">Лазарет: +30 HP (раз в день)</button>`
        : "";
    return `<div class="panel wide"><h3>${def.name} · ${TRUST_NAMES[lv]} · ${residents(c)} жит.</h3>
      <div class="hint">${def.npc.lines[0]}</div>
      <h3>Поручение</h3><div class="loot-list">${reqHtml}</div>
      <h3>Торговля (бартер)</h3><div class="loot-list">${rows || '<div class="dim">склад пуст</div>'}</div>
      <h3>Пожертвовать (+доверие)</h3><div class="loot-row">${don}</div>
      <h3>Постройки</h3><div class="loot-list">${ups}</div>
      ${healHtml}
      <div class="hint">доверие ${c.trust} · E / Esc — закрыть</div></div>`;
  }

  function basePanel() {
    const b = getBase();
    const inv = getInventory();
    if (!b.founded)
      return `<div class="panel"><h3>База</h3>
        <div class="hint">Основать базу на этом месте? Нужен открытый газон вне зданий.</div>
        <button data-base="found">Основать базу</button>
        <div class="hint">V / Esc — закрыть</div></div>`;
    const cost = (ct) =>
      Object.entries(ct)
        .map(([id, n]) => `${iconHtml(id, 14)}${n}`)
        .join(" ") || "бесплатно";
    const ups = BASE_STRUCTURES.map((s, i) => {
      const n = b.structures.filter((k) => k === s.id).length;
      const ok = canAfford(inv, s.cost);
      return `<div class="loot-row ${ok ? "" : "dim"}"><span class="nm">${s.name}${n ? ` ×${n}` : ""}</span> <span class="dim">${s.desc} (${cost(s.cost)})</span>
        <button data-base="build" data-i="${i}" ${ok ? "" : "disabled"}>строить</button></div>`;
    }).join("");
    const grid = (slots, side) =>
      slots
        .map((s, i) => {
          if (!s)
            return `<div class="slot" data-side="${side}" data-slot="${i}"></div>`;
          const d = ITEMS[s.id];
          return `<div class="slot" data-side="${side}" data-slot="${i}" title="${d.name}">${iconHtml(s.id, 24)}<span class="n">${s.n}</span></div>`;
        })
        .join("");
    return `<div class="panel wide"><h3>База · жителей ${b.residents}/${baseCapacity(b)} · защита ${baseDefense(b)}</h3>
      <h3>Постройки</h3><div class="loot-list">${ups}</div>
      <h3>Склад базы (${b.storage.size})</h3><div class="grid">${grid(b.storage.slots, "base")}</div>
      <h3>Рюкзак</h3><div class="grid">${grid(inv.slots, "inv")}</div>
      <div class="hint">клик по предмету — переложить · жители приходят при месте и еде · ночью рейд · V / Esc — закрыть</div></div>`;
  }

  function journalPanel() {
    return `<div class="panel wide journal">${journalHtml(getJournal())}</div>`;
  }

  function render() {
    if (!mode) return;
    root.innerHTML =
      mode === "inv"
        ? invPanel()
        : mode === "craft"
          ? craftPanel()
          : mode === "char"
            ? charPanel()
            : mode === "trunk"
              ? trunkPanel()
              : mode === "camp"
                ? campPanel()
                : mode === "base"
                  ? basePanel()
                  : mode === "journal"
                    ? journalPanel()
                    : lootPanel();
    root.style.display = "flex";
    if (mode === "base") {
      root.querySelectorAll("button[data-base]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const a = btn.dataset.base;
          if (a === "found") onBaseFound?.();
          if (a === "build") onBaseBuild?.(Number(btn.dataset.i));
          render();
        }),
      );
      root.querySelectorAll(".slot[data-side]").forEach((el) =>
        el.addEventListener("click", () => {
          const i = Number(el.dataset.slot);
          if (el.dataset.side === "base") onBaseTake?.(i);
          else onBasePut?.(i);
          render();
        }),
      );
      return;
    }
    if (mode === "camp") {
      root.querySelectorAll("button[data-camp]").forEach((b) =>
        b.addEventListener("click", () => {
          const act = b.dataset.camp;
          if (act === "buy") onCampBuy?.(Number(b.dataset.i));
          if (act === "donate") onCampDonate?.(b.dataset.id);
          if (act === "deliver") onCampDeliver?.();
          if (act === "build") onCampBuild?.(Number(b.dataset.i));
          if (act === "service") onCampService?.();
          render();
        }),
      );
      return;
    }
    if (mode === "trunk") {
      root.querySelectorAll(".slot[data-side]").forEach((el) =>
        el.addEventListener("click", () => {
          const i = Number(el.dataset.slot);
          if (el.dataset.side === "trunk") onTrunkTake?.(i);
          else onTrunkPut?.(i);
          render();
        }),
      );
      return;
    }
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
    openCharacter() {
      mode = "char";
      ctxSlot = -1;
      render();
    },
    openTrunk(car) {
      mode = "trunk";
      trunkCar = car;
      ctxSlot = -1;
      render();
    },
    openCamp(camp) {
      mode = "camp";
      campTarget = camp;
      ctxSlot = -1;
      render();
    },
    openBase() {
      mode = "base";
      ctxSlot = -1;
      render();
    },
    openJournal() {
      mode = "journal";
      ctxSlot = -1;
      render();
    },
  };
}
