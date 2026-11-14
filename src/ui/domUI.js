import { clamp } from "../core/math.js";

const TABS = [
  "inv",
  "craft",
  "skill",
  "quest",
  "base",
  "camp",
  "trunk",
  "log",
  "map",
];
const TITLES = {
  inv: "РЮКЗАК",
  craft: "КРАФТ",
  skill: "НАВЫКИ",
  quest: "ЗАДАНИЯ",
  base: "ПОСТРОЙКИ",
  camp: "ЛАГЕРЬ",
  trunk: "БАГАЖНИК",
  log: "ЖУРНАЛ",
  map: "КАРТА ГОРОДА",
};

export function createDomUI({
  $,
  getState,
  setState,
  setBody,
  mouse,
  saveGame,
  playUi,
  renderTab,
  getViewport,
}) {
  let curTab = "inv";

  function toast(text, type) {
    const element = document.createElement("div");
    element.className = "toast " + (type || "");
    element.textContent = text;
    $("toasts").appendChild(element);
    while ($("toasts").children.length > 6)
      $("toasts").removeChild($("toasts").firstChild);
    setTimeout(() => {
      element.classList.add("out");
      setTimeout(() => element.remove(), 350);
    }, 3600);
  }

  function panelOpen() {
    return !$("panel").classList.contains("hid");
  }

  function openPanel(tab) {
    if (getState() !== "play" && getState() !== "panel") return;
    setState("panel");
    setBody("play");
    mouse.down = false;
    $("panel").classList.remove("hid");
    $("pauseChip").classList.remove("hid");
    setTab(tab || curTab);
    playUi();
    saveGame();
  }

  function closePanel() {
    $("panel").classList.add("hid");
    $("pauseChip").classList.add("hid");
    hideTip();
    if (getState() === "panel") setState("play");
  }

  function setTab(tab) {
    curTab = tab;
    document
      .querySelectorAll(".tab")
      .forEach((button) =>
        button.classList.toggle("on", button.dataset.tab === tab),
      );
    for (const name of TABS)
      $("tab-" + name).classList.toggle("hid", name !== tab);
    $("panelTitle").textContent = TITLES[tab];
    renderTab(tab);
  }

  function showTip(html, x, y) {
    const tip = $("tip");
    tip.innerHTML = html;
    tip.classList.remove("hid");
    const rect = tip.getBoundingClientRect();
    const { W, H } = getViewport();
    tip.style.left = clamp(x + 14, 4, W - rect.width - 6) + "px";
    tip.style.top = clamp(y + 14, 4, H - rect.height - 6) + "px";
  }

  function hideTip() {
    $("tip").classList.add("hid");
  }

  return {
    toast,
    panelOpen,
    openPanel,
    closePanel,
    setTab,
    showTip,
    hideTip,
    getTab: () => curTab,
  };
}
