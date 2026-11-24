// Игровой HUD: полоски HP/сытости, часы, стрелы, хотбар, тосты, экран смерти.
// DOM-интерфейс отделён от цикла; отрисовка мира сюда не вмешивается.
import { iconHtml } from "../render/icons.js";
import { ITEMS } from "../data/items.js";

export function createHud({ hudRoot, toastsRoot, debugRoot, deathRoot }) {
  hudRoot.innerHTML = `
    <div id="hudStatus">
      <div class="hudbar hp"><i></i><span></span></div>
      <div class="hudbar food"><i></i><span></span></div>
      <div class="hudbar stam"><i></i><span></span></div>
      <div id="hudMeta"><span id="hudClock"></span><span id="hudArrows"></span><span id="hudFloor"></span><span id="hudInf"></span><span id="hudStealth"></span></div>
    </div>
    <div id="objective"></div>
    <div id="hudStory"></div>
    <div id="hudWeapons"></div>
    <div id="hudHotbar"></div>`;
  const hpBar = hudRoot.querySelector(".hudbar.hp");
  const foodBar = hudRoot.querySelector(".hudbar.food");
  const hpFill = hpBar.querySelector("i");
  const hpText = hpBar.querySelector("span");
  const foodFill = foodBar.querySelector("i");
  const foodText = foodBar.querySelector("span");
  const stamBar = hudRoot.querySelector(".hudbar.stam");
  const stamFill = stamBar.querySelector("i");
  const stamText = stamBar.querySelector("span");
  const infEl = hudRoot.querySelector("#hudInf");
  const stealthEl = hudRoot.querySelector("#hudStealth");
  const clockEl = hudRoot.querySelector("#hudClock");
  const arrowsEl = hudRoot.querySelector("#hudArrows");
  const floorEl = hudRoot.querySelector("#hudFloor");
  const storyEl = hudRoot.querySelector("#hudStory");
  const weaponsEl = hudRoot.querySelector("#hudWeapons");
  const hotbarEl = hudRoot.querySelector("#hudHotbar");

  let lastHotbar = "";
  let lastWeapons = "";
  let deathOpen = false;
  let respawnFn = null;

  function update(s) {
    const hpPct = Math.max(0, Math.min(100, (s.hp / s.maxHp) * 100));
    hpFill.style.width = hpPct + "%";
    hpText.textContent = `HP ${Math.ceil(s.hp)}/${s.maxHp}`;
    hpBar.classList.toggle("low", hpPct < 30);
    const foodPct = Math.max(0, Math.min(100, s.hunger));
    foodFill.style.width = foodPct + "%";
    foodText.textContent = `Сытость ${Math.ceil(s.hunger)}`;
    foodBar.classList.toggle("low", foodPct < 25);
    const stamPct = Math.max(0, Math.min(100, s.stamina ?? 100));
    stamFill.style.width = stamPct + "%";
    stamText.textContent = s.exhausted
      ? "Истощение"
      : `Стамина ${Math.ceil(stamPct)}`;
    stamBar.classList.toggle("low", s.exhausted || stamPct < 25);
    infEl.textContent = s.infected ? "☣ инфекция" : "";
    infEl.classList.toggle("inf", !!s.infected);
    const stealth = s.stealth || {};
    stealthEl.textContent = stealth.crouched
      ? stealth.moving
        ? "R присед · тихо"
        : "R присед"
      : stealth.sprinting
        ? "ШУМ"
        : "";
    stealthEl.title = `Шум ${stealth.noiseRadius ?? 0} м`;
    stealthEl.className = stealth.crouched
      ? "quiet"
      : stealth.sprinting
        ? "loud"
        : "";
    clockEl.textContent = s.clock;
    arrowsEl.innerHTML = `${iconHtml("arrow", 14)} ${s.arrows}`;
    floorEl.textContent = s.level > 0 ? `этаж ${s.level + 1}` : "";
    storyEl.textContent = s.story || "";
    const wb = (s.weapons || [])
      .map(
        (w) =>
          `<span class="wep${w.active ? " on" : ""}${w.owned ? "" : " off"}"><b>${w.key}</b> ${w.name} · ${
            w.owned
              ? w.kind === "ranged"
                ? "ЛКМ выстрел"
                : "ЛКМ удар"
              : "нет предмета"
          }</span>`,
      )
      .join("");
    const fists = s.fists
      ? `<span class="wep on"><b>✊</b> Кулаки · ЛКМ удар</span>`
      : "";
    const wh = wb + fists;
    if (wh !== lastWeapons) {
      lastWeapons = wh;
      weaponsEl.innerHTML = wh;
    }
    // хотбар: Q — еда, H — бинт, факел; в машине — скорость и топливо
    let hb;
    if (s.inCar) {
      hb = `<span class="hb car">Авто · ${Math.abs(s.speed * 3.6).toFixed(0)} км/ч · ${s.fuel}</span>`;
    } else {
      hb =
        `<span class="hb">${s.weapon ? `${s.weapon.icon} ${s.weapon.name}` : ""}</span>` +
        `<span class="hb"><b>Q</b>${iconHtml("can", 16)} ${s.cans}</span>` +
        `<span class="hb"><b>H</b>${iconHtml("meds", 16)} ${s.meds}</span>` +
        (s.torch
          ? `<span class="hb lit">${iconHtml("torch", 16)} ${Math.ceil(s.torchT)}с</span>`
          : "") +
        (s.camp ? `<span class="hb"><b>E</b> лагерь «${s.camp}»</span>` : "") +
        (s.noArrows ? `<span class="hb lit">НЕТ СТРЕЛ</span>` : "") +
        (s.companion
          ? `<span class="hb"><b>G</b> ${s.companion.name}: ${s.companion.state === "following" ? "идёт" : "ждёт"}</span>`
          : "");
    }
    if (hb !== lastHotbar) {
      hotbarEl.innerHTML = hb;
      lastHotbar = hb;
    }
  }

  function toast(msg, big = false) {
    const el = document.createElement("div");
    el.className = "toast" + (big ? " big" : "");
    el.textContent = msg;
    toastsRoot.appendChild(el);
    while (toastsRoot.children.length > 4) toastsRoot.firstChild.remove();
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  function setDebug(v) {
    debugRoot.style.display = v ? "block" : "none";
  }
  function updateDebug(d) {
    debugRoot.textContent =
      `FPS ${d.fps.toFixed(0)} · кадр ${d.ms.toFixed(1)} мс · drawImage ${d.draws} · чанков ${d.chunks}\n` +
      `сид ${d.seed} · ${d.size}×${d.size} м · зданий ${d.buildings} · зомби ${d.zombies}`;
  }

  function showDeath({
    day,
    kills,
    distance,
    arrowsFired,
    itemsLooted,
    deaths,
    lost,
    home,
    onRespawn,
  }) {
    respawnFn = onRespawn;
    deathOpen = true;
    const lostHtml = lost.length
      ? lost.map((l) => `${ITEMS[l.id]?.name || l.id} ×${l.n}`).join(", ")
      : "ничего";
    deathRoot.innerHTML = `
      <div class="death-panel">
        <h2>ТЫ ПОГИБ</h2>
        <div class="death-stats">
          <div><span>Дней прожито</span><b>${day}</b></div>
          <div><span>Убито зомби</span><b>${kills}</b></div>
          <div><span>Пройдено</span><b>${(distance / 1000).toFixed(2)} км</b></div>
          <div><span>Выстрелов</span><b>${arrowsFired}</b></div>
          <div><span>Добыто предметов</span><b>${itemsLooted}</b></div>
          <div><span>Смертей</span><b>${deaths}</b></div>
        </div>
        <div class="death-lost">При возрождении потеряно: <b>${lostHtml}</b></div>
        <button id="respawnBtn">Возродиться (R)</button>
        <div class="hint">${home ? "Возрождение в своём номере мотеля" : "Возрождение у парка"}, сытость снизится. Прогресс мира сохранён.</div>
      </div>`;
    deathRoot.style.display = "flex";
    deathRoot.querySelector("#respawnBtn").addEventListener("click", () => {
      respawnFn?.();
    });
  }
  function hideDeath() {
    deathOpen = false;
    respawnFn = null;
    deathRoot.style.display = "none";
    deathRoot.innerHTML = "";
  }

  return {
    update,
    toast,
    setDebug,
    updateDebug,
    showDeath,
    hideDeath,
    isDeathOpen: () => deathOpen,
  };
}
