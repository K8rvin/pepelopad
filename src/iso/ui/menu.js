// Главное меню, настройки и подтверждение новой игры (без нативных confirm).
// DOM-оверлеи; игровое состояние не меняет — только колбэки наружу.
import { DEFAULT_SETTINGS } from "../persistence/settings.js";

const CONTROLS = `
  WASD — движение / руль · Shift — бег · ЛКМ — лук (удерживать — натяжение)<br>
  E — обыск / сесть / выйти / лестница / диалог · X — спуск с этажа · B — разбить окно<br>
  I / Tab — рюкзак · C — крафт · P — персонаж · J — журнал · M — карта<br>
  Q — съесть · H — бинт · T — багажник · F — заправить · V — база<br>
  R — возрождение · Esc — пауза · F3 — отладка`;

export function createMenu({
  menuRoot,
  settingsRoot,
  confirmRoot,
  getSettings,
  onSettingsChange,
  onStartFresh,
  onContinue,
  onNewGame,
  hasSave,
}) {
  let titleOpen = false;
  let settingsOpen = false;
  let confirmOpen = false;

  function hideTitle() {
    titleOpen = false;
    menuRoot.style.display = "none";
    menuRoot.innerHTML = "";
  }
  function showTitle(canContinue) {
    titleOpen = true;
    menuRoot.innerHTML = `
      <div class="menu-panel">
        <h1>МЁРТВЫЙ РАЙОН</h1>
        <div class="menu-sub">изометрический survival · мёртвый пригород</div>
        <div class="menu-btns">
          ${canContinue ? '<button id="mContinue">Продолжить</button>' : ""}
          <button id="mNew">${canContinue ? "Новая игра" : "Начать игру"}</button>
          <button id="mSettings">Настройки</button>
          <button id="mControls">Управление</button>
        </div>
        <div id="mControlsBody" class="menu-controls" style="display:none">${CONTROLS}</div>
        <div class="menu-foot">Автосохранение каждые 15 с · сюжет и мир сохраняются</div>
      </div>`;
    menuRoot.style.display = "flex";
    menuRoot.querySelector("#mContinue")?.addEventListener("click", () => {
      hideTitle();
      onContinue?.();
    });
    menuRoot.querySelector("#mNew").addEventListener("click", askNewGame);
    menuRoot
      .querySelector("#mSettings")
      .addEventListener("click", showSettings);
    menuRoot.querySelector("#mControls").addEventListener("click", () => {
      const b = menuRoot.querySelector("#mControlsBody");
      b.style.display = b.style.display === "none" ? "block" : "none";
    });
  }

  function askNewGame() {
    if (hasSave?.())
      confirm("Начать заново? Текущее сохранение будет удалено.", onNewGame);
    else {
      hideTitle();
      onStartFresh?.();
    }
  }

  function confirm(message, onYes) {
    confirmOpen = true;
    confirmRoot.innerHTML = `
      <div class="menu-panel small">
        <div class="confirm-msg">${message}</div>
        <div class="menu-btns row">
          <button id="cYes">Да</button>
          <button id="cNo">Нет</button>
        </div>
      </div>`;
    confirmRoot.style.display = "flex";
    confirmRoot.querySelector("#cYes").addEventListener("click", () => {
      hideConfirm();
      onYes?.();
    });
    confirmRoot.querySelector("#cNo").addEventListener("click", hideConfirm);
  }
  function hideConfirm() {
    confirmOpen = false;
    confirmRoot.style.display = "none";
    confirmRoot.innerHTML = "";
  }

  function hideSettings() {
    settingsOpen = false;
    settingsRoot.style.display = "none";
    settingsRoot.innerHTML = "";
  }
  function showSettings() {
    settingsOpen = true;
    const s = getSettings();
    const slider = (id, label, val) => `
      <label class="set-row">
        <span>${label}</span>
        <input type="range" min="0" max="100" value="${Math.round(val * 100)}" data-set="${id}">
        <b data-out="${id}">${Math.round(val * 100)}%</b>
      </label>`;
    settingsRoot.innerHTML = `
      <div class="menu-panel">
        <h2>Настройки</h2>
        ${slider("master", "Общая громкость", s.master)}
        ${slider("sfx", "Эффекты", s.sfx)}
        ${slider("amb", "Атмосфера", s.amb)}
        <label class="set-row check">
          <span>Отладочная панель (F3)</span>
          <input type="checkbox" data-set="debug" ${s.debug ? "checked" : ""}>
        </label>
        <div class="menu-btns row">
          <button id="setBack">Назад</button>
          <button id="setReset">Сбросить</button>
        </div>
      </div>`;
    settingsRoot.style.display = "flex";
    settingsRoot.querySelectorAll("input[data-set]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const cur = { ...getSettings() };
        const key = inp.dataset.set;
        if (key === "debug") cur.debug = inp.checked;
        else {
          cur[key] = Number(inp.value) / 100;
          settingsRoot.querySelector(`[data-out="${key}"]`).textContent =
            inp.value + "%";
        }
        onSettingsChange?.(cur);
      });
    });
    settingsRoot
      .querySelector("#setBack")
      .addEventListener("click", hideSettings);
    settingsRoot.querySelector("#setReset").addEventListener("click", () => {
      onSettingsChange?.({ ...DEFAULT_SETTINGS });
      hideSettings();
      showSettings();
    });
  }

  return {
    showTitle,
    hideTitle,
    showSettings,
    hideSettings,
    askNewGame,
    confirm,
    hideConfirm,
    isOpen: () => titleOpen || settingsOpen || confirmOpen,
    titleVisible: () => titleOpen,
    settingsVisible: () => settingsOpen,
    confirmVisible: () => confirmOpen,
  };
}
