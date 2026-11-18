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
} from "./systems/vehicles.js";
import { PITCH } from "./world/cityGen.js";
import { createCity } from "./world/cityGen.js";
import { loadAssets } from "./render/assets.js";
import { makeGroundSet } from "./render/tiles.js";
import {
  makeTree,
  makeLamp,
  makeBench,
  makeContainer,
  makeTires,
  makeFence,
  makeCar,
  makeActor,
} from "./render/sprites.js";
import {
  createRenderer,
  bakeVignette,
  renderWorld,
} from "./render/renderer.js";
import { createLighting, fitLighting } from "./render/lighting.js";
import { initActors, updatePlayer, updateZombies } from "./systems/actors.js";
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
} from "./systems/inventory.js";
import {
  createLoot,
  nearestContainer,
  openContainer,
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
  const carSpriteCache = new Map();
  const carSprite = (car) => {
    const key = car.color + car.axis + (car.wreck ? "w" : "");
    if (!carSpriteCache.has(key))
      carSpriteCache.set(key, makeCar(car.color, car.wreck, car.axis));
    return carSpriteCache.get(key);
  };
  const SPR = {
    trees: [0, 1, 2].map((v) => makeTree(false, v)),
    deadTrees: [0, 1, 2].map((v) => makeTree(true, v)),
    lamp: makeLamp(),
    bench: makeBench(),
    container: makeContainer(),
    tires: makeTires(),
    fenceX: makeFence("x"),
    fenceY: makeFence("y"),
    cars: city.cars.map(carSprite),
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
  // лут и инвентарь
  const inv = createInventory(24);
  const loot = createLoot(city);
  const quests = createQuests();
  const veh = { inCar: null };
  initVehicles(city);
  const npcs = createNpcs(city, PITCH);
  const dlg = createDialog();
  // загрузка сохранения (если есть и не форсирована новая игра через ?new=1)
  const wantNew = params.get("new") === "1";
  let loaded = false;
  if (hasSave() && !wantNew) {
    const data = loadGameData();
    if (data && data.seed === seed && data.nb === nb) {
      applySave(data, { city, player, combat, survival, inv, loot, quests });
      loaded = true;
    }
  }
  if (!loaded) {
    addItem(inv, "arrow", 12); // стартовый колчан
    addItem(inv, "can", 2); // немного еды на старт
    addItem(inv, "meds", 1);
  }
  let toastMsg = "",
    toastT = 0;
  const toast = (msg) => {
    toastMsg = msg;
    toastT = 2.5;
  };
  // квестовые события: kill / loot / visit
  const questEvent = (type, data) => {
    const done = qEvent(quests, QUESTS, type, data);
    if (done) {
      for (const [id, n] of done.reward) addItem(inv, id, n);
      toast(`Квест выполнен: «${done.name}»! Награда получена.`);
    }
  };
  combat.onKill = () => questEvent("kill");
  const useItem = (id) => {
    const msg = useConsumable(survival, combat, inv, id, (i, n) =>
      removeItem(inv, i, n),
    );
    if (msg) toast(msg);
    ui.render();
  };
  const ui = createUI({
    getInventory: () => inv,
    getLootState: (c) => loot.opened.get(c.id),
    onTake: (c, i) => {
      const { id, took } = takeFrom(loot, c, i, (id2, n) =>
        addItem(inv, id2, n),
      );
      if (took > 0) questEvent("loot", { id, n: took });
    },
    onTakeAll: (c) => {
      for (const [id, took] of takeAll(loot, c, (id2, n) =>
        addItem(inv, id2, n),
      ))
        questEvent("loot", { id, n: took });
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
      if (r && craft(inv, r)) toast(`Создано: ${r.name}`);
    },
    canCraft: (r) => canCraft(inv, r),
    onClose: () => {},
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
    releaseBow(combat, player, aim, inv, city);
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
        // шум: зомби в 12 м идут к игроку
        for (const z of city.zombies) {
          if (z.dead) continue;
          if (Math.hypot(z.x - player.x, z.y - player.y) < 12) {
            z.tx = player.x;
            z.ty = player.y;
            z.retarget = 0;
          }
        }
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
    if (e.code === "KeyC") {
      if (ui.isOpen()) ui.close();
      else ui.openCraft();
    }
    // интерфейс: рюкзак и обыск
    if (e.code === "KeyI" || e.code === "Tab") {
      e.preventDefault();
      if (ui.isOpen()) ui.close();
      else ui.openInventory();
    }
    if (e.code === "KeyE") {
      if (ui.isOpen()) {
        ui.close();
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
        const npc = npcNear(npcs, player.x, player.y);
        if (npc) {
          openDialog(dlg, npc);
          renderDialog(dlg, npc);
        } else if (veh.inCar) {
          exitCar(city, veh, player);
        } else {
          const car = nearestCar(city, player.x, player.y);
          if (car && !car.wreck) enterCar(veh, car, player);
          else if (car && car.wreck) toast("Машина разбита");
          else {
            const c = nearestContainer(
              loot,
              player.x,
              player.y,
              1.6,
              frameState.insideB,
            );
            if (c) {
              openContainer(loot, c);
              ui.openLoot(c);
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
    save: () => saveGame({ city, player, combat, survival, inv, loot }),
  };

  // автосохранение: каждые 15 с и при скрытии страницы
  let saveT = 15;
  let visitT = 0;
  const frameState = { insideB: null, stairsNear: false };
  const doSave = () =>
    saveGame({ city, player, combat, survival, inv, loot, quests });
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
    if (!npc) {
      dlgEl.style.display = "none";
      return;
    }
    dlgEl.style.display = "block";
    dlgEl.innerHTML = `<div class="who">${npc.name}</div><div>${npc.lines[D.line]}</div><div class="hint">E — дальше</div>`;
  }
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
      });
      hud.textContent = `ПЕПЕЛОПАД: Город — ПАУЗА\n${clockText(survival)} · HP ${Math.ceil(combat.playerHp)}/${combat.playerMaxHp} · сытость ${Math.ceil(survival.hunger)}`;
      requestAnimationFrame(frame);
      return;
    }
    const t0 = performance.now();
    if (!ui.isOpen() && !dlg.npc) {
      if (veh.inCar)
        updateVehicle(city, veh.inCar, keys, player, combat, dt, null);
      else updatePlayer(city, player, keys, dt);
    } else keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    updateSurvival(survival, combat, player, city, inv, dt);
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
    loot.nearest = nearestContainer(
      loot,
      player.x,
      player.y,
      1.6,
      frameState.insideB,
    );
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
    hud.textContent = `ПЕПЕЛОПАД: Город · ${city.SIZE}×${city.SIZE} м · зданий ${city.buildings.length} · сид ${seed}
FPS ${fpsE.toFixed(0)} · кадр ${msE.toFixed(1)} мс · drawImage ${R.drawCalls} · чанков ${R.chunkCache.size}
${clockText(survival)} · HP ${Math.ceil(combat.playerHp)}/${combat.playerMaxHp} · сытость ${Math.ceil(survival.hunger)} · стрелы ${countItem(inv, "arrow")} · убито ${combat.kills}${veh.inCar ? ` · 🚗 ${Math.abs(veh.inCar.v * 3.6).toFixed(0)} км/ч · ${fuelText(veh.inCar)}` : ""}${player.level > 0 ? ` · этаж ${player.level + 1}` : ""}
${questHudText()}
${veh.inCar ? "WASD — руль · E — выйти · F — заправить" : "WASD — движение · ЛКМ — лук · E — обыск/сесть · I — рюкзак · C — крафт · Q — еда · H — бинт"}${combat.noArrowsT > 0 ? "  ← НЕТ СТРЕЛ!" : ""}${toastT > 0 ? "\n▸ " + toastMsg : ""}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// модуль — точка входа: запускаем сразу
boot();
