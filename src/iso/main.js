// Точка входа новой игры (этап 16.4): город, рендер, актёры, цикл.
// Старый путь (OSM/Волгоград) остаётся в index.html до паритета.
import { mulberry32 } from "./core/rng.js";
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
} from "./systems/loot.js";
import { createUI } from "./ui/panels.js";
import { ITEMS } from "./data/items.js";
import { RECIPES } from "./data/recipes.js";
import { canCraft, craft } from "./systems/craft.js";
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
  // загрузка сохранения (если есть и не форсирована новая игра через ?new=1)
  const wantNew = params.get("new") === "1";
  let loaded = false;
  if (hasSave() && !wantNew) {
    const data = loadGameData();
    if (data && data.seed === seed && data.nb === nb) {
      applySave(data, { city, player, combat, survival, inv, loot });
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
    onTake: (c, i) => takeFrom(loot, c, i, (id, n) => addItem(inv, id, n)),
    onTakeAll: (c) => takeAll(loot, c, (id, n) => addItem(inv, id, n)),
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
    releaseBow(combat, player, aim, inv);
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
      if (ui.isOpen()) ui.close();
      else if (!combat.dead) {
        const c = nearestContainer(loot, player.x, player.y);
        if (c) {
          openContainer(loot, c);
          ui.openLoot(c);
        }
      }
    }
    if (e.code === "Escape" && ui.isOpen()) ui.close();
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
  const doSave = () => saveGame({ city, player, combat, survival, inv, loot });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doSave();
  });

  let lastT = performance.now();
  let fpsE = 60,
    msE = 16;
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const t0 = performance.now();
    if (!ui.isOpen()) updatePlayer(city, player, keys, dt);
    else keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    updateSurvival(survival, combat, player, city, inv, dt);
    const dark = darknessFor(survival.tod);
    const night = dark > 0.4;
    updateZombies(city, city.zombies, player, dt, night ? 1.35 : 1);
    loot.nearest = nearestContainer(loot, player.x, player.y);
    toastT = Math.max(0, toastT - dt);
    const camS = w2s(cam.x, cam.y);
    const aim = screenToWorld(mouse.x, mouse.y, camS, W, H, zoom);
    updateCombat(combat, city, player, aim, dt, t / 1000);
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
      aim,
      now: t / 1000,
      lootNearest: loot.nearest,
      uiOpen: ui.isOpen(),
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
${clockText(survival)} · HP ${Math.ceil(combat.playerHp)}/${combat.playerMaxHp} · сытость ${Math.ceil(survival.hunger)} · стрелы ${countItem(inv, "arrow")} · убито ${combat.kills}
WASD — движение · ЛКМ — лук · E — обыск · I — рюкзак · Q — еда · H — бинт · N — к ночи/утру${combat.noArrowsT > 0 ? "  ← НЕТ СТРЕЛ!" : ""}${toastT > 0 ? "\n▸ " + toastMsg : ""}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// модуль — точка входа: запускаем сразу
boot();
