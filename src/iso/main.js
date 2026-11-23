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
  repairCar,
  fuelText,
  openTrunk,
} from "./systems/vehicles.js";
import { PITCH } from "./world/cityGen.js";
import { createCity, buildSolidIndex } from "./world/cityGen.js";
import { loadAssets, SPRTEX } from "./render/assets.js";
import { makeGroundSet } from "./render/tiles.js";
import { prewarmTextureTiles } from "./render/chunks.js";
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
import { createHud } from "./ui/hud.js";
import { createMap } from "./ui/map.js";
import { createMenu } from "./ui/menu.js";
import { ITEMS } from "./data/items.js";
import { RECIPES } from "./data/recipes.js";
import { canCraft, craft } from "./systems/craft.js";
import { createNpcs, npcNear } from "./systems/npcs.js";
import { playerInside } from "./render/renderer.js";
import { getInterior, groundWindows } from "./world/interiors.js";
import {
  createQuests,
  mainQuest,
  goalText,
  goalDone,
  currentStage,
  questProgress,
  trackedQuest,
} from "./systems/quests.js";
import { ALL_QUESTS } from "./data/quests.js";
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
import { createStory, storyHud } from "./systems/story.js";
import {
  createSurvivors,
  survivorNear,
  toggleSurvivor,
  followingSurvivor,
} from "./systems/survivors.js";
import { isSimulationPaused, isTutorialCraft } from "./systems/pause.js";
import {
  createInteractions,
  nearestInteraction,
} from "./systems/interactions.js";
import { createSiege } from "./systems/siege.js";
import { createCampaignRuntime } from "./systems/campaignRuntime.js";
import { createDialogueUI } from "./ui/dialogue.js";
import { showEpilogueScreen } from "./ui/epilogue.js";
import { storyPoint } from "./world/storyLocations.js";
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
  prewarmTextureTiles();
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
    stamina: 100,
    exhausted: false,
    infected: false,
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
  const camps = createCamps(city);
  let campTarget = null;
  const base = createBase();
  const story = createStory();
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, PITCH, camps, survivors, story);
  const siege = createSiege();
  const stats = createStats();
  const levelFx = createLevelUp();
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
        interactions,
        survivors,
        siege,
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
  let dialogueUI;
  const campaign = createCampaignRuntime(
    {
      city,
      player,
      inv,
      quests,
      story,
      camps,
      survivors,
      interactions,
      npcs,
      survival,
      combat,
      siege,
    },
    {
      notify: (msg, big = false) => hud.toast(msg, big),
      banner: showQuestBanner,
      sound: (id) => audio.play(id),
      dialogue: (d) => dialogueUI?.render(d),
      openCamp: (id) => {
        const camp = camps.find((c) => c.id === id);
        if (!camp) return;
        campTarget = camp;
        ui.openCamp(camp);
      },
      openHome: () => ui.openHome(),
      sleep: () => sleepAtHome(),
      ending: (id) => showEpilogue(id),
      noise: (radius) => alertNear(city, player.x, player.y, radius, 8),
      rebuild: () => buildSolidIndex(city),
    },
  );
  const questEvent = (type, data) => campaign.event(type, data);
  combat.onKill = (source, z) => {
    questEvent("kill", { group: z?.questGroup, zombieType: z?.type });
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
  combat.onInfect = () => {
    audio.play("hurt");
    say(comic, player.x, player.y, "Заражён!", "alert", 2);
    toast("Заражение! Сними инфекцию бинтом (H).");
  };
  combat.onKnock = () => audio.play("knock");
  combat.onCarHit = () => audio.play("carHit");
  combat.onPractice = (weapon, target) => {
    questEvent("practice", { target: weapon });
    say(comic, target.x, target.y, "Есть!", "heal", 1);
    audio.play("hit");
  };
  combat.onSurvivorHurt = (s) => say(comic, s.x, s.y, "Ай!", "alert", 0.9);
  combat.onSurvivorDead = (s) => campaign.onSurvivorDead(s);

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
      player,
      mods,
    );
    if (msg) {
      toast(msg);
      audio.play(id === "meds" || id === "medkit" ? "bandage" : "eat");
      if ((id === "meds" || id === "medkit") && combat.playerHp > hpBefore) {
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
        if (ITEMS[s.id].unique) {
          toast("Это пригодится выжившим. Нельзя просто выбросить.");
          return;
        }
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
        questEvent("craft", { target: r.id });
        audio.play("craft");
      }
    },
    canCraft: (r) => canCraft(inv, r),
    getTutorialRecipes: () =>
      isTutorialCraft(quests) ? ["arrows", "knife", "medkit"] : [],
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
    getHome: () => story.home,
    onHomeTake: (i) => {
      const slots = story.home.storage;
      const s = slots[i];
      if (!s) return;
      const left = addItem(inv, s.id, s.n);
      s.n = left;
      if (!left) slots[i] = null;
      audio.play("pickup");
    },
    onHomePut: (i) => {
      const s = inv.slots[i];
      if (!s) return;
      const homeInv = {
        slots: story.home.storage,
        size: story.home.storage.length,
      };
      const left = addItem(homeInv, s.id, s.n);
      inv.slots[i] = left ? { id: s.id, n: left } : null;
      audio.play("pickup");
    },
    getJournal: () => ({ quests, story, stats, survival, combat }),
    onTrack: (id) => campaign.track(id),
    onOpenMap: () => map.open(),
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
      interactions,
      survivors,
      siege,
    });

  // смерть и возрождение с ценой (четверть стаков, сытость снижается)
  let deathShown = false;
  let deathLost = [];
  function doRespawn() {
    applyPenalty(inv, deathLost);
    survival.hunger = Math.min(survival.hunger, 40);
    const home = story.home.unlocked
      ? storyPoint(city, { site: "motel", x: 3, y: 13 })
      : spawn;
    respawn(combat, player, home.x, home.y);
    if (siege.active) campaign.retrySiegeWave();
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
    if (
      e.button === 0 &&
      !combat.dead &&
      !ui.isOpen() &&
      !map.isOpen() &&
      !campaign.dialogue.conversation
    ) {
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
    if (e.button !== 0 || ui.isOpen() || campaign.dialogue.conversation) return;
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
    if (campaign.dialogue.conversation) {
      if (["KeyE", "Space", "Enter"].includes(e.code)) {
        e.preventDefault();
        campaign.advance();
        audio.play("uiClick");
      } else if (["Digit1", "Digit2", "Digit3"].includes(e.code)) {
        e.preventDefault();
        dialogueUI?.chooseByNumber(Number(e.code.slice(-1)) - 1);
      } else if (e.code === "Escape") campaign.close();
      return;
    }
    if (e.code === "KeyG" && !combat.dead) {
      const active = followingSurvivor(survivors);
      const waiting = survivors
        .filter(
          (s) =>
            s.state === "waiting" &&
            !s.hidden &&
            Math.hypot(s.x - player.x, s.y - player.y) < 4,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - player.x, a.y - player.y) -
            Math.hypot(b.x - player.x, b.y - player.y),
        )[0];
      const companion = active || waiting;
      if (companion) {
        const mode = toggleSurvivor(companion);
        toast(
          mode === "following"
            ? `${companion.name} идёт за тобой.`
            : `${companion.name} ждёт на месте.`,
        );
      } else toast("Нет спутника, который мог бы ответить.");
      return;
    }
    if (e.code === "KeyN")
      survival.tod = darknessFor(survival.tod) > 0.4 ? 7 : 20.9;
    if (e.code === "KeyZ") zoom = zoom === 1 ? 2 : 1;
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
    // ремонт машины деталью (Y): чинит остов и повреждённые
    if (e.code === "KeyY") {
      const car = veh.inCar || nearestCar(city, player.x, player.y, 3);
      if (!car) toast("Рядом нет машины");
      else if (
        repairCar(
          car,
          (id) => countItem(inv, id),
          (id, n) => removeItem(inv, id, n),
        )
      ) {
        toast("Машина починена: +40 ресурса.");
        audio.play("craft");
      } else toast("Нужна деталь, или машина исправна");
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
    if (e.code === "KeyI") {
      e.preventDefault();
      if (ui.isOpen()) ui.close();
      else {
        ui.openInventory();
        audio.play("uiOpen");
      }
    }
    // TAB — единая панель с вкладками (помнит последнюю)
    if (e.code === "Tab") {
      e.preventDefault();
      if (ui.isOpen()) ui.close();
      else {
        ui.openTabLast();
        audio.play("uiOpen");
      }
    }
    // быстрый лут в открытом окне: Space — взять всё
    if (e.code === "Space" && ui.isLoot()) {
      e.preventDefault();
      ui.quickAll();
      return;
    }
    if (e.code === "KeyE") {
      if (search) return;
      // быстрый лут: E — взять верхнюю вещь
      if (ui.isLoot()) {
        ui.quickTake();
        return;
      }
      if (ui.isOpen()) {
        ui.close();
        audio.play("uiClose");
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
        const object = nearestInteraction(
          interactions,
          player.x,
          player.y,
          campaign.context(),
        );
        const npc = npcNear(npcs, player.x, player.y);
        const nearbySurvivor = survivorNear(survivors, player.x, player.y);
        const survivor =
          nearbySurvivor?.state === "stranded" ? nearbySurvivor : null;
        const nearLoot = nearestContainer(
          loot,
          player.x,
          player.y,
          1.6,
          frameState.insideB,
        );
        const candidates = [
          object && {
            kind: "object",
            value: object,
            d: Math.hypot(object.x - player.x, object.y - player.y),
          },
          npc && {
            kind: "npc",
            value: npc,
            d: Math.hypot(npc.x - player.x, npc.y - player.y),
          },
          survivor && {
            kind: "survivor",
            value: survivor,
            d: Math.hypot(survivor.x - player.x, survivor.y - player.y),
          },
        ]
          .filter(Boolean)
          .sort((a, b) => a.d - b.d);
        let target = candidates[0];
        if (target?.kind === "survivor" && nearLoot) target = null;
        if (target?.kind === "object") {
          beginStoryInteraction(target.value);
        } else if (target?.kind === "npc") {
          combat.bowDrawing = false;
          combat.bowCharge = 0;
          campaign.talk(target.value.id);
          audio.play("uiClick");
        } else if (target?.kind === "survivor") {
          const s = target.value;
          if (
            s.id === "nina" &&
            mainQuest(quests, ALL_QUESTS)?.id === "m02" &&
            !(quests.stages.m02 || 0)
          ) {
            combat.bowDrawing = false;
            combat.bowCharge = 0;
            campaign.talk("nina");
          } else {
            const mode = toggleSurvivor(s);
            toast(
              mode === "following"
                ? `${s.name} следует за тобой.`
                : `${s.name} ждёт на месте.`,
            );
          }
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
              const c = nearLoot;
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
        const camp = campNear(camps, player.x, player.y);
        if (
          !target &&
          camp &&
          !veh.inCar &&
          !loot.nearest &&
          !nearestCar(city, player.x, player.y)
        ) {
          campTarget = camp;
          ui.openCamp(camp);
          audio.play("uiOpen");
        }
      }
    }
    if (e.code === "Escape") {
      if (ui.isOpen()) {
        ui.close();
        audio.play("uiClose");
      } else if (!campaign.close()) {
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
    quests,
    survivors,
    interactions,
    siege,
    npcs,
    campaign,
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
  const frameState = { insideB: null, stairsNear: false, windowNear: null };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doSave();
  });

  function questHudText() {
    const q = mainQuest(quests, ALL_QUESTS);
    if (!q) return "◆ Кампания завершена. Район живёт дальше.";
    const stage = currentStage(quests, q);
    return `◆ ${q.name}: ${(stage?.goals || []).map((g) => goalText(g, questProgress(quests, q.id))).join(" · ")}`;
  }

  function sideHudText() {
    const q = trackedQuest(quests, ALL_QUESTS);
    if (!q) return storyHud(story);
    const stage = currentStage(quests, q);
    return `◇ ${q.name}: ${(stage?.goals || []).map((g) => goalText(g, questProgress(quests, q.id))).join(" · ")}`;
  }

  dialogueUI = createDialogueUI({
    root: document.getElementById("dlg"),
    getContext: campaign.context,
    onChoice: (choice) => campaign.choose(choice),
  });

  function beginStoryInteraction(object) {
    if (["homeStorage", "sleep", "toggleGenerator"].includes(object.action)) {
      campaign.interact(object);
      return;
    }
    search = {
      c: object,
      storyObject: true,
      t: 0,
      dur: ["repair", "build", "loadVehicle"].includes(object.action)
        ? 1.5
        : 0.8,
    };
    say(comic, object.x, object.y, "…", "think", search.dur + 0.4);
  }

  function sleepAtHome() {
    if (survivors.some((s) => s.state === "following") || siege.active) {
      toast("Сейчас нельзя спать: кто-то идёт за тобой или идёт осада.");
      return;
    }
    const nextDay = survival.tod >= 6;
    if (nextDay) {
      survival.day++;
      campsNewDay(camps, survival.day);
      baseNewDay(base, survival.day);
      campaign.newDay();
    }
    survival.tod = 6;
    survival.hunger = Math.max(10, survival.hunger - 18);
    combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + 25);
    toast("Ты проспал до утра. В мотеле слышны голоса.", true);
    doSave();
  }

  function showEpilogue(id) {
    paused = true;
    showEpilogueScreen({
      root: document.getElementById("epilogue"),
      ending: id,
      story,
      survivors,
      onClose: () => {
        paused = false;
        doSave();
      },
    });
  }

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
    return {
      player,
      questTarget: campaign.target(),
      sideQuestTarget: campaign.target(true),
      camps,
      base,
      zombies: city.zombies,
    };
  }
  function hudState() {
    const nc = campNear(camps, player.x, player.y);
    const companion =
      followingSurvivor(survivors) ||
      survivors.find(
        (s) =>
          s.state === "waiting" &&
          !s.hidden &&
          Math.hypot(s.x - player.x, s.y - player.y) < 4,
      );
    return {
      hp: combat.playerHp,
      maxHp: combat.playerMaxHp,
      hunger: survival.hunger,
      clock: clockText(survival),
      arrows: countItem(inv, "arrow"),
      quest: questHudText(),
      story: sideHudText(),
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
      stamina: player.stamina ?? 100,
      exhausted: player.exhausted,
      infected: player.infected,
      companion,
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
      questTarget: campaign.target(),
      sideQuestTarget: campaign.target(true),
      inCar: !!veh.inCar,
      npcs,
      survivors,
      interactions,
      story,
      siege,
      stairsNear: frameState.stairsNear,
      windowNear: frameState.windowNear,
      search,
      camps,
      base,
      levelFx,
      comic,
      car: veh.inCar,
      questLootId: (() => {
        const q = mainQuest(quests, ALL_QUESTS);
        if (!q) return null;
        const g = currentStage(quests, q)?.goals.find(
          (goal) =>
            goal.type === "collect" &&
            !goalDone(goal, questProgress(quests, q.id)),
        );
        return g?.id || null;
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
    if (
      isSimulationPaused({
        paused,
        menuOpen: menu.isOpen(),
        dialogueOpen: !!campaign.dialogue.conversation,
        tutorialModal: isTutorialCraft(quests) && ui.isOpen(),
      })
    ) {
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
          const current = search;
          const c = current.c;
          search = null;
          if (current.storyObject) {
            campaign.interact(c);
            audio.play(
              c.action === "repair" || c.action === "build"
                ? "craft"
                : "uiOpen",
            );
          } else {
            openContainer(loot, c, mods.lootBonus);
            questEvent("search", { target: c.id });
            skillXp("scavenging", 6);
            lootOpen = { c, taken: {} };
            ui.openLoot(c);
            audio.play("uiOpen");
          }
        }
      }
    }
    const canMove =
      !ui.isOpen() &&
      !campaign.dialogue.conversation &&
      !search &&
      !map.isOpen() &&
      !combat.dead;
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
      campaign.newDay();
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
    campaign.update(dt, veh.inCar);
    updateZombies(
      city,
      city.zombies,
      player,
      dt,
      night ? 1.35 : 1,
      !!veh.inCar,
      survivors,
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
    interactions.nearest = nearestInteraction(
      interactions,
      player.x,
      player.y,
      campaign.context(),
    );
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
      survivors,
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
        home: story.home.unlocked,
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
