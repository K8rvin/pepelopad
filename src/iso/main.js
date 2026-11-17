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
import { createInventory, addItem, countItem } from "./systems/inventory.js";
import {
  createLoot,
  nearestContainer,
  openContainer,
  takeFrom,
  takeAll,
} from "./systems/loot.js";
import { createUI } from "./ui/panels.js";
import { ITEMS } from "./data/items.js";
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
  // лут и инвентарь
  const inv = createInventory(24);
  addItem(inv, "arrow", 12); // стартовый колчан
  const loot = createLoot(city);
  const ui = createUI({
    getInventory: () => inv,
    getLootState: (c) => loot.opened.get(c.id),
    onTake: (c, i) => takeFrom(loot, c, i, (id, n) => addItem(inv, id, n)),
    onTakeAll: (c) => takeAll(loot, c, (id, n) => addItem(inv, id, n)),
    onClose: () => {},
  });
  let night = false,
    zoom = 1;
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
    if (e.code === "KeyN") night = !night;
    if (e.code === "KeyZ") zoom = zoom === 1 ? 2 : 1;
    if (e.code === "KeyR" && combat.dead)
      respawn(combat, player, spawn.x, spawn.y);
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
    inv,
    loot,
    ui,
    teleport: (x, y) => {
      player.x = x;
      player.y = y;
      cam.x = x;
      cam.y = y;
    },
    setNight: (v) => (night = v),
  };

  let lastT = performance.now();
  let fpsE = 60,
    msE = 16;
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const t0 = performance.now();
    if (!ui.isOpen()) updatePlayer(city, player, keys, dt);
    else keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
    updateZombies(city, city.zombies, player, dt);
    loot.nearest = nearestContainer(loot, player.x, player.y);
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
    hud.textContent = `ПЕПЕЛОПАД: Город · ${city.SIZE}×${city.SIZE} м · зданий ${city.buildings.length} · сид ${seed}
FPS ${fpsE.toFixed(0)} · кадр ${msE.toFixed(1)} мс · drawImage ${R.drawCalls} · чанков ${R.chunkCache.size}
HP ${combat.playerHp}/${combat.playerMaxHp} · убито ${combat.kills} · стрелы ${countItem(inv, "arrow")} · ${night ? "НОЧЬ" : "день"} · zoom ×${zoom}
WASD — движение · ЛКМ — лук · E — обыск · I — рюкзак · N — день/ночь · Z — зум${combat.noArrowsT > 0 ? "  ← НЕТ СТРЕЛ!" : ""}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// модуль — точка входа: запускаем сразу
boot();
