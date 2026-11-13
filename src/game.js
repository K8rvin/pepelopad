import {
  clamp,
  lerp,
  rnd,
  ri,
  pick,
  mod,
  dist,
  d2,
  K,
} from "/src/core/math.js";
import { mb32, h2, hashStr } from "/src/core/rng.js";
import { createEventBus } from "/src/core/events.js";
import { T, SC, CH, CELL, BASEX, BASEY } from "/src/core/constants.js";
import {
  ITEMS,
  WEAPONS,
  HOT,
  RECIPES,
  SKILLS,
  ZT,
  POI,
  LOOT,
  BUILDS,
  PROJ,
  DIFFS,
  VEHICLES,
  CAMP_UPGRADES,
  DISTRICTS,
  RAIDS,
  CTRLS,
  MAIN,
  assertValidGameData,
} from "/src/data/index.js";
import {
  addItemToSlots,
  countItemInSlots,
  removeItemFromSlots,
} from "/src/systems/inventory.js";
import {
  districtDefinition,
  districtGuardCount,
  rollDistrictLoot,
} from "/src/systems/districts.js";
import { activeRaidId, raidDistrictRules } from "/src/systems/raids.js";
import {
  advanceVehicle,
  consumeVehicleFuel,
  damageVehicle,
  normalizeVehicle,
  vehicleDefinition,
} from "/src/systems/vehicles.js";
import { moveStackToTrunk, takeStackFromTrunk } from "/src/systems/trunk.js";
import {
  getSolid,
  circleHit as testCircleHit,
  moveBody as moveBodyGrid,
} from "/src/systems/collision.js";
import {
  applyQuestEvent,
  goalsComplete,
  syncQuestProgress,
} from "/src/systems/questProgress.js";
import {
  darknessForTime,
  nextSiegeDayFor,
  advanceClock,
} from "/src/systems/time.js";
import { getReloadTime, createShotProjectiles } from "/src/systems/combat.js";
import {
  maxHpFor,
  maxStFor,
  playerSpeed,
  damageMultiplier,
  xpNeed as xpNeedFor,
  threatForDay,
} from "/src/systems/player.js";
import { createZombie, shouldAttackStructure } from "/src/systems/zombies.js";
import {
  shouldSkipZombieUpdate,
  shouldUnloadZombie,
  steerAroundObstacles,
} from "/src/systems/zombieNavigation.js";
import {
  buildCostFor,
  buildLockFor,
  placementLock,
} from "/src/systems/building.js";
import {
  findCampNear,
  campUpgradeCost,
  campUpgradeLock,
  applyCampUpgrade,
  donateToCamp,
  tradeLock,
} from "/src/systems/camps.js";
import { loadSprite, loadSpriteSheet } from "/src/render/assets.js";
import { cnv, R } from "/src/render/spriteUtils.js";
import { createTiles } from "/src/render/proceduralTiles.js";
import { createActorSprites } from "/src/render/proceduralActors.js";
import { createStructureSprites } from "/src/render/proceduralStructures.js";
import { createItemIcons } from "/src/render/proceduralItems.js";
import { renderVfx } from "/src/render/vfx.js";
import { prepareMegaQuest } from "/src/systems/campaign.js";
import { collectQuestGrants } from "/src/systems/questGrants.js";
import {
  CITY_ID,
  createSaveData,
  parseSave,
} from "/src/persistence/saveSchema.js";
import { resolveLoadMode } from "/src/persistence/loadMode.js";
import { renderHome as drawHome } from "/src/render/homeRenderer.js";
import {
  screenToWorld as toWorld,
  worldToScreen as toScreen,
} from "/src/render/camera.js";
import { drawWeaponOverlay as renderWeapon } from "/src/render/weaponRenderer.js";
import { renderLighting } from "/src/render/lighting.js";
import { renderParticles } from "/src/render/particles.js";
import { renderGuidance } from "/src/render/guidance.js";
import { renderCampsAndVehicles } from "/src/render/campsAndVehicles.js";
import { renderWorldObjects } from "/src/render/worldObjects.js";
import { renderActors } from "/src/render/actors.js";
import { createWorldRenderer } from "/src/render/worldRenderer.js";
import { renderFloor } from "/src/render/floorRenderer.js";
import { changeFloor } from "/src/systems/floors.js";
import {
  createFloorScene,
  floorContainers,
  floorTileAt,
} from "/src/world/floorScene.js";
import { createDomUI } from "/src/ui/domUI.js";
import { createMapController } from "/src/ui/mapController.js";
import { attachMapInteractions } from "/src/ui/mapInteractions.js";
import { FLOOR_DEFINITIONS } from "/src/data/floors.js";
import { districtOf } from "/src/world/city.js";
import {
  spatialKey,
  addToSpatialGrid,
  moveInSpatialGrid,
  nearInSpatialGrid,
} from "/src/world/spatialGrid.js";
import { createChunkManager } from "/src/world/chunkManager.js";
import { loadOsmWorld } from "/src/world/osmMap.js";
import { createOsmGameProjection } from "/src/world/osmPois.js";
import { createOsmCityModel } from "/src/world/osmCity.js";
import { osmSolidAt } from "/src/world/osmCollision.js";
import { renderOsmMap } from "/src/render/osmMapRenderer.js";

assertValidGameData({
  ITEMS,
  WEAPONS,
  HOT,
  RECIPES,
  SKILLS,
  ZT,
  POI,
  LOOT,
  BUILDS,
  PROJ,
  VEHICLES,
  CAMP_UPGRADES,
  DISTRICTS,
  RAIDS,
  MAIN,
});

const OSM_WORLD = await loadOsmWorld(
  `${import.meta.env.BASE_URL}assets/maps/volgograd-center.json`,
);
const OSM_PROJECTION = createOsmGameProjection(OSM_WORLD);
const OSM_CITY = createOsmCityModel(OSM_WORLD, OSM_PROJECTION);
const OSM_QUEST_TARGETS = OSM_PROJECTION.campaignTargets();

const $ = (id) => document.getElementById(id);
$("appVersion").textContent =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
$("buildDate").textContent =
  typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "dev";
$("buildVersion").textContent =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const cv = $("cv"),
  ctx = cv.getContext("2d"),
  LC = cnv(1, 1),
  lx = LC.getContext("2d"),
  mm = $("mmap").getContext("2d"),
  bm = $("bmap").getContext("2d");
const AU = {
  ac: null,
  mg: null,
  muted: false,
  init() {
    if (this.ac) return;
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.mg = this.ac.createGain();
      this.mg.gain.value = 0.8;
      this.mg.connect(this.ac.destination);
      const b = this.ac.createBuffer(
          1,
          this.ac.sampleRate * 2,
          this.ac.sampleRate,
        ),
        d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ac.createBufferSource();
      s.buffer = b;
      s.loop = true;
      const f = this.ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 320;
      this.wind = this.ac.createGain();
      this.wind.gain.value = 0.022;
      s.connect(f);
      f.connect(this.wind);
      this.wind.connect(this.mg);
      s.start();
      const o = this.ac.createOscillator();
      o.type = "sine";
      o.frequency.value = 48;
      this.drone = this.ac.createGain();
      this.drone.gain.value = 0;
      o.connect(this.drone);
      this.drone.connect(this.mg);
      o.start();
      const e = this.ac.createOscillator();
      e.type = "sawtooth";
      e.frequency.value = 70;
      this.eng = this.ac.createGain();
      this.eng.gain.value = 0;
      const ef = this.ac.createBiquadFilter();
      ef.type = "lowpass";
      ef.frequency.value = 240;
      e.connect(ef);
      ef.connect(this.eng);
      this.eng.connect(this.mg);
      e.start();
    } catch (e) {}
  },
  resume() {
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
  },
  mute(m) {
    this.muted = m;
    if (this.mg) this.mg.gain.value = m ? 0 : 0.8;
    $("muteBtn").textContent = m ? "✕ ЗВУК: ВЫКЛ" : "♪ ЗВУК: ВКЛ";
    $("muteBtn").classList.toggle("off", m);
  },
  tone(f, d, t, v, sl, de) {
    if (!this.ac || this.muted) return;
    const n = this.ac.currentTime + (de || 0),
      o = this.ac.createOscillator(),
      g = this.ac.createGain();
    o.type = t || "square";
    o.frequency.setValueAtTime(f, n);
    if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(20, sl), n + d);
    g.gain.setValueAtTime(v || 0.12, n);
    g.gain.exponentialRampToValueAtTime(0.0001, n + d);
    o.connect(g);
    g.connect(this.mg);
    o.start(n);
    o.stop(n + d + 0.02);
  },
  noise(d, f, v, t, de) {
    if (!this.ac || this.muted) return;
    const n = this.ac.currentTime + (de || 0),
      l = Math.max(1, (this.ac.sampleRate * d) | 0),
      b = this.ac.createBuffer(1, l, this.ac.sampleRate),
      dd = b.getChannelData(0);
    for (let i = 0; i < l; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / l);
    const s = this.ac.createBufferSource();
    s.buffer = b;
    const fl = this.ac.createBiquadFilter();
    fl.type = t || "lowpass";
    fl.frequency.value = f;
    const g = this.ac.createGain();
    g.gain.value = v || 0.15;
    s.connect(fl);
    fl.connect(g);
    g.connect(this.mg);
    s.start(n);
  },
  tick(dt) {
    if (!this.ac) return;
    const dk = darkness();
    if (this.wind)
      this.wind.gain.value = state === "home" ? 0.016 : 0.022 + dk * 0.028;
    if (this.drone)
      this.drone.gain.value =
        (state === "play" || state === "floor") && dk > 0.3 ? 0.02 : 0;
    if (this.eng) {
      const c = P && P.inCar ? CARS.get(P.inCar) : null;
      this.eng.gain.value = c && Math.abs(c.speed) > 4 ? 0.035 : 0;
    }
  },
};
const SFX = {
  shoot(w) {
    if (w === "bow") {
      AU.tone(320, 0.09, "triangle", 0.13, 140);
      AU.noise(0.05, 2200, 0.04, "highpass");
    } else if (w === "crossbow") {
      AU.tone(250, 0.12, "triangle", 0.16, 105);
      AU.noise(0.07, 1500, 0.07);
    } else if (w === "shotgun") {
      AU.noise(0.22, 850, 0.34);
      AU.tone(115, 0.14, "square", 0.18, 42);
    } else if (w === "rifle") {
      AU.noise(0.14, 1700, 0.28);
      AU.tone(175, 0.09, "square", 0.16, 55);
    } else if (w === "revolver") {
      AU.noise(0.16, 1200, 0.3);
      AU.tone(140, 0.12, "square", 0.2, 50);
    } else {
      AU.noise(0.08, 1400, 0.22);
      AU.tone(145, 0.06, "square", 0.13, 58);
    }
  },
  draw() {
    AU.tone(170, 0.2, "triangle", 0.06, 115);
  },
  ready() {
    AU.tone(820, 0.05, "sine", 0.07, 1100);
  },
  reload() {
    AU.noise(0.04, 1100, 0.09);
    AU.noise(0.05, 850, 0.09, "lowpass", 0.12);
  },
  empty() {
    AU.tone(1050, 0.04, "square", 0.06);
  },
  hit() {
    AU.tone(92, 0.05, "square", 0.1, 58);
    AU.noise(0.04, 650, 0.08);
  },
  zdie() {
    AU.tone(115, 0.28, "sawtooth", 0.1, 36);
    AU.noise(0.15, 450, 0.08);
  },
  hurt() {
    AU.tone(200, 0.16, "sawtooth", 0.18, 68);
    AU.noise(0.1, 550, 0.13);
  },
  melee() {
    AU.noise(0.07, 850, 0.1, "bandpass");
  },
  pickup() {
    AU.tone(600, 0.06, "sine", 0.09, 880);
    AU.tone(900, 0.07, "sine", 0.07, 1150, 0.05);
  },
  loot() {
    AU.noise(0.12, 750, 0.1);
    AU.tone(500, 0.08, "sine", 0.07, 740, 0.08);
  },
  craft() {
    AU.noise(0.05, 1050, 0.12);
    AU.noise(0.05, 1050, 0.12, "lowpass", 0.11);
    AU.tone(680, 0.1, "sine", 0.07, 940, 0.2);
  },
  build() {
    AU.noise(0.06, 550, 0.18);
    AU.noise(0.08, 480, 0.16, "lowpass", 0.1);
  },
  breakS() {
    AU.noise(0.25, 380, 0.24);
    AU.tone(85, 0.2, "square", 0.11, 38);
  },
  level() {
    [523, 659, 784, 1046].forEach((f, i) =>
      AU.tone(f, 0.14, "square", 0.09, undefined, i * 0.09),
    );
  },
  quest() {
    [392, 523, 659].forEach((f, i) =>
      AU.tone(f, 0.18, "triangle", 0.1, undefined, i * 0.12),
    );
  },
  bp() {
    [660, 880, 1100].forEach((f, i) =>
      AU.tone(f, 0.12, "sine", 0.1, undefined, i * 0.08),
    );
  },
  explode() {
    AU.noise(0.5, 220, 0.42);
    AU.tone(58, 0.45, "sine", 0.32, 26);
  },
  nestHit() {
    AU.tone(68, 0.09, "sine", 0.12, 48);
  },
  nestDie() {
    AU.noise(0.7, 180, 0.42);
    AU.tone(190, 0.8, "sawtooth", 0.18, 24);
    AU.tone(85, 0.6, "sine", 0.22, 28, 0.1);
  },
  scream() {
    AU.tone(640, 0.4, "sawtooth", 0.13, 1050);
    AU.tone(1000, 0.3, "sawtooth", 0.09, 280, 0.25);
  },
  spit() {
    AU.tone(380, 0.1, "sine", 0.07, 170);
    AU.noise(0.06, 850, 0.05);
  },
  siren() {
    for (let i = 0; i < 3; i++) {
      AU.tone(840, 0.3, "square", 0.08, undefined, i * 0.62);
      AU.tone(600, 0.3, "square", 0.08, undefined, i * 0.62 + 0.31);
    }
  },
  eat() {
    AU.noise(0.08, 650, 0.08);
    AU.tone(280, 0.08, "sine", 0.06, 210, 0.06);
  },
  heal() {
    AU.tone(430, 0.12, "sine", 0.08, 640);
    AU.tone(640, 0.14, "sine", 0.07, 840, 0.1);
  },
  step() {
    AU.noise(0.03, 450, 0.025);
  },
  ui() {
    AU.tone(780, 0.04, "square", 0.04);
  },
  place() {
    AU.tone(190, 0.08, "square", 0.09, 115);
    AU.noise(0.06, 750, 0.09);
  },
  poison() {
    AU.tone(280, 0.2, "sine", 0.06, 115);
  },
  dawn() {
    AU.tone(500, 0.3, "triangle", 0.07, 740);
    AU.tone(740, 0.4, "triangle", 0.06, 980, 0.25);
  },
  flash() {
    AU.noise(0.9, 180, 0.38);
    AU.tone(40, 0.9, "sine", 0.32, 22);
    AU.tone(900, 0.5, "sawtooth", 0.07, 120, 0.1);
  },
  door() {
    AU.noise(0.18, 420, 0.14);
    AU.tone(120, 0.2, "triangle", 0.09, 70);
  },
  engine() {
    AU.tone(90, 0.2, "sawtooth", 0.06, 60);
  },
  crash() {
    AU.noise(0.3, 300, 0.3);
    AU.tone(70, 0.3, "square", 0.16, 35);
  },
  horn() {
    AU.tone(420, 0.25, "square", 0.14);
    AU.tone(330, 0.25, "square", 0.12, undefined, 0.02);
  },
  throwM() {
    AU.noise(0.1, 900, 0.08, "bandpass");
    AU.tone(300, 0.1, "triangle", 0.06, 180);
  },
  fire() {
    AU.noise(0.4, 600, 0.16, "lowpass");
  },
  turret() {
    AU.noise(0.04, 1900, 0.07, "highpass");
  },
};
const S = {},
  TI = createTiles(),
  ICONS = {};
createActorSprites(S);
createStructureSprites(S);
createItemIcons(ICONS);
loadSprite("./assets/effects/campfire.gif", (image) => {
  S.fire[0] = image;
  S.fire[1] = image;
});
loadSprite("./assets/effects/arrow.gif", (image) => {
  S.arrowP = image;
});
const ATLAS_SIZES = {
  player: [12, 14],
  survivor: [12, 14],
  walker: [12, 14],
  dog: [14, 10],
  brute: [18, 18],
  spitter: [12, 14],
  riot: [12, 14],
  howler: [12, 14],
  crate: [16, 16],
  rock: [16, 16],
  tree: [16, 16],
  pistol: [10, 6],
  rifle: [16, 6],
  car_sedan: [28, 16],
  car_blue: [28, 16],
  car_taxi: [28, 16],
  car_police: [28, 16],
  car_ambulance: [28, 16],
  car_truck: [32, 16],
  car_wreck: [28, 16],
};
for (const [id, url] of Object.entries({
  wood: "./assets/sprites/wood.png",
  scrap: "./assets/sprites/scrap.png",
  cloth: "./assets/sprites/cloth.png",
  chem: "./assets/sprites/chem.png",
  elec: "./assets/sprites/elec.png",
  can: "./assets/sprites/can.png",
  bandage: "./assets/sprites/bandage.png",
  medkit: "./assets/sprites/medkit.png",
  armor: "./assets/sprites/armor.png",
  arrow: "./assets/sprites/arrow.png",
  crossbow: "./assets/sprites/crossbow.png",
  pistol: "./assets/sprites/pistol.png",
  rifle: "./assets/sprites/rifle.png",
  crate: "./assets/sprites/crate.png",
  rock: "./assets/sprites/rock.png",
  player: "./assets/sprites/player.png",
  survivor: "./assets/sprites/survivor.png",
  walker: "./assets/sprites/walker.png",
  dog: "./assets/sprites/dog.png",
  brute: "./assets/sprites/brute.png",
  spitter: "./assets/sprites/spitter.png",
  riot: "./assets/sprites/riot.png",
  howler: "./assets/sprites/howler.png",
  tree: "./assets/sprites/tree.png",
  car_sedan: "./assets/sprites/car_sedan.png",
  car_blue: "./assets/sprites/car_blue.png",
  car_taxi: "./assets/sprites/car_taxi.png",
  car_police: "./assets/sprites/car_police.png",
  car_ambulance: "./assets/sprites/car_ambulance.png",
  car_truck: "./assets/sprites/car_truck.png",
  car_wreck: "./assets/sprites/car_wreck.png",
})) {
  loadSprite(
    url,
    (image) => {
      if (id.startsWith("car_")) S[id] = image;
      else if (id === "tree" || id === "rock") {
        const index = id === "tree" ? 14 : 15,
          terrain = cnv(16, 16),
          g = terrain.getContext("2d");
        g.drawImage(TI[index], 0, 0);
        g.drawImage(image, 0, 0);
        TI[index] = terrain;
      } else if (id === "crate") {
        S.cont_crate = image;
        S.cont_crate_open = image;
      } else if (id === "pistol") S.gun_pistol = image;
      else if (id === "rifle") S.gun_rifle = image;
      else if (
        [
          "player",
          "survivor",
          "walker",
          "dog",
          "brute",
          "spitter",
          "riot",
          "howler",
        ].includes(id)
      ) {
        S[id] = image;
        if (id !== "player" && id !== "survivor") {
          const tinted = cnv(image.width, image.height);
          const g = tinted.getContext("2d");
          g.drawImage(image, 0, 0);
          g.globalCompositeOperation = "source-atop";
          g.fillStyle = "rgba(166,232,60,.22)";
          g.fillRect(0, 0, tinted.width, tinted.height);
          S[id + "_e"] = tinted;
        }
      } else ICONS[id] = image;
    },
    ATLAS_SIZES[id] || [12, 12],
  );
}
loadSpriteSheet("./assets/effects/small-explosion.png", (sheet) => {
  VFX_ASSETS.explosion = sheet;
}).catch(() => {});
const icache = {};
function spriteDataURL(source) {
  if (source.toDataURL) return source.toDataURL();
  const canvas = cnv(source.width, source.height);
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas.toDataURL();
}
function iconURL(id) {
  if (!icache[id]) icache[id] = spriteDataURL(ICONS[id] || ICONS.scrap);
  return icache[id];
}
function structURL(t) {
  return spriteDataURL(t === "fire" ? S.fire[0] : S[t]);
}
let state = "menu",
  SEED = 1,
  DIFFK = "easy",
  DIFF = DIFFS.easy,
  newDiff = "easy";
const mapController = createMapController({ minZoom: 0.5, maxZoom: 4 });
let mapReturnState = "play",
  pauseReturnState = "play",
  mapFloorId = "ground",
  mapFloorScene = null,
  mapHoverName = "";
let P,
  inv = [],
  learned = new Set(),
  bench = 1,
  day = 1,
  tod = 21.7,
  playT = 0,
  timeSpeed = 1,
  lastSiegeDay = 0,
  siege = null,
  siegeWarnDay = 0,
  deathCause = "",
  invSlots = 30,
  hasSpear = false,
  energyT = 0,
  currentFloorId = "outdoor",
  FLOOR_SCENE = null,
  FLOOR_CONTAINERS = new Map(),
  floorReturn = null;
let stats,
  J = [],
  Q = {
    main: 0,
    side: [],
    tracked: "main",
    prog: {},
    given: {},
    endless: false,
    sideSeq: 0,
    raids: {},
  },
  baseProj = {
    wall: 0,
    workshop: 0,
    garden: 0,
    tower: 0,
    garage: 0,
    radio: 0,
    clinic: 0,
  };
const chunks = new Map(),
  PLAN = new Map(),
  CMAP = new Map(),
  SMAP = new Map(),
  OV = new Map(),
  EX = new Set(),
  CARS = new Map(),
  CAR_GRID = new Map(),
  CAMPS = new Map(),
  NPCS = [];
let Z = [],
  PR = [],
  PT = [],
  DR = [],
  CL = [],
  TX = [],
  LG = [],
  visChunks = [],
  VFX = [];
const VFX_ASSETS = { explosion: null };
const cam = { x: BASEX, y: BASEY },
  keys = {},
  mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
let shake = 0,
  recoil = 0,
  buildSel = null,
  searching = null,
  promptObj = null,
  W = innerWidth,
  H = innerHeight,
  RES = Math.min(devicePixelRatio || 1, 2),
  hudT = 0,
  mmT = 0,
  saveT = 0,
  spawnT = 0,
  menuT = 0,
  ash = [],
  fpsEma = 16,
  slowN = 0,
  HOME = null,
  homeStage = 0,
  homeAfter = false,
  homeFlash = 0,
  homeRain = 0,
  DL = { active: false, lines: [], i: 0, ch: 0, cb: null },
  tut = [],
  nightToasted = false,
  gateOpen = false,
  curCamp = null,
  curCar = null,
  driveAcc = 0;
const SOLID = new Set([6, 7, 8, 14, 15, 16, 17, 18, 22, 23]);
const collisionContext = {
  structures: SMAP,
  containers: CMAP,
  solidTiles: SOLID,
  tileAt,
  osmSolidAt: (x, y, radius) =>
    currentFloorId === "outdoor" && !inBase(x, y)
      ? osmSolidAt(x, y, OSM_CITY.gameWorld, radius)
      : null,
  carsNear,
};
const { genChunk, getChunk } = createChunkManager({
  chunks,
  CMAP,
  OV,
  CAMPS,
  cnv,
  planBlock,
  ensureCars,
  initCamp,
  paintChunk,
  getSeed: () => SEED,
  getState: () => state,
  getPlayer: () => P,
  getStats: () => stats,
  getZombies: () => Z,
  gainXP,
  toast,
  spawnGuards,
  stampCityBuildings: false,
});
function resetStats() {
  stats = {
    kills: 0,
    nests: 0,
    pois: 0,
    looted: 0,
    crafted: 0,
    shots: 0,
    sieges: 0,
    calm: 0,
    drive: 0,
    camps: 0,
  };
}
function resetPlayer() {
  P = {
    x: 184,
    y: 232,
    r: 5,
    hp: 120,
    st: 100,
    hu: 100,
    armor: 0,
    xp: 0,
    lvl: 1,
    sp: 0,
    skills: {},
    aim: 0,
    weapon: "bow",
    owned: {},
    mags: {
      bow: 0,
      crossbow: 0,
      pistol: 0,
      revolver: 0,
      shotgun: 0,
      rifle: 0,
    },
    cd: 0,
    rl: 0,
    rlMax: 1,
    iframe: 0,
    poison: 0,
    meleeCd: 0,
    stDelay: 0,
    flash: true,
    stepT: 0,
    emptyT: 0,
    moving: false,
    inCar: null,
  };
  for (const s of SKILLS) P.skills[s.id] = 0;
  inv = new Array(invSlots).fill(null);
}
function maxHp() {
  return maxHpFor(P);
}
function maxSt() {
  return maxStFor(P);
}
function pSpeed() {
  return playerSpeed(P, energyT);
}
function dmgMul(w) {
  return damageMultiplier(P, w);
}
function xpNeed(l) {
  return xpNeedFor(l);
}
function buildCost(t) {
  return buildCostFor(t, P.skills);
}
function threat() {
  return threatForDay(day);
}
function planBlock(bx, by) {
  const key = K(bx, by);
  if (PLAN.has(key)) return PLAN.get(key);
  const block = OSM_CITY.planBlock(bx, by, SEED, OV);
  PLAN.set(key, block);
  return block;
}
function ensureCars(p) {
  for (const c of p.cars) {
    if (CARS.has(c.id)) continue;
    const st = OV.get("CAR" + c.id),
      v = st
        ? Object.assign({}, c, st)
        : Object.assign({}, c, {
            speed: 0,
            trunk: [],
            dead: false,
            flash: 0,
            crashCd: 0,
          });
    if (!v.trunk) v.trunk = [];
    if (typeof v.speed !== "number") v.speed = 0;
    normalizeVehicle(v);
    CARS.set(c.id, v);
    carGridAdd(v);
  }
}
function carGridKey(x, y) {
  return spatialKey(x, y);
}
function carGridAdd(c) {
  addToSpatialGrid(CAR_GRID, c);
}
function carGridMove(c) {
  moveInSpatialGrid(CAR_GRID, c);
}
function carsNear(x, y, r) {
  return nearInSpatialGrid(CAR_GRID, CARS, x, y, r);
}
function paintChunk(c) {
  const g = c.canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  renderOsmMap({
    ctx: g,
    world: OSM_CITY.gameWorld,
    cam: { x: c.cx * 256 + 128, y: c.cy * 256 + 128 },
    W: 256,
    H: 256,
    SC: 1,
    w2s: (x, y) => ({ x: x - c.cx * 256, y: y - c.cy * 256 }),
  });
  const gore = OV.get("G" + c.k);
  if (gore)
    for (const s of gore) {
      g.fillStyle = s[3];
      g.globalAlpha = 0.5;
      for (let i = 0; i < 5; i++)
        g.fillRect(
          s[0] + ((i * 7 + s[2]) % 9) - 4,
          s[1] + ((i * 5 + s[2]) % 7) - 3,
          2 + (i % 3),
          2 + (i % 2),
        );
      g.globalAlpha = 1;
    }
}
function tileAt(tx, ty) {
  if (currentFloorId !== "outdoor") return floorTileAt(FLOOR_SCENE, tx, ty);
  return 0;
}
function solidAt(tx, ty, exCar) {
  return getSolid(tx, ty, collisionContext, exCar);
}
function circleHit(x, y, r, exCar) {
  return testCircleHit(x, y, r, collisionContext, exCar);
}
function moveBody(e, dx, dy, exCar) {
  return moveBodyGrid(e, dx, dy, collisionContext, exCar);
}
function spawnGuards(p) {
  const district = districtDefinition(p.district),
    n = districtGuardCount(
      p.buildings[0] ? POI[p.buildings[0].type].guard : 1,
      threat(),
      p.district,
    );
  for (let i = 0; i < n; i++) {
    const b = p.buildings[0],
      x = (b.x + ri(1, b.w - 2)) * 16,
      y = (b.y + ri(1, b.h - 2)) * 16;
    if (!solidAt(Math.floor(x / 16), Math.floor(y / 16)))
      spawnZ(day < 3 ? "walker" : pick(district.enemies), x, y);
  }
}
function syncCampPopulation(c) {
  const count = NPCS.filter((n) => n.camp === c.id).length,
    r = mb32(hashStr(c.id));
  for (let i = count; i < 4 + c.proj.tower * 2; i++)
    NPCS.push({
      id: c.id + ":n" + i,
      camp: c.id,
      x: c.x + Math.floor(r() * 120) - 60,
      y: c.y + Math.floor(r() * 120) - 60,
      tx: c.x,
      ty: c.y,
      wt: 0,
      leader: i === 0,
      shootT: 0,
    });
}
function initCamp(cc) {
  if (CAMPS.has(cc.id)) {
    syncCampPopulation(CAMPS.get(cc.id));
    return;
  }
  const st = OV.get("CAMP" + cc.id) || {
      level: 1,
      trust: 0,
      proj: { wall: 0, garden: 0, tower: 0, clinic: 0 },
      quest: null,
    },
    c = Object.assign({}, cc, st, {
      leader: cc.name.includes("Мост")
        ? "Марта"
        : cc.name.includes("Ферма")
          ? "Илья"
          : "Серый",
    });
  CAMPS.set(cc.id, c);
  syncCampPopulation(c);
}
function initBase() {
  const put = (t, x, y, hp) =>
    SMAP.set(K(x, y), {
      t,
      x,
      y,
      hp: hp || BUILDS[t].hp,
      max: hp || BUILDS[t].hp,
      ang: 0,
      cd: 0,
      flash: 0,
    });
  for (let x = 6; x <= 25; x++) {
    if (x < 14 || x > 16) {
      put("fence", x, 6, 240);
      put("fence", x, 25, 240);
    }
  }
  for (let y = 7; y < 25; y++) {
    put("fence", 6, y, 240);
    put("fence", 25, y, 240);
  }
  for (let x = 14; x <= 16; x++)
    SMAP.set(K(x, 25), {
      t: "gate",
      x,
      y: 25,
      hp: 280,
      max: 280,
      open: false,
      ang: 0,
      cd: 0,
      flash: 0,
    });
  put("bench", 13, 15, 240);
  put("fire", 16, 16, 360);
  put("generator", 19, 14, 170);
  put("medstation", 18, 15, 130);
  put("turret", 10, 23, 130);
  put("turret", 21, 23, 130);
  put("turret", 23, 8, 130);
  gateOpen = false;
  applyBaseProjects();
}
function applyBaseProjects() {
  bench = 1 + baseProj.workshop;
  for (let x = 6; x <= 25; x++)
    for (const y of [6, 25]) {
      const s = SMAP.get(K(x, y));
      if (s && s.t === "fence") {
        s.max = 240 + baseProj.wall * 80;
        s.hp = Math.min(s.hp + baseProj.wall * 20, s.max);
      }
    }
  for (const s of SMAP.values())
    if (s.t === "gate") {
      s.max = 280 + baseProj.wall * 100;
      s.hp = Math.min(s.hp + baseProj.wall * 25, s.max);
    }
  const extra = [
    [8, 8],
    [23, 23],
    [8, 23],
    [23, 8],
  ];
  for (let i = 0; i < baseProj.tower; i++) {
    const [x, y] = extra[i];
    if (!SMAP.has(K(x, y)))
      SMAP.set(K(x, y), {
        t: "turret",
        x,
        y,
        hp: 130,
        max: 130,
        ang: 0,
        cd: 0,
      });
  }
  if (baseProj.radio && !SMAP.get("16,10"))
    SMAP.set("16,10", {
      t: "radioTower",
      x: 16,
      y: 10,
      hp: 180,
      max: 180,
      ang: 0,
      cd: 0,
    });
  if (baseProj.garage && !SMAP.get("22,18"))
    SMAP.set("22,18", {
      t: "garage",
      x: 22,
      y: 18,
      hp: 200,
      max: 200,
      ang: 0,
      cd: 0,
    });
  if (baseProj.clinic) {
    const s = SMAP.get("18,15");
    if (s) s.max = 130 + baseProj.clinic * 60;
  }
}
function buildHome() {
  const w = 22,
    h = 14,
    t = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      t[x + y * w] = x === 0 || x === w - 1 || y === 0 || y === h - 1 ? 24 : 4;
  for (let y = 5; y <= 7; y++) for (let x = 8; x <= 13; x++) t[x + y * w] = 25;
  const furn = [
    { id: "wardrobe", x: 2, y: 2, w: 2, h: 3, spr: S.h_wardrobe },
    { id: "bed", x: 16, y: 2, w: 4, h: 3, spr: S.h_bed },
    { id: "counter", x: 14, y: 2, w: 4, h: 1, spr: S.h_counter },
    { id: "sofa", x: 2, y: 8, w: 4, h: 2, spr: S.h_sofa },
    { id: "table", x: 6, y: 9, w: 3, h: 2, spr: S.h_table },
    { id: "lamp", x: 19, y: 8, w: 1, h: 2, spr: S.h_lamp },
  ];
  HOME = {
    w,
    h,
    t,
    furn,
    objs: [
      {
        id: "window",
        x: 10 * 16,
        y: 2.2 * 16,
        hint: "Посмотреть в окно",
      },
      { id: "wardrobe", x: 3 * 16, y: 5.6 * 16, hint: "Открыть шкаф" },
      { id: "table", x: 7.5 * 16, y: 11.6 * 16, hint: "Собрать рюкзак" },
      { id: "door", x: 10.5 * 16, y: 12.7 * 16, hint: "Выйти во двор" },
    ],
  };
  homeStage = 0;
  homeAfter = false;
  homeFlash = 0;
  P.x = 10.5 * 16;
  P.y = 11.5 * 16;
  P.aim = -Math.PI / 2;
  cam.x = w * 8;
  cam.y = h * 8;
}
function homeSolid(x, y, r) {
  if (
    x - r < 16 ||
    x + r > HOME.w * 16 - 16 ||
    y - r < 16 ||
    y + r > HOME.h * 16 - 16
  )
    return true;
  for (const f of HOME.furn) {
    const px = clamp(x, f.x * 16, (f.x + f.w) * 16),
      py = clamp(y, f.y * 16, (f.y + f.h) * 16);
    if (d2(x, y, px, py) < r * r) return true;
  }
  return false;
}
function setFloorScene(scene) {
  FLOOR_SCENE = scene;
  FLOOR_CONTAINERS = floorContainers(scene);
  for (const container of FLOOR_CONTAINERS.values())
    container.looted = OV.get("L" + container.id) === true;
  collisionContext.containers = FLOOR_CONTAINERS;
}
function enterFloor(buildingId, floorId) {
  if (currentFloorId === "outdoor") floorReturn = { x: P.x, y: P.y };
  currentFloorId = floorId;
  setFloorScene(createFloorScene(buildingId, floorId));
  P.inCar = null;
  P.x = FLOOR_SCENE.spawn.x;
  P.y = FLOOR_SCENE.spawn.y;
  PR.length = 0;
  searching = null;
  state = "floor";
  setBody("play");
  $("fade").classList.add("on");
  setTimeout(() => $("fade").classList.remove("on"), 120);
}
function transitionFloor(target) {
  if (target === "outdoor") {
    exitFloor();
    return;
  }
  const next = changeFloor(
    { buildingId: FLOOR_SCENE.buildingId, floorId: currentFloorId },
    target,
  );
  enterFloor(next.buildingId, next.floorId);
}
function exitFloor() {
  currentFloorId = "outdoor";
  FLOOR_SCENE = null;
  FLOOR_CONTAINERS = new Map();
  collisionContext.containers = CMAP;
  if (floorReturn) {
    P.x = floorReturn.x;
    P.y = floorReturn.y;
  }
  PR.length = 0;
  searching = null;
  state = "play";
  setBody("play");
}
function say(lines, cb) {
  DL = { active: true, lines, i: 0, ch: 0, cb };
  $("dialog").classList.remove("hid");
  dlgText();
}
function dlgText() {
  const l = DL.lines[DL.i] || { text: "" };
  $("dlgWho").textContent = l.who || "АРТЁМ";
  $("dlgText").innerHTML = l.text.slice(0, Math.floor(DL.ch));
}
function advanceDialog() {
  if (!DL.active) return;
  if (DL.ch < DL.lines[DL.i].text.length) {
    DL.ch = DL.lines[DL.i].text.length;
    dlgText();
    return;
  }
  DL.i++;
  DL.ch = 0;
  if (DL.i >= DL.lines.length) {
    DL.active = false;
    $("dialog").classList.add("hid");
    const cb = DL.cb;
    DL.cb = null;
    if (cb) cb();
  } else {
    dlgText();
    SFX.ui();
  }
}
function homeObjective() {
  const a = [
    "Подойди к окну и посмотри, что происходит в городе.",
    "Открой шкаф. Там старый лук.",
    "Собери рюкзак на столе.",
    "Выйди во двор. Ворота Рубежа закрыты.",
    "",
  ];
  $("homeObjText").textContent = DL.active ? "…" : a[homeStage];
}
function homeInteract() {
  if (DL.active) return;
  const o = HOME.objs[homeStage];
  if (!o || dist(P.x, P.y, o.x, o.y) > 42) return;
  if (o.id === "window") {
    homeFlash = 1;
    homeAfter = true;
    shake = 10;
    SFX.flash();
    setTimeout(() => SFX.siren(), 650);
    say(
      [
        { text: "Свет над городом… Это не гроза." },
        { text: "На проспекте люди падают. И встают. Уже не людьми." },
        {
          text: "Забор, ворота, генератор во дворе — я строил это «на всякий случай». Случай настал.",
        },
      ],
      () => {
        homeStage = 1;
        homeObjective();
      },
    );
  } else if (o.id === "wardrobe") {
    addItem("bow", 1, true);
    addItem("arrow", 26, true);
    say(
      [
        { text: "Старый лук. Двадцать шесть стрел. Три года пыли." },
        { text: "<em>Наконец-то мне пригодится лук.</em>" },
        { text: "Тетива натягивается сама. Я буду видеть прогресс." },
      ],
      () => {
        homeStage = 2;
        homeObjective();
      },
    );
  } else if (o.id === "table") {
    addItem("bandage", 2, true);
    addItem("can", 2, true);
    addItem("wood", 4, true);
    addItem("scrap", 4, true);
    say(
      [
        {
          text: "Бинты, тушёнка, доски и железо. Меньше вещей — больше шансов.",
        },
        {
          text: "Город большой. Супермаркет, оружейный и больница рядом. Дальше — машина.",
        },
      ],
      () => {
        homeStage = 3;
        homeObjective();
      },
    );
  } else if (o.id === "door") {
    SFX.door();
    enterWorld();
  }
}
function enterWorld() {
  $("fade").classList.add("on");
  setTimeout(() => {
    state = "play";
    setBody("play");
    $("menuOv").classList.add("hid");
    $("dialog").classList.add("hid");
    DL.active = false;
    P.x = 184;
    P.y = 232;
    P.iframe = 2;
    cam.x = P.x;
    cam.y = P.y;
    Z.length = 0;
    PR.length = 0;
    PT.length = 0;
    DR.length = 0;
    CL.length = 0;
    TX.length = 0;
    LG.length = 0;
    VFX.length = 0;
    journalAdd(
      "Тихий вечер",
      "21:47. Артём Вересов, бывший тренер по стрельбе из лука. Вспышка над городом. Лук из шкафа. Двор — крепость.",
    );
    journalAdd(
      "Карта города",
      "Супермаркет «Калина» — восток. Оружейный «Калибр» — юг. Больница «Милосердие» — запад. АЗС и автосервис — рядом. Ворота закрыты.",
    );
    setupMain();
    buildHotbar();
    buildResRow();
    refreshHUD();
    toast("РУБЕЖ · безопасная зона", "quest");
    tut = [
      [2, "Город живой: кварталы, перекрёстки, дворы. M — карта."],
      [8, "Лук перезаряжается сам. Янтарная дуга — натяжение."],
      [16, "Машины стоят во дворах и на парковках. E — сесть. W — газ."],
      [26, "Лагеря выживших дают поручения, торговлю и улучшения."],
    ];
    playT = 0;
    saveGame();
    setTimeout(() => $("fade").classList.remove("on"), 120);
  }, 620);
}
function skipPrologue() {
  if (!P.owned.bow) {
    addItem("bow", 1, true);
    addItem("arrow", 26, true);
    addItem("bandage", 2, true);
    addItem("can", 2, true);
    addItem("wood", 4, true);
    addItem("scrap", 4, true);
  }
  enterWorld();
}
function updateHome(dt) {
  playT += dt;
  if (DL.active) {
    const l = DL.lines[DL.i];
    if (DL.ch < l.text.length) {
      DL.ch += dt * 48;
      dlgText();
    }
  }
  homeFlash = Math.max(0, homeFlash - dt * 0.7);
  homeRain += dt;
  shake = Math.max(0, shake - dt * 20);
  if (!DL.active) {
    let mx = 0,
      my = 0;
    if (keys.KeyW || keys.ArrowUp) my--;
    if (keys.KeyS || keys.ArrowDown) my++;
    if (keys.KeyA || keys.ArrowLeft) mx--;
    if (keys.KeyD || keys.ArrowRight) mx++;
    if (isTouch) {
      mx += stickVec.x;
      my += stickVec.y;
    }
    const l = Math.hypot(mx, my);
    P.moving = l > 0.1;
    if (l > 0.1) {
      const s = 58;
      if (!homeSolid(P.x + (mx / l) * s * dt, P.y, P.r))
        P.x += (mx / l) * s * dt;
      if (!homeSolid(P.x, P.y + (my / l) * s * dt, P.r))
        P.y += (my / l) * s * dt;
    }
  }
  const o = HOME.objs[homeStage];
  if (o && !DL.active && dist(P.x, P.y, o.x, o.y) < 42) {
    $("prompt").classList.remove("hid");
    $("promptT").textContent = "E — " + o.hint;
    $("promptS").textContent = "";
  } else $("prompt").classList.add("hid");
  homeObjective();
  AU.tick(dt);
}
function renderHome() {
  drawHome({
    ctx,
    W,
    H,
    HOME,
    TI,
    S,
    SC,
    homeAfter,
    homeRain,
    homeStage,
    dialogActive: DL.active,
    homeFlash,
    P,
  });
}
function countItem(id) {
  return countItemInSlots(inv, id);
}
function addItem(id, n, silent) {
  const it = ITEMS[id];
  if (!it) return 0;
  if (it.t === "Оружие") {
    if (id === "spear") {
      hasSpear = true;
      toast("Копьё: ближний бой усилен", "epic");
      return n;
    }
    if (!P.owned[id]) {
      P.owned[id] = true;
      P.weapon = id;
      P.mags[id] = 0;
      if (state === "play" || state === "floor") startReload();
      toast("НОВОЕ ОРУЖИЕ: " + it.n, "epic");
      SFX.bp();
      refreshHotbar();
    }
    return n;
  }
  if (it.bp) {
    learnBP(id);
    return n;
  }
  const { added, left } = addItemToSlots(inv, it, id, n);
  if (left > 0) {
    addDrop(P.x, P.y, id, left);
    toast("Рюкзак полон", "danger");
  }
  if (!silent) qEvent("loot", { id, n: added });
  if (panelOpen()) buildInv();
  return added;
}
function removeItem(id, n) {
  return removeItemFromSlots(inv, id, n);
}
function learnBP(id) {
  const w = ITEMS[id].bp;
  if (learned.has(w)) {
    addItem("scrap", 3, true);
    toast("Чертёж уже изучен → металл", "info");
    return;
  }
  learned.add(w);
  toast("ЧЕРТЁЖ ИЗУЧЕН: " + (WEAPONS[w] ? WEAPONS[w].n : w), "epic");
  SFX.bp();
  qEvent("bp", { w });
}
function useItem(i, ctx) {
  const s = inv[i];
  if (!s) return;
  const it = ITEMS[s.id];
  if (ctx === "trunk") {
    if (
      !moveStackToTrunk(
        curCar.trunk,
        inv,
        i,
        vehicleDefinition(curCar.type).trunkSlots,
      )
    )
      toast("Багажник полон", "danger");
    buildTrunk();
    return;
  }
  if (it.use === "eat") {
    P.hu = clamp(P.hu + (it.food || 30), 0, 100);
    P.hp = clamp(P.hp + (s.id === "mre" ? 10 : 4), 0, maxHp());
    removeItem(s.id, 1);
    SFX.eat();
    toast("+" + (it.food || 30) + " сытости", "loot");
  } else if (it.use === "drink") {
    P.st = maxSt();
    P.hu = clamp(P.hu + 10, 0, 100);
    removeItem(s.id, 1);
    SFX.eat();
    toast("Вода: выносливость восстановлена", "loot");
  } else if (it.use === "energy") {
    P.st = maxSt();
    energyT = 25;
    removeItem(s.id, 1);
    SFX.heal();
    toast("Энергетик: ускорение 25с", "loot");
  } else if (it.use === "heal") {
    if (P.hp >= maxHp()) {
      toast("Здоровье полное", "info");
      return;
    }
    const h = Math.round(it.heal * (1 + P.skills.medic * 0.15));
    P.hp = clamp(P.hp + h, 0, maxHp());
    removeItem(s.id, 1);
    SFX.heal();
    ptBurst(P.x, P.y, "#7dd87a", 8);
    toast("+" + h + " HP", "loot");
  } else if (it.use === "cure") {
    P.poison = 0;
    P.hp = clamp(P.hp + 15, 0, maxHp());
    removeItem(s.id, 1);
    SFX.heal();
    toast("Заражение снято", "loot");
  } else if (it.use === "armor") {
    if (P.armor > 30) {
      toast("Броня ещё цела", "info");
      return;
    }
    P.armor = 60;
    removeItem(s.id, 1);
    SFX.build();
    toast("Бронежилет надет", "loot");
  } else if (it.use === "throw") toast("G — бросить Молотов", "info");
  else toast(it.n + ": " + it.d, "info");
  buildInv();
  refreshHUD();
}
function quickHeal() {
  const def = maxHp() - P.hp;
  if (def <= 0 && P.poison <= 0) {
    toast("Здоровье полное", "info");
    return;
  }
  if (P.poison > 0 && countItem("antibiotics")) {
    P.poison = 0;
    removeItem("antibiotics", 1);
    SFX.heal();
    toast("Антибиотики: заражение снято", "loot");
    return;
  }
  let id = null;
  if (def >= 50 && countItem("medkit")) id = "medkit";
  else if (countItem("bandage")) id = "bandage";
  else if (countItem("medkit")) id = "medkit";
  else if (countItem("painkiller")) id = "painkiller";
  if (!id) {
    toast("Нет медицины", "danger");
    return;
  }
  const h = Math.round(ITEMS[id].heal * (1 + P.skills.medic * 0.15));
  P.hp = clamp(P.hp + h, 0, maxHp());
  removeItem(id, 1);
  SFX.heal();
  ptBurst(P.x, P.y, "#7dd87a", 10);
  toast("+" + h + " HP", "loot");
  refreshHUD();
}
function addDrop(x, y, id, n) {
  DR.push({
    x: x + ri(-8, 8),
    y: y + ri(-8, 8),
    id,
    n,
    t: rnd() * 6,
    vx: ri(-30, 30),
    vy: ri(-30, 30),
  });
}
function equip(w) {
  if (!P.owned[w]) return;
  P.weapon = w;
  P.rl = 0;
  if (WEAPONS[w].auto) startReload();
  SFX.ui();
  refreshHotbar();
}
function reloadTime(w) {
  return getReloadTime(w, P.skills);
}
function startReload() {
  const w = WEAPONS[P.weapon];
  if (
    !P.owned[P.weapon] ||
    P.rl > 0 ||
    P.mags[P.weapon] >= w.mag ||
    countItem(w.ammo) <= 0
  )
    return;
  P.rl = reloadTime(w);
  P.rlMax = P.rl;
  if (w.auto) SFX.draw();
  else SFX.reload();
}
function fireWeapon() {
  const w = WEAPONS[P.weapon];
  if (P.inCar || !P.owned[P.weapon] || P.cd > 0 || P.rl > 0) return;
  if (P.mags[P.weapon] <= 0) {
    startReload();
    if (countItem(w.ammo) <= 0 && P.emptyT <= 0) {
      SFX.empty();
      P.emptyT = 1.8;
      toast("Нет боеприпасов: " + ITEMS[w.ammo].n, "danger");
    }
    return;
  }
  P.cd = w.cd;
  P.mags[P.weapon]--;
  stats.shots++;
  PR.push(
    ...createShotProjectiles({
      x: P.x,
      y: P.y,
      aim: P.aim,
      weaponId: P.weapon,
      damageMultiplier: dmgMul(P.weapon),
      random: rnd,
    }),
  );
  LG.push({
    x: P.x + Math.cos(P.aim) * 14,
    y: P.y + Math.sin(P.aim) * 14,
    r: 55,
    life: 0.06,
    max: 0.06,
    col: "255,200,110",
  });
  ptSpark(P.x + Math.cos(P.aim) * 14, P.y + Math.sin(P.aim) * 14, P.aim);
  recoil = Math.min(14, recoil + (w.pellets > 1 ? 7 : 3));
  shake = Math.max(shake, w.pellets > 1 ? 2.5 : 1);
  SFX.shoot(P.weapon);
  alertNoise(P.x, P.y, w.noise * 16 * (1 - P.skills.stealth * 0.08));
  if (w.auto) startReload();
}
function melee() {
  if (P.inCar || P.meleeCd > 0) return;
  P.meleeCd = 0.48;
  P.st = Math.max(0, P.st - 6);
  P.stDelay = 0.4;
  SFX.melee();
  PT.push({
    type: "slash",
    x: P.x,
    y: P.y,
    a: P.aim,
    life: 0.14,
    max: 0.14,
  });
  const range = hasSpear ? 2.1 : 1.6,
    dmg = (hasSpear ? 32 : 15) * (1 + P.skills.melee * 0.12);
  let hitAny = false;
  for (const z of Z) {
    if (d2(P.x, P.y, z.x, z.y) < (range * 16) ** 2) {
      let da = Math.atan2(z.y - P.y, z.x - P.x) - P.aim;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 1.15) {
        hurtZ(z, dmg, P.aim, 120);
        hitAny = true;
      }
    }
  }
  for (const c of visChunks)
    if (
      c.nest &&
      c.nest.alive &&
      d2(P.x, P.y, c.nest.x, c.nest.y) < (range * 16 + 8) ** 2
    ) {
      hurtNest(c.nest, dmg);
      hitAny = true;
    }
  if (hitAny) shake = Math.max(shake, 2);
  alertNoise(P.x, P.y, 3 * 16);
}
function throwMolotov() {
  if (P.inCar) return;
  if (!countItem("molotov")) {
    toast("Нет Молотова. Крафт: стекло+ткань+химикаты", "info");
    return;
  }
  removeItem("molotov", 1);
  SFX.throwM();
  PR.push({
    x: P.x,
    y: P.y,
    vx: Math.cos(P.aim) * 260,
    vy: Math.sin(P.aim) * 260,
    dmg: 0,
    type: "molotov",
    from: "m",
    life: 0.55,
    pierce: 0,
    hit: new Set(),
  });
}
function alertNoise(x, y, r) {
  for (const z of Z)
    if (d2(x, y, z.x, z.y) < r * r) {
      if (z.st !== "chase") {
        z.st = "chase";
        z.tx = x;
        z.ty = y;
      }
      z.mem = Math.max(z.mem || 0, 4);
    }
  PT.push({
    type: "ring",
    x,
    y,
    r0: 8,
    r1: r,
    life: 0.45,
    max: 0.45,
    col: "rgba(217,203,166,.25)",
  });
}
function currentRaidRules() {
  return raidDistrictRules(
    activeRaidId(Q.side),
    districtOf(
      Math.floor(P.x / (CELL * 16)),
      Math.floor(P.y / (CELL * 16)),
      SEED,
    ),
  );
}
function spawnZ(type, x, y, o = {}) {
  const rules = currentRaidRules();
  if (rules && o.elite === undefined && rnd() < rules.eliteChance)
    o = { ...o, elite: true };
  o.floorId = o.floorId || currentFloorId;
  Z.push(createZombie(type, x, y, o, DIFF, threat(), rnd));
}
function hurtZ(z, d, ang, kb) {
  const crit = rnd() < 0.08;
  if (crit) d *= 1.5;
  if (z.type === "riot") d *= 0.65;
  z.hp -= d;
  z.flash = 0.12;
  z.st = "chase";
  z.tx = P.x;
  z.ty = P.y;
  z.mem = 5;
  if (ang !== undefined) {
    z.vx += Math.cos(ang) * (kb || 55);
    z.vy += Math.sin(ang) * (kb || 55);
  }
  ptBlood(z.x, z.y, crit ? 6 : 3);
  TX.push({
    x: z.x,
    y: z.y - 14,
    txt: Math.round(d) + "",
    col: crit ? "#ffb23e" : "#ece5d0",
    life: 0.7,
    vy: -34,
    size: crit ? 9 : 7,
  });
  SFX.hit();
  if (z.hp <= 0) killZ(z);
}
function killZ(z) {
  const i = Z.indexOf(z);
  if (i < 0) return;
  Z.splice(i, 1);
  ptBlood(z.x, z.y, 12);
  goreAdd(z.x, z.y);
  SFX.zdie();
  shake = Math.max(shake, 1.3);
  gainXP(z.xp);
  stats.kills++;
  qEvent("kill", { type: z.type });
  if (z.type === "bloater") explode(z.x, z.y, 2.4 * 16, 22, true);
  const r = rnd();
  if (r < 0.14) addDrop(z.x, z.y, "cloth", 1);
  else if (r < 0.26) addDrop(z.x, z.y, "scrap", 1);
  else if (r < 0.34) addDrop(z.x, z.y, "chem", 1);
  else if (r < 0.42) addDrop(z.x, z.y, "arrow", ri(1, 3));
  else if (r < 0.46) addDrop(z.x, z.y, "valuables", 1);
}
function goreAdd(x, y) {
  const cx = Math.floor(x / 256),
    cy = Math.floor(y / 256),
    k = "G" + K(cx, cy);
  let a = OV.get(k);
  if (!a) {
    a = [];
    OV.set(k, a);
  }
  if (a.length < 40)
    a.push([
      Math.floor(x - cx * 256),
      Math.floor(y - cy * 256),
      ri(0, 9),
      "#5c1a14",
    ]);
  const c = chunks.get(K(cx, cy));
  if (c) paintChunk(c);
}
function updateZ(z, dt) {
  const dp = dist(z.x, z.y, P.x, P.y);
  if ((z.floorId || "outdoor") !== currentFloorId) return;
  if (shouldSkipZombieUpdate(z, dp)) return;
  const t = ZT[z.type];
  z.atk -= dt;
  z.flash -= dt;
  z.mem -= dt;
  z.wt -= dt;
  z.sideT -= dt;
  z.chargeCd -= dt;
  z.spitCd -= dt;
  const night = darkness() > 0.3,
    sight = z.sight * 16 * (night ? 1.2 : 1),
    safe =
      currentFloorId === "outdoor" &&
      ((inBase(P.x, P.y) && !siege) || nearCamp(P.x, P.y));
  if ((state === "play" || state === "floor") && !safe) {
    if (z.siege) {
      const near = dist(P.x, P.y, BASEX, BASEY) < 34 * 16;
      z.tx = near ? P.x : BASEX;
      z.ty = near ? P.y : BASEY;
      z.st = "chase";
    } else if (dp < sight || (z.mem > 0 && dp < sight * 2.2)) {
      if (
        (z.type === "screamer" || z.type === "howler") &&
        !z.screamed &&
        day > 3
      ) {
        z.screamed = true;
        z.fleeT = 2;
        SFX.scream();
        alertNoise(z.x, z.y, 15 * 16);
        for (let i = 0; i < 2; i++) {
          const a = rnd() * Math.PI * 2,
            x = z.x + Math.cos(a) * 48,
            y = z.y + Math.sin(a) * 48;
          if (!solidAt(Math.floor(x / 16), Math.floor(y / 16)))
            spawnZ("walker", x, y);
        }
      }
      if (z.fleeT <= 0) {
        z.st = "chase";
        z.tx = P.x;
        z.ty = P.y;
      }
    } else if (z.st === "chase" && z.mem <= 0) z.st = "wander";
  }
  let mx = 0,
    my = 0,
    spd = z.spd;
  if (z.fleeT > 0) {
    z.fleeT -= dt;
    const a = Math.atan2(z.y - P.y, z.x - P.x);
    mx = Math.cos(a);
    my = Math.sin(a);
    spd *= 1.1;
  } else if (z.st === "chase") {
    const a = Math.atan2(z.ty - z.y, z.tx - z.x);
    if (z.type === "spitter") {
      if (dp < 72) {
        mx = -Math.cos(a);
        my = -Math.sin(a);
      } else if (dp > 120) {
        mx = Math.cos(a);
        my = Math.sin(a);
      }
      if (
        dp < 150 &&
        z.spitCd <= 0 &&
        (state === "play" || state === "floor")
      ) {
        z.spitCd = 2.8;
        SFX.spit();
        const aa = Math.atan2(P.y - z.y, P.x - z.x) + (rnd() - 0.5) * 0.12;
        PR.push({
          x: z.x,
          y: z.y,
          vx: Math.cos(aa) * 96,
          vy: Math.sin(aa) * 96,
          dmg: 7 * DIFF.dmg,
          type: "spit",
          from: "z",
          life: 1.6,
          pierce: 0,
          hit: new Set(),
        });
      }
    } else if (z.type === "brute") {
      if (dp > 56 && dp < 120 && z.chargeCd <= 0 && day > 4) {
        z.chargeT = 0.5;
        z.chargeCd = 5;
        SFX.scream();
      }
      if (z.chargeT > 0) {
        z.chargeT -= dt;
        spd *= 3;
      }
      mx = Math.cos(a);
      my = Math.sin(a);
    } else {
      mx = Math.cos(a);
      my = Math.sin(a);
      if (z.type === "dog") {
        const p = Math.sin(playT * 5 + z.bob) * 0.5;
        mx += -Math.sin(a) * p;
        my += Math.cos(a) * p;
      }
    }
  } else {
    if (z.wt <= 0) {
      z.wt = 2 + rnd() * 3;
      const a = rnd() * Math.PI * 2;
      z.tx = z.x + Math.cos(a) * ri(20, 70);
      z.ty = z.y + Math.sin(a) * ri(20, 70);
    }
    const a = Math.atan2(z.ty - z.y, z.tx - z.x);
    if (d2(z.x, z.y, z.tx, z.ty) > 64) {
      mx = Math.cos(a);
      my = Math.sin(a);
      spd *= 0.35;
    }
  }
  if (z.st === "chase" && (mx || my)) {
    const steering = steerAroundObstacles(z, mx, my, (x, y) =>
      testCircleHit(x, y, z.r, collisionContext),
    );
    mx = steering.mx;
    my = steering.my;
    z.side = steering.side;
  } else if (z.sideT > 0) {
    const a = Math.atan2(my, mx) + (z.side * Math.PI) / 2;
    mx = Math.cos(a);
    my = Math.sin(a);
  }
  const ml = Math.hypot(mx, my) || 1,
    res = moveBody(
      z,
      ((mx / ml) * spd + z.vx) * dt,
      ((my / ml) * spd + z.vy) * dt,
    );
  z.vx *= Math.pow(0.001, dt);
  z.vy *= Math.pow(0.001, dt);
  if (shouldAttackStructure(res, z)) {
    if (z.atk <= 0) {
      z.atk = z.cd;
      hurtStruct(res.hit.o, z.dmg * (z.type === "brute" ? 3 : 1));
    }
  } else if ((res.bx || res.by) && z.sideT <= 0 && z.st !== "chase") {
    z.side = rnd() < 0.5 ? 1 : -1;
    z.sideT = 0.4 + rnd() * 0.4;
  }
  if (
    (state === "play" || state === "floor") &&
    dp < z.r + P.r + 3 &&
    z.atk <= 0 &&
    z.fleeT <= 0 &&
    !P.inCar
  ) {
    z.atk = z.cd;
    damagePlayer(z.dmg * (z.chargeT > 0 ? 1.4 : 1), t.n);
    if (z.type === "spitter") P.poison = Math.max(P.poison, 1);
  }
  if (P.inCar && dp < z.r + 20 && z.atk <= 0) {
    z.atk = z.cd;
    hurtCar(CARS.get(P.inCar), z.dmg * 0.5);
  }
  if (shouldUnloadZombie(z, dp)) Z.splice(Z.indexOf(z), 1);
}
function ambientSpawn(dt) {
  spawnT -= dt;
  if (spawnT > 0) return;
  spawnT = 1.7;
  const night = darkness() > 0.3,
    district = districtDefinition(
      districtOf(
        Math.floor(P.x / (CELL * 16)),
        Math.floor(P.y / (CELL * 16)),
        SEED,
      ),
    ),
    raidDanger = currentRaidRules()?.danger || 1,
    cap =
      Math.round(
        (6 + Math.min(day, 12) * 1.3 + (night ? 6 : 0)) *
          DIFF.cap *
          district.danger *
          raidDanger,
      ) -
      stats.calm +
      (Q.endless ? 2 : 0);
  if (Z.length >= Math.max(day < 3 ? 4 : 6, cap)) return;
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2,
      d = (17 + rnd() * 10) * 16,
      x = P.x + Math.cos(a) * d,
      y = P.y + Math.sin(a) * d;
    if (inBase(x, y) || nearCamp(x, y) || dist(x, y, BASEX, BASEY) < 28 * 16)
      continue;
    if (solidAt(Math.floor(x / 16), Math.floor(y / 16))) continue;
    const r = rnd(),
      th = threat();
    let type = "walker";
    if (day < 3) type = "walker";
    else if (night && day >= 4 && r < 0.07) type = "stalker";
    else if (th > 0.55 && r < 0.05) type = "riot";
    else if (th > 0.5 && r < 0.11) type = "brute";
    else if (th > 0.3 && r < 0.18) type = "bloater";
    else if (th > 0.22 && r < 0.28) type = "spitter";
    else if (th > 0.4 && r < 0.34) type = "screamer";
    else if (th > 0.6 && r < 0.38) type = "howler";
    else if (r < 0.55) type = "walker";
    else if (r < 0.72) type = "dog";
    else type = "runner";
    spawnZ(type, x, y);
    return;
  }
}
function hurtNest(n, d) {
  if (!n.alive) return;
  n.hp -= d;
  n.flash = 0.12;
  ptBurst(n.x + ri(-8, 8), n.y + ri(-8, 8), "#a6e83c", 3);
  SFX.nestHit();
  if (n.hp <= 0) nestDie(n);
}
function nestDie(n) {
  n.alive = false;
  OV.set("D" + n.k, true);
  const c = chunks.get(K(Math.floor(n.x / 256), Math.floor(n.y / 256)));
  if (c) {
    c.nest = null;
    for (let i = 0; i < 256; i++)
      if (c.t[i] === 10 || c.t[i] === 20) c.t[i] = 11;
    paintChunk(c);
  }
  for (const z of [...Z]) if (z.nest === n.k) z.nest = null;
  SFX.nestDie();
  shake = 10;
  PT.push({
    type: "ring",
    x: n.x,
    y: n.y,
    r0: 10,
    r1: 112,
    life: 0.7,
    max: 0.7,
    col: "rgba(166,232,60,.65)",
  });
  ptBurst(n.x, n.y, "#a6e83c", 36);
  gainXP(140 * n.tier);
  stats.nests++;
  stats.calm = Math.min(8, stats.calm + 1);
  addDrop(n.x, n.y, "chem", ri(3, 6));
  addDrop(n.x, n.y, "sample", 1);
  addDrop(n.x, n.y, "scrap", ri(4, 8));
  if (n.tier >= 2) addDrop(n.x, n.y, "elec", ri(1, 3));
  if (n.mega) addDrop(n.x, n.y, "valuables", 6);
  toast(n.mega ? "СЕРДЦЕ МАТКИ ПОГАСЛО" : "РАССАДНИК УНИЧТОЖЕН", "epic");
  qEvent("nest", { tier: n.tier, mega: n.mega });
  saveGame();
}
function updateNests(dt) {
  for (const c of visChunks) {
    const n = c.nest;
    if (!n || !n.alive) continue;
    n.flash -= dt;
    const dp = dist(P.x, P.y, n.x, n.y);
    if (state !== "play") continue;
    if (!n.act && dp < 224) {
      n.act = true;
      SFX.scream();
      toast((n.mega ? "Логово Матки" : "Рассадник") + " пробудился", "danger");
      const cnt = n.mega ? 10 : 2 + n.tier;
      for (let i = 0; i < cnt; i++) {
        const a = rnd() * Math.PI * 2,
          r = ri(48, 80),
          x = n.x + Math.cos(a) * r,
          y = n.y + Math.sin(a) * r;
        if (!solidAt(Math.floor(x / 16), Math.floor(y / 16)))
          spawnZ(
            n.mega
              ? i < 3
                ? "brute"
                : pick(["runner", "spitter", "screamer", "riot"])
              : n.tier === 1
                ? pick(["walker", "runner"])
                : pick(["walker", "runner", "spitter", "bloater"]),
            x,
            y,
            { nest: n.k, elite: n.mega && rnd() < 0.3 },
          );
      }
    }
    if (n.act && dp < 320) {
      n.sp -= dt;
      if (n.sp <= 0) {
        n.sp = 6;
        const cnt = Z.filter((z) => z.nest === n.k).length;
        if (cnt < 4 && Z.length < 60) {
          spawnZ("walker", n.x + ri(-40, 40), n.y + ri(-40, 40), {
            nest: n.k,
          });
          ptBurst(n.x, n.y, "#a6e83c", 4);
        }
      }
    }
  }
}
function powered(s) {
  for (const o of SMAP.values())
    if (
      o.t === "generator" &&
      d2(s.x * 16, s.y * 16, o.x * 16, o.y * 16) < (16 * 16) ** 2
    )
      return true;
  return false;
}
function hurtStruct(s, d) {
  s.hp -= d;
  s.flash = 0.15;
  if (s.hp <= 0) destroyStruct(s);
}
function destroyStruct(s) {
  SMAP.delete(K(s.x, s.y));
  ptBurst(s.x * 16 + 8, s.y * 16 + 8, "#8a7450", 14);
  SFX.breakS();
  shake = Math.max(shake, 3);
  if (s.t === "fire") {
    gameOver("base");
    return;
  }
  toast((BUILDS[s.t] ? BUILDS[s.t].n : "Постройка") + " разрушена", "danger");
}
function updateStructs(dt) {
  for (const s of SMAP.values()) {
    s.flash = (s.flash || 0) - dt;
    const sx = s.x * 16 + 8,
      sy = s.y * 16 + 8;
    if (s.t === "fire") {
      if (rnd() < dt * 5)
        PT.push({
          type: "ember",
          x: sx + ri(-4, 4),
          y: sy - 4,
          vx: ri(-6, 6),
          vy: -ri(14, 28),
          life: 0.8,
          max: 0.8,
          col: "#ffb23e",
        });
      if (
        (state === "play" || state === "floor") &&
        d2(P.x, P.y, sx, sy) < (3 * 16) ** 2
      )
        P.hp = clamp(P.hp + 2 * dt, 0, maxHp());
    } else if (s.t === "medstation") {
      if (
        (state === "play" || state === "floor") &&
        d2(P.x, P.y, sx, sy) < (3.5 * 16) ** 2 &&
        P.hp < maxHp()
      )
        P.hp = clamp(P.hp + (4 + baseProj.clinic * 2) * dt, 0, maxHp());
    } else if (s.t === "turret") {
      s.cd -= dt;
      if (!powered(s)) {
        s.off = true;
        continue;
      }
      s.off = false;
      let best = null,
        bd = (9 * 16) ** 2;
      for (const z of Z) {
        const d = d2(sx, sy, z.x, z.y);
        if (d < bd) {
          bd = d;
          best = z;
        }
      }
      if (best) {
        const ta = Math.atan2(best.y - sy, best.x - sx);
        let da = ta - s.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        s.ang += clamp(da, -6 * dt, 6 * dt);
        if (s.cd <= 0 && Math.abs(da) < 0.3) {
          s.cd = 0.42;
          PR.push({
            x: sx + Math.cos(s.ang) * 10,
            y: sy + Math.sin(s.ang) * 10,
            vx: Math.cos(s.ang) * 620,
            vy: Math.sin(s.ang) * 620,
            dmg: 12 * (1 + 0.25 * P.skills.turrets),
            type: "turret",
            from: "t",
            life: 0.5,
            pierce: 0,
            hit: new Set(),
          });
          LG.push({
            x: sx,
            y: sy,
            r: 40,
            life: 0.05,
            max: 0.05,
            col: "255,200,110",
          });
          SFX.turret();
        }
      }
    }
  }
}
function buildLocked(t) {
  return buildLockFor(t, { bench, learned });
}
function tryPlace(tx, ty) {
  if (!buildSel) return;
  const lock = placementLock({
    type: buildSel,
    tx,
    ty,
    P,
    Z,
    bench,
    learned,
    countItem,
    solidAt,
    tileAt,
  });
  if (lock) {
    toast(lock, "danger");
    return;
  }
  const cost = buildCost(buildSel);
  for (const k in cost) removeItem(k, cost[k]);
  const B = BUILDS[buildSel];
  SMAP.set(K(tx, ty), {
    t: buildSel,
    x: tx,
    y: ty,
    hp: B.hp * (1 + P.skills.builder * 0.1),
    max: B.hp * (1 + P.skills.builder * 0.1),
    ang: 0,
    cd: 0,
    flash: 0,
  });
  SFX.place();
  ptBurst(tx * 16 + 8, ty * 16 + 8, "#d9cba6", 8);
  qEvent("build", { t: buildSel });
  refreshHUD();
  buildBuildBar();
}
function tryRemove() {
  let best = null,
    bd = (1.6 * 16) ** 2;
  for (const s of SMAP.values()) {
    if (
      ["fire", "bench", "gate", "fence", "radioTower", "garage"].includes(s.t)
    )
      continue;
    const d = d2(P.x, P.y, s.x * 16 + 8, s.y * 16 + 8);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  if (!best) return;
  SMAP.delete(K(best.x, best.y));
  const cost = buildCost(best.t);
  for (const k in cost)
    addItem(k, Math.max(1, Math.floor(cost[k] * 0.5)), true);
  SFX.breakS();
  ptBurst(best.x * 16 + 8, best.y * 16 + 8, "#8a7450", 8);
  toast("Разобрано: +50% ресурсов", "loot");
  refreshHUD();
}
function toggleGate() {
  gateOpen = !gateOpen;
  for (const s of SMAP.values()) if (s.t === "gate") s.open = gateOpen;
  SFX.door();
  toast(
    "Ворота " + (gateOpen ? "открыты" : "закрыты"),
    gateOpen ? "info" : "quest",
  );
}
function carSpriteKey(c) {
  if (c.dead) return "car_wreck";
  return Object.hasOwn(VEHICLES, c.type) ? "car_" + c.type : "car_sedan";
}
function enterCar(c) {
  if (c.dead) {
    toast("Машина разбита", "danger");
    return;
  }
  normalizeVehicle(c);
  if (c.broken) {
    if (countItem("repairkit") && countItem("sparkplug")) {
      removeItem("repairkit", 1);
      removeItem("sparkplug", 1);
      c.engineHp = 55;
      c.hp = Math.max(c.hp, c.maxHp * 0.55);
      SFX.craft();
      toast("Двигатель ожил", "quest");
      qEvent("car", { action: "repair" });
    } else if (P.skills.mechanic >= 2 && countItem("parts") >= 2) {
      removeItem("parts", 2);
      c.engineHp = 45;
      c.hp = Math.max(c.hp, c.maxHp * 0.45);
      SFX.craft();
      toast("Механик: двигатель запущен запчастями", "quest");
      qEvent("car", { action: "repair" });
    } else {
      toast(
        "Нужны ремкомплект + свеча (или Механик ур.2 + 2 запчасти)",
        "danger",
      );
      return;
    }
  }
  if (c.locked) {
    if (countItem("keys")) {
      removeItem("keys", 1);
      c.locked = false;
      toast("Ключи подошли", "loot");
    } else if (countItem("lockpick")) {
      removeItem("lockpick", 1);
      c.locked = false;
      toast("Замок вскрыт отмычкой", "loot");
    } else if (rnd() < P.skills.lockpick * 0.18 + P.skills.mechanic * 0.08) {
      c.locked = false;
      toast("Замок вскрыт навыком", "loot");
    } else {
      toast("Заперто. Нужны ключи / отмычка / навык", "danger");
      return;
    }
  }
  if (c.fuel <= 0 && countItem("fuelcan")) {
    removeItem("fuelcan", 1);
    c.fuel = 45;
    toast("Заправлено из канистры", "loot");
  }
  P.inCar = c.id;
  curCar = c;
  P.x = c.x;
  P.y = c.y;
  mouse.down = false;
  SFX.engine();
  toast(
    c.fuel <= 0
      ? "Бак пуст. F — заправить канистрой."
      : "За рулём. W — газ, S — тормоз, A/D — руль.",
    "info",
  );
  qEvent("car", { action: "enter" });
  refreshHUD();
}
function exitCar() {
  const c = CARS.get(P.inCar);
  if (!c) return;
  let placed = false;
  for (const a of [
    c.angle + Math.PI / 2,
    c.angle - Math.PI / 2,
    c.angle + Math.PI,
  ]) {
    const x = c.x + Math.cos(a) * 28,
      y = c.y + Math.sin(a) * 28;
    if (!circleHit(x, y, P.r, c.id)) {
      P.x = x;
      P.y = y;
      placed = true;
      break;
    }
  }
  if (!placed) {
    P.x = c.x;
    P.y = c.y + 30;
  }
  P.inCar = null;
  curCar = null;
  SFX.door();
  refreshHUD();
}
function refuelCar(c) {
  if (!c) return false;
  if (countItem("fuelcan")) {
    removeItem("fuelcan", 1);
    c.fuel = clamp(c.fuel + 45, 0, c.maxFuel);
    SFX.eat();
    toast("Заправлено +45", "loot");
    return true;
  }
  if (countItem("fuel") >= 2) {
    removeItem("fuel", 2);
    c.fuel = clamp(c.fuel + 25, 0, c.maxFuel);
    SFX.eat();
    toast("Заправлено +25", "loot");
    return true;
  }
  toast("Нужна канистра или топливо ×2", "danger");
  return false;
}
function repairCar(c) {
  if (!c) return;
  if (c.dead) {
    toast("Машина не подлежит ремонту", "danger");
    return;
  }
  normalizeVehicle(c);
  if (countItem("repairkit")) {
    removeItem("repairkit", 1);
    c.hp = clamp(c.hp + 45, 0, c.maxHp);
    c.engineHp = clamp(c.engineHp + 55, 0, 100);
    c.tireHp = clamp(c.tireHp + 35, 0, 100);
    SFX.craft();
    toast("Кузов, двигатель и колёса отремонтированы", "loot");
    qEvent("car", { action: "repair" });
    return;
  }
  if (countItem("parts") >= 2) {
    removeItem("parts", 2);
    c.hp = clamp(c.hp + 25, 0, c.maxHp);
    c.engineHp = clamp(c.engineHp + 25, 0, 100);
    c.tireHp = clamp(c.tireHp + 20, 0, 100);
    SFX.craft();
    toast("Ремонт запчастями: прочность и узлы восстановлены", "loot");
    qEvent("car", { action: "repair" });
    return;
  }
  toast("Нужен ремкомплект или 2 запчасти", "danger");
}
function hurtCar(c, d, collision = false) {
  if (!c || c.dead) return;
  damageVehicle(c, d, collision);
  c.flash = 0.15;
  if (c.dead) {
    explode(c.x, c.y, 48, 28, true);
    if (P.inCar === c.id) {
      P.inCar = null;
      damagePlayer(30, "взрыв авто");
    }
  }
}
function updateCars(dt) {
  for (const c of CARS.values()) {
    c.flash = (c.flash || 0) - dt;
    c.crashCd = (c.crashCd || 0) - dt;
    if (c.dead) continue;
    const controls = {
      active: P.inCar === c.id,
      accel:
        (keys.KeyW || keys.ArrowUp ? 1 : 0) -
        (keys.KeyS || keys.ArrowDown ? 1 : 0),
      steer:
        (keys.KeyD || keys.ArrowRight ? 1 : 0) -
        (keys.KeyA || keys.ArrowLeft ? 1 : 0),
      boost: keys.ShiftLeft || keys.ShiftRight,
      handbrake: keys.Space,
    };
    const { dx, dy } = advanceVehicle(c, controls, dt);
    if (!controls.active) continue;
    const body = { x: c.x, y: c.y, r: 12 },
      res = moveBody(body, dx, dy, c.id);
    const moved = Math.hypot(body.x - c.x, body.y - c.y),
      intended = Math.hypot(dx, dy);
    if (intended > 0.4 && moved < intended * 0.55) {
      if (Math.abs(c.speed) > 28 && c.crashCd <= 0) {
        c.crashCd = 0.4;
        hurtCar(c, Math.abs(c.speed) * 0.1, true);
        SFX.crash();
        shake = Math.max(shake, 5);
        if (res.hit) {
          if (res.hit.kind === "struct")
            hurtStruct(res.hit.o, Math.abs(c.speed) * 0.18);
          if (res.hit.kind === "car")
            hurtCar(res.hit.o, Math.abs(c.speed) * 0.12, true);
        }
      }
      c.speed *= 0.3;
    }
    c.x = body.x;
    c.y = body.y;
    carGridMove(c);
    P.x = c.x;
    P.y = c.y;
    P.aim = c.angle;
    consumeVehicleFuel(c, dt, P.skills.mechanic);
    const m = moved / 16;
    stats.drive += m;
    driveAcc += m;
    if (Math.abs(c.speed) > 40)
      for (const z of [...Z])
        if (d2(c.x, c.y, z.x, z.y) < 28 * 28) {
          hurtZ(z, Math.abs(c.speed) * 0.38, c.angle, 180);
          c.speed *= 0.93;
          shake = Math.max(shake, 3);
        }
  }
}
function nearCamp(x, y) {
  return findCampNear(x, y, CAMPS);
}
function updateNPCs(dt) {
  for (const n of NPCS) {
    const c = CAMPS.get(n.camp);
    if (!c) continue;
    n.wt -= dt;
    n.shootT -= dt;
    if (n.wt <= 0) {
      n.wt = 2 + rnd() * 3;
      n.tx = c.x + ri(-70, 70);
      n.ty = c.y + ri(-70, 70);
    }
    const a = Math.atan2(n.ty - n.y, n.tx - n.x);
    if (d2(n.x, n.y, n.tx, n.ty) > 64) {
      n.x += Math.cos(a) * 22 * dt;
      n.y += Math.sin(a) * 22 * dt;
    }
    if (c.proj.tower > 0) {
      let best = null,
        bd = 140 * 140;
      for (const z of Z) {
        const d = d2(n.x, n.y, z.x, z.y);
        if (d < bd) {
          bd = d;
          best = z;
        }
      }
      if (best && n.shootT <= 0) {
        n.shootT = 1.4;
        const aa = Math.atan2(best.y - n.y, best.x - n.x);
        PR.push({
          x: n.x,
          y: n.y,
          vx: Math.cos(aa) * 480,
          vy: Math.sin(aa) * 480,
          dmg: 10 + c.proj.tower * 4,
          type: "turret",
          from: "t",
          life: 0.5,
          pierce: 0,
          hit: new Set(),
        });
        SFX.turret();
      }
    }
  }
}
function openCamp(c) {
  curCamp = c;
  const grants = collectQuestGrants(
    [mainQuest()],
    Q.given,
    (target) => target.bx === c.bx && target.by === c.by,
  );
  for (const [id, n] of Object.entries(grants.items)) addItem(id, n);
  if (grants.granted.length) toast("Припасы для лагеря получены", "quest");
  openPanel("camp");
}
function donate(c, id, n) {
  if (countItem(id) < n) {
    toast("Не хватает: " + ITEMS[id].n, "danger");
    return;
  }
  removeItem(id, n);
  donateToCamp(c, n);
  OV.set("CAMP" + c.id, {
    level: c.level,
    trust: c.trust,
    proj: c.proj,
    quest: c.quest,
  });
  toast("Передано: " + ITEMS[id].n + " ×" + n + " · доверие +" + n, "quest");
  qEvent("camp_supply", { camp: c.id, id, n });
  qEvent("donate", { camp: c.id, n });
  buildCamp();
}
function upgradeCamp(c, id) {
  const lock = campUpgradeLock(c, id, countItem);
  if (lock) {
    toast(lock, lock === "Уже максимум" ? "info" : "danger");
    return;
  }
  const lv = c.proj[id] || 0;
  const cost = campUpgradeCost(id, lv);
  for (const k in cost) removeItem(k, cost[k]);
  applyCampUpgrade(c, id);
  syncCampPopulation(c);
  OV.set("CAMP" + c.id, {
    level: c.level,
    trust: c.trust,
    proj: c.proj,
    quest: c.quest,
  });
  SFX.build();
  toast(c.name + ": улучшение " + id + " ур." + c.proj[id], "epic");
  qEvent("project", { id, level: c.proj[id], camp: c.id });
  buildCamp();
}
function tradeBuy(c, id, n, cost) {
  const lock = tradeLock(c, cost, countItem);
  if (lock) {
    toast(lock, "danger");
    return;
  }
  removeItem(cost.item, cost.n);
  addItem(id, n);
  SFX.loot();
  toast("Обмен совершён", "loot");
  buildCamp();
}
function explode(x, y, r, dmg, hurtAll) {
  SFX.explode();
  shake = Math.max(shake, 7);
  if (VFX_ASSETS.explosion) {
    VFX.push({
      type: "explosion",
      x,
      y,
      r,
      start: performance.now() / 1000,
    });
  }
  PT.push({
    type: "ring",
    x,
    y,
    r0: 6,
    r1: r,
    life: 0.4,
    max: 0.4,
    col: "rgba(255,178,62,.75)",
  });
  ptBurst(x, y, "#ffb23e", 22);
  LG.push({ x, y, r: r * 1.4, life: 0.3, max: 0.3, col: "255,150,60" });
  CL.push({ x, y, r: r * 0.8, life: 3.5, max: 3.5, fire: true });
  if (
    (state === "play" || state === "floor") &&
    d2(P.x, P.y, x, y) < r * r &&
    !P.inCar
  ) {
    damagePlayer(dmg, "взрыв");
    P.poison = Math.max(P.poison, 1);
  }
  if (hurtAll)
    for (const z of [...Z])
      if (d2(z.x, z.y, x, y) < r * r)
        hurtZ(z, dmg, Math.atan2(z.y - y, z.x - x), 130);
}
function fireCloud(x, y) {
  CL.push({ x, y, r: 42, life: 5, max: 5, fire: true });
  SFX.fire();
  LG.push({ x, y, r: 80, life: 0.4, max: 0.4, col: "255,120,40" });
}
function updatePR(dt) {
  for (let i = PR.length - 1; i >= 0; i--) {
    const p = PR[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (p.type === "molotov") fireCloud(p.x, p.y);
      PR.splice(i, 1);
      continue;
    }
    const steps = p.type === "spit" || p.type === "molotov" ? 1 : 2;
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      p.x += (p.vx * dt) / steps;
      p.y += (p.vy * dt) / steps;
      if (p.type === "molotov") p.vy += (120 * dt) / steps;
      const tx = Math.floor(p.x / 16),
        ty = Math.floor(p.y / 16),
        sol = solidAt(tx, ty);
      if (sol) {
        if (p.type === "molotov") {
          fireCloud(p.x, p.y);
          dead = true;
          break;
        }
        if (sol.kind === "struct" && p.from === "z") hurtStruct(sol.o, p.dmg);
        if (sol.kind === "car" && p.from !== "p") hurtCar(sol.o, p.dmg);
        ptSpark(p.x, p.y, Math.atan2(-p.vy, -p.vx));
        dead = true;
        break;
      }
      if (p.from === "z") {
        if (
          (state === "play" || state === "floor") &&
          !P.inCar &&
          d2(p.x, p.y, P.x, P.y) < (P.r + 4) ** 2
        ) {
          damagePlayer(p.dmg, "плевака");
          P.poison = Math.max(P.poison, 1.2);
          SFX.poison();
          dead = true;
          break;
        }
      } else if (p.from === "p" || p.from === "t") {
        for (const z of Z) {
          if ((z.floorId || "outdoor") !== currentFloorId) continue;
          if (p.hit.has(z)) continue;
          if (d2(p.x, p.y, z.x, z.y) < (z.r + 3) ** 2) {
            p.hit.add(z);
            hurtZ(z, p.dmg, Math.atan2(p.vy, p.vx), 65);
            if (p.pierce > 0) p.pierce--;
            else dead = true;
            break;
          }
        }
        if (!dead && currentFloorId === "outdoor")
          for (const c of visChunks) {
            const n = c.nest;
            if (n && n.alive && d2(p.x, p.y, n.x, n.y) < 225) {
              hurtNest(n, p.dmg);
              dead = true;
              break;
            }
          }
      }
    }
    if (dead) PR.splice(i, 1);
  }
}
function ptBlood(x, y, n) {
  for (let i = 0; i < n; i++)
    PT.push({
      type: "px",
      x,
      y,
      vx: ri(-65, 65),
      vy: ri(-65, 65),
      life: 0.4 + rnd() * 0.3,
      max: 0.7,
      col: pick(["#7a2a22", "#5c1a14", "#93362b"]),
      size: ri(1, 3),
      grav: 150,
    });
}
function ptBurst(x, y, col, n) {
  for (let i = 0; i < n; i++)
    PT.push({
      type: "px",
      x,
      y,
      vx: ri(-85, 85),
      vy: ri(-85, 85),
      life: 0.4 + rnd() * 0.4,
      max: 0.8,
      col,
      size: ri(1, 3),
      grav: 55,
    });
}
function ptSpark(x, y, a) {
  for (let i = 0; i < 4; i++) {
    const aa = a + (rnd() - 0.5) * 0.9;
    PT.push({
      type: "px",
      x,
      y,
      vx: Math.cos(aa) * ri(60, 150),
      vy: Math.sin(aa) * ri(60, 150),
      life: 0.15 + rnd() * 0.1,
      max: 0.25,
      col: pick(["#ffe87a", "#ffb23e", "#ece5d0"]),
      size: 1,
      grav: 0,
    });
  }
}
function updatePT(dt) {
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i];
    p.life -= dt;
    if (p.life <= 0) {
      PT.splice(i, 1);
      continue;
    }
    if (p.type === "px" || p.type === "ember") {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
    }
  }
  if (PT.length > 650) PT.splice(0, PT.length - 650);
}
function updateDR(dt) {
  for (let i = DR.length - 1; i >= 0; i--) {
    const d = DR[i];
    d.t += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= Math.pow(0.001, dt);
    d.vy *= Math.pow(0.001, dt);
    if (state !== "play") continue;
    const dd = dist(d.x, d.y, P.x, P.y);
    if (dd < 22) {
      const a = Math.atan2(P.y - d.y, P.x - d.x);
      d.x += Math.cos(a) * 130 * dt;
      d.y += Math.sin(a) * 130 * dt;
    }
    if (dd < 10) {
      const got = addItem(d.id, d.n);
      if (got > 0) {
        SFX.pickup();
        toast("+" + got + " " + ITEMS[d.id].n, "loot");
      }
      DR.splice(i, 1);
    }
  }
}
function updateCL(dt) {
  for (let i = CL.length - 1; i >= 0; i--) {
    const c = CL[i];
    c.life -= dt;
    if (c.life <= 0) {
      CL.splice(i, 1);
      continue;
    }
    if (c.fire) {
      for (const z of [...Z])
        if (d2(z.x, z.y, c.x, c.y) < c.r * c.r) hurtZ(z, 18 * dt, undefined, 0);
      if (
        (state === "play" || state === "floor") &&
        !P.inCar &&
        d2(P.x, P.y, c.x, c.y) < c.r * c.r
      )
        damagePlayer(8 * dt, "огонь");
    } else if (
      (state === "play" || state === "floor") &&
      d2(P.x, P.y, c.x, c.y) < c.r * c.r
    )
      P.poison = Math.max(P.poison, 0.5);
  }
}
function updateTX(dt) {
  for (let i = TX.length - 1; i >= 0; i--) {
    const t = TX[i];
    t.life -= dt;
    t.y += t.vy * dt;
    if (t.life <= 0) TX.splice(i, 1);
  }
}
function updateLG(dt) {
  for (let i = LG.length - 1; i >= 0; i--) {
    LG[i].life -= dt;
    if (LG[i].life <= 0) LG.splice(i, 1);
  }
}
function inBase(x, y) {
  const tx = x / 16,
    ty = y / 16;
  return tx >= 6 && tx <= 26 && ty >= 6 && ty <= 26;
}
function gainXP(n) {
  P.xp += n;
  TX.push({
    x: P.x,
    y: P.y - 20,
    txt: "+" + n + " XP",
    col: "#a6e83c",
    life: 0.8,
    vy: -26,
    size: 6,
  });
  while (P.xp >= xpNeed(P.lvl)) {
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    P.sp++;
    P.hp = clamp(P.hp + maxHp() * 0.25, 0, maxHp());
    SFX.level();
    PT.push({
      type: "ring",
      x: P.x,
      y: P.y,
      r0: 6,
      r1: 48,
      life: 0.6,
      max: 0.6,
      col: "rgba(166,232,60,.75)",
    });
    toast("УРОВЕНЬ " + P.lvl + "! +1 очко навыков [K]", "epic");
  }
  refreshHUD();
}
function damagePlayer(d, src) {
  if (
    P.iframe > 0 ||
    (state !== "play" && state !== "floor") ||
    (currentFloorId === "outdoor" && inBase(P.x, P.y) && !siege)
  )
    return;
  const abs = 0.6 + P.skills.tough * 0.05,
    ab = Math.min(P.armor, d * abs);
  P.armor -= ab;
  d -= ab;
  P.hp -= d;
  P.iframe = 0.5;
  deathCause = src;
  SFX.hurt();
  shake = Math.max(shake, 3.5);
  $("fxHp").style.opacity = 0.75;
  setTimeout(() => ($("fxHp").style.opacity = 0), 120);
  ptBlood(P.x, P.y, 5);
  if (searching) searching = null;
  if (P.hp <= 0) gameOver(src === "огонь" ? "fire" : "zombie");
}
function gameOver(reason) {
  if (state === "dead") return;
  state = "dead";
  setBody("dead");
  mouse.down = false;
  SFX.explode();
  $("deathTitle").textContent = reason === "base" ? "РУБЕЖ ПАЛ" : "ТЫ ПОГИБ";
  $("deathCause").textContent =
    reason === "base"
      ? "Костёр погас. Гниль забрала последний свет."
      : reason === "fire"
        ? "Огонь не различает своих."
        : reason === "голод"
          ? "Голод оказался терпеливее."
          : reason === "яд"
            ? "Заражение разъело изнутри."
            : "Тебя разорвали: " + (deathCause || "гниль") + ".";
  $("deathStats").innerHTML = miniStats();
  $("btnRespawn").classList.toggle("hid", DIFF.perma);
  $("deathOv").classList.remove("hid");
  if (DIFF.perma) wipeSave();
  else saveGame(true);
}
function respawn() {
  if (currentFloorId !== "outdoor") exitFloor();
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i];
    if (
      s &&
      ["Ресурс", "Боеприпас", "Еда", "Медицина", "Инструмент"].includes(
        ITEMS[s.id].t,
      )
    ) {
      s.n = Math.floor(s.n * 0.7);
      if (s.n <= 0) inv[i] = null;
    }
  }
  if (!SMAP.get("16,16"))
    SMAP.set("16,16", {
      t: "fire",
      x: 16,
      y: 16,
      hp: 240,
      max: 360,
      ang: 0,
      cd: 0,
    });
  P.x = 184;
  P.y = 232;
  P.hp = Math.round(maxHp() * 0.65);
  P.hu = 60;
  P.armor = 0;
  P.poison = 0;
  P.iframe = 3;
  P.inCar = null;
  Z.splice(
    0,
    Z.length,
    ...Z.filter((z) => dist(z.x, z.y, BASEX, BASEY) > 30 * 16),
  );
  siege = null;
  $("siegeB").classList.add("hid");
  $("deathOv").classList.add("hid");
  state = "play";
  setBody("play");
  toast("Ты очнулся у костра. Рубеж стоит.", "info");
  saveGame();
}
function miniStats() {
  return (
    "<span><b>" +
    day +
    "</b>дней</span><span><b>" +
    stats.kills +
    "</b>убито</span><span><b>" +
    stats.nests +
    "</b>рассадников</span><span><b>" +
    P.lvl +
    "</b>уровень</span><span><b>" +
    Math.round(stats.drive) +
    "м</b>за рулём</span>"
  );
}
function startSearch(o) {
  if (o.looted || OV.get("L" + o.id)) return;
  searching = { o, t: 0, dur: 1.05 * (1 - P.skills.scav * 0.12) };
  SFX.ui();
}
function finishSearch() {
  const o = searching.o;
  searching = null;
  o.looted = true;
  OV.set("L" + o.id, true);
  const table = LOOT[o.type] || LOOT.shelf,
    luck = 0.18 + P.skills.scav * 0.1;
  let rolls = ["cache", "garden"].includes(o.type)
    ? table.length
    : 2 + (rnd() < luck ? 1 : 0) + (P.skills.scav >= 3 ? 1 : 0);
  const got = {};
  for (let i = 0; i < rolls; i++) {
    let e = null;
    if (["cache", "garden"].includes(o.type)) e = table[i];
    else {
      for (const ee of table)
        if (rnd() < ee[1] * DIFF.loot) {
          e = ee;
          break;
        }
      if (!e) e = table[0];
    }
    const n = Math.max(
      1,
      Math.round(ri(e[2], e[3]) * (DIFF.loot * 0.85 + 0.15)),
    );
    got[e[0]] = (got[e[0]] || 0) + n;
  }
  const bonus = rollDistrictLoot(
    districtOf(Math.floor(o.x / CELL), Math.floor(o.y / CELL), SEED),
    rnd,
  );
  if (bonus) got[bonus.id] = (got[bonus.id] || 0) + bonus.n;
  const grants = collectQuestGrants(
    [mainQuest(), ...Q.side],
    Q.given,
    (target) => {
      if (target.siteId) {
        const special = OSM_CITY.specials.get(K(target.bx, target.by));
        return special?.building?.wayId === o.wayId;
      }
      return (
        Math.floor(o.x / CELL) === target.bx &&
        Math.floor(o.y / CELL) === target.by
      );
    },
  );
  for (const [id, n] of Object.entries(grants.items))
    got[id] = (got[id] || 0) + n;
  if (grants.granted.length) toast("Находка по заданию!", "quest");
  const parts = [];
  for (const id in got) {
    addItem(id, got[id]);
    parts.push("+" + got[id] + " " + ITEMS[id].n);
    stats.looted += got[id];
  }
  SFX.loot();
  toast("Обыск: " + parts.join(", "), "loot");
}
function contName(t) {
  return (
    {
      crate: "Ящик",
      shelf: "Стеллаж",
      fridge: "Холодильник",
      cabinet: "Шкаф",
      medbox: "Медящик",
      locker: "Шкафчик",
      gunrack: "Оружейная стойка",
      market: "Витрина",
      freezer: "Морозильник",
      toolbox: "Инструменты",
      desk: "Стол",
      trash: "Мусор",
      pump: "Колонка",
      garden: "Грядка",
      cache: "Ящик припасов",
      tire: "Шины",
    }[t] || "Контейнер"
  );
}
function updateFloorInteract() {
  if (searching) {
    $("prompt").classList.remove("hid");
    $("promptT").textContent = "ОБЫСК…";
    $("promptS").textContent = "Не двигайся";
    return;
  }
  let stair = null,
    stairDistance = 40 * 40;
  for (const candidate of FLOOR_SCENE.stairs) {
    const distance = d2(P.x, P.y, candidate.x, candidate.y);
    if (distance < stairDistance) {
      stairDistance = distance;
      stair = candidate;
    }
  }
  if (stair) {
    promptObj = { kind: "stairs", o: stair };
    $("promptT").textContent =
      stair.target === "outdoor" ? "E — Выйти наружу" : "E — " + stair.target;
    $("promptS").textContent = FLOOR_SCENE.name;
    $("prompt").classList.remove("hid");
    return;
  }
  let best = null,
    bestDistance = (1.8 * 16) ** 2;
  for (const container of FLOOR_CONTAINERS.values()) {
    if (container.looted) continue;
    const distance = d2(P.x, P.y, container.x * 16 + 8, container.y * 16 + 8);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = container;
    }
  }
  if (best) {
    promptObj = { kind: "cont", o: best };
    $("promptT").textContent = "E — Обыскать: " + contName(best.type);
    $("promptS").textContent = FLOOR_SCENE.name;
  } else {
    $("prompt").classList.add("hid");
  }
}
function nearbyFloorEntrance() {
  const pcx = Math.floor(P.x / (CELL * 16)),
    pcy = Math.floor(P.y / (CELL * 16));
  let nearest = null,
    bestDistance = (1.8 * 16) ** 2;
  for (const building of OSM_CITY.buildingsNearDoor(pcx, pcy)) {
    if (!FLOOR_DEFINITIONS[building.type]) continue;
    const x = (building.x + Math.floor(building.w / 2) + 0.5) * 16,
      y = (building.y + building.h + 0.5) * 16,
      distance = d2(P.x, P.y, x, y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = {
        buildingId: building.type,
        x,
        y,
        name: POI[building.type].name,
      };
    }
  }
  return nearest;
}
function updateInteract() {
  promptObj = null;
  if (currentFloorId !== "outdoor") {
    updateFloorInteract();
    return;
  }
  if (state !== "play" || buildSel) {
    $("prompt").classList.add("hid");
    return;
  }
  if (searching) {
    $("prompt").classList.remove("hid");
    $("promptT").textContent = "ОБЫСК…";
    $("promptS").textContent = "Не двигайся";
    return;
  }
  if (P.inCar) {
    const c = CARS.get(P.inCar);
    $("prompt").classList.remove("hid");
    $("promptT").textContent = "E — выйти · T — багажник · H — сигнал";
    $("promptS").textContent =
      c.fuel < 15 ? "Мало топлива!" : "W — газ · S — тормоз/задний ход";
    return;
  }
  const entrance = nearbyFloorEntrance();
  let best = null,
    bd = (1.8 * 16) ** 2;
  for (const c of visChunks)
    for (const o of c.containers) {
      const d = d2(P.x, P.y, o.x * 16 + 8, o.y * 16 + 8);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  let car = null,
    cd = (2.2 * 16) ** 2;
  for (const c of carsNear(P.x, P.y, 40)) {
    const d = d2(P.x, P.y, c.x, c.y);
    if (d < cd) {
      cd = d;
      car = c;
    }
  }
  let camp = null,
    cd2 = (2.4 * 16) ** 2;
  for (const c of CAMPS.values()) {
    const d = d2(P.x, P.y, c.x, c.y);
    if (d < cd2) {
      cd2 = d;
      camp = c;
    }
  }
  let sNear = null,
    sd = (1.9 * 16) ** 2;
  for (const s of SMAP.values()) {
    const d = d2(P.x, P.y, s.x * 16 + 8, s.y * 16 + 8);
    if (d < sd) {
      sd = d;
      sNear = s;
    }
  }
  if (car) {
    promptObj = { kind: "car", o: car };
    $("promptT").textContent =
      "E — " +
      (car.dead
        ? "осмотреть"
        : car.locked
          ? "вскрыть "
          : car.broken
            ? "починить "
            : "сесть в ") +
      (car.type === "truck"
        ? "грузовик"
        : car.type === "police"
          ? "полицейскую машину"
          : car.type === "ambulance"
            ? "скорую"
            : "авто");
    $("promptS").textContent = "F — заправить · R — ремонт · T — багажник";
  } else if (camp) {
    promptObj = { kind: "camp", o: camp };
    $("promptT").textContent = "E — " + camp.name + " · лидер " + camp.leader;
    $("promptS").textContent = "Торговля · улучшения · поручения";
  } else if (entrance) {
    promptObj = { kind: "floorEntrance", o: entrance };
    $("promptT").textContent = "E — Войти: " + entrance.name;
    $("promptS").textContent = "Доступны внутренние этажи";
  } else if (best && !best.looted) {
    promptObj = { kind: "cont", o: best };
    $("promptT").textContent = "E — Обыскать: " + contName(best.type);
    $("promptS").textContent = best.type === "pump" ? "Топливо и химикаты" : "";
  } else if (sNear) {
    promptObj = { kind: "struct", o: sNear };
    const names = {
      bench: "Верстак",
      fire: "Костёр",
      gate: "Ворота",
      generator: "Генератор",
      turret: "Турель",
      medstation: "Медпункт",
      radioTower: "Радиовышка",
      garage: "Гараж",
    };
    $("promptT").textContent = "E — " + (names[sNear.t] || "Постройка");
    $("promptS").textContent =
      sNear.t === "gate"
        ? sNear.open
          ? "закрыть"
          : "открыть"
        : sNear.t === "radioTower"
          ? "запросить поручение"
          : sNear.t === "garage"
            ? "ремонт/заправка авто"
            : "";
  } else {
    $("prompt").classList.add("hid");
    return;
  }
  $("prompt").classList.remove("hid");
}
function doInteract() {
  if (searching) return;
  if (currentFloorId !== "outdoor") {
    if (promptObj?.kind === "stairs") transitionFloor(promptObj.o.target);
    else if (promptObj?.kind === "cont") startSearch(promptObj.o);
    return;
  }
  if (P.inCar) {
    exitCar();
    return;
  }
  if (!promptObj) return;
  if (promptObj.kind === "floorEntrance") {
    enterFloor(promptObj.o.buildingId, "ground");
    return;
  }
  if (promptObj.kind === "cont") {
    if (promptObj.o.type === "pump") {
      const c = nearestCar(44);
      if (c) refuelCar(c);
      else startSearch(promptObj.o);
    } else startSearch(promptObj.o);
  } else if (promptObj.kind === "car") enterCar(promptObj.o);
  else if (promptObj.kind === "camp") openCamp(promptObj.o);
  else if (promptObj.kind === "struct") {
    const s = promptObj.o;
    if (s.t === "bench") openPanel("craft");
    else if (s.t === "fire") {
      saveGame();
      toast("Вахта сохранена у костра", "quest");
      SFX.quest();
    } else if (s.t === "gate") toggleGate();
    else if (s.t === "radioTower") {
      if (Q.side.length < 3) {
        genSideQuest();
        toast("Новое поручение получено по радио", "quest");
      } else toast("Слишком много активных поручений", "info");
    } else if (s.t === "garage") {
      const c = nearestCar(60) || curCar;
      if (c) {
        repairCar(c);
        refuelCar(c);
      } else openPanel("base");
    }
  }
}
function nearestCar(r) {
  let best = null,
    bd = r * r;
  for (const c of carsNear(P.x, P.y, r)) {
    const d = d2(P.x, P.y, c.x, c.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
function mainQuest() {
  return Q.endless ? null : MAIN[Q.main];
}
function trackedQuest() {
  if (Q.tracked === "main") return mainQuest() || Q.side[0];
  return Q.side.find((q) => q.id === Q.tracked) || mainQuest() || Q.side[0];
}
function setupMain() {
  const q = mainQuest();
  if (!q) return;
  Q.prog = {};
  Q.given = {};
  Q.targets = (OSM_QUEST_TARGETS[q.id] || q.targets || []).map((target) => ({
    ...target,
  }));
  if (OSM_QUEST_TARGETS[q.id]) q.targets = Q.targets;
  syncQuestProgress(q, Q.prog, {
    learned,
    owned: P.owned,
    baseProj,
    stats,
  });
  if (goalsComplete(q, Q.prog)) {
    completeQuest(q);
    return;
  }
  if (q.goals.some((g) => g[0] === "nest") && !q.targets) {
    const n = findNearestNest();
    q.targets = n ? [n] : [];
  }
  if (q.goals.some((g) => g[0] === "mega")) {
    Q.targets = [prepareMegaQuest(OV, PLAN, chunks, CMAP)];
  }
  if (q.goals.some((g) => g[0] === "siege")) {
    Q.forcedSiege = nextSiegeDay();
    toast("Орда придёт в 22:00. Проверь ворота.", "danger");
  }
  updateQuestUI();
}
function findNearestNest() {
  const pcx = Math.floor(P.x / (CELL * 16)),
    pcy = Math.floor(P.y / (CELL * 16));
  for (let r = 2; r <= 12; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = planBlock(pcx + dx, pcy + dy);
        if (p.nest && !OV.get("D" + p.k))
          return { bx: p.bx, by: p.by, label: p.name || "Рассадник" };
      }
  return { bx: 5, by: -4, label: "Карьер" };
}
function handleQuestEvent(type, data) {
  if (state === "menu" || state === "home") return;
  const qs = [mainQuest(), ...Q.side].filter(Boolean);
  for (const q of qs) {
    const isSide = q.kind === "side",
      p = isSide ? Q.sideProg[q.id] : Q.prog;
    if (!p) continue;
    if (type === "camp_supply" && q.campId !== data.camp) continue;
    if (type === "deliver" && q.campId && q.campId !== data.camp) continue;
    applyQuestEvent(p, type, data);
    if (goalsComplete(q, p)) completeQuest(q);
  }
  updateQuestUI();
}
const gameEvents = createEventBus();
let completingQuest = false;
gameEvents.on("*", (data, type) => handleQuestEvent(type, data));
function qEvent(type, data) {
  gameEvents.emit(type, data);
}
function completeQuest(q) {
  if (completingQuest) return;
  completingQuest = true;
  try {
    SFX.quest();
    toast("ЗАДАНИЕ ВЫПОЛНЕНО: " + q.title, "quest");
    if (q.reward) {
      gainXP(q.reward.xp || 0);
      if (q.reward.items)
        for (const [id, n] of q.reward.items) addItem(id, n, true);
      const rewardCamp = q.campId ? CAMPS.get(q.campId) : curCamp;
      if (q.reward.trust && rewardCamp) {
        rewardCamp.trust += q.reward.trust;
        OV.set("CAMP" + rewardCamp.id, rewardCamp);
      }
    }
    journalAdd(q.title, q.story || "Поручение выполнено.");
    if (q.kind === "side") {
      if (q.raid) Q.raids[q.raid] = "done";
      Q.side = Q.side.filter((s) => s.id !== q.id);
      delete Q.sideProg[q.id];
      if (Q.tracked === q.id) Q.tracked = "main";
      if (Q.endless) genSideQuest("radio");
    } else {
      Q.main++;
      if (Q.main >= MAIN.length) {
        showEnding();
        return;
      }
      setupMain();
    }
    buildQuestList();
    saveGame();
  } finally {
    completingQuest = false;
  }
}
function startRaid(camp, id) {
  const def = RAIDS[id];
  if (
    !def ||
    def.campId !== camp.id ||
    Q.main < def.unlockMain ||
    Q.raids[id] ||
    Q.side.some((quest) => quest.raid === id)
  )
    return null;
  const quest = { ...def, kind: "side", raid: id };
  Q.side.push(quest);
  Q.sideProg[id] = {};
  Q.tracked = id;
  toast(def.title + ". Особые правила указаны на карте.", "quest");
  buildQuestList();
  return quest;
}
function genSideQuest(src) {
  if (Q.side.length >= 3) return;
  const id = "s" + ++Q.sideSeq,
    dayF = Math.min(day, 12),
    roll = rnd(),
    camp = src && typeof src === "object" ? src : null;
  let q;
  if (roll < 0.28) {
    const p = randomPOI(),
      need = pick(["can", "bandage", "fuelcan", "repairkit", "medkit"]);
    q = {
      id,
      kind: "side",
      title: (camp ? camp.name + ": " : "Доставка: ") + ITEMS[need].n,
      desc: camp
        ? camp.leader +
          " просит припасы. Передай их этому лагерю через кнопку пожертвования."
        : "Лагерь просит припасы. Найди и передай.",
      goals: [["supply_" + need, ri(2, 4)]],
      targets: [p],
      reward: {
        xp: 90 + dayF * 12,
        items: [
          ["valuables", ri(1, 3)],
          ["scrap", ri(3, 6)],
        ],
      },
    };
  } else if (roll < 0.5) {
    const n = findNearestNest();
    q = {
      id,
      kind: "side",
      title: "Зачистка узла",
      desc: "Сожги рассадник и вернись с образцом.",
      goals: [
        ["nest", 1],
        ["sample", 1],
      ],
      targets: [n],
      reward: {
        xp: 140 + dayF * 14,
        items: [
          ["chem", 4],
          ["elec", 2],
        ],
      },
    };
  } else if (roll < 0.72) {
    const p = randomPOI();
    q = {
      id,
      kind: "side",
      title: "Тихая зачистка",
      desc: "В отмеченном квартале замечены гнилые. Уничтожь их.",
      goals: [["kills", ri(8, 16)]],
      targets: [p],
      reward: {
        xp: 100 + dayF * 10,
        items: [
          ["ammo9", 12],
          ["arrow", 12],
        ],
      },
    };
  } else if (roll < 0.88) {
    q = {
      id,
      kind: "side",
      title: "Груз для лагеря",
      desc: "Найди груз в отмеченном месте и доставь его в любой лагерь.",
      goals: [
        ["cargo", 1],
        ["deliver", 1],
      ],
      targets: [randomPOI()],
      grant: [["cargo", 1]],
      reward: {
        xp: 150 + dayF * 12,
        items: [
          ["fuelcan", 1],
          ["parts", 3],
        ],
      },
    };
  } else {
    q = {
      id,
      kind: "side",
      title: "Радиоразведка",
      desc: "Доедь до отмеченной точки и проверь эфир.",
      goals: [["drive", ri(250, 500)]],
      targets: [randomPOI()],
      reward: {
        xp: 110 + dayF * 10,
        items: [
          ["radiopart", 1],
          ["wire", 4],
        ],
      },
    };
  }
  if (camp) {
    q.campId = camp.id;
    q.reward.trust = 3;
  }
  Q.side.push(q);
  Q.sideProg[id] = {};
  Q.tracked = id;
  if (src) toast("НОВОЕ ПОРУЧЕНИЕ: " + q.title, "quest");
  buildQuestList();
  return q;
}
function randomPOI() {
  const pcx = Math.floor(P.x / (CELL * 16)),
    pcy = Math.floor(P.y / (CELL * 16));
  for (let i = 0; i < 40; i++) {
    const bx = pcx + ri(-6, 6),
      by = pcy + ri(-6, 6),
      p = planBlock(bx, by);
    if (p.buildings.length) return { bx, by, label: p.name || "Место" };
  }
  return { bx: 2, by: 0, label: "Супермаркет" };
}
function questTargetWorld() {
  if (siege) return { x: BASEX, y: BASEY, label: "РУБЕЖ", siege: true };
  const waypoint = mapController.getState().waypoint;
  if (waypoint && currentFloorId === "outdoor")
    return {
      x: waypoint.x * CELL * 16,
      y: waypoint.y * CELL * 16,
      label: waypoint.label || "Метка",
    };
  const q = trackedQuest(),
    targets = q?.kind === "side" ? q.targets : Q.targets;
  if (!q || !targets || !targets.length) return null;
  const t = targets[0];
  return {
    x: Number.isFinite(t.x) ? t.x : t.bx * CELL * 16 + 14 * 16,
    y: Number.isFinite(t.y) ? t.y : t.by * CELL * 16 + 14 * 16,
    label: q.title,
  };
}
function updateQuestUI() {
  const q = trackedQuest();
  if (!q) {
    $("qTitle").textContent = "Вахта";
    $("qDesc").textContent = "Город продолжает жить.";
    $("qGoals").innerHTML = "";
    return;
  }
  $("qTitle").textContent = (q.kind === "side" ? "◇ " : "◆ ") + q.title;
  $("qDesc").textContent = q.desc;
  const prog = q.kind === "side" ? Q.sideProg[q.id] : Q.prog;
  $("qGoals").innerHTML = q.goals
    .map((g) => {
      const have = prog ? prog[g[0]] || 0 : 0,
        ok = have >= g[1];
      return (
        '<div class="' +
        (ok ? "ok" : "no") +
        '">' +
        (ok ? "✓ " : "▸ ") +
        goalLabel(g[0], g[1]) +
        " · " +
        Math.min(have, g[1]) +
        "/" +
        g[1] +
        "</div>"
      );
    })
    .join("");
  $("qHint").textContent =
    q.targets && q.targets.length
      ? "◈ " + q.targets[0].label + " · M — карта"
      : "Подготовка на Рубеже";
  if (q.id === "m2" && Q.prog.bp_crossbow && !Q.prog.craft_crossbow)
    $("qHint").textContent = "Чертёж найден. Собери арбалет на верстаке [C].";
}
function goalLabel(k, n) {
  if (ITEMS[k]) return ITEMS[k].n + " ×" + n;
  if (k === "nest") return "Сжечь рассадники";
  if (k === "mega") return "Сердце Матки";
  if (k === "siege") return "Пережить осаду";
  if (k === "kills") return "Убить гнилых";
  if (k === "drive") return "Проехать метров";
  if (k === "car_repair") return "Починить авто";
  if (k === "camp_talk") return "Поговорить с лагерем";
  if (k === "donate") return "Передать припасы";
  if (k === "deliver") return "Доставить груз";
  if (k.startsWith("bp_"))
    return (
      "Чертёж: " + (WEAPONS[k.slice(3)] ? WEAPONS[k.slice(3)].n : k.slice(3))
    );
  if (k.startsWith("craft_"))
    return (
      "Собрать: " + (WEAPONS[k.slice(6)] ? WEAPONS[k.slice(6)].n : k.slice(6))
    );
  if (k.startsWith("project_"))
    return "Улучшить: " + (PROJ[k.slice(8)] ? PROJ[k.slice(8)].n : k.slice(8));
  return k;
}
function journalAdd(t, x) {
  J.push({ d: day, t, x });
  if (J.length > 90) J.shift();
}
function darkness() {
  return darknessForTime(tod, state);
}
function nextSiegeDay() {
  return nextSiegeDayFor(day, tod);
}
function updateTime(dt) {
  const prev = tod;
  const clock = advanceClock({ day, tod }, dt, timeSpeed);
  day = clock.day;
  tod = clock.tod;
  if (clock.dawn) {
    toast("ДЕНЬ " + day + ". Город встретил рассвет.", "info");
    for (const [k, v] of [...OV]) if (k.startsWith("Lbase:")) OV.delete(k);
    for (const c of chunks.values())
      for (const o of c.containers)
        if (["garden", "cache"].includes(o.type)) o.looted = false;
    saveGame();
  }
  const tonight = (day >= 6 && (day - 6) % 4 === 0) || Q.forcedSiege === day;
  if (prev < 20 && tod >= 20 && tonight && siegeWarnDay !== day) {
    siegeWarnDay = day;
    toast("К ночи жди гостей. Проверь ворота.", "danger");
    SFX.scream();
  }
  if (prev < 22 && tod >= 22 && tonight && lastSiegeDay !== day && !siege)
    startSiege();
  if (prev < 6 && tod >= 6 && siege) endSiege(true);
  if (prev < 6 && tod >= 6) SFX.dawn();
  if (darkness() > 0.3 && !nightToasted) {
    nightToasted = true;
    toast("Ночь. За забором безопаснее. Фонарь: F", "info");
  }
  if (darkness() < 0.1) nightToasted = false;
}
function startSiege() {
  lastSiegeDay = day;
  siegeWarnDay = day;
  siege = {
    wave: 0,
    total: Math.min(5, 2 + Math.floor(day / 6)),
    between: 2,
    alive: 0,
  };
  SFX.siren();
  shake = 4;
  toast("☠ ОСАДА РУБЕЖА", "danger");
  $("siegeB").classList.remove("hid");
}
function spawnSiegeWave() {
  siege.wave++;
  const n = Math.round((4 + siege.wave * 2 + day * 0.35) * DIFF.siege);
  for (let i = 0; i < n; i++) {
    for (let tr = 0; tr < 8; tr++) {
      const a = rnd() * Math.PI * 2,
        r = (24 + rnd() * 6) * 16,
        x = BASEX + Math.cos(a) * r,
        y = BASEY + Math.sin(a) * r;
      if (solidAt(Math.floor(x / 16), Math.floor(y / 16))) continue;
      const rr = rnd();
      let tp =
        rr < 0.45
          ? "walker"
          : rr < 0.65
            ? "runner"
            : rr < 0.78
              ? "dog"
              : rr < 0.9
                ? "spitter"
                : "bloater";
      if (siege.wave >= 3 && rr < 0.12) tp = "brute";
      spawnZ(tp, x, y, { siege: true });
      siege.alive++;
      break;
    }
  }
}
function updateSiege(dt) {
  if (!siege) return;
  siege.alive = Z.filter((z) => z.siege).length;
  if (siege.alive === 0) {
    if (siege.wave >= siege.total) {
      endSiege(true, true);
      return;
    }
    siege.between -= dt;
    if (siege.between <= 0) {
      siege.between = 8;
      spawnSiegeWave();
    }
  }
  $("siegeT").textContent =
    "☠ ВОЛНА " +
    Math.max(1, siege.wave) +
    "/" +
    siege.total +
    " · " +
    siege.alive;
  $("siegeF").style.width =
    clamp(
      (siege.alive / Math.max(1, 4 + siege.wave * 2 + day * 0.35)) * 100,
      0,
      100,
    ) + "%";
}
function endSiege(surv, cleared) {
  siege = null;
  $("siegeB").classList.add("hid");
  for (const z of Z) z.siege = false;
  if (surv) {
    stats.sieges++;
    SFX.dawn();
    toast(cleared ? "ОСАДА ОТБИТА" : "Рассвет. Орда отступила.", "quest");
    gainXP(110);
    if (cleared) {
      addDrop(BASEX + 20, BASEY + 20, "elec", 2);
      addDrop(BASEX - 20, BASEY + 20, "medkit", 1);
      addDrop(BASEX, BASEY + 30, "arrow", 14);
    }
    qEvent("siege", {});
    saveGame();
  }
}
function nearBench() {
  for (const s of SMAP.values())
    if (
      s.t === "bench" &&
      d2(P.x, P.y, s.x * 16 + 8, s.y * 16 + 8) < (4.5 * 16) ** 2
    )
      return true;
  return false;
}
function craftLock(r) {
  if (r.tier > bench) return "верстак ур." + r.tier;
  if (r.bp && !learned.has(r.bp)) return "нужен чертёж";
  if (r.weapon && P.owned[r.out]) return "уже есть";
  if (r.id === "backpack" && invSlots >= 36) return "уже улучшено";
  if (r.bench && !nearBench()) return "подойди к верстаку";
  for (const k in r.cost)
    if (countItem(k) < r.cost[k]) return "не хватает ресурсов";
  return null;
}
function doCraft(r) {
  const lock = craftLock(r);
  if (lock) {
    toast(lock, "danger");
    return;
  }
  for (const k in r.cost) removeItem(k, r.cost[k]);
  let n = r.n;
  if (!r.upgrade && rnd() < P.skills.crafting * 0.08) n *= 2;
  if (r.out === "backpack") {
    invSlots += 6;
    while (inv.length < invSlots) inv.push(null);
    toast("Рюкзак расширен до " + invSlots + " слотов", "epic");
  } else {
    addItem(r.out, n, true);
  }
  toast("Создано: " + ITEMS[r.out].n + (n > 1 ? " ×" + n : ""), "loot");
  stats.crafted++;
  SFX.craft();
  qEvent("craft", { id: r.out });
  buildCraft();
  refreshHUD();
}
function projCost(id, lv) {
  const c = {};
  for (const k in PROJ[id].cost) c[k] = PROJ[id].cost[k] * (lv + 1);
  return c;
}
function projLock(id) {
  const p = PROJ[id],
    lv = baseProj[id] || 0;
  if (lv >= p.max) return "максимум";
  if (p.bp && !learned.has(p.bp)) return "нужен чертёж";
  const cost = projCost(id, lv);
  for (const k in cost)
    if (countItem(k) < cost[k]) return "не хватает ресурсов";
  return null;
}
function upgradeBase(id) {
  const lock = projLock(id);
  if (lock) {
    toast(lock, "danger");
    return;
  }
  const lv = baseProj[id] || 0,
    cost = projCost(id, lv);
  for (const k in cost) removeItem(k, cost[k]);
  baseProj[id] = lv + 1;
  applyBaseProjects();
  SFX.build();
  toast("РУБЕЖ: " + PROJ[id].n + " ур." + baseProj[id], "epic");
  qEvent("project", { id, level: baseProj[id] });
  for (let cy = -1; cy <= 1; cy++)
    for (let cx = -1; cx <= 1; cx++) chunks.delete(K(cx, cy));
  buildBase();
  refreshHUD();
}
const domUI = createDomUI({
  $,
  getState: () => state,
  setState: (next) => (state = next),
  setBody,
  mouse,
  saveGame,
  playUi: () => SFX.ui(),
  renderTab: (tab) => {
    ({
      inv: buildInv,
      craft: buildCraft,
      skill: buildSkills,
      quest: buildQuestList,
      base: buildBase,
      camp: buildCamp,
      trunk: buildTrunk,
      log: buildLog,
    })[tab]();
  },
  getViewport: () => ({ W, H }),
});
function setBody(c) {
  document.body.className = c;
}
function toast(t, c) {
  domUI.toast(t, c);
}
function panelOpen() {
  return domUI.panelOpen();
}
function openPanel(tab) {
  domUI.openPanel(tab);
}
function closePanel() {
  domUI.closePanel();
}
function setTab(tab) {
  domUI.setTab(tab);
}
function showTip(html, x, y) {
  domUI.showTip(html, x, y);
}
function hideTip() {
  domUI.hideTip();
}
function itemTip(id) {
  const it = ITEMS[id],
    rc = ["#d9cba6", "#a6e83c", "#7fb8d8", "#ffb23e"][it.r];
  return (
    '<div class="tn" style="color:' +
    rc +
    '">' +
    it.n +
    '</div><div class="tt">' +
    it.t +
    '</div><div class="td">' +
    it.d +
    '</div><div class="ta">' +
    (it.use
      ? "ЛКМ — использовать · ПКМ — выбросить"
      : "ЛКМ — инфо · ПКМ — выбросить") +
    "</div>"
  );
}
function buildInv() {
  const g = $("invGrid");
  g.innerHTML = "";
  let used = 0;
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i],
      cell = document.createElement("div");
    cell.className = "cell" + (s ? " r" + ITEMS[s.id].r : " empty");
    if (s) {
      used++;
      cell.innerHTML =
        '<img class="icon" src="' +
        iconURL(s.id) +
        '"><span class="n">' +
        s.n +
        "</span>";
      cell.onmouseenter = (e) => showTip(itemTip(s.id), e.clientX, e.clientY);
      cell.onmousemove = (e) => showTip(itemTip(s.id), e.clientX, e.clientY);
      cell.onmouseleave = hideTip;
      cell.onclick = () => {
        useItem(i);
        hideTip();
      };
      cell.oncontextmenu = (e) => {
        e.preventDefault();
        addDrop(P.x, P.y + 10, s.id, s.n);
        inv[i] = null;
        buildInv();
        hideTip();
      };
    }
    g.appendChild(cell);
  }
  $("slotCount").textContent = used + "/" + invSlots;
  const w = WEAPONS[P.weapon];
  $("invSide").innerHTML =
    '<h3>АРТЁМ ВЕРЕСОВ</h3><div><span class="sv">Уровень:</span> <b>' +
    P.lvl +
    "</b> · очков: <b>" +
    P.sp +
    '</b></div><div><span class="sv">HP:</span> <b>' +
    Math.ceil(P.hp) +
    "/" +
    maxHp() +
    "</b> · броня: <b>" +
    Math.ceil(P.armor) +
    '/60</b></div><div><span class="sv">Оружие:</span> <b style="color:var(--amber)">' +
    w.n +
    "</b>" +
    (hasSpear ? " · копьё" : "") +
    '</div><div class="sv" style="font-size:11px">' +
    w.d +
    '</div><div style="margin-top:10px" class="sv">Чертежей: <b>' +
    learned.size +
    "/8</b> · верстак ур.<b>" +
    bench +
    '</b></div><div style="margin-top:10px;font-size:11px;color:var(--dim)">Лук и арбалет перезаряжаются сами.<br>Машины: E сесть, W газ, F заправить, R ремонт, T багажник.<br>Лагеря: торговля, улучшения, поручения.</div>';
}
function buildCraft() {
  $("benchInfo").innerHTML =
    'Верстак <b style="color:var(--amber)">ур.' +
    bench +
    "</b> · " +
    (nearBench()
      ? '<span style="color:var(--good)">ты у верстака</span>'
      : '<span style="color:var(--warn)">сложные рецепты — у верстака</span>') +
    '<br><span style="color:var(--dim)">Ресурсы: стекло, пластик, резина, провода, шестерни, топливо, аккумуляторы, запчасти.</span>';
  const L = $("craftList");
  L.innerHTML = "";
  for (const r of RECIPES) {
    const lock = craftLock(r),
      row = document.createElement("div");
    row.className = "craftRow" + (lock ? " lock" : "");
    let costs = "";
    for (const k in r.cost) {
      const have = countItem(k);
      costs +=
        '<span class="cost"><img class="icon" src="' +
        iconURL(k) +
        '"><span class="' +
        (have >= r.cost[k] ? "have" : "lack") +
        '">' +
        have +
        "/" +
        r.cost[k] +
        "</span></span>";
    }
    row.innerHTML =
      '<img class="icon" src="' +
      iconURL(r.out) +
      '"><div class="ci"><div class="cn">' +
      ITEMS[r.out].n +
      (r.n > 1 ? " ×" + r.n : "") +
      '</div><div class="cd">' +
      r.d +
      '</div><div class="costs">' +
      costs +
      "</div>" +
      (lock ? '<div class="lockReason">▸ ' + lock + "</div>" : "") +
      "</div>";
    const b = document.createElement("button");
    b.className = "btn" + (lock ? "" : " acid");
    b.textContent = "СОЗДАТЬ";
    b.disabled = !!lock;
    b.onclick = () => doCraft(r);
    row.appendChild(b);
    L.appendChild(row);
  }
}
function buildSkills() {
  $("skillInfo").innerHTML =
    'Очков навыков: <b style="color:var(--acid);font-size:16px">' +
    P.sp +
    "</b> · 16 навыков в трёх ветках.";
  const L = $("skillList");
  L.innerHTML = "";
  for (const br of ["Выживание", "Бой", "Инженерия"]) {
    const g = document.createElement("div");
    g.className = "skillGroup";
    g.innerHTML = "<h3>" + br + "</h3>";
    for (const s of SKILLS.filter((x) => x.br === br)) {
      const rank = P.skills[s.id],
        row = document.createElement("div");
      row.className = "skillRow";
      let pips = "";
      for (let i = 0; i < s.max; i++)
        pips += '<div class="pip' + (i < rank ? " on" : "") + '"></div>';
      row.innerHTML =
        '<div class="si"><div class="sn">' +
        s.n +
        '</div><div class="sd">' +
        s.d +
        '</div></div><div class="pips">' +
        pips +
        "</div>";
      const b = document.createElement("button");
      b.className = "btn acid";
      b.textContent = "+";
      b.disabled = P.sp <= 0 || rank >= s.max;
      b.onclick = () => {
        P.sp--;
        P.skills[s.id]++;
        if (s.id === "vit") P.hp += 20;
        SFX.level();
        buildSkills();
        refreshHUD();
        saveGame();
      };
      row.appendChild(b);
      g.appendChild(row);
    }
    L.appendChild(g);
  }
}
function buildQuestList() {
  const L = $("questList");
  L.innerHTML = "";
  const mq = mainQuest(),
    list = [];
  if (mq) list.push(mq);
  list.push(...Q.side);
  if (!list.length)
    list.push({
      title: "Вахта продолжается",
      desc: "Запрашивай поручения по радио или у лидеров лагерей.",
      goals: [],
      targets: [],
    });
  for (const q of list) {
    const row = document.createElement("div");
    row.className = "questRow";
    const prog = q.kind === "side" ? Q.sideProg[q.id] : Q.prog;
    row.innerHTML =
      '<div class="qi"><div class="qn">' +
      (q.kind === "side" ? "◇ " : "◆ ") +
      q.title +
      '</div><div class="qd">' +
      q.desc +
      '</div><div class="qd">' +
      q.goals
        .map(
          (g) =>
            goalLabel(g[0], g[1]) +
            " " +
            Math.min((prog && prog[g[0]]) || 0, g[1]) +
            "/" +
            g[1],
        )
        .join(" · ") +
      "</div></div>";
    const b = document.createElement("button");
    b.className =
      "btn small" +
      (Q.tracked === (q.kind === "side" ? q.id : "main") ? " acid" : "");
    b.textContent = "Следить";
    b.onclick = () => {
      Q.tracked = q.kind === "side" ? q.id : "main";
      updateQuestUI();
      buildQuestList();
    };
    row.appendChild(b);
    L.appendChild(row);
  }
  if (baseProj.radio) {
    const b = document.createElement("button");
    b.className = "btn acid";
    b.style.marginTop = "10px";
    b.textContent = "Запросить поручение по радио";
    b.disabled = Q.side.length >= 3;
    b.onclick = () => {
      genSideQuest("radio");
      buildQuestList();
    };
    L.appendChild(b);
  }
}
function buildBase() {
  $("baseInfo").innerHTML =
    "Рубеж · дом Артёма. Улучшения меняют базу реально: ворота, турели, огород, гараж, радио, лазарет.";
  const L = $("baseList");
  L.innerHTML = "";
  for (const id in PROJ) {
    const p = PROJ[id],
      lv = baseProj[id] || 0,
      lock = projLock(id),
      cost = projCost(id, lv),
      row = document.createElement("div");
    row.className = "projRow" + (lock ? " lock" : "");
    let cs = "";
    if (lv < p.max)
      for (const k in cost) {
        const have = countItem(k);
        cs +=
          '<span class="cost"><img class="icon" src="' +
          iconURL(k) +
          '"><span class="' +
          (have >= cost[k] ? "have" : "lack") +
          '">' +
          have +
          "/" +
          cost[k] +
          "</span></span>";
      }
    row.innerHTML =
      '<div class="pi"><div class="pn">' +
      p.n +
      ' <span style="color:var(--acid)">ур.' +
      lv +
      "/" +
      p.max +
      '</span></div><div class="pd">' +
      p.d +
      '</div><div class="costs">' +
      cs +
      "</div>" +
      (lock ? '<div class="lockReason">▸ ' + lock + "</div>" : "") +
      "</div>";
    const b = document.createElement("button");
    b.className = "btn" + (lock ? "" : " acid");
    b.textContent = lv >= p.max ? "MAX" : "Улучшить";
    b.disabled = !!lock;
    b.onclick = () => upgradeBase(id);
    row.appendChild(b);
    L.appendChild(row);
  }
}
function buildCamp() {
  const L = $("campList");
  L.innerHTML = "";
  if (!curCamp) {
    $("campInfo").innerHTML =
      "Подойди к лидеру любого лагеря выживших (синяя метка на карте). Там торговля, улучшения и поручения.";
    return;
  }
  const c = curCamp;
  qEvent("camp", { id: c.id });
  $("campInfo").innerHTML =
    '<b style="color:var(--steel)">' +
    c.name +
    "</b> · лидер " +
    c.leader +
    " · уровень " +
    c.level +
    ' · доверие <b style="color:var(--acid)">' +
    c.trust +
    "</b><br>Улучшения лагеря повышают его безопасность и ассортимент.";
  const acts = document.createElement("div");
  acts.className = "infoBox";
  acts.innerHTML = "<b>Передать припасы:</b><br>";
  for (const [id, n] of [
    ["medkit", 1],
    ["bandage", 1],
    ["can", 3],
    ["fuelcan", 1],
    ["repairkit", 1],
    ["parts", 2],
  ]) {
    const b = document.createElement("button");
    b.className = "btn small";
    b.style.margin = "4px";
    b.textContent = ITEMS[id].n + " ×" + n;
    b.onclick = () => donate(c, id, n);
    acts.appendChild(b);
  }
  const q = document.createElement("button");
  q.className = "btn acid small";
  q.style.margin = "4px";
  q.textContent = "Взять поручение";
  q.disabled = Q.side.length >= 3;
  q.onclick = () => {
    genSideQuest(c);
    buildCamp();
  };
  acts.appendChild(q);
  for (const def of Object.values(RAIDS)) {
    if (
      def.campId !== c.id ||
      Q.main < def.unlockMain ||
      Q.raids[def.id] ||
      Q.side.some((quest) => quest.raid === def.id)
    )
      continue;
    const raidButton = document.createElement("button");
    raidButton.className = "btn acid small";
    raidButton.style.margin = "4px";
    raidButton.textContent = def.title;
    raidButton.disabled = Q.side.length >= 3;
    raidButton.onclick = () => {
      startRaid(c, def.id);
      buildCamp();
    };
    acts.appendChild(raidButton);
  }
  if (countItem("cargo")) {
    const d = document.createElement("button");
    d.className = "btn acid small";
    d.style.margin = "4px";
    d.textContent = "Сдать груз";
    d.onclick = () => {
      removeItem("cargo", 1);
      c.trust += 4;
      OV.set("CAMP" + c.id, c);
      qEvent("deliver", { camp: c.id });
      toast("Груз доставлен. Доверие +4", "quest");
      buildCamp();
    };
    acts.appendChild(d);
  }
  L.appendChild(acts);
  const up = document.createElement("div");
  up.className = "infoBox";
  up.innerHTML = "<b>Улучшения лагеря:</b><br>";
  for (const [id, def] of Object.entries(CAMP_UPGRADES)) {
    const lv = c.proj[id] || 0,
      cost = campUpgradeCost(id, lv),
      costText = Object.entries(cost)
        .map(([item, n]) => ITEMS[item].n + " ×" + n)
        .join(", "),
      line = document.createElement("div"),
      b = document.createElement("button");
    line.style.margin = "6px 0";
    b.className = "btn small";
    b.style.margin = "4px";
    b.textContent = def.name + " ур." + lv;
    b.disabled = !!campUpgradeLock(c, id, countItem);
    b.onclick = () => upgradeCamp(c, id);
    line.appendChild(b);
    line.appendChild(
      document.createTextNode(
        (lv >= 3 ? "максимум" : costText) + " — " + def.description,
      ),
    );
    up.appendChild(line);
  }
  L.appendChild(up);
  const tr = document.createElement("div");
  tr.className = "infoBox";
  tr.innerHTML = "<b>Торговля (за ценности и металл):</b><br>";
  L.appendChild(tr);
  const offers = [
    ["medkit", 1, { item: "valuables", n: 2, trust: 0 }],
    ["fuelcan", 1, { item: "scrap", n: 6, trust: 0 }],
    ["repairkit", 1, { item: "valuables", n: 3, trust: 4 }],
    ["ammo9", 16, { item: "scrap", n: 4, trust: 2 }],
    ["shell", 10, { item: "scrap", n: 5, trust: 4 }],
    ["bp_turret", 1, { item: "valuables", n: 8, trust: 10 }],
  ];
  for (const [id, n, cost] of offers) {
    const row = document.createElement("div");
    row.className = "tradeRow";
    row.innerHTML =
      '<img class="icon" src="' +
      iconURL(id) +
      '"><div class="ti"><div class="tn2">' +
      ITEMS[id].n +
      " ×" +
      n +
      '</div><div class="td2">' +
      ITEMS[cost.item].n +
      " ×" +
      cost.n +
      " · доверие " +
      cost.trust +
      "</div></div>";
    const b = document.createElement("button");
    b.className = "btn small";
    b.textContent = "Обмен";
    b.onclick = () => tradeBuy(c, id, n, cost);
    row.appendChild(b);
    L.appendChild(row);
  }
}
function buildTrunk() {
  const c = curCar || nearestCar(48) || (P.inCar ? CARS.get(P.inCar) : null);
  if (!c) {
    $("trunkInfo").textContent = "Подойди к машине или сядь за руль.";
    $("trunkGrid").innerHTML = "";
    $("trunkInv").innerHTML = "";
    return;
  }
  curCar = c;
  normalizeVehicle(c);
  const def = vehicleDefinition(c.type);
  $("trunkInfo").innerHTML =
    '<b style="color:var(--steel)">' +
    def.name +
    "</b> · топливо " +
    Math.round(c.fuel) +
    "/" +
    c.maxFuel +
    " · прочность " +
    Math.round(c.hp) +
    "/" +
    c.maxHp +
    " · двигатель " +
    Math.round(c.engineHp) +
    "% · колёса " +
    Math.round(c.tireHp) +
    "% · " +
    (c.locked ? "заперт" : "открыт") +
    " · " +
    (c.broken ? "сломан" : "на ходу");
  const g = $("trunkGrid");
  g.innerHTML = "";
  for (let i = 0; i < def.trunkSlots; i++) {
    const s = c.trunk[i],
      cell = document.createElement("div");
    cell.className = "cell" + (s ? " r" + ITEMS[s.id].r : " empty");
    if (s) {
      cell.innerHTML =
        '<img class="icon" src="' +
        iconURL(s.id) +
        '"><span class="n">' +
        s.n +
        "</span>";
      cell.onclick = () => {
        const { added, left } = takeStackFromTrunk(
          c.trunk,
          i,
          inv,
          ITEMS[s.id],
        );
        if (added) qEvent("loot", { id: s.id, n: added });
        if (left) {
          addDrop(P.x, P.y, s.id, left);
          toast("Рюкзак полон", "danger");
        }
        buildTrunk();
      };
    }
    g.appendChild(cell);
  }
  const iv = $("trunkInv");
  iv.innerHTML = "";
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i],
      cell = document.createElement("div");
    cell.className = "cell" + (s ? " r" + ITEMS[s.id].r : " empty");
    if (s) {
      cell.innerHTML =
        '<img class="icon" src="' +
        iconURL(s.id) +
        '"><span class="n">' +
        s.n +
        "</span>";
      cell.onclick = () => {
        if (!moveStackToTrunk(c.trunk, inv, i, def.trunkSlots)) {
          toast("Багажник полон", "danger");
          return;
        }
        buildTrunk();
      };
    }
    iv.appendChild(cell);
  }
}
function buildLog() {
  $("statsGrid").innerHTML = [
    [day, "дней"],
    [stats.kills, "убито"],
    [stats.nests, "рассадников"],
    [stats.pois, "мест"],
    [stats.looted, "добыто"],
    [stats.crafted, "создано"],
    [stats.sieges, "осад"],
    [Math.round(stats.drive) + "м", "за рулём"],
  ]
    .map(
      (s) =>
        '<div class="stat"><div class="sv">' +
        s[0] +
        '</div><div class="sk">' +
        s[1] +
        "</div></div>",
    )
    .join("");
  $("logList").innerHTML = J.slice()
    .reverse()
    .map(
      (e) =>
        '<div class="logEntry"><div class="ld">ДЕНЬ ' +
        e.d +
        '</div><div class="lt">' +
        e.t +
        '</div><div class="lx">' +
        e.x +
        "</div></div>",
    )
    .join("");
}
function buildHotbar() {
  const hb = $("hotbar");
  hb.innerHTML = "";
  HOT.forEach((w, i) => {
    const s = document.createElement("div");
    s.className = "hslot";
    s.dataset.w = w;
    s.innerHTML =
      '<span class="k">' +
      (i + 1) +
      '</span><img class="icon" src="' +
      iconURL(w) +
      '"><span class="am"></span><i class="rlbar"></i>';
    s.onclick = () => equip(w);
    s.onmouseenter = (e) =>
      showTip(
        '<div class="tn" style="color:var(--amber)">' +
          WEAPONS[w].n +
          '</div><div class="td">' +
          WEAPONS[w].d +
          "</div>",
        e.clientX,
        e.clientY - 70,
      );
    s.onmouseleave = hideTip;
    hb.appendChild(s);
  });
  const sep = document.createElement("div");
  sep.className = "hsep";
  hb.appendChild(sep);
  const q = document.createElement("div");
  q.className = "hslot qs";
  q.id = "qSlot";
  q.innerHTML =
    '<span class="k">Q</span><img class="icon" src="' +
    iconURL("bandage") +
    '"><span class="am"></span>';
  q.onclick = quickHeal;
  hb.appendChild(q);
  refreshHotbar();
}
function refreshHotbar() {
  document.querySelectorAll(".hslot[data-w]").forEach((s) => {
    const w = s.dataset.w;
    s.classList.toggle("on", P.weapon === w);
    s.classList.toggle("lock", !P.owned[w]);
    const am = s.querySelector(".am");
    am.textContent = P.mags[w] + "/" + countItem(WEAPONS[w].ammo);
    am.classList.toggle("empty", P.mags[w] === 0);
    s.querySelector(".rlbar").style.width =
      (P.weapon === w && P.rl > 0 ? 100 * (1 - P.rl / (P.rlMax || 1)) : 0) +
      "%";
  });
  const q = $("qSlot");
  if (q) {
    const b = countItem("bandage"),
      m = countItem("medkit");
    q.querySelector("img").src = iconURL(m && !b ? "medkit" : "bandage");
    q.querySelector(".am").textContent = b + m;
  }
}
function buildResRow() {
  $("resRow").innerHTML = [
    "wood",
    "scrap",
    "cloth",
    "chem",
    "elec",
    "fuel",
    "parts",
    "valuables",
    "can",
  ]
    .map(
      (id) =>
        '<div class="res"><img class="icon" src="' +
        iconURL(id) +
        '"><span id="res-' +
        id +
        '">0</span></div>',
    )
    .join("");
}
function refreshHUD() {
  if (!P) return;
  $("hpF").style.width = clamp((P.hp / maxHp()) * 100, 0, 100) + "%";
  $("hpT").textContent = Math.ceil(P.hp) + " / " + maxHp();
  $("stF").style.width = clamp((P.st / maxSt()) * 100, 0, 100) + "%";
  $("huF").style.width = clamp(P.hu, 0, 100) + "%";
  $("arRow").classList.toggle("hid", P.armor <= 0);
  $("arF").style.width = clamp((P.armor / 60) * 100, 0, 100) + "%";
  $("lvlT").textContent = "УР." + P.lvl;
  $("xpF").style.width = clamp((P.xp / xpNeed(P.lvl)) * 100, 0, 100) + "%";
  $("spChip").classList.toggle("hid", P.sp <= 0);
  $("spChip").textContent = "+" + P.sp + " НАВЫК";
  $("fxHp").classList.toggle(
    "low",
    P.hp < maxHp() * 0.28 && (state === "play" || state === "floor"),
  );
  $("fxPoison").style.opacity = P.poison > 0 ? 0.7 : 0;
  const hh = Math.floor(tod),
    m = Math.floor((tod - hh) * 60);
  $("dayT").textContent = "ДЕНЬ " + day;
  $("clockT").textContent =
    (hh < 10 ? "0" : "") + hh + ":" + (m < 10 ? "0" : "") + m;
  $("dayIco").textContent = darkness() > 0.3 ? "☾" : "☀";
  $("timeChip").classList.toggle("night", darkness() > 0.3);
  for (const id of [
    "wood",
    "scrap",
    "cloth",
    "chem",
    "elec",
    "fuel",
    "parts",
    "valuables",
    "can",
  ]) {
    const e = $("res-" + id);
    if (e) e.textContent = countItem(id);
  }
  refreshHotbar();
  const fire = SMAP.get("16,16"),
    near = inBase(P.x, P.y) || siege;
  $("coreChip").classList.toggle("hid", !near || !fire);
  if (fire) {
    $("coreF").style.width = clamp((fire.hp / fire.max) * 100, 0, 100) + "%";
    $("coreLabel").textContent = siege
      ? "РУБЕЖ · ОСАДА"
      : inBase(P.x, P.y)
        ? "РУБЕЖ · БЕЗОПАСНО"
        : "РУБЕЖ";
    $("coreChip").classList.toggle("safe", inBase(P.x, P.y) && !siege);
    $("coreChip").classList.toggle("danger", !!siege);
  }
  $("carHud").classList.toggle("hid", !P.inCar);
  if (P.inCar) {
    const c = CARS.get(P.inCar);
    $("carName").textContent = vehicleDefinition(c.type).name;
    $("carSpeed").textContent = Math.round(Math.abs(c.speed) * 0.9);
    $("carFuel").style.width = (c.fuel / c.maxFuel) * 100 + "%";
    $("carHp").style.width = (c.hp / c.maxHp) * 100 + "%";
    $("carEngine").textContent = Math.round(c.engineHp);
    $("carTires").textContent = Math.round(c.tireHp);
  }
  $("resRow").classList.toggle("hid", !!P.inCar);
}
function buildBuildBar() {
  const bar = $("buildBar");
  bar.innerHTML = "";
  let i = 1;
  for (const t in BUILDS) {
    const B = BUILDS[t],
      lock = buildLocked(t),
      cost = buildCost(t),
      card = document.createElement("div");
    card.className =
      "bcard" + (buildSel === t ? " on" : "") + (lock ? " lock" : "");
    let cs = "";
    for (const k in cost) {
      const have = countItem(k);
      cs +=
        '<span class="' +
        (have >= cost[k] ? "have" : "lack") +
        '">' +
        ITEMS[k].n.slice(0, 4) +
        " " +
        have +
        "/" +
        cost[k] +
        "</span> ";
    }
    card.innerHTML =
      '<div class="bk">[' +
      i +
      ']</div><img class="icon" src="' +
      structURL(t) +
      '"><div class="bn">' +
      B.n +
      '</div><div class="bc">' +
      cs +
      "</div>" +
      (lock ? '<div class="bl">▸ ' + lock + "</div>" : "");
    card.onclick = () => {
      buildSel = buildSel === t ? null : t;
      buildBuildBar();
      SFX.ui();
    };
    bar.appendChild(card);
    i++;
  }
}
function toggleBuild() {
  if (state !== "play" || P.inCar) return;
  if (buildSel !== null || !$("buildBar").classList.contains("hid")) {
    buildSel = null;
    $("buildBar").classList.add("hid");
    $("buildHint").classList.add("hid");
    $("hotbar").classList.remove("hid");
  } else {
    buildSel = "barricade";
    buildBuildBar();
    $("buildBar").classList.remove("hid");
    $("buildHint").classList.remove("hid");
    $("hotbar").classList.add("hid");
    SFX.ui();
  }
}
function paintMapTo(g, span, cell, view = null) {
  const width = g.canvas.width,
    height = g.canvas.height,
    center = view?.center || {
      x: P.x / (CELL * 16),
      y: P.y / (CELL * 16),
    },
    pcx = Math.floor(center.x),
    pcy = Math.floor(center.y),
    halfX = Math.ceil(width / cell / 2) + 1,
    halfY = Math.ceil(height / cell / 2) + 1,
    screen = (x, y) => ({
      x: width / 2 + (x - center.x) * cell,
      y: height / 2 + (y - center.y) * cell,
    });
  const mapScale = cell / (CELL * 16),
    mapCamera = { x: center.x * CELL * 16, y: center.y * CELL * 16 };
  renderOsmMap({
    ctx: g,
    world: OSM_CITY.gameWorld,
    cam: mapCamera,
    W: width,
    H: height,
    SC: mapScale,
    w2s: (x, y) => ({
      x: width / 2 + (x - mapCamera.x) * mapScale,
      y: height / 2 + (y - mapCamera.y) * mapScale,
    }),
  });
  for (let dy = -halfY; dy <= halfY; dy++)
    for (let dx = -halfX; dx <= halfX; dx++) {
      const bx = pcx + dx,
        by = pcy + dy,
        p = planBlock(bx, by),
        s = screen(bx + 0.5, by + 0.5),
        px = s.x - cell / 2,
        py = s.y - cell / 2,
        ex = EX.has(p.k) || p.special || p.camp;
      if (ex) {
        const col = p.camp
          ? "#24404a"
          : p.nest
            ? "#39511b"
            : p.special === "base"
              ? "#4a3a28"
              : p.district === "industrial"
                ? "#3a3a32"
                : p.district === "commercial"
                  ? "#403828"
                  : p.district === "civic"
                    ? "#344048"
                    : "#2c3826";
        g.fillStyle = col;
        g.globalAlpha = 0.22;
        g.fillRect(px + 1, py + 1, cell - 1, cell - 1);
        g.globalAlpha = 1;
        if (p.buildings.length) {
          g.fillStyle = "#ffb23e";
          g.fillRect(s.x - 1, s.y - 1, 3, 3);
        }
        if (p.nest && !OV.get("D" + p.k)) {
          g.fillStyle = "#a6e83c";
          g.fillRect(s.x - 2, s.y - 2, 5, 5);
        }
        if (p.camp) {
          g.fillStyle = "#7fb8d8";
          g.fillRect(s.x - 2, s.y - 2, 5, 5);
        }
        if (view && p.name && cell >= 30) {
          g.fillStyle = "#d9cba6";
          g.font = "8px monospace";
          g.textAlign = "center";
          g.fillText(p.name, s.x, s.y + cell / 2 - 5, cell * 1.8);
          g.textAlign = "start";
        }
      }
    }
  if (view)
    for (const car of CARS.values()) {
      if (car.dead) continue;
      const s = screen(car.x / (CELL * 16), car.y / (CELL * 16));
      g.fillStyle = "#ffb23e";
      g.fillRect(s.x - 3, s.y - 2, 6, 4);
    }
  const q = trackedQuest();
  if (q && q.targets)
    for (const t of q.targets) {
      const s = screen(t.bx + 0.5, t.by + 0.5),
        p = 2 + Math.sin(performance.now() / 200) * 1.5;
      g.strokeStyle = "#ece5d0";
      g.lineWidth = 2;
      g.strokeRect(s.x - 4 - p, s.y - 4 - p, 8 + p * 2, 8 + p * 2);
    }
  const waypoint = mapController.getState().waypoint;
  if (waypoint) {
    const s = screen(waypoint.x, waypoint.y);
    g.strokeStyle = "#e58cff";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.x, s.y - 7);
    g.lineTo(s.x + 7, s.y);
    g.lineTo(s.x, s.y + 7);
    g.lineTo(s.x - 7, s.y);
    g.closePath();
    g.stroke();
  }
  if (siege) {
    const s = screen(0.5, 0.5),
      p = 3 + Math.sin(performance.now() / 150) * 2;
    g.strokeStyle = "#e04338";
    g.strokeRect(s.x - 6 - p, s.y - 6 - p, 12 + p * 2, 12 + p * 2);
  }
  const player = screen(P.x / (CELL * 16), P.y / (CELL * 16));
  g.save();
  g.translate(player.x, player.y);
  g.rotate(P.aim);
  g.fillStyle = "#a6e83c";
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(-4, -4);
  g.lineTo(-4, 4);
  g.closePath();
  g.fill();
  g.restore();
}
function drawMinimap() {
  if (currentFloorId !== "outdoor") {
    mm.fillStyle = "#0a0c09";
    mm.fillRect(0, 0, mm.canvas.width, mm.canvas.height);
    mm.fillStyle = "#d9cba6";
    mm.font = "10px monospace";
    mm.fillText(FLOOR_SCENE.name, 6, 18);
    return;
  }
  if (P) paintMapTo(mm, 9, 17);
}
function mapCanvasPoint(point) {
  const view = mapController.getState(),
    cell = 24 * view.zoom;
  return {
    x: view.center.x + (point.x - bm.canvas.width / 2) / cell,
    y: view.center.y + (point.y - bm.canvas.height / 2) / cell,
  };
}
function selectMapFloor(direction) {
  if (!FLOOR_SCENE) return;
  const floors = Object.keys(FLOOR_DEFINITIONS[FLOOR_SCENE.buildingId]),
    index = floors.indexOf(mapFloorId),
    next = clamp(index + direction, 0, floors.length - 1);
  mapFloorId = floors[next];
  mapFloorScene = createFloorScene(FLOOR_SCENE.buildingId, mapFloorId);
  drawBigmap();
}
function drawBigmap() {
  $("mapFloorNav").classList.toggle("hid", currentFloorId === "outdoor");
  if (currentFloorId !== "outdoor") {
    const scene = mapFloorScene || FLOOR_SCENE;
    bm.fillStyle = "#0a0c09";
    bm.fillRect(0, 0, bm.canvas.width, bm.canvas.height);
    for (let y = 0; y < scene.h; y++)
      for (let x = 0; x < scene.w; x++)
        bm.drawImage(TI[floorTileAt(scene, x, y)], x * 16 + 72, y * 16 + 56);
    bm.fillStyle = "#d9cba6";
    bm.font = "14px monospace";
    bm.fillText(scene.name, 72, 34);
    $("mapFloorName").textContent = scene.name;
    $("mapDistrict").textContent =
      FLOOR_SCENE.name + " · просмотр: " + scene.name;
    $("seedShow").textContent = SEED;
    return;
  }
  const view = mapController.getState();
  paintMapTo(bm, 21, 24 * view.zoom, view);
  const district = districtDefinition(
    districtOf(
      Math.floor(P.x / (CELL * 16)),
      Math.floor(P.y / (CELL * 16)),
      SEED,
    ),
  );
  $("mapDistrict").textContent =
    district.name +
    " · опасность ×" +
    district.danger +
    " · добыча: " +
    district.loot.map(([id]) => ITEMS[id].n).join(", ") +
    " · масштаб ×" +
    view.zoom.toFixed(2) +
    (mapHoverName ? " · " + mapHoverName : "") +
    (view.waypoint ? " · метка установлена" : "");
  const raidRules = currentRaidRules();
  if (raidRules) $("mapDistrict").textContent += " · " + raidRules.label;
  $("seedShow").textContent = SEED;
}
function openMap() {
  if (state !== "play" && state !== "floor") return;
  mapReturnState = state;
  mapFloorId = currentFloorId === "outdoor" ? "ground" : currentFloorId;
  mapFloorScene = FLOOR_SCENE;
  mapHoverName = "";
  mapController.panBy(
    P.x / (CELL * 16) - mapController.getState().center.x,
    P.y / (CELL * 16) - mapController.getState().center.y,
  );
  state = "map";
  mouse.down = false;
  $("mapOv").classList.remove("hid");
  $("pauseChip").classList.remove("hid");
  drawBigmap();
  SFX.ui();
}
function closeMap() {
  $("mapOv").classList.add("hid");
  $("pauseChip").classList.add("hid");
  if (state === "map") state = mapReturnState;
}
function openPause() {
  if (state !== "play" && state !== "floor") return;
  pauseReturnState = state;
  state = "pause";
  mouse.down = false;
  $("pauseOv").classList.remove("hid");
  $("pauseChip").classList.remove("hid");
  saveGame();
  SFX.ui();
}
function closePause() {
  $("pauseOv").classList.add("hid");
  $("pauseChip").classList.add("hid");
  if (state === "pause") state = pauseReturnState;
}
function showEnding() {
  state = "ending";
  setBody("ending");
  mouse.down = false;
  $("endText").innerHTML =
    "<p>" +
    MAIN[MAIN.length - 1].story +
    '</p><p style="color:var(--acid)">Кампания завершена. Дальше — бесконечная вахта: поручения лагерей, новые рассадники, зачистки, грузы и рейды. Город продолжает жить.</p>';
  $("endStats").innerHTML = miniStats();
  $("endOv").classList.remove("hid");
  SFX.level();
  saveGame();
}
function ctrlHTML() {
  return CTRLS.map((c) => "<div><b>" + c[0] + "</b> " + c[1] + "</div>").join(
    "",
  );
}
const SKEY = "ashfall_v4_city";
const LEGACY_SKEY = "ashfall_v3_city";
function saveGame(dead) {
  if (!P || state === "menu" || state === "home") return;
  try {
    if (P.inCar) {
      const c = CARS.get(P.inCar);
      if (c)
        OV.set("CAR" + c.id, {
          x: c.x,
          y: c.y,
          angle: c.angle,
          fuel: c.fuel,
          hp: c.hp,
          engineHp: c.engineHp,
          tireHp: c.tireHp,
          locked: c.locked,
          broken: c.broken,
          dead: c.dead,
          trunk: c.trunk,
          speed: 0,
        });
    }
    const data = createSaveData({
      seed: SEED,
      diff: DIFFK,
      day,
      tod,
      playT,
      timeSpeed,
      lastSiegeDay,
      siegeWarnDay,
      dead: !!dead,
      gateOpen,
      P,
      floor: FLOOR_SCENE
        ? {
            buildingId: FLOOR_SCENE.buildingId,
            floorId: currentFloorId,
            return: floorReturn,
          }
        : null,
      inv,
      invSlots,
      hasSpear,
      learned,
      bench,
      Q,
      baseProj,
      OV,
      SMAP,
      EX,
      CARS,
      CAMPS,
      stats,
      J,
    });
    localStorage.setItem(SKEY, JSON.stringify(data));
    const c = $("saveChip");
    c.classList.add("show");
    setTimeout(() => c.classList.remove("show"), 1200);
  } catch (e) {}
}
function hasSave() {
  try {
    const raw = localStorage.getItem(SKEY) || localStorage.getItem(LEGACY_SKEY);
    return !!raw && parseSave(raw).city === CITY_ID;
  } catch (e) {
    return false;
  }
}
function wipeSave() {
  try {
    localStorage.removeItem(SKEY);
    localStorage.removeItem(LEGACY_SKEY);
  } catch (e) {}
}
function loadGame() {
  let d;
  try {
    const raw = localStorage.getItem(SKEY) || localStorage.getItem(LEGACY_SKEY);
    if (!raw) return false;
    d = parseSave(raw);
    if (d.city !== CITY_ID) return false;
  } catch (e) {
    return false;
  }
  SEED = d.seed;
  DIFFK = d.diff;
  DIFF = DIFFS[DIFFK];
  chunks.clear();
  visChunks = [];
  PLAN.clear();
  CMAP.clear();
  SMAP.clear();
  OV.clear();
  EX.clear();
  CARS.clear();
  CAR_GRID.clear();
  CAMPS.clear();
  NPCS.length = 0;
  for (const [k, v] of d.OV) OV.set(k, v);
  for (const [k, v] of d.SM) SMAP.set(k, v);
  for (const k of d.EX) EX.add(k);
  for (const [k, v] of d.cars) {
    if (!v.trunk) v.trunk = [];
    normalizeVehicle(v);
    CARS.set(k, v);
    carGridAdd(v);
  }
  for (const [k, v] of d.camps) CAMPS.set(k, v);
  day = d.day;
  tod = d.tod;
  playT = d.playT || 0;
  timeSpeed = d.timeSpeed || 1;
  lastSiegeDay = d.lastSiegeDay || 0;
  siegeWarnDay = d.siegeWarnDay || 0;
  bench = d.bench;
  learned = new Set(d.learned);
  inv = d.inv;
  invSlots = d.invSlots || 30;
  hasSpear = d.hasSpear;
  Q = d.Q;
  Q.sideProg = Q.sideProg || {};
  Q.raids = Q.raids || {};
  baseProj = d.baseProj;
  stats = d.stats;
  J = d.J || [];
  gateOpen = d.gateOpen;
  P = d.P;
  floorReturn = d.floor?.return || null;
  if (d.floor?.buildingId) {
    currentFloorId = d.floor.floorId;
    setFloorScene(createFloorScene(d.floor.buildingId, currentFloorId));
  } else {
    currentFloorId = "outdoor";
    FLOOR_SCENE = null;
    FLOOR_CONTAINERS = new Map();
    collisionContext.containers = CMAP;
  }
  P.iframe = 1;
  P.poison = 0;
  P.cd = 0;
  P.rl = 0;
  P.rlMax = P.rlMax || 1;
  P.meleeCd = 0;
  P.stDelay = 0;
  P.emptyT = 0;
  P.inCar = null;
  Z.length = 0;
  PR.length = 0;
  PT.length = 0;
  DR.length = 0;
  CL.length = 0;
  TX.length = 0;
  LG.length = 0;
  VFX.length = 0;
  siege = null;
  searching = null;
  buildSel = null;
  curCamp = null;
  curCar = null;
  driveAcc = 0;
  $("siegeB").classList.add("hid");
  $("buildBar").classList.add("hid");
  $("buildHint").classList.add("hid");
  $("hotbar").classList.remove("hid");
  cam.x = P.x;
  cam.y = P.y;
  applyBaseProjects();
  buildHotbar();
  buildResRow();
  updateQuestUI();
  refreshHUD();
  const mode = resolveLoadMode(d, MAIN.length);
  if (mode === "dead") {
    state = "play";
    setBody("play");
    respawn();
  } else if (mode === "ending") {
    showEnding();
  } else {
    state = FLOOR_SCENE ? "floor" : "play";
    setBody("play");
  }
  return true;
}
function initGame(seed, diffK) {
  SEED = seed;
  DIFFK = diffK;
  DIFF = DIFFS[diffK];
  currentFloorId = "outdoor";
  FLOOR_SCENE = null;
  FLOOR_CONTAINERS = new Map();
  floorReturn = null;
  collisionContext.containers = CMAP;
  chunks.clear();
  visChunks = [];
  PLAN.clear();
  CMAP.clear();
  SMAP.clear();
  OV.clear();
  EX.clear();
  CARS.clear();
  CAR_GRID.clear();
  CAMPS.clear();
  NPCS.length = 0;
  day = 1;
  tod = 21.7;
  playT = 0;
  lastSiegeDay = 0;
  siegeWarnDay = 0;
  bench = 1;
  invSlots = 30;
  hasSpear = false;
  learned = new Set();
  resetStats();
  resetPlayer();
  Q = {
    main: 0,
    side: [],
    sideProg: {},
    tracked: "main",
    prog: {},
    given: {},
    endless: false,
    sideSeq: 0,
    raids: {},
    forcedSiege: 0,
  };
  J = [];
  baseProj = {
    wall: 0,
    workshop: 0,
    garden: 0,
    tower: 0,
    garage: 0,
    radio: 0,
    clinic: 0,
  };
  nightToasted = false;
  deathCause = "";
  driveAcc = 0;
  initBase();
  for (const key of OSM_CITY.specials.keys()) EX.add(key);
  cam.x = BASEX;
  cam.y = BASEY;
  Z.length = 0;
  PR.length = 0;
  PT.length = 0;
  DR.length = 0;
  CL.length = 0;
  TX.length = 0;
  LG.length = 0;
  VFX.length = 0;
  buildSel = null;
  curCamp = null;
  curCar = null;
  $("siegeB").classList.add("hid");
  $("buildBar").classList.add("hid");
  $("buildHint").classList.add("hid");
  $("hotbar").classList.remove("hid");
  buildHotbar();
  buildResRow();
  refreshHUD();
}
function startAttract() {
  state = "menu";
  setBody("menu");
  $("menuOv").classList.remove("hid");
  $("btnContinue").classList.toggle("hid", !hasSave());
  initGame((rnd() * 1e9) | 0, "easy");
  tod = 17.6;
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2,
      r = (30 + rnd() * 8) * 16,
      x = BASEX + Math.cos(a) * r,
      y = BASEY + Math.sin(a) * r;
    if (!solidAt(Math.floor(x / 16), Math.floor(y / 16)))
      spawnZ("walker", x, y);
  }
}
function newGame() {
  const sv = $("seedInp").value.trim(),
    seed = sv ? hashStr(sv) : (rnd() * 1e9) | 0;
  initGame(seed, newDiff);
  buildHome();
  state = "home";
  setBody("home");
  $("menuOv").classList.add("hid");
  homeObjective();
  say(
    [
      {
        text: "21:47. Дождь за окном. Я — Артём Вересов, бывший тренер по стрельбе из лука. Зал закрылся год назад.",
      },
      {
        who: "РАДИО",
        text: "«…вспышка над промышленной зоной… оставайтесь дома… не открывайте двери…» — и помехи.",
      },
      {
        text: "Сирены воют третий раз за вечер. Надо посмотреть в окно.",
      },
    ],
    () => homeObjective(),
  );
}
function keyAction(code) {
  if (state === "home") {
    if (["KeyE", "Space", "Enter"].includes(code)) {
      DL.active ? advanceDialog() : homeInteract();
    }
    return;
  }
  if (state === "play" || state === "floor") {
    if (code === "KeyE") doInteract();
    else if (code === "KeyR") {
      if (P.inCar) repairCar(CARS.get(P.inCar));
      else startReload();
    } else if (code === "KeyQ") quickHeal();
    else if (code === "KeyF") {
      if (P.inCar || nearestCar(40)) {
        const c = P.inCar ? CARS.get(P.inCar) : nearestCar(40);
        refuelCar(c);
      } else {
        P.flash = !P.flash;
        toast("Фонарь: " + (P.flash ? "ВКЛ" : "ВЫКЛ"), "info");
      }
    } else if (code === "Space" && !P.inCar) melee();
    else if (code === "KeyG") throwMolotov();
    else if (code === "KeyH" && P.inCar) {
      SFX.horn();
      alertNoise(P.x, P.y, 22 * 16);
    } else if (code === "KeyT") {
      const c = P.inCar ? CARS.get(P.inCar) : nearestCar(48);
      if (c) {
        curCar = c;
        openPanel("trunk");
      } else toast("Нет машины рядом", "info");
    } else if (code === "KeyX") tryRemove();
    else if (code === "KeyB") toggleBuild();
    else if (code === "Tab" || code === "KeyI") openPanel("inv");
    else if (code === "KeyC") openPanel("craft");
    else if (code === "KeyK") openPanel("skill");
    else if (code === "KeyJ") openPanel("quest");
    else if (code === "KeyM") openMap();
    else if (code === "Escape") {
      if (buildSel !== null || !$("buildBar").classList.contains("hid"))
        toggleBuild();
      else openPause();
    } else if (code.startsWith("Digit")) {
      const n = +code.slice(5);
      if (n >= 1 && n <= 6) {
        if (buildSel !== null || !$("buildBar").classList.contains("hid")) {
          const ts = Object.keys(BUILDS);
          if (ts[n - 1]) {
            buildSel = ts[n - 1];
            buildBuildBar();
          }
        } else equip(HOT[n - 1]);
      }
    }
  } else if (state === "panel") {
    if (code === "Escape" || code === "Tab" || code === "KeyI") closePanel();
    else if (code === "KeyC") setTab("craft");
    else if (code === "KeyK") setTab("skill");
    else if (code === "KeyJ") setTab("quest");
  } else if (state === "map") {
    if (code === "Escape" || code === "KeyM") closeMap();
  } else if (state === "pause") {
    if (code === "Escape") closePause();
  }
}
window.addEventListener("keydown", (e) => {
  if (document.activeElement && document.activeElement.tagName === "INPUT")
    return;
  if (
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    e.preventDefault();
  keys[e.code] = true;
  if (!e.repeat) keyAction(e.code);
});
window.addEventListener("keyup", (e) => (keys[e.code] = false));
attachMapInteractions({
  canvas: $("bmap"),
  controller: mapController,
  cellSize: () => 24 * mapController.getState().zoom,
  isEnabled: () => state === "map" && currentFloorId === "outdoor",
  onSelect: (point) => {
    const target = mapCanvasPoint(point);
    mapController.setWaypoint({ ...target, label: "Метка" });
    drawBigmap();
  },
  onClear: () => {
    mapController.clearWaypoint();
    drawBigmap();
  },
  onHover: (point) => {
    const target = mapCanvasPoint(point),
      block = planBlock(Math.floor(target.x), Math.floor(target.y));
    mapHoverName = block.name || "";
    for (const car of CARS.values()) {
      if (
        !car.dead &&
        Math.hypot(
          car.x / (CELL * 16) - target.x,
          car.y / (CELL * 16) - target.y,
        ) < 0.3
      )
        mapHoverName = vehicleDefinition(car.type).name;
    }
  },
});
$("mmap").addEventListener("click", openMap);
$("mapFloorPrev").onclick = () => selectMapFloor(-1);
$("mapFloorNext").onclick = () => selectMapFloor(1);
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener("mousedown", (e) => {
  AU.init();
  AU.resume();
  if (
    e.target.closest(
      "button,.cell,.hslot,.bcard,.tab,.mpanel,#panel,#touch,#dialog",
    )
  )
    return;
  if (e.button === 0) {
    if (state === "home" && DL.active) {
      advanceDialog();
      return;
    }
    if (state === "play" || state === "floor") {
      if (buildSel) {
        const w = screenToWorld(mouse.x, mouse.y);
        tryPlace(Math.floor(w.x / 16), Math.floor(w.y / 16));
      } else mouse.down = true;
    }
  } else if (
    e.button === 2 &&
    (state === "play" || state === "floor") &&
    buildSel !== null
  )
    toggleBuild();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouse.down = false;
});
window.addEventListener("contextmenu", (e) => {
  if (state === "play" || state === "floor") e.preventDefault();
});
window.addEventListener(
  "wheel",
  (e) => {
    if (state !== "play" || buildSel || P.inCar) return;
    const owned = HOT.filter((w) => P.owned[w]);
    if (owned.length < 2) return;
    let i = owned.indexOf(P.weapon);
    equip(owned[mod(i + (e.deltaY > 0 ? 1 : -1), owned.length)]);
  },
  { passive: true },
);
window.addEventListener("blur", () => {
  if (state === "play" || state === "floor") openPause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (state === "play" || state === "floor")) openPause();
});
window.addEventListener("beforeunload", () => {
  if (["play", "panel", "pause", "map"].includes(state)) saveGame();
});
const isTouch = "ontouchstart" in window;
let stickId = null,
  stickVec = { x: 0, y: 0 },
  aimId = null;
if (isTouch) {
  $("touch").classList.remove("hid");
  const st = $("stick");
  st.onpointerdown = (e) => {
    stickId = e.pointerId;
    st.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  st.onpointermove = (e) => {
    if (e.pointerId !== stickId) return;
    const r = st.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2),
      dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    stickVec = { x: dx, y: dy };
    st.firstElementChild.style.transform =
      "translate(" + dx * 28 + "px," + dy * 28 + "px)";
  };
  const es = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      stickVec = { x: 0, y: 0 };
      st.firstElementChild.style.transform = "none";
    }
  };
  st.onpointerup = es;
  st.onpointercancel = es;
  cv.onpointerdown = (e) => {
    if (e.pointerType !== "touch") return;
    AU.init();
    AU.resume();
    if (state === "home" && DL.active) {
      advanceDialog();
      return;
    }
    if (state === "play" || state === "floor") {
      aimId = e.pointerId;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (buildSel) {
        const w = screenToWorld(mouse.x, mouse.y);
        tryPlace(Math.floor(w.x / 16), Math.floor(w.y / 16));
      } else mouse.down = true;
    }
  };
  cv.onpointermove = (e) => {
    if (e.pointerId === aimId) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
  };
  const ea = (e) => {
    if (e.pointerId === aimId) {
      aimId = null;
      mouse.down = false;
    }
  };
  cv.onpointerup = ea;
  cv.onpointercancel = ea;
  document.querySelectorAll("#tbtns button").forEach(
    (b) =>
      (b.onpointerdown = (e) => {
        e.preventDefault();
        AU.init();
        keyAction(b.dataset.k);
      }),
  );
}
$("muteBtn").onclick = () => {
  AU.init();
  AU.resume();
  AU.mute(!AU.muted);
};
$("btnNew").onclick = () => {
  AU.init();
  AU.resume();
  SFX.ui();
  newGame();
};
$("btnContinue").onclick = () => {
  AU.init();
  AU.resume();
  if (loadGame()) {
    $("menuOv").classList.add("hid");
    if (state === "play" || state === "floor")
      toast("Вахта продолжается. День " + day + ".", "quest");
    SFX.quest();
  } else startAttract();
};
$("btnSkip").onclick = () => {
  AU.init();
  AU.resume();
  skipPrologue();
};
$("dialog").onclick = () => {
  AU.init();
  AU.resume();
  advanceDialog();
};
document.querySelectorAll("#diffSeg button").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("#diffSeg button")
        .forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      newDiff = b.dataset.d;
      SFX.ui();
    }),
);
document
  .querySelectorAll(".tab")
  .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
$("panelX").onclick = closePanel;
$("spChip").onclick = () => openPanel("skill");
$("btnResume").onclick = closePause;
$("speedSel").onchange = (e) => (timeSpeed = +e.target.value);
$("btnRestart").onclick = () => {
  if (confirm("Начать заново?")) {
    wipeSave();
    closePause();
    newGame();
  }
};
$("btnToMenu").onclick = () => {
  saveGame();
  closePause();
  startAttract();
};
$("btnRespawn").onclick = respawn;
$("btnDeathMenu").onclick = () => {
  $("deathOv").classList.add("hid");
  startAttract();
};
$("btnEndless").onclick = () => {
  $("endOv").classList.add("hid");
  Q.endless = true;
  Q.side = [];
  genSideQuest("radio");
  genSideQuest("radio");
  genSideQuest("radio");
  state = "play";
  setBody("play");
  toast("БЕСКОНЕЧНАЯ ВАХТА", "epic");
  saveGame();
};
$("menuCtrlGrid").innerHTML = ctrlHTML();
$("pauseCtrls").innerHTML = ctrlHTML();
function screenToWorld(sx, sy) {
  return toWorld(sx, sy, cam, W, H, SC);
}
function w2s(x, y) {
  return toScreen(x, y, cam, W, H, SC);
}
function resize() {
  W = innerWidth;
  H = innerHeight;
  cv.width = W * RES;
  cv.height = H * RES;
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.imageSmoothingEnabled = false;
  LC.width = W;
  LC.height = H;
  ash = [];
  for (let i = 0; i < 60; i++)
    ash.push({
      x: rnd() * W,
      y: rnd() * H,
      s: ri(1, 3),
      v: ri(8, 24),
      a: 0.07 + rnd() * 0.18,
      ph: rnd() * 6,
    });
}
window.addEventListener("resize", resize);
function drawWeaponOverlay() {
  renderWeapon({ ctx, P, S, SC });
}
const renderWorld = createWorldRenderer({
  ctx,
  lx,
  LC,
  SC,
  cam,
  getW: () => W,
  getH: () => H,
  getShake: () => shake,
  rnd,
  getChunk,
  setVisChunks: (next) => (visChunks = next),
  S,
  ICONS,
  ITEMS,
  DR,
  PR,
  CL,
  PT,
  TX,
  ash,
  SMAP,
  CAMPS,
  CARS,
  NPCS,
  Z,
  getState: () => state,
  getP: () => P,
  getBuildSel: () => buildSel,
  mouse,
  screenToWorld,
  solidAt,
  tileAt,
  buildLocked,
  mainQuest,
  getSearching: () => searching,
  getBench: () => bench,
  carSpriteKey,
  drawWeaponOverlay,
  darkness,
  questTargetWorld,
  isTouch,
  getRecoil: () => recoil,
  w2s,
  LG,
  VFX,
  VFX_ASSETS,
});
function render() {
  if (state === "home") {
    renderHome();
    return;
  }
  if (state === "floor") {
    renderFloor({
      ctx,
      scene: FLOOR_SCENE,
      containers: FLOOR_CONTAINERS,
      TI,
      S,
      SC,
      W,
      H,
      P,
      Z: Z.filter((zombie) => (zombie.floorId || "outdoor") === currentFloorId),
      now: performance.now() / 1000,
      w2s,
      drawWeaponOverlay,
      PR,
      PT,
      TX,
      rnd,
    });
    return;
  }
  renderWorld();
}
function update(dt) {
  playT += dt;
  energyT = Math.max(0, energyT - dt);
  recoil = Math.max(0, recoil - dt * 30);
  shake = Math.max(0, shake - dt * 22);
  updateTime(dt);
  while (tut.length && playT >= tut[0][0]) toast(tut.shift()[1], "info");
  if (P.inCar) {
    updateCars(dt);
    if (driveAcc >= 20) {
      qEvent("drive", { m: driveAcc });
      driveAcc = 0;
    }
  } else {
    let mx = 0,
      my = 0;
    if (keys.KeyW || keys.ArrowUp) my--;
    if (keys.KeyS || keys.ArrowDown) my++;
    if (keys.KeyA || keys.ArrowLeft) mx--;
    if (keys.KeyD || keys.ArrowRight) mx++;
    if (isTouch) {
      mx += stickVec.x;
      my += stickVec.y;
    }
    const l = Math.hypot(mx, my);
    P.moving = l > 0.1;
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && P.st > 1 && P.moving,
      spd = pSpeed() * (sprint ? 1.5 : 1);
    if (P.moving) {
      if (searching) searching = null;
      moveBody(P, (mx / l) * spd * dt, (my / l) * spd * dt);
      if (sprint) {
        P.st = Math.max(0, P.st - 12 * dt);
        P.stDelay = 0.4;
      }
      P.stepT -= dt;
      if (P.stepT <= 0) {
        P.stepT = sprint ? 0.24 : 0.36;
        SFX.step();
      }
    }
    if (!sprint) {
      P.stDelay -= dt;
      if (P.stDelay <= 0)
        P.st = clamp(
          P.st + (13 + P.skills.sta * 2) * dt * (P.hu <= 0 ? 0.5 : 1),
          0,
          maxSt(),
        );
    }
    const mw = screenToWorld(mouse.x, mouse.y);
    P.aim = Math.atan2(mw.y - P.y, mw.x - P.x);
    P.cd -= dt;
    P.meleeCd -= dt;
    P.emptyT -= dt;
    if (P.rl > 0) {
      P.rl -= dt;
      if (P.rl <= 0) {
        const w = WEAPONS[P.weapon],
          take = Math.min(w.mag - P.mags[P.weapon], countItem(w.ammo));
        removeItem(w.ammo, take);
        P.mags[P.weapon] += take;
        if (w.auto) SFX.ready();
        else SFX.reload();
      }
    }
    if (WEAPONS[P.weapon].auto && P.mags[P.weapon] <= 0 && P.rl <= 0)
      startReload();
    if (mouse.down && !buildSel && !searching) fireWeapon();
  }
  P.iframe -= dt;
  P.hu = Math.max(0, P.hu - dt * 0.1 * (1 - P.skills.metabolism * 0.12));
  if (P.hu <= 0) {
    P.hp -= dt * 0.6;
    deathCause = "голод";
    if (P.hp <= 0) {
      gameOver("голод");
      return;
    }
  }
  if (P.poison > 0) {
    P.poison -= dt;
    P.hp -= dt * 3;
    deathCause = "яд";
    if (P.hp <= 0) {
      gameOver("яд");
      return;
    }
  }
  if (searching) {
    searching.t += dt;
    if (searching.t >= searching.dur) finishSearch();
  }
  for (const z of [...Z]) updateZ(z, dt);
  if (!P.inCar && currentFloorId === "outdoor") updateCars(dt);
  if (currentFloorId === "outdoor") {
    updateNests(dt);
    updateStructs(dt);
    updateNPCs(dt);
  }
  updatePR(dt);
  updateDR(dt);
  updateCL(dt);
  updatePT(dt);
  updateTX(dt);
  updateLG(dt);
  if (currentFloorId === "outdoor") {
    ambientSpawn(dt);
    updateSiege(dt);
  }
  const bx = Math.floor(P.x / (CELL * 16)),
    by = Math.floor(P.y / (CELL * 16));
  if (currentFloorId === "outdoor") EX.add(K(bx, by));
  cam.x = lerp(
    cam.x,
    P.inCar ? CARS.get(P.inCar).x : P.x,
    1 - Math.pow(0.0001, dt),
  );
  cam.y = lerp(
    cam.y,
    P.inCar ? CARS.get(P.inCar).y : P.y,
    1 - Math.pow(0.0001, dt),
  );
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    refreshHUD();
    updateInteract();
  }
  mmT -= dt;
  if (mmT <= 0) {
    mmT = 0.35;
    drawMinimap();
  }
  saveT -= dt;
  if (saveT <= 0) {
    saveT = 25;
    saveGame();
  }
  AU.tick(dt);
}
function updateMenu(dt) {
  menuT += dt;
  cam.x = BASEX + Math.cos(menuT * 0.1) * 60;
  cam.y = BASEY + Math.sin(menuT * 0.08) * 50;
  for (const z of [...Z]) updateZ(z, dt);
  updateStructs(dt);
  updatePT(dt);
  updateTX(dt);
  updateLG(dt);
  shake = Math.max(0, shake - dt * 22);
  AU.tick(dt);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsEma = lerp(fpsEma, dt * 1000, 0.05);
  if (fpsEma > 32 && RES > 1) {
    slowN++;
    if (slowN > 140) {
      RES = 1;
      resize();
      slowN = 0;
    }
  } else slowN = Math.max(0, slowN - 1);
  if (state === "play" || state === "floor") update(dt);
  else if (state === "menu") updateMenu(dt);
  else if (state === "home") updateHome(dt);
  else {
    updatePT(dt);
    updateTX(dt);
    updateLG(dt);
    shake = Math.max(0, shake - dt * 22);
  }
  render();
  if (state === "map") drawBigmap();
}
$("btnNew").disabled = false;
$("btnNew").textContent = "НОВАЯ ИСТОРИЯ";
$("btnContinue").disabled = false;
resize();
startAttract();
requestAnimationFrame(frame);
