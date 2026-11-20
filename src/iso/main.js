// Точка входа новой игры (этап 16.4): город, рендер, актёры, цикл.
// Старый путь (OSM/Волгоград) остаётся в index.html до паритета.
import { mulberry32 } from "./core/rng.js";
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
import { loadAssets } from "./render/assets.js";
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
  respawn,
  screenToWorld,
} from "./systems/combat.js";
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
import { SKILLS, ATTRS } from "./data/skills.js";
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
import { w2s } from "./core/geo.js";

export async function boot() {
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const hud = document.getElementById("hud");
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
    level: 0, // этаж (0 = улица/первый)
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
  // лут и инвентарь
  const inv = createInventory(24);
  const loot = createLoot(city);
  const quests = createQuests();
  const veh = { inCar: null };
  let trunkCar = null;
  let search = null; // {c, t, dur} — обыск с шкалой до окна лута
  initVehicles(city);
  // Олег живёт в парковом лагере; отдельные NPC истории — у больницы
  const npcs = createNpcs(city, PITCH).filter((n) => n.name !== "Олег");
  const hosp = poiBuilding(city, "Больница");
  if (hosp) {
    npcs.push({
      name: "Рая",
      lines: [
        "Рая: «Не шуми. Дети спят.»",
        "Рая: «Инсулин в холодильнике. Не трогай.»",
      ],
      x: hosp.x + hosp.doorU,
      y: hosp.y + hosp.h + 1.5,
    });
    npcs.push({
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
  // загрузка сохранения (если есть и не форсирована новая игра через ?new=1)
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
      });
      buildSolidIndex(city); // машины могли переехать с позиций генерации
      loaded = true;
    }
  }
  if (!loaded) {
    addItem(inv, "arrow", 12); // стартовый колчан
    addItem(inv, "can", 2); // немного еды на старт
    addItem(inv, "meds", 1);
  }
  mods = modifiers(skills);
  resizeInventory(inv, mods.carrySlots);
  combat.playerMaxHp = mods.maxHp;
  let toastMsg = "",
    toastT = 0;
  const toast = (msg) => {
    toastMsg = msg;
    toastT = 2.5;
  };
  // XP навыков: повышения показываем тостом; Сила растит рюкзак
  const skillXp = (id, n) => {
    for (const ev of gainXp(skills, id, n)) {
      const def = ev.kind === "skill" ? SKILLS[ev.id] : ATTRS[ev.id];
      toast(`${def.icon} ${def.name}: уровень ${ev.level}`);
      if (ev.kind === "attr" && ev.id === "strength")
        resizeInventory(inv, modifiers(skills).carrySlots);
    }
  };
  // квестовые события: kill / loot / visit
  const questEvent = (type, data) => {
    const done = qEvent(quests, QUESTS, type, data);
    if (done) {
      for (const [id, n] of done.reward) addItem(inv, id, n);
      toast(`Квест выполнен: «${done.name}»! Награда получена.`);
    }
  };
  combat.onKill = (source, z) => {
    questEvent("kill");
    if (source === "ram") skillXp("driving", 10);
    else skillXp("archery", 15);
    if (z?.type === "boss") {
      addItem(inv, "meds", 3);
      addItem(inv, "part", 2);
      toast("Матка мертва. Награда: бинты ×3, детали ×2.");
    }
  };
  combat.onHit = () => skillXp("archery", 6);
  const useItem = (id) => {
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
      if (id === "meds" && combat.playerHp > hpBefore) skillXp("medicine", 10);
      if (id === "can" && hungry) skillXp("survival", 5);
    }
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
      }
      // контейнер опустел — окно обыска больше не нужно
      if ((loot.opened.get(c.id) || []).every((s) => !s)) ui.close();
    },
    onTakeAll: (c) => {
      for (const [id, took] of takeAll(loot, c, (id2, n) =>
        addItem(inv, id2, n),
      )) {
        questEvent("loot", { id, n: took });
        skillXp("scavenging", took);
      }
      if ((loot.opened.get(c.id) || []).every((s) => !s)) ui.close();
    },
    onUse: (id) => useItem(id),
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
      }
    },
    canCraft: (r) => canCraft(inv, r),
    onClose: () => {},
    getSkills: () => skills,
    getMods: () => mods,
    onTrunkTake: (i) => {
      const tr = trunkCar?.trunk;
      const s = tr?.slots[i];
      if (!s) return;
      const left = addItem(inv, s.id, s.n);
      s.n = left;
      if (!left) tr.slots[i] = null;
    },
    onTrunkPut: (i) => {
      const tr = trunkCar?.trunk;
      const s = inv.slots[i];
      if (!tr || !s) return;
      const left = addItem(tr, s.id, s.n);
      inv.slots[i] = left ? { id: s.id, n: left } : null;
    },
    onCampBuy: (i) => {
      if (campTarget && campBuy(campTarget, inv, i))
        toast(`Куплено: ${ITEMS[campTarget.stock[i]?.id]?.name || "предмет"}`);
    },
    onCampDonate: (id) => {
      if (!campTarget) return;
      const g = campDonate(campTarget, inv, id, 1);
      if (g) toast(`Пожертвовано: +${g} доверия лагерю`);
    },
    onCampDeliver: () => {
      if (campTarget && campDeliver(campTarget, inv))
        toast("Поручение выполнено. Доверие и награда получены.");
    },
    onCampBuild: (i) => {
      if (campTarget && campBuild(campTarget, inv, i))
        toast(`Построено: ${campDef(campTarget).upgrades[i].name}`);
    },
    onCampService: () => {
      if (campTarget && campService(campTarget, combat, survival.day))
        toast("Лазарет: перевязка +30 HP.");
    },
    getBase: () => base,
    onBaseFound: () => {
      if (foundBase(base, city, player))
        toast("База основана. Строй постройки и набирай жителей.");
      else toast("Нужен открытый газон вне зданий.");
    },
    onBaseBuild: (i) => {
      if (baseBuild(base, inv, i)) toast("Построено на базе.");
    },
    onBaseTake: (i) => {
      const s = base.storage.slots[i];
      if (!s) return;
      const left = addItem(inv, s.id, s.n);
      s.n = left;
      if (!left) base.storage.slots[i] = null;
    },
    onBasePut: (i) => {
      const s = inv.slots[i];
      if (!s) return;
      const left = addItem(base.storage, s.id, s.n);
      inv.slots[i] = left ? { id: s.id, n: left } : null;
    },
  });
  let zoom = 1;
  const mouse = { x: 0, y: 0 };
  cv.addEventListener("mousemove", (e) => {
    const r = cv.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  cv.addEventListener("mousedown", (e) => {
    if (e.button === 0 && !combat.dead && !ui.isOpen())
      combat.bowDrawing = true;
  });
  cv.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || ui.isOpen()) return;
    const camS = w2s(cam.x, cam.y);
    const aim = screenToWorld(mouse.x, mouse.y, camS, W, H, zoom);
    if (releaseBow(combat, player, aim, inv, city, mods)) skillXp("archery", 2);
  });
  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyN")
      survival.tod = darknessFor(survival.tod) > 0.4 ? 7 : 20.9; // отладка: к утру/закату
    if (e.code === "KeyZ") zoom = zoom === 1 ? 2 : 1;
    if (e.code === "KeyR" && combat.dead)
      respawn(combat, player, spawn.x, spawn.y);
    if (e.code === "KeyQ") useItem("can");
    if (e.code === "KeyH") useItem("meds");
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
    // разбить окно (B) — вход через окно первого этажа
    if (e.code === "KeyB" && !combat.dead) {
      const w = frameState.windowNear;
      if (w) {
        const set = city.brokenWindows.get(w.bid) || new Set();
        set.add(w.key);
        city.brokenWindows.set(w.bid, set);
        toast("Окно разбито. Шум слышен далеко...");
        // шум: зомби в 12 м идут к игроку, тревога разойдётся по стае
        alertNear(city, player.x, player.y, 12, 8);
      }
    }
    // машины: посадка/высадка/заправка
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
        }
      }
    }
    if (e.code === "KeyC") {
      if (ui.isOpen()) ui.close();
      else ui.openCraft();
    }
    if (e.code === "KeyP") {
      if (ui.isOpen()) ui.close();
      else ui.openCharacter();
    }
    if (e.code === "KeyV" && !combat.dead) {
      if (ui.isOpen()) ui.close();
      else if (!base.founded) {
        if (foundBase(base, city, player))
          toast("База основана. Строй постройки и набирай жителей.");
        else toast("Нужен открытый газон вне зданий.");
      } else ui.openBase();
    }
    // интерфейс: рюкзак и обыск
    if (e.code === "KeyI" || e.code === "Tab") {
      e.preventDefault();
      if (ui.isOpen()) ui.close();
      else ui.openInventory();
    }
    if (e.code === "KeyE") {
      if (search) return; // идёт обыск — действия заблокированы
      if (ui.isOpen()) {
        ui.close();
      } else if (dlg.beat) {
        // история: листаем реплики; на последней — выбор кликом
        if (dlg.line < dlg.beat.lines.length - 1) {
          dlg.line++;
          renderDialog(dlg, null);
        }
      } else if (dlg.npc) {
        if (!advanceDialog(dlg)) renderDialog(dlg, null);
        else renderDialog(dlg, dlg.npc);
      } else if (!combat.dead) {
        // лестница: внутри здания у лестницы — E наверх, X вниз
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
        } else if (npc) {
          openDialog(dlg, npc);
          renderDialog(dlg, npc);
        } else if (veh.inCar) {
          exitCar(city, veh, player);
        } else {
          // сначала ближайшая исправная; остов — только если исправных рядом нет
          const drivable = nearestCar(
            city,
            player.x,
            player.y,
            3,
            (c) => !c.wreck,
          );
          if (drivable) enterCar(veh, drivable, player);
          else {
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
                // обыск занимает время; навык поиска ускоряет
                search = {
                  c,
                  t: 0,
                  dur: Math.max(
                    0.5,
                    1.5 - 0.06 * skills.skills.scavenging.level,
                  ),
                };
              }
            }
          }
        }
      }
    }
    if (e.code === "Escape") {
      if (ui.isOpen()) ui.close();
      else setPaused(!paused);
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
  const pZoom = document.getElementById("pZoom");
  pZoom.addEventListener("click", () => {
    zoom = zoom === 1 ? 2 : 1;
    pZoom.textContent = "Зум: ×" + zoom;
  });
  document.getElementById("pNew").addEventListener("click", () => {
    if (confirm("Начать заново? Текущее сохранение будет удалено.")) {
      deleteSave();
      location.search = "?new=1";
    }
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
    save: () =>
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
      }),
  };

  // автосохранение: каждые 15 с и при скрытии страницы
  let saveT = 15;
  let visitT = 0;
  const frameState = { insideB: null, stairsNear: false };
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
    });
  // строка квеста для HUD
  function questHudText() {
    const q = mainQuest(quests, QUESTS);
    if (!q) return "◆ Цепочка выполнена. Выживай.";
    return `◆ ${q.name}: ${q.goals.map((g) => goalText(g, quests.prog)).join(" · ")}`;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doSave();
  });

  let lastT = performance.now();
  let fpsE = 60,
    msE = 16;
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
    dlg.beat = null;
    dlg.line = 0;
    renderDialog(dlg, null);
  });
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (paused) {
      // пауза: мир стоит, только рендер + HUD
      const camS0 = w2s(cam.x, cam.y);
      const aim0 = screenToWorld(mouse.x, mouse.y, camS0, W, H, zoom);
      const dark0 = darknessFor(survival.tod);
      renderWorld({
        ctx,
        R,
        city,
        player,
        zombies: city.zombies,
        groundSet,
        SPR,
        cam,
        zoom,
        night: dark0 > 0.4,
        L,
        W,
        H,
        ashP,
        combat,
        loot,
        aim: aim0,
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
      });
      hud.textContent = `МЁРТВЫЙ РАЙОН — ПАУЗА\n${clockText(survival)} · HP ${Math.ceil(combat.playerHp)}/${combat.playerMaxHp} · сытость ${Math.ceil(survival.hunger)}`;
      requestAnimationFrame(frame);
      return;
    }
    const t0 = performance.now();
    mods = modifiers(skills);
    combat.playerMaxHp = mods.maxHp;
    if (combat.playerHp > combat.playerMaxHp)
      combat.playerHp = combat.playerMaxHp;
    // обыск: движение/урон отменяют, по завершении — окно лута
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
          ui.openLoot(c);
        }
      }
    }
    if (!ui.isOpen() && !dlg.npc && !search) {
      if (veh.inCar)
        updateVehicle(city, veh.inCar, keys, player, combat, dt, mods, (m) =>
          skillXp("driving", m / 100),
        );
      else
        updatePlayer(city, player, keys, dt, mods, (m, run) =>
          skillXp("athletics", (m * (run ? 1.5 : 1)) / 40),
        );
    } else keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    const dayBefore = survival.day;
    updateSurvival(survival, combat, player, city, inv, dt, mods);
    if (survival.day > dayBefore) {
      skillXp("survival", 20); // пережил сутки
      campsNewDay(camps, survival.day); // склад и поручения лагерей
      baseNewDay(base, survival.day); // жители и производство базы
    }
    if (survival.tod >= 21 && survival.tod < 21.1) {
      const n = baseRaid(base, city, survival.day);
      if (n > 0) toast(`Рейд на базу: ${n} зомби!`);
    }
    if (survival.pendingBoss) {
      const p = survival.pendingBoss;
      survival.pendingBoss = null;
      spawnZombie(city, p.x, p.y, "boss");
      toast("Матка пришла к больнице. Она зовёт подкрепление...");
    }
    const dark = darknessFor(survival.tod);
    const night = dark > 0.4;
    updateZombies(
      city,
      city.zombies,
      player,
      dt,
      night ? 1.35 : 1,
      !!veh.inCar,
    );
    // регистрация интерьерных контейнеров при входе в здание
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
    // пустые контейнеры не предлагают обыск; учитываем уже опустошённые
    const nearItems = nearC
      ? loot.opened.has(nearC.id)
        ? loot.opened.get(nearC.id)
        : containerItems(nearC, mods.lootBonus)
      : null;
    loot.nearest = nearC && nearItems.some((s) => s) ? nearC : null;
    toastT = Math.max(0, toastT - dt);
    // квесты: визит к POI (раз в 0,5 с)
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
    // внутри какого здания и у лестницы ли
    frameState.insideB = playerInside(city, player);
    frameState.stairsNear = false;
    frameState.windowNear = null;
    // ближайшее неразбитое окно первого этажа
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
    renderWorld({
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
    });
    // пепел дрейфует
    for (const a of ashP) {
      a.x -= (3 + a.layer * 5) * dt * (1 + 0.3 * Math.sin(t / 900 + a.p));
      a.y += (9 + a.layer * 7) * dt;
      if (a.y > H + 4 || a.x < -4) {
        a.x = Math.random() * (W + 40);
        a.y = -4;
      }
    }
    const ms = performance.now() - t0;
    msE += (ms - msE) * 0.06;
    fpsE += (1 / Math.max(dt, 1e-4) - fpsE) * 0.06;
    // автосохранение раз в 15 с
    saveT -= dt;
    if (saveT <= 0 && !combat.dead) {
      saveT = 15;
      doSave();
    }
    hud.textContent = `МЁРТВЫЙ РАЙОН · ${city.SIZE}×${city.SIZE} м · зданий ${city.buildings.length} · сид ${seed}
FPS ${fpsE.toFixed(0)} · кадр ${msE.toFixed(1)} мс · drawImage ${R.drawCalls} · чанков ${R.chunkCache.size}
${clockText(survival)} · HP ${Math.ceil(combat.playerHp)}/${combat.playerMaxHp} · сытость ${Math.ceil(survival.hunger)} · стрелы ${countItem(inv, "arrow")} · убито ${combat.kills}${veh.inCar ? ` · 🚗 ${Math.abs(veh.inCar.v * 3.6).toFixed(0)} км/ч · ${fuelText(veh.inCar)}` : ""}${player.level > 0 ? ` · этаж ${player.level + 1}` : ""}
${questHudText()}
${storyHud(story)}
${veh.inCar ? "WASD — руль · E — выйти · F — заправить · T — багажник" : "WASD — движение · ЛКМ — лук · E — обыск/сесть · I — рюкзак · C — крафт · P — персонаж · T — багажник · Q — еда · H — бинт"}${campNear(camps, player.x, player.y) ? ` · E — лагерь «${campDef(campNear(camps, player.x, player.y)).name}»` : ""}${combat.noArrowsT > 0 ? "  ← НЕТ СТРЕЛ!" : ""}${toastT > 0 ? "\n▸ " + toastMsg : ""}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// модуль — точка входа: запускаем сразу
boot();
