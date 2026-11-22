// Точка входа: город, рендер, актёры, цикл + слой презентации (этап 20).
// HUD/меню/карта/журнал/звук/статистика подключены здесь; механики — в systems/.
import { mulberry32 } from "./core/rng.js";
import { createAudio } from "./core/audio.js";
import {
  initVehicles,
  nearestCar,
  enterCar,
  exitCar,
  updateVehicle,
  refuelCar,
  fuelText,
  openTrunk,
} from "./systems/vehicles.js";
import { PITCH } from "./world/cityGen.js";
import { createCity, buildSolidIndex } from "./world/cityGen.js";
import { loadAssets, SPRTEX } from "./render/assets.js";
import { makeGroundSet } from "./render/tiles.js";
import {
  makeTree,
  makeLamp,
  makeBench,
  makeContainer,
  makeTires,
  makeFence,
  makeActor,
} from "./render/sprites.js";
import {
  createRenderer,
  bakeVignette,
  renderWorld,
} from "./render/renderer.js";
import { createLighting, fitLighting } from "./render/lighting.js";
import { litQueueSize, buildingLitCanvas } from "./render/buildings.js";
import {
  initActors,
  updatePlayer,
  updateZombies,
  spawnZombie,
  alertNear,
} from "./systems/actors.js";
import {
  createCombat,
  initCombat,
  updateCombat,
  releaseBow,
  meleeAttack,
  respawn,
  screenToWorld,
} from "./systems/combat.js";
import { weaponDef, WEAPONS } from "./data/weapons.js";
import {
  createInventory,
  addItem,
  countItem,
  removeItem,
  resizeInventory,
} from "./systems/inventory.js";
import {
  createLoot,
  nearestContainer,
  openContainer,
  containerItems,
  takeFrom,
  takeAll,
  registerInterior,
} from "./systems/loot.js";
import { createUI } from "./ui/panels.js";
import {
  createLevelUp,
  pushLevelUp,
  updateLevelUp,
  showLevelUpBanner,
  showQuestBanner,
} from "./ui/levelup.js";
import { createComic, say, lootFloat, updateComic } from "./ui/comic.js";
import { createGaitLab, toggleGaitLab, renderGaitLab } from "./ui/gaitlab.js";
import { createHud } from "./ui/hud.js";
import { createMap } from "./ui/map.js";
import { createMenu } from "./ui/menu.js";
import { ITEMS } from "./data/items.js";
import { RECIPES } from "./data/recipes.js";
import { canCraft, craft } from "./systems/craft.js";
import {
  createNpcs,
  npcNear,
  createDialog,
  openDialog,
  advanceDialog,
} from "./systems/npcs.js";
import { playerInside } from "./render/renderer.js";
import { getInterior, groundWindows } from "./world/interiors.js";
import {
  createQuests,
  mainQuest,
  goalText,
  goalDone,
  qEvent,
  questTargetPoi,
  poiBuilding,
} from "./systems/quests.js";
import { QUESTS } from "./data/quests.js";
import {
  saveGame,
  loadGameData,
  hasSave,
  deleteSave,
  applySave,
} from "./persistence/save.js";
import {
  loadSettings,
  saveSettings,
  mergeSettings,
} from "./persistence/settings.js";
import {
  createSurvival,
  darknessFor,
  clockText,
  updateSurvival,
  useConsumable,
} from "./systems/survival.js";
import {
  createSkills,
  gainXp,
  modifiers,
  NEUTRAL_MODS,
} from "./systems/skills.js";
import {
  createCamps,
  campNear,
  campDef,
  newDay as campsNewDay,
  buy as campBuy,
  donate as campDonate,
  deliver as campDeliver,
  build as campBuild,
  service as campService,
} from "./systems/camps.js";
import {
  createBase,
  foundBase,
  buildStructure as baseBuild,
  baseNewDay,
  baseRaid,
} from "./systems/base.js";
import {
  createStory,
  storyNear,
  applyChoice,
  storyHud,
} from "./systems/story.js";
import { createStats, deathPenalty, applyPenalty } from "./systems/stats.js";
import { w2s } from "./core/geo.js";

// фатальная ошибка: показываем отчёт вместо чёрного экрана, цикл останавливаем
function fatal(err) {
  const el = document.getElementById("fatal");
  if (!el) return;
  el.style.display = "flex";
  el.innerHTML = `<div class="fatal-panel">
    <h2>Ошибка игры</h2>
    <pre>${String(err && err.stack ? err.stack : err).replace(/</g, "&lt;")}</pre>
    <button onclick="location.reload()">Перезагрузить</button>
  </div>`;
  document.getElementById("loading")?.remove();
}

export async function boot() {
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get("seed")) || 11;
  const nb = Number(params.get("nb")) || 19;

  await loadAssets();
  const city = createCity(seed, nb);
  initActors(seed);

  const groundSet = makeGroundSet();
  const SPR = {
    trees: [0, 1, 2].map((v) => makeTree(false, v)),
    deadTrees: [0, 1, 2].map((v) => makeTree(true, v)),
    lamp: makeLamp(),
    bench: makeBench(),
    container: makeContainer(),
    tires: makeTires(),
    fenceX: makeFence("x"),
    fenceY: makeFence("y"),
    player: [makeActor("player", 0), makeActor("player", 1)],
    zombie: [makeActor("zombie", 0), makeActor("zombie", 1)],
  };

  const R = createRenderer();
  const L = createLighting();

  let W = 1280,
    H = 720;
  function fit() {
    W = innerWidth;
    H = innerHeight;
    cv.width = W;
    cv.height = H;
    ctx.imageSmoothingEnabled = false;
    fitLighting(L, W, H);
    R.vignette = bakeVignette(W, H);
  }
  fit();
  addEventListener("resize", fit);

  // состояние
  const player = {
    x: PITCH + 11 + 31,
    y: PITCH + 11 + 31,
    r: 0.35,
    pose: 0,
    animT: 0,
    level: 0,
    weapon: "bow",
  };
  const spawn = { x: player.x, y: player.y };
  const cam = { x: player.x, y: player.y };
  const keys = {};
  const combat = createCombat();
  initCombat(seed);
  const survival = createSurvival();
  const skills = createSkills();
  const craftRng = mulberry32(seed * 31 + 11);
  let mods = NEUTRAL_MODS;
  const inv = createInventory(24);
  const loot = createLoot(city);
  const quests = createQuests();
  const veh = { inCar: null };
  let trunkCar = null;
  let search = null;
  initVehicles(city);
  const npcs = createNpcs(city, PITCH).filter((n) => n.id !== "oleg");
  const hosp = poiBuilding(city, "Больница");
  if (hosp) {
    npcs.push({
      id: "raya",
      name: "Рая",
      lines: [
        "Рая: «Не шуми. Дети спят.»",
        "Рая: «Инсулин в холодильнике. Не трогай.»",
      ],
      x: hosp.x + hosp.doorU,
      y: hosp.y + hosp.h + 1.5,
    });
    npcs.push({
      id: "masha",
      name: "Маша",
      lines: ["Маша: «...»", "Маша: «Не подходи. Пожалуйста.»"],
      x: hosp.x + hosp.w / 2,
      y: hosp.y - 3,
    });
  }
  const dlg = createDialog();
  const camps = createCamps(city);
  let campTarget = null;
  const base = createBase();
  const story = createStory();
  const stats = createStats();
  const levelFx = createLevelUp();
  const gaitLab = createGaitLab();
  const comic = createComic();
  let lootOpen = null; // {c, taken:{id:n}} — сессия обыска для фидбека при закрытии

  // слой презентации: настройки, звук, HUD, карта, меню
  const settings = loadSettings(localStorage);
  const audio = createAudio();
  audio.setVolumes(settings);
  const hud = createHud({
    hudRoot: document.getElementById("hud"),
    toastsRoot: document.getElementById("toasts"),
    debugRoot: document.getElementById("debug"),
    deathRoot: document.getElementById("death"),
  });
  hud.setDebug(settings.debug);
  const map = createMap({
    minimapCanvas: document.getElementById("minimap"),
    bigRoot: document.getElementById("bigmap"),
    city,
  });
  const menu = createMenu({
    menuRoot: document.getElementById("menu"),
    settingsRoot: document.getElementById("settings"),
    confirmRoot: document.getElementById("confirm"),
    getSettings: () => settings,
    onSettingsChange: (s) => {
      Object.assign(settings, mergeSettings(s));
      saveSettings(settings, localStorage);
      audio.setVolumes(settings);
      hud.setDebug(settings.debug);
    },
    onStartFresh: () => {},
    onContinue: () => {},
    onNewGame: () => {
      deleteSave();
      location.search = "?new=1";
    },
    hasSave,
  });

  // загрузка сохранения
  const wantNew = params.get("new") === "1";
  let loaded = false;
  if (hasSave() && !wantNew) {
    const data = loadGameData();
    if (data && data.seed === seed && data.nb === nb) {
      applySave(data, {
        city,
        player,
        combat,
        survival,
        inv,
        loot,
        quests,
        skills,
        camps,
        base,
        story,
        stats,
      });
      buildSolidIndex(city);
      loaded = true;
    }
  }
  if (!loaded) {
    addItem(inv, "arrow", 12);
    addItem(inv, "can", 2);
    addItem(inv, "meds", 1);
  }
  mods = modifiers(skills);
  resizeInventory(inv, mods.carrySlots);
  combat.playerMaxHp = mods.maxHp;

  const toast = (msg) => hud.toast(msg);
  const skillXp = (id, n) => {
    for (const ev of gainXp(skills, id, n)) {
      pushLevelUp(levelFx, ev, player.x, player.y);
      if (ev.kind === "attr" && ev.id === "strength")
        resizeInventory(inv, modifiers(skills).carrySlots);
    }
  };
  const questEvent = (type, data) => {
    const done = qEvent(quests, QUESTS, type, data);
    if (done) {
      for (const [id, n] of done.reward) addItem(inv, id, n);
      showQuestBanner(done);
      audio.play("quest");
    }
  };
  combat.onKill = (source, z) => {
    questEvent("kill");
    if (source === "ram") skillXp("driving", 10);
    else if (source === "melee") skillXp("melee", 15);
    else skillXp("archery", 15);
    audio.play("kill");
    if (z?.type === "boss") {
      addItem(inv, "meds", 3);
      addItem(inv, "part", 2);
      toast("Матка мертва. Награда: бинты ×3, детали ×2.");
      audio.play("boss");
    }
  };
  combat.onHit = () => {
    skillXp("archery", 6);
    audio.play("hit");
  };
  combat.onHurt = () => {
    audio.play("hurt");
    say(comic, player.x, player.y, "Ай!", "alert", 0.9);
  };
  combat.onKnock = () => audio.play("knock");
  combat.onCarHit = () => audio.play("carHit");

  const useItem = (id) => {
    if (id === "torch") {
      if (player.torch) {
        player.torch = false;
        toast("Факел погашен.");
      } else if (countItem(inv, "torch") > 0) {
        player.torch = true;
        player.torchT = 120;
        toast("Факел зажжён. Горит ~2 минуты.");
        audio.play("torch");
      } else toast("Нет факела.");
      ui.render();
      return;
    }
    const hpBefore = combat.playerHp;
    const hungry = survival.hunger < 60;
    const msg = useConsumable(
      survival,
      combat,
      inv,
      id,
      (i, n) => removeItem(inv, i, n),
      mods,
    );
    if (msg) {
      toast(msg);
      audio.play(id === "meds" ? "bandage" : "eat");
      if (id === "meds" && combat.playerHp > hpBefore) {
        skillXp("medicine", 10);
        say(comic, player.x, player.y, "+HP", "heal", 1.2);
      }
      if (id === "can" && hungry) skillXp("survival", 5);
    }
    ui.render();
  };

  const equipWeapon = (id) => {
    if (id !== "bow" && countItem(inv, id) < 1) {
      toast(`Нет предмета: ${WEAPONS[id]?.name || id}`);
      return;
    }
    player.weapon = id;
    toast(`В руках: ${weaponDef(id).name}`);
    audio.play("uiClick");
    ui.render();
  };

  const ui = createUI({
    getInventory: () => inv,
    getLootState: (c) => loot.opened.get(c.id),
    onTake: (c, i) => {
      const { id, took } = takeFrom(loot, c, i, (id2, n) =>
        addItem(inv, id2, n),
      );
      if (took > 0) {
        questEvent("loot", { id, n: took });
        skillXp("scavenging", took);
        stats.itemsLooted += took;
        audio.play("pickup");
        if (lootOpen) lootOpen.taken[id] = (lootOpen.taken[id] || 0) + took;
      }
      if ((loot.opened.get(c.id) || []).every((s) => !s)) ui.close();
    },
    onTakeAll: (c) => {
      for (const [id, took] of takeAll(loot, c, (id2, n) =>
        addItem(inv, id2, n),
      )) {
        questEvent("loot", { id, n: took });
        skillXp("scavenging", took);
        stats.itemsLooted += took;
        if (lootOpen) lootOpen.taken[id] = (lootOpen.taken[id] || 0) + took;
      }
      audio.play("pickup");
      if ((loot.opened.get(c.id) || []).every((s) => !s)) ui.close();
    },
    onUse: (id) => useItem(id),
    onEquip: (id) => equipWeapon(id),
    onDrop: (slotIndex) => {
      const s = inv.slots[slotIndex];
      if (s) {
        toast(`Выброшено: ${ITEMS[s.id].name} ×${s.n}`);
        inv.slots[slotIndex] = null;
      }
    },
    onCraft: (id) => {
      const r = RECIPES.find((r) => r.id === id);
      if (r && craft(inv, r, mods.craftBonus, craftRng)) {
        toast(`Создано: ${r.name}`);
        skillXp("crafting", 8);
        stats.crafts++;
        audio.play("craft");
      }
    },
    canCraft: (r) => canCraft(inv, r),
    onClose: () => {
      // закрыл обыск — всплывающие «+N предмет» над контейнером и звук лутания
      if (lootOpen) {
        const items = Object.entries(lootOpen.taken).map(([id, n]) => ({
          id,
          n,
          name: ITEMS[id]?.name || id,
        }));
        if (items.length) {
          lootFloat(comic, lootOpen.c.x, lootOpen.c.y, items);
          audio.play("loot");
        }
        lootOpen = null;
      }
    },
    getSkills: () => skills,
    getMods: () => mods,
    onTrunkTake: (i) => {
      const tr = trunkCar?.trunk;
      const s = tr?.slots[i];
      if (!s) return;
      const left = addItem(inv, s.id, s.n);
      s.n = left;
      if (!left) tr.slots[i] = null;
      audio.play("pickup");
    },
    onTrunkPut: (i) => {
      const tr = trunkCar?.trunk;
      const s = inv.slots[i];
      if (!tr || !s) return;
      const left = addItem(tr, s.id, s.n);
      inv.slots[i] = left ? { id: s.id, n: left } : null;
      audio.play("pickup");
    },
    onCampBuy: (i) => {
      if (campTarget && campBuy(campTarget, inv, i)) {
        toast(`Куплено: ${ITEMS[campTarget.stock[i]?.id]?.name || "предмет"}`);
        audio.play("pickup");
      }
    },
    onCampDonate: (id) => {
      if (!campTarget) return;
      const g = campDonate(campTarget, inv, id, 1);
      if (g) toast(`Пожертвовано: +${g} доверия лагерю`);
    },
    onCampDeliver: () => {
      if (campTarget && campDeliver(campTarget, inv)) {
        toast("Поручение выполнено. Доверие и награда получены.");
        audio.play("quest");
      }
    },
    onCampBuild: (i) => {
      if (campTarget && campBuild(campTarget, inv, i)) {
        toast(`Построено: ${campDef(campTarget).upgrades[i].name}`);
        audio.play("craft");
      }
    },
    onCampService: () => {
      if (campTarget && campService(campTarget, combat, survival.day)) {
        toast("Лазарет: перевязка +30 HP.");
        audio.play("bandage");
        say(comic, player.x, player.y, "+HP", "heal", 1.2);
      }
    },
    getBase: () => base,
    onBaseFound: () => {
      if (foundBase(base, city, player)) {
        toast("База основана. Строй постройки и набирай жителей.");
        audio.play("craft");
      } else toast("Нужен открытый газон вне зданий.");
    },
    onBaseBuild: (i) => {
      if (baseBuild(base, inv, i)) {
        toast("Построено на базе.");
        audio.play("craft");
      }
    },
    onBaseTake: (i) => {
      const s = base.storage.slots[i];
      if (!s) return;
      const left = addItem(inv, s.id, s.n);
      s.n = left;
      if (!left) base.storage.slots[i] = null;
      audio.play("pickup");
    },
    onBasePut: (i) => {
      const s = inv.slots[i];
      if (!s) return;
      const left = addItem(base.storage, s.id, s.n);
      inv.slots[i] = left ? { id: s.id, n: left } : null;
      audio.play("pickup");
    },
    getJournal: () => ({ quests, story, stats, survival, combat }),
  });

  const doSave = () =>
    saveGame({
      city,
      player,
      combat,
      survival,
      inv,
      loot,
      quests,
      skills,
      camps,
      base,
      story,
      stats,
    });

  // смерть и возрождение с ценой (четверть стаков, сытость снижается)
  let deathShown = false;
  let deathLost = [];
  function doRespawn() {
    applyPenalty(inv, deathLost);
    survival.hunger = Math.min(survival.hunger, 40);
    respawn(combat, player, spawn.x, spawn.y);
    hud.hideDeath();
    deathShown = false;
    audio.play("respawn");
    doSave();
  }

  let zoom = 2; // старт в приближенном виде (по playtest пользователя)
  const mouse = { x: 0, y: 0 };
  cv.addEventListener("mousemove", (e) => {
    const r = cv.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  cv.addEventListener("mousedown", (e) => {
    audio.unlock();
    if (e.button === 0 && !combat.dead && !ui.isOpen() && !map.isOpen()) {
      const w = weaponDef(player.weapon);
      if (w.kind === "melee") {
        const camS = w2s(cam.x, cam.y);
        const aim = screenToWorld(mouse.x, mouse.y, camS, W, H, zoom);
        const hits = meleeAttack(combat, player, aim, city, w, mods);
        audio.play(hits > 0 ? "meleeHit" : "swing");
        if (hits > 0) skillXp("melee", 6 * hits);
        return;
      }
      if (countItem(inv, "arrow") < 1) {
        // без стрел не натягиваем лук — комикс-облачко вместо анимации
        say(comic, player.x, player.y, "Нет стрел!", "alert", 1.4);
        audio.play("empty");
        return;
      }
      combat.bowDrawing = true;
      audio.play("bowDraw");
    }
  });
  cv.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || ui.isOpen()) return;
    const camS = w2s(cam.x, cam.y);
    const aim = screenToWorld(mouse.x, mouse.y, camS, W, H, zoom);
    if (releaseBow(combat, player, aim, inv, city, mods)) {
      skillXp("archery", 2);
      stats.arrowsFired++;
      audio.play("bowRelease");
    }
  });

  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    audio.unlock();
    // отладка доступна всегда
    if (e.code === "F3") {
      e.preventDefault();
      settings.debug = !settings.debug;
      saveSettings(settings, localStorage);
      hud.setDebug(settings.debug);
      return;
    }
    // экран смерти: только возрождение
    if (hud.isDeathOpen()) {
      if (e.code === "KeyR") doRespawn();
      return;
    }
    // меню/настройки: Esc закрывает верхний слой
    if (menu.isOpen()) {
      if (e.code === "Escape") {
        if (menu.confirmVisible()) menu.hideConfirm();
        else if (menu.settingsVisible()) menu.hideSettings();
        else if (menu.titleVisible() && loaded) menu.hideTitle();
      }
      return;
    }
    // большая карта: M/Esc закрыть, остальные клавиши не проходят
    if (map.isOpen()) {
      if (e.code === "KeyM" || e.code === "Escape") map.close();
      return;
    }
    if (e.code === "KeyN")
      survival.tod = darknessFor(survival.tod) > 0.4 ? 7 : 20.9;
    if (e.code === "KeyZ") zoom = zoom === 1 ? 2 : 1;
    if (e.code === "KeyG") toggleGaitLab(gaitLab, R);
    if (e.code === "KeyR" && combat.dead) doRespawn();
    if (e.code === "KeyQ") useItem("can");
    if (e.code === "KeyH") useItem("meds");
    if (e.code === "Digit1") equipWeapon("bow");
    if (e.code === "Digit2") equipWeapon("bat");
    if (e.code === "Digit3") equipWeapon("knife");
    if (e.code === "KeyM") {
      if (ui.isOpen()) ui.close();
      map.open();
      audio.play("uiOpen");
      return;
    }
    if (e.code === "KeyJ") {
      if (ui.isOpen()) ui.close();
      else {
        ui.openJournal();
        audio.play("uiOpen");
      }
      return;
    }
    // лестница вниз
    if (e.code === "KeyX" && !combat.dead) {
      const ib = frameState.insideB;
      if (ib && player.level > 0) {
        const it = getInterior(city, ib);
        if (it.stairs) {
          const sx = ib.x + it.stairs.x + it.stairs.w / 2,
            sy = ib.y + it.stairs.y + it.stairs.h / 2;
          if (Math.hypot(player.x - sx, player.y - sy) < 2.2) {
            player.level--;
            toast(`Спустился на этаж ${player.level + 1}`);
          }
        }
      }
    }
    // разбить окно
    if (e.code === "KeyB" && !combat.dead) {
      const w = frameState.windowNear;
      if (w) {
        const set = city.brokenWindows.get(w.bid) || new Set();
        set.add(w.key);
        city.brokenWindows.set(w.bid, set);
        toast("Окно разбито. Шум слышен далеко...");
        audio.play("glass");
        audio.play("growl");
        alertNear(city, player.x, player.y, 12, 8);
      }
    }
    // заправка
    if (e.code === "KeyF") {
      const car = veh.inCar || nearestCar(city, player.x, player.y);
      if (car && !car.wreck) {
        const lit = refuelCar(
          car,
          inv,
          (id) => countItem(inv, id),
          (id, n) => removeItem(inv, id, n),
        );
        toast(
          lit > 0
            ? `Заправлено: +${lit} л (${fuelText(car)})`
            : "Нет бензина или бак полон",
        );
        if (lit > 0) audio.play("refuel");
      }
    }
    if (e.code === "KeyT" && !combat.dead) {
      if (ui.isOpen()) ui.close();
      else {
        const car = veh.inCar || nearestCar(city, player.x, player.y, 3);
        if (!car) toast("Рядом нет машины");
        else if (!openTrunk(car)) toast("У остова нет багажника");
        else {
          trunkCar = car;
          ui.openTrunk(car);
          audio.play("uiOpen");
        }
      }
    }
    if (e.code === "KeyC") {
      if (ui.isOpen()) ui.close();
      else {
        ui.openCraft();
        audio.play("uiOpen");
      }
    }
    if (e.code === "KeyP") {
      if (ui.isOpen()) ui.close();
      else {
        ui.openCharacter();
        audio.play("uiOpen");
      }
    }
    if (e.code === "KeyV" && !combat.dead) {
      if (ui.isOpen()) ui.close();
      else if (!base.founded) {
        if (foundBase(base, city, player)) {
          toast("База основана. Строй постройки и набирай жителей.");
          audio.play("craft");
        } else toast("Нужен открытый газон вне зданий.");
      } else {
        ui.openBase();
        audio.play("uiOpen");
      }
    }
    if (e.code === "KeyI" || e.code === "Tab") {
      e.preventDefault();
      if (ui.isOpen()) ui.close();
      else {
        ui.openInventory();
        audio.play("uiOpen");
      }
    }
    if (e.code === "KeyE") {
      if (search) return;
      if (ui.isOpen()) {
        ui.close();
        audio.play("uiClose");
      } else if (dlg.beat) {
        if (dlg.line < dlg.beat.lines.length - 1) {
          dlg.line++;
          renderDialog(dlg, null);
          audio.play("uiClick");
        }
      } else if (dlg.npc) {
        if (!advanceDialog(dlg)) renderDialog(dlg, null);
        else renderDialog(dlg, dlg.npc);
        audio.play("uiClick");
      } else if (!combat.dead) {
        const ib = frameState.insideB;
        if (ib) {
          const it = getInterior(city, ib);
          if (it.stairs) {
            const sx = ib.x + it.stairs.x + it.stairs.w / 2,
              sy = ib.y + it.stairs.y + it.stairs.h / 2;
            if (Math.hypot(player.x - sx, player.y - sy) < 2.2) {
              if (player.level < ib.floors - 1) {
                player.level++;
                toast(`Поднялся на этаж ${player.level + 1}`);
              } else toast("Выше некуда");
              return;
            }
          }
        }
        const sb = storyNear(story, city, camps, player);
        if (sb) {
          dlg.beat = sb.beat;
          dlg.line = 0;
          dlg.npc = null;
          renderDialog(dlg, null);
          return;
        }
        const camp = campNear(camps, player.x, player.y);
        const npc = npcNear(npcs, player.x, player.y);
        if (camp) {
          campTarget = camp;
          ui.openCamp(camp);
          audio.play("uiOpen");
        } else if (npc) {
          openDialog(dlg, npc);
          renderDialog(dlg, npc);
          audio.play("uiClick");
        } else if (veh.inCar) {
          exitCar(city, veh, player);
          audio.engineStop();
          audio.play("door");
        } else {
          const drivable = nearestCar(
            city,
            player.x,
            player.y,
            3,
            (c) => !c.wreck,
          );
          if (drivable) {
            enterCar(veh, drivable, player);
            audio.play("door");
            audio.engineStart();
          } else {
            const wreck = nearestCar(city, player.x, player.y);
            if (wreck) toast("Машина разбита");
            else {
              const c = nearestContainer(
                loot,
                player.x,
                player.y,
                1.6,
                frameState.insideB,
              );
              if (c) {
                const contents = loot.opened.has(c.id)
                  ? loot.opened.get(c.id)
                  : containerItems(c, mods.lootBonus);
                if (!contents.some((s) => s)) {
                  toast("Пусто.");
                  return;
                }
                search = {
                  c,
                  t: 0,
                  dur: Math.max(
                    0.5,
                    1.5 - 0.06 * skills.skills.scavenging.level,
                  ),
                };
                say(comic, c.x, c.y, "…", "think", search.dur + 0.4);
              }
            }
          }
        }
      }
    }
    if (e.code === "Escape") {
      if (ui.isOpen()) {
        ui.close();
        audio.play("uiClose");
      } else if (dlg.npc || dlg.beat) {
        dlg.npc = null;
        dlg.beat = null;
        dlg.line = 0;
        renderDialog(dlg, null);
      } else setPaused(!paused);
    }
  });

  // меню паузы
  const pauseEl = document.getElementById("pause");
  let paused = false;
  function setPaused(v) {
    paused = v;
    pauseEl.style.display = v ? "flex" : "none";
  }
  document
    .getElementById("pContinue")
    .addEventListener("click", () => setPaused(false));
  document.getElementById("pSave").addEventListener("click", () => {
    doSave();
    toast("Сохранено");
    setPaused(false);
  });
  document.getElementById("pJournal").addEventListener("click", () => {
    setPaused(false);
    ui.openJournal();
  });
  document.getElementById("pMap").addEventListener("click", () => {
    setPaused(false);
    map.open();
  });
  document.getElementById("pSettings").addEventListener("click", () => {
    menu.showSettings();
  });
  document.getElementById("pMenu").addEventListener("click", () => {
    setPaused(false);
    menu.showTitle(true);
  });
  const pZoom = document.getElementById("pZoom");
  pZoom.textContent = "Зум: ×" + zoom;
  pZoom.addEventListener("click", () => {
    zoom = zoom === 1 ? 2 : 1;
    pZoom.textContent = "Зум: ×" + zoom;
  });
  document.getElementById("pNew").addEventListener("click", () => {
    menu.askNewGame();
  });
  addEventListener("keyup", (e) => (keys[e.code] = false));

  // пепел (screen-space)
  const ashP = [];
  const arng = mulberry32(4242);
  for (let i = 0; i < 160; i++)
    ashP.push({
      x: arng() * W,
      y: arng() * H,
      s: 0.6 + arng() * 1.8,
      p: arng() * 7,
      layer: i % 2,
    });

  // отладочный доступ (dev)
  window.__city = {
    city,
    player,
    cam,
    R,
    combat,
    survival,
    inv,
    loot,
    ui,
    teleport: (x, y) => {
      player.x = x;
      player.y = y;
      cam.x = x;
      cam.y = y;
    },
    setTod: (v) => (survival.tod = v),
    skills,
    veh,
    gainXp: skillXp,
    spawn: (x, y, type) => spawnZombie(city, x, y, type),
    alertNear: (x, y, r) => alertNear(city, x, y, r),
    search: () => search,
    peek: (c) => containerItems(c, mods.lootBonus),
    camps,
    base,
    story,
    levelFx,
    SPRTEX,
    frameMs: () => msLast,
    bakeQueueSize: () => R.bakeQueue.size + R.bldQueue.size + R.phQueue.size,
    litQueueSize,
    hasLit: (id) => {
      const b = city.buildings.find((k) => k.id === id);
      return b ? !!buildingLitCanvas(b) : false;
    },
    stats,
    audio,
    hud,
    map,
    menu,
    settings,
    comic,
    say: (text, kind) => say(comic, player.x, player.y, text, kind),
    die: () => {
      combat.playerHp = 0;
      combat.dead = true;
      combat.deadT = 0;
    },
    save: doSave,
  };

  let saveT = 15;
  let visitT = 0;
  const frameState = { insideB: null, stairsNear: false, windowNear: null };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doSave();
  });

  function questHudText() {
    const q = mainQuest(quests, QUESTS);
    if (!q) return "◆ Цепочка выполнена. Выживай.";
    return `◆ ${q.name}: ${q.goals.map((g) => goalText(g, quests.prog)).join(" · ")}`;
  }

  const dlgEl = document.getElementById("dlg");
  function renderDialog(D, npc) {
    if (D.beat) {
      dlgEl.style.display = "block";
      const b = D.beat;
      const last = D.line >= b.lines.length - 1;
      const choices = last
        ? `<div class="dlg-choices">${b.choices
            .map((c, i) => `<button data-ci="${i}">${c.text}</button>`)
            .join("")}</div>`
        : `<div class="hint">E — дальше</div>`;
      dlgEl.innerHTML = `<div class="who">${b.title}</div><div>${b.lines[D.line]}</div>${choices}`;
      return;
    }
    if (!npc) {
      dlgEl.style.display = "none";
      return;
    }
    dlgEl.style.display = "block";
    dlgEl.innerHTML = `<div class="who">${npc.name}</div><div>${npc.lines[D.line]}</div><div class="hint">E — дальше</div>`;
  }
  dlgEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ci]");
    if (!btn || !dlg.beat) return;
    const ch = applyChoice(story, Number(btn.dataset.ci), { inv, camps, base });
    if (ch) toast(`Выбор: ${ch.text}`);
    audio.play("uiClick");
    dlg.beat = null;
    dlg.line = 0;
    renderDialog(dlg, null);
  });

  // титульный экран для нового игрока; сейв совместимый — сразу в игру
  if (!loaded && !wantNew && !hasSave()) menu.showTitle(false);

  let lastT = performance.now();
  let fpsE = 60,
    msE = 16,
    msLast = 0;
  let prevNight = null;
  let prevNightSay = null;
  let hungerSayT = 0;
  let alertSayT = 0;
  let wasChased = false;

  function mapState() {
    const poi = questTargetPoi(quests, QUESTS);
    return {
      player,
      questTarget: poi ? poiBuilding(city, poi) : null,
      camps,
      base,
      zombies: city.zombies,
    };
  }
  function hudState() {
    const nc = campNear(camps, player.x, player.y);
    return {
      hp: combat.playerHp,
      maxHp: combat.playerMaxHp,
      hunger: survival.hunger,
      clock: clockText(survival),
      arrows: countItem(inv, "arrow"),
      quest: questHudText(),
      story: storyHud(story),
      torch: player.torch,
      torchT: player.torchT || 0,
      inCar: veh.inCar,
      speed: veh.inCar ? veh.inCar.v : 0,
      fuel: veh.inCar ? fuelText(veh.inCar) : "",
      level: player.level,
      cans: countItem(inv, "can"),
      meds: countItem(inv, "meds"),
      camp: nc ? campDef(nc).name : null,
      noArrows: combat.noArrowsT > 0,
      weapon: weaponDef(player.weapon),
    };
  }
  function renderPayload(aim, night, t) {
    return {
      ctx,
      R,
      city,
      player,
      zombies: city.zombies,
      groundSet,
      SPR,
      cam,
      zoom,
      night,
      L,
      W,
      H,
      ashP,
      combat,
      loot,
      aim,
      now: t / 1000,
      lootNearest: loot.nearest,
      uiOpen: ui.isOpen(),
      questTarget: (() => {
        const poi = questTargetPoi(quests, QUESTS);
        return poi ? poiBuilding(city, poi) : null;
      })(),
      inCar: !!veh.inCar,
      npcs,
      stairsNear: frameState.stairsNear,
      windowNear: frameState.windowNear,
      search,
      camps,
      base,
      levelFx,
      comic,
      questLootId: (() => {
        const q = mainQuest(quests, QUESTS);
        if (!q) return null;
        const g = q.goals.find(
          (g) => g.type === "loot" && !goalDone(g, quests.prog),
        );
        return g ? g.id : null;
      })(),
    };
  }

  function tick(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const dark = darknessFor(survival.tod);
    const night = dark > 0.4;
    // эмбиент переключается на границе дня/ночи (после разблокировки звука)
    if (audio.ready && night !== prevNight) {
      prevNight = night;
      audio.ambience(night ? "night" : "day");
    }
    if (night !== prevNightSay) {
      prevNightSay = night;
      if (night && !combat.dead)
        say(comic, player.x, player.y, "Тихо…", "think", 2.2);
    }
    if (paused || menu.isOpen()) {
      const camS0 = w2s(cam.x, cam.y);
      const aim0 = screenToWorld(mouse.x, mouse.y, camS0, W, H, zoom);
      renderWorld(renderPayload(aim0, night, t));
      hud.update(hudState());
      map.update(dt, mapState());
      return;
    }
    const t0 = performance.now();
    mods = modifiers(skills);
    if (player.torch) {
      player.torchT = (player.torchT ?? 120) - dt;
      if (player.torchT <= 0) {
        removeItem(inv, "torch", 1);
        if (countItem(inv, "torch") > 0) player.torchT = 120;
        else {
          player.torch = false;
          toast("Факел догорел.");
        }
      }
    }
    combat.playerMaxHp = mods.maxHp;
    if (combat.playerHp > combat.playerMaxHp)
      combat.playerHp = combat.playerMaxHp;
    if (search) {
      const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
      if (moving || combat.dead || combat.hurtFlash > 0) search = null;
      else {
        search.t += dt;
        if (search.t >= search.dur) {
          const c = search.c;
          search = null;
          openContainer(loot, c, mods.lootBonus);
          skillXp("scavenging", 6);
          lootOpen = { c, taken: {} };
          ui.openLoot(c);
          audio.play("uiOpen");
        }
      }
    }
    const canMove =
      !ui.isOpen() && !dlg.npc && !search && !map.isOpen() && !combat.dead;
    if (canMove) {
      if (veh.inCar)
        updateVehicle(city, veh.inCar, keys, player, combat, dt, mods, (m) => {
          skillXp("driving", m / 100);
          stats.distance += m;
        });
      else
        updatePlayer(city, player, keys, dt, mods, (m, run) => {
          skillXp("athletics", (m * (run ? 1.5 : 1)) / 40);
          stats.distance += m;
        });
    } else keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    if (veh.inCar) audio.engineUpdate(Math.abs(veh.inCar.v) / 22);
    const dayBefore = survival.day;
    updateSurvival(survival, combat, player, city, inv, dt, mods);
    if (survival.day > dayBefore) {
      skillXp("survival", 20);
      campsNewDay(camps, survival.day);
      baseNewDay(base, survival.day);
    }
    if (survival.tod >= 21 && survival.tod < 21.1) {
      const n = baseRaid(base, city, survival.day);
      if (n > 0) {
        toast(`Рейд на базу: ${n} зомби!`, true);
        audio.play("raid");
      }
    }
    if (survival.pendingBoss) {
      const p = survival.pendingBoss;
      survival.pendingBoss = null;
      spawnZombie(city, p.x, p.y, "boss");
      toast("Матка пришла к больнице. Она зовёт подкрепление...", true);
      audio.play("boss");
    }
    updateZombies(
      city,
      city.zombies,
      player,
      dt,
      night ? 1.35 : 1,
      !!veh.inCar,
    );
    if (frameState.insideB && !loot.interior.has(frameState.insideB.id))
      registerInterior(
        loot,
        frameState.insideB,
        getInterior(city, frameState.insideB),
      );
    const nearC = nearestContainer(
      loot,
      player.x,
      player.y,
      1.6,
      frameState.insideB,
    );
    const nearItems = nearC
      ? loot.opened.has(nearC.id)
        ? loot.opened.get(nearC.id)
        : containerItems(nearC, mods.lootBonus)
      : null;
    loot.nearest = nearC && nearItems.some((s) => s) ? nearC : null;
    const luStarted = updateLevelUp(levelFx, dt);
    if (luStarted) {
      showLevelUpBanner(luStarted);
      audio.play("levelup");
    }
    updateComic(comic, dt);
    // комикс-подсказки состояний: голод и тревога погони (с кулдауном)
    hungerSayT -= dt;
    alertSayT -= dt;
    if (survival.hunger < 25 && !combat.dead && hungerSayT <= 0) {
      say(comic, player.x, player.y, "Хочу есть…", "think", 2);
      hungerSayT = 8;
    }
    const chased = city.zombies.some(
      (z) =>
        !z.dead &&
        z.alertT > 0 &&
        (z.level || 0) === (player.level || 0) &&
        Math.hypot(z.x - player.x, z.y - player.y) < 12,
    );
    if (chased && !wasChased && alertSayT <= 0 && !combat.dead) {
      say(comic, player.x, player.y, "Они идут!", "alert", 1.6);
      audio.play("growl");
      alertSayT = 8;
    }
    wasChased = chased;
    visitT -= dt;
    if (visitT <= 0) {
      visitT = 0.5;
      const poi = questTargetPoi(quests, QUESTS);
      if (poi) {
        const b = poiBuilding(city, poi);
        if (
          b &&
          Math.hypot(player.x - (b.x + b.w / 2), player.y - (b.y + b.h / 2)) <
            25
        )
          questEvent("visit", { poi });
      }
    }
    const camS = w2s(cam.x, cam.y);
    const aim = screenToWorld(mouse.x, mouse.y, camS, W, H, zoom);
    updateCombat(
      combat,
      city,
      player,
      aim,
      dt,
      t / 1000,
      !!veh.inCar || player.level > 0,
      mods,
    );
    frameState.insideB = playerInside(city, player);
    frameState.stairsNear = false;
    frameState.windowNear = null;
    if (player.level === 0) {
      const bcx = Math.floor(player.x / 16),
        bcy = Math.floor(player.y / 16);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cell = city.buildingGrid?.get(bcx + dx + "," + (bcy + dy));
          if (!cell) continue;
          for (const b of cell) {
            if (!b.floors) continue;
            const broken = city.brokenWindows.get(b.id);
            for (const w of groundWindows(b)) {
              if (broken && broken.has(w.face + ":" + w.u)) continue;
              if (Math.hypot(player.x - w.x, player.y - w.y) < 1.5) {
                frameState.windowNear = {
                  bid: b.id,
                  key: w.face + ":" + w.u,
                  x: w.x,
                  y: w.y,
                };
              }
            }
          }
        }
    }
    if (frameState.insideB) {
      const ib = frameState.insideB,
        it = getInterior(city, ib);
      if (it.stairs) {
        const sx = ib.x + it.stairs.x + it.stairs.w / 2,
          sy = ib.y + it.stairs.y + it.stairs.h / 2;
        frameState.stairsNear = Math.hypot(player.x - sx, player.y - sy) < 2.2;
      }
    }
    cam.x += (player.x - cam.x) * Math.min(1, dt * 6);
    cam.y += (player.y - cam.y) * Math.min(1, dt * 6);
    renderWorld(renderPayload(aim, night, t));
    if (gaitLab.open) renderGaitLab(gaitLab, R, SPR, t / 1000);
    for (const a of ashP) {
      a.x -= (3 + a.layer * 5) * dt * (1 + 0.3 * Math.sin(t / 900 + a.p));
      a.y += (9 + a.layer * 7) * dt;
      if (a.y > H + 4 || a.x < -4) {
        a.x = Math.random() * (W + 40);
        a.y = -4;
      }
    }
    // экран смерти
    if (combat.dead && !deathShown) {
      deathShown = true;
      stats.deaths++;
      deathLost = deathPenalty(inv.slots);
      audio.play("death");
      audio.engineStop();
      hud.showDeath({
        day: survival.day,
        kills: combat.kills,
        distance: stats.distance,
        arrowsFired: stats.arrowsFired,
        itemsLooted: stats.itemsLooted,
        deaths: stats.deaths,
        lost: deathLost,
        onRespawn: doRespawn,
      });
    }
    const ms = performance.now() - t0;
    msLast = ms;
    msE += (ms - msE) * 0.06;
    fpsE += (1 / Math.max(dt, 1e-4) - fpsE) * 0.06;
    saveT -= dt;
    if (saveT <= 0 && !combat.dead) {
      saveT = 15;
      doSave();
    }
    hud.update(hudState());
    map.update(dt, mapState());
    if (settings.debug)
      hud.updateDebug({
        fps: fpsE,
        ms: msE,
        draws: R.drawCalls,
        chunks: R.chunkCache.size,
        seed,
        size: city.SIZE,
        buildings: city.buildings.length,
        zombies: city.zombies.length,
      });
  }

  function frame(t) {
    try {
      tick(t);
    } catch (err) {
      fatal(err);
      return;
    }
    requestAnimationFrame(frame);
  }

  document.getElementById("loading")?.remove();
  requestAnimationFrame(frame);
}

boot().catch(fatal);
