/* ПЕПЕЛОПАД — прототип изометрического рендера (этап 16.1)
 * Мир в метрах (прямоугольный, как в игре). Изометрия — только проекция.
 * Тайл 64×32 px = 1 м². Чанки земли 8×8 тайлов (512×256 px).
 * Палитра и нормативы: docs/visual-redesign-qwen.md
 */

// ---------- базовые константы ----------
const TW = 64, TH = 32; // ромб-тайл
const ZH = 32; // 1 метр высоты = 32 px
let W = 1280,
  H = 720;
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const hud = document.getElementById("hud");
let vignette = null;
function bakeVignette() {
  const c = mkCanvas(W, H);
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.78);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(108,106,98,1)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  vignette = c;
}
function fitViewport() {
  W = innerWidth;
  H = innerHeight;
  cv.width = W;
  cv.height = H;
  ctx.imageSmoothingEnabled = false;
  lightCv.width = W >> 1;
  lightCv.height = H >> 1;
  warmCv.width = W >> 1;
  warmCv.height = H >> 1;
  bakeVignette();
}

// палитра «ПЕПЕЛОПАД»
const PAL = {
  dark: "#10141a",
  night: "#222a34",
  asphalt: "#3b4148",
  concrete: "#5b6065",
  panel: "#7c786e",
  brick: "#9a9283",
  ash: "#c2beb2",
  grass: "#6a6944",
  bush: "#454f3b",
  rust: "#8a4a28",
  blood: "#6d2b25",
  warm: "#ffb45c",
  moon: "#6f86ad",
};

// ---------- проекция ----------
// экранные координаты мира (без камеры)
function w2s(wx, wy, wz = 0) {
  return { x: (wx - wy) * (TW / 2), y: (wx + wy) * (TH / 2) - wz * ZH };
}

// ---------- утилиты ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function h2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// ---------- генерация спрайтов земли ----------
// тайл: ромб 64×32 в канвасе 68×36 (запас 2px против швов)
const TILE_PAD = 2;
const TILE_CX = 34,
  TILE_CY = 18;
function diamondPath(g, grow = 1) {
  g.beginPath();
  g.moveTo(TILE_CX, TILE_CY - 16 - grow);
  g.lineTo(TILE_CX + 32 + grow, TILE_CY);
  g.lineTo(TILE_CX, TILE_CY + 16 + grow);
  g.lineTo(TILE_CX - 32 - grow, TILE_CY);
  g.closePath();
}
function speckle(g, r, n, colors, sizeMin = 1, sizeMax = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.min(colors.length - 1, Math.floor(r() * colors.length))];
    const s = sizeMin + r() * (sizeMax - sizeMin);
    g.fillRect(4 + r() * 60, 4 + r() * 28, s, s * 0.7);
  }
}

function makeTile(base, flecks, r, opts = {}) {
  const c = mkCanvas(TW + TILE_PAD * 2, TH + TILE_PAD * 2);
  const g = c.getContext("2d");
  diamondPath(g);
  g.fillStyle = base;
  g.fill();
  g.save();
  diamondPath(g);
  g.clip();
  speckle(g, r, opts.speckles ?? 26, flecks, 1, 2.4);
  if (opts.crack && r() < (opts.crackChance ?? 0.5)) {
    g.strokeStyle = "rgba(16,20,26,0.5)";
    g.lineWidth = 1;
    g.beginPath();
    let x = 10 + r() * 44,
      y = 8 + r() * 16;
    g.moveTo(x, y);
    for (let i = 0; i < 3; i++) {
      x += (r() - 0.5) * 18;
      y += r() * 7;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  if (opts.patch && r() < 0.3) {
    g.fillStyle = "rgba(16,20,26,0.18)";
    g.beginPath();
    g.ellipse(12 + r() * 44, 10 + r() * 16, 4 + r() * 7, 2 + r() * 3, 0, 0, 7);
    g.fill();
  }
  g.restore();
  return c;
}

// текстурный тайл: квадрат текстуры проецируется в ромб (как советует Qwen)
// flipU/flipV — зеркалирование для скрытия швов при тайлинге
function makeTexturedTile(img, flipU, flipV, tint) {
  const c = mkCanvas(TW + TILE_PAD * 2, TH + TILE_PAD * 2);
  const g = c.getContext("2d");
  g.save();
  diamondPath(g);
  g.clip();
  const s = img.width;
  const k = 33.5 / 32; // лёгкое перекрытие соседних ромбов против швов
  const bUx = 32 * k * (flipU ? -1 : 1),
    bUy = 16 * k * (flipU ? -1 : 1);
  const bVx = -32 * k * (flipV ? -1 : 1),
    bVy = 16 * k * (flipV ? -1 : 1);
  const e = TILE_CX - 0.5 * bUx - 0.5 * bVx,
    f = TILE_CY - 0.5 * bUy - 0.5 * bVy;
  g.setTransform(bUx / s, bUy / s, bVx / s, bVy / s, e, f);
  g.drawImage(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (tint) {
    g.globalCompositeOperation = "multiply";
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
  }
  g.restore();
  return c;
}

const T_GRASS = 0,
  T_DIRT = 1,
  T_ASPHALT = 2,
  T_SIDEWALK = 3,
  T_FLOOR = 4,
  T_SAND = 5,
  T_PATH = 6;

const TEX = {}; // загруженные Gemini-текстуры
const SPRTEX = {}; // спрайты с альфа-каналом (после вырезания фона)
const SPRITE_FILES = {
  tree: "/assets/gen/tree_poplar.png",
  tree_dead: "/assets/gen/tree_dead.png",
  tree_birch: "/assets/gen/tree_birch.png",
  zombie: "/assets/gen/zombie.png",
  survivor: "/assets/gen/survivor.png",
  bench: "/assets/gen/bench.png",
  dumpster: "/assets/gen/dumpster.png",
  tires: "/assets/gen/tires.png",
  barrel: "/assets/gen/barrel.png",
};
function loadSpriteTex() {
  return Promise.all(
    Object.entries(SPRITE_FILES).map(
      ([k, src]) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            SPRTEX[k] = img;
            res();
          };
          img.onerror = () => res();
          img.src = src;
        }),
    ),
  );
}
const TEX_FILES = {
  asphalt: "/assets/textures/asphalt.png",
  dead_grass: "/assets/textures/dead_grass.png",
  dirt: "/assets/textures/dirt_ground.png",
  sidewalk: "/assets/textures/sidewalk.png",
  wood_floor: "/assets/textures/wood_floor.png",
  panel_wall: "/assets/textures/panel_wall.png",
  brick_wall: "/assets/textures/brick_wall.png",
  roof_felt: "/assets/textures/roof_felt.png",
};
function loadTextures() {
  return Promise.all(
    Object.entries(TEX).length
      ? []
      : Object.entries(TEX_FILES).map(
          ([k, src]) =>
            new Promise((res) => {
              const img = new Image();
              img.onload = () => {
                TEX[k] = img;
                res();
              };
              img.onerror = () => res(); // fallback: процедурные тайлы
              img.src = src;
            }),
        ),
  );
}

// бесшовная 2×2 зеркальная композиция + запечённая тонировка (один раз, не на тайл)
const tex2xCache = new Map();
function tex2x(key, tint) {
  const ck = key + "|" + (tint || "");
  if (tex2xCache.has(ck)) return tex2xCache.get(ck);
  const img = TEX[key];
  if (!img) return null;
  const s = img.width;
  const c = mkCanvas(s * 2, s * 2);
  const g = c.getContext("2d");
  const quad = (fx, fy, ox, oy) => {
    g.save();
    g.translate(ox * s, oy * s);
    g.scale(fx ? -1 : 1, fy ? -1 : 1);
    g.drawImage(img, fx ? -s : 0, fy ? -s : 0);
    g.restore();
  };
  quad(0, 0, 0, 0);
  quad(1, 0, 1, 0);
  quad(0, 1, 0, 1);
  quad(1, 1, 1, 1);
  if (tint) {
    g.globalCompositeOperation = "multiply";
    g.fillStyle = tint;
    g.fillRect(0, 0, s * 2, s * 2);
    g.globalCompositeOperation = "source-over";
  }
  tex2xCache.set(ck, c);
  return c;
}

function makeGroundSet() {
  const set = {};
  const defs = [
    [T_GRASS, PAL.grass, ["#5d5c3b", "#75744c", "#525138", "#6a6944"], { speckles: 30 }],
    [T_DIRT, "#57503c", ["#4a4433", "#645c46", "#3f3a2c"], { speckles: 30 }],
    [T_ASPHALT, PAL.asphalt, ["#33383e", "#42474e", "#2f3339", "#4a4f56"], { speckles: 34, crack: true, patch: true }],
    [T_SIDEWALK, "#63666b", ["#585b60", "#6e7176", "#4f5257"], { speckles: 20, crack: true, crackChance: 0.1 }],
    [T_FLOOR, "#5d4a33", ["#54422d", "#685238", "#4c3b28"], { speckles: 18 }],
    [T_SAND, "#8a7f63", ["#7d7356", "#968a6c", "#6f6549"], { speckles: 24 }],
    [T_PATH, "#4e4a3c", ["#453f33", "#585244", "#3e392e"], { speckles: 26 }],
  ];
  for (const [id, base, flecks, opts] of defs) {
    set[id] = [];
    for (let v = 0; v < 4; v++)
      set[id].push(makeTile(base, flecks, mulberry32(id * 100 + v * 17 + 5), opts));
  }
  // асфальт из Gemini-текстуры: 4 зеркальных варианта против швов + приглушение в палитру
  if (TEX.asphalt) {
    const tint = "#5a616b"; // multiply: тянем бежевый оригинал к PAL.asphalt
    set[T_ASPHALT] = [
      makeTexturedTile(TEX.asphalt, false, false, tint),
      makeTexturedTile(TEX.asphalt, true, false, tint),
      makeTexturedTile(TEX.asphalt, false, true, tint),
      makeTexturedTile(TEX.asphalt, true, true, tint),
    ];
  }
  // доски пола — горизонтальные полосы поверх
  for (const t of set[T_FLOOR]) {
    const g = t.getContext("2d");
    g.strokeStyle = "rgba(30,24,16,0.55)";
    g.lineWidth = 1;
    for (let y = 6; y < 34; y += 7) {
      g.beginPath();
      g.moveTo(Math.max(0, TILE_CX - 16 - (y - TILE_CY + 16)), y);
      g.lineTo(Math.min(68, TILE_CX + 16 + (y - TILE_CY + 16)), y);
      g.stroke();
    }
  }
  return set;
}

// ---------- текстуры стен / крыш (паттерны) ----------
function makePanelTexture(style) {
  const c = mkCanvas(96, 96);
  const g = c.getContext("2d");
  const r = mulberry32(style === "brick" ? 77 : 55);
  if (style === "brick") {
    g.fillStyle = PAL.brick;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "rgba(70,60,50,0.5)";
    for (let y = 0; y < 96; y += 12) g.fillRect(0, y, 96, 1.5);
    for (let y = 0; y < 96; y += 12)
      for (let x = (y / 12) % 2 ? 0 : 16; x < 96; x += 32) g.fillRect(x, y, 1.5, 12);
  } else if (style === "kiosk") {
    g.fillStyle = "#565b52";
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "rgba(16,20,26,0.4)";
    for (let x = 0; x < 96; x += 8) g.fillRect(x, 0, 2, 96);
    g.fillStyle = "rgba(138,74,40,0.35)";
    for (let i = 0; i < 6; i++) g.fillRect(r() * 90, r() * 60, 3, 20 + r() * 30);
  } else {
    g.fillStyle = PAL.panel;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "rgba(40,38,30,0.35)";
    g.fillRect(0, 0, 96, 2); // шов этажа
    g.fillRect(47, 0, 2, 96); // шов панели
    g.fillRect(95, 0, 1, 96);
  }
  // шум + потёки
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(16,20,26,0.07)" : "rgba(194,190,178,0.06)";
    g.fillRect(r() * 96, r() * 96, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 4; i++) {
    g.fillStyle = "rgba(16,20,26,0.08)";
    const x = r() * 90;
    g.fillRect(x, 0, 2 + r() * 3, 30 + r() * 60);
  }
  return c;
}
function makeRoofTexture() {
  const c = mkCanvas(64, 64);
  const g = c.getContext("2d");
  const r = mulberry32(913);
  g.fillStyle = "#54585a";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(16,20,26,0.18)";
  for (let y = 0; y < 64; y += 24) g.fillRect(0, y, 64, 2);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = r() < 0.6 ? "rgba(16,20,26,0.08)" : "rgba(194,190,178,0.1)";
    g.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1 + r() * 2);
  }
  return c;
}

// ---------- окна ----------
function makeWindowSprite(lit) {
  const c = mkCanvas(30, 46);
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,18,14,0.85)";
  g.fillRect(0, 0, 30, 46); // проём
  g.fillStyle = "#8f8a7c";
  g.fillRect(2, 2, 26, 40); // рама
  g.fillStyle = lit ? PAL.warm : "#22303c";
  g.fillRect(4, 4, 22, 36);
  if (lit) {
    g.fillStyle = "#ffe3b0";
    g.fillRect(7, 7, 8, 12);
    g.fillStyle = "rgba(20,16,8,0.55)";
    g.fillRect(4, 20, 22, 3); // переплёт
    g.fillRect(14, 4, 3, 36);
  } else {
    g.fillStyle = "rgba(127,184,216,0.25)";
    g.beginPath();
    g.moveTo(6, 30);
    g.lineTo(18, 4);
    g.lineTo(24, 4);
    g.lineTo(10, 34);
    g.fill();
    g.fillStyle = "rgba(16,20,26,0.5)";
    g.fillRect(4, 20, 22, 2);
    g.fillRect(14, 4, 2, 36);
  }
  g.fillStyle = "#9a9484";
  g.fillRect(1, 42, 28, 4); // подоконник
  return c;
}
const winDay = makeWindowSprite(false);
const winLit = makeWindowSprite(true);

// световые спрайты (пре-рендер, эллипсы 2:1!)
function makeGlowSprite(w, h, color, inner = 0.12) {
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(inner, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  g.translate(-w / 2, -w / 2);
  g.fillStyle = grad;
  g.fillRect(0, -(w - h) / 2, w, w);
  g.restore();
  return c;
}
const glowLamp = makeGlowSprite(288, 144, "rgba(255,255,255,0.95)");
const glowPlayer = makeGlowSprite(440, 220, "rgba(255,255,255,0.8)");
const glowWarmLamp = makeGlowSprite(288, 144, "rgba(255,180,92,0.55)");
const glowWarmWin = makeGlowSprite(90, 60, "rgba(255,180,92,0.85)");

// ---------- здания (генерирует genCity) ----------

const wallTex = { panel: makePanelTexture("panel"), brick: makePanelTexture("brick"), kiosk: makePanelTexture("kiosk") };
const roofTex = makeRoofTexture();

function bakeBuilding(b, seedKey) {
  // печём в локальных координатах (как будто здание в (0,0)); экземпляры смещаются при отрисовке
  const bx = 0,
    by = 0;
  const Z = b.floors * 3;
  const c000 = w2s(bx, by, 0),
    c100 = w2s(bx + b.w, by, 0),
    c010 = w2s(bx, by + b.h, 0),
    c110 = w2s(bx + b.w, by + b.h, 0);
  const c01z = w2s(bx, by + b.h, Z),
    c10z = w2s(bx + b.w, by, Z),
    c11z = w2s(bx + b.w, by + b.h, Z),
    c00z = w2s(bx, by, Z);
  const xs = [c000, c100, c010, c110, c00z, c10z, c11z, c01z].map((p) => p.x);
  const ys = [c000, c100, c010, c110, c00z, c10z, c11z, c01z].map((p) => p.y);
  const minX = Math.floor(Math.min(...xs)) - 4,
    minY = Math.floor(Math.min(...ys)) - 4;
  const maxX = Math.ceil(Math.max(...xs)) + 4,
    maxY = Math.ceil(Math.max(...ys)) + 4;
  const cnv = mkCanvas(maxX - minX, maxY - minY);
  const g = cnv.getContext("2d");
  g.translate(-minX, -minY);
  // стены: Gemini-текстура (96px = 3 м) или процедурный fallback
  const wallCanvas = (style) => {
    const img = TEX[style + "_wall"];
    if (!img) return wallTex[style] || wallTex.panel;
    const c = mkCanvas(96, 96);
    c.getContext("2d").drawImage(img, 0, 0, 96, 96);
    return c;
  };
  const tex = wallCanvas(b.style);
  function wall(origin, sxSign, lenMeters, darker) {
    g.save();
    g.setTransform(sxSign, 0.5, 0, -1, origin.x - minX, origin.y - minY);
    const pat = g.createPattern(tex, "repeat");
    g.fillStyle = pat;
    g.fillRect(0, 0, lenMeters * 32, Z * 32);
    if (darker) {
      g.fillStyle = "rgba(16,20,26,0.22)";
      g.fillRect(0, 0, lenMeters * 32, Z * 32);
    }
    // верхняя кромка
    g.fillStyle = "rgba(16,20,26,0.45)";
    g.fillRect(0, Z * 32 - 3, lenMeters * 32, 3);
    g.restore();
  }
  wall(c100, -1, b.h, true); // восточная (x+w), в тени
  wall(c010, 1, b.w, false); // южная (y+h)
  // крыша: мировая ориентация текстуры (128 px = 4 м)
  g.save();
  g.beginPath();
  g.moveTo(c00z.x, c00z.y);
  g.lineTo(c10z.x, c10z.y);
  g.lineTo(c11z.x, c11z.y);
  g.lineTo(c01z.x, c01z.y);
  g.closePath();
  if (TEX.roof_felt) {
    g.clip();
    g.setTransform(1, 0.5, -1, 0.5, c00z.x - minX, c00z.y - minY);
    const pat = g.createPattern(TEX.roof_felt, "repeat");
    g.fillStyle = pat;
    g.fillRect(0, 0, b.w * 32, b.h * 32);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "rgba(40,44,48,0.35)";
    g.fill();
  } else {
    g.fillStyle = g.createPattern(roofTex, "repeat");
    g.fill();
  }
  g.strokeStyle = "rgba(16,20,26,0.7)";
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  // вентиляция на крыше
  const r = mulberry32(seedKey);
  const vents = b.w * b.h > 150 ? 2 : 1;
  for (let i = 0; i < vents; i++) {
    const vx = bx + 2 + r() * (b.w - 4),
      vy = by + 2 + r() * (b.h - 4);
    const p = w2s(vx, vy, Z);
    g.fillStyle = "#43484a";
    g.fillRect(p.x - 5, p.y - 12, 10, 12);
    g.fillStyle = "#5f6466";
    g.fillRect(p.x - 5, p.y - 12, 10, 3);
  }
  // окна на двух видимых гранях + ночная подложка
  const lit = mkCanvas(cnv.width, cnv.height);
  const gl = lit.getContext("2d");
  gl.translate(-minX, -minY);
  const faces = [
    { o: c010, dx: 1, len: b.w }, // южная
    { o: c100, dx: 0, len: b.h }, // восточная
  ];
  let wi = 0;
  for (const f of faces) {
    for (let fl = 0; fl < b.floors; fl++) {
      for (let u = 1.8; u < f.len - 1.8; u += 2.5) {
        // пропускаем окна над дверью первого этажа на южной грани
        if (f.dx === 1 && fl === 0 && Math.abs(u - b.doorU) < 1.6) continue;
        const base = f.dx === 1 ? w2s(bx + u, by + b.h, fl * 3 + 0.9) : w2s(bx + b.w, by + u, fl * 3 + 0.9);
        g.drawImage(winDay, base.x - 15, base.y - 46 + 4);
        if (h2(seedKey + fl, wi, 3) < 0.3) {
          gl.drawImage(winLit, base.x - 15, base.y - 46 + 4);
          gl.globalAlpha = 0.5;
          gl.drawImage(glowWarmWin, base.x - 45, base.y - 46);
          gl.globalAlpha = 1;
        }
        wi++;
      }
    }
  }
  // дверь на южной грани
  const dp = w2s(bx + b.doorU, by + b.h, 0);
  g.fillStyle = "#241d14";
  g.fillRect(dp.x - 16, dp.y - 68, 32, 68);
  g.fillStyle = "#4a3b26";
  g.fillRect(dp.x - 13, dp.y - 64, 26, 64);
  g.fillStyle = "#ffb45c";
  g.fillRect(dp.x - 13, dp.y - 70, 26, 3); // козырёк-лампа
  g.fillStyle = "#6f6650";
  g.fillRect(dp.x - 20, dp.y - 4, 40, 4); // ступень
  return {
    canvas: cnv,
    litCanvas: lit,
    minX,
    minY,
  };
}

// ---------- пропсы ----------
function makeTree(dead, variant) {
  const c = mkCanvas(128, 160);
  const g = c.getContext("2d");
  const r = mulberry32(variant * 91 + (dead ? 5 : 11));
  const bx = 64,
    by = 150;
  g.strokeStyle = "#3a2f24";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(bx, by);
  g.quadraticCurveTo(bx - 4 + r() * 8, by - 45, bx + (r() * 10 - 5), by - 78);
  g.stroke();
  if (dead) {
    g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(bx, by - 30 - r() * 40);
      g.lineTo(bx + (r() - 0.5) * 70, by - 60 - r() * 55);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2,
        rr = r() * 38;
      const px = bx + Math.cos(a) * rr,
        py = by - 88 + Math.sin(a) * rr * 0.62;
      g.fillStyle = h2(i, variant) < 0.25 ? "#55614a" : h2(i, variant, 2) < 0.5 ? PAL.bush : "#3d4735";
      g.beginPath();
      g.ellipse(px, py, 9 + r() * 12, 6 + r() * 8, 0, 0, 7);
      g.fill();
    }
    // пепел на кроне
    for (let i = 0; i < 10; i++) {
      g.fillStyle = "rgba(194,190,178,0.25)";
      g.fillRect(bx - 30 + r() * 60, by - 120 + r() * 30, 2, 1.4);
    }
  }
  return c;
}
function makeLamp() {
  const c = mkCanvas(48, 208);
  const g = c.getContext("2d");
  g.strokeStyle = "#2c3033";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(24, 200);
  g.lineTo(24, 24);
  g.stroke();
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(24, 26);
  g.quadraticCurveTo(30, 14, 42, 14);
  g.stroke();
  g.fillStyle = "#3a3f42";
  g.fillRect(36, 8, 12, 8);
  g.fillStyle = PAL.warm;
  g.fillRect(38, 14, 8, 3);
  return c;
}
function makeBench() {
  const c = mkCanvas(80, 48);
  const g = c.getContext("2d");
  g.fillStyle = "#4c3b28";
  g.save();
  g.transform(1, 0.5, 0, 1, 0, 0);
  g.fillRect(16, 10, 64, 5);
  g.fillRect(16, 22, 64, 5);
  g.restore();
  g.fillStyle = "#2c3033";
  g.fillRect(24, 30, 4, 14);
  g.fillRect(64, 44, 4, 4);
  return c;
}
function makeContainer() {
  const c = mkCanvas(72, 56);
  const g = c.getContext("2d");
  g.fillStyle = "#3d4a3a";
  g.fillRect(12, 14, 56, 34);
  g.fillStyle = "#31402f";
  g.fillRect(12, 8, 56, 9);
  g.fillStyle = "rgba(138,74,40,0.5)";
  g.fillRect(16, 20, 8, 20);
  g.fillRect(54, 24, 6, 16);
  g.fillStyle = "#222a34";
  g.fillRect(16, 48, 8, 5);
  g.fillRect(56, 48, 8, 5);
  return c;
}
function makeTires() {
  const c = mkCanvas(56, 40);
  const g = c.getContext("2d");
  for (let i = 0; i < 3; i++) {
    g.fillStyle = "#1d2124";
    g.beginPath();
    g.ellipse(28, 30 - i * 9, 18, 8, 0, 0, 7);
    g.fill();
    g.fillStyle = "#33383c";
    g.beginPath();
    g.ellipse(28, 28 - i * 9, 10, 4, 0, 0, 7);
    g.fill();
  }
  return c;
}
function makeCar(color, wreck, axis) {
  // машина 4.4×1.8 м, высота 1.45 м; axis: 'x' (едет вдоль +x) или 'y'
  const L = 4.4, Wd = 1.8, Hh = 1.45;
  const c = mkCanvas(224, 170);
  const g = c.getContext("2d");
  const P = (wx, wy, wz) => {
    const p = w2s(axis === "x" ? wx : wy, axis === "x" ? wy : wx, wz);
    return { x: p.x + 112, y: p.y + 46 };
  };
  const A = P(0, 0, 0), B = P(L, 0, 0), C = P(0, Wd, 0), D = P(L, Wd, 0);
  const Dz = (p) => ({ x: p.x, y: p.y - Hh * ZH });
  const Az = Dz(A), Bz = Dz(B), Cz = Dz(C), Dzz = Dz(D);
  // колёса
  g.fillStyle = "#15181b";
  for (const [wx, wy] of [[0.9, 0], [3.5, 0], [0.9, Wd], [3.5, Wd]]) {
    const p = P(wx, wy, 0);
    g.beginPath();
    g.ellipse(p.x, p.y - 4, 11, 6, 0, 0, 7);
    g.fill();
  }
  // южная грань (y=Wd)
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(C.x, C.y);
  g.lineTo(D.x, D.y);
  g.lineTo(Dzz.x, Dzz.y);
  g.lineTo(Cz.x, Cz.y);
  g.closePath();
  g.fill();
  // восточная грань (x=L)
  g.fillStyle = shade(color, 0.78);
  g.beginPath();
  g.moveTo(B.x, B.y);
  g.lineTo(D.x, D.y);
  g.lineTo(Dzz.x, Dzz.y);
  g.lineTo(Bz.x, Bz.y);
  g.closePath();
  g.fill();
  // крыша-кабина (чуть уже)
  const cab = 0.62;
  const cA = P(L * 0.18, Wd * 0.12, Hh), cB = P(L * cab, Wd * 0.12, Hh), cC = P(L * 0.18, Wd * 0.88, Hh), cD = P(L * cab, Wd * 0.88, Hh);
  const cH = 0.55 * ZH;
  // стёкла: юг и восток
  g.fillStyle = wreck ? "#1c2226" : "#26333d";
  g.beginPath();
  g.moveTo(cC.x, cC.y);
  g.lineTo(cD.x, cD.y);
  g.lineTo(cD.x, cD.y - cH);
  g.lineTo(cC.x, cC.y - cH);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cB.x, cB.y);
  g.lineTo(cD.x, cD.y);
  g.lineTo(cD.x, cD.y - cH);
  g.lineTo(cB.x, cB.y - cH);
  g.closePath();
  g.fill();
  // верх кабины
  g.fillStyle = shade(color, 1.12);
  g.beginPath();
  g.moveTo(cA.x, cA.y - cH);
  g.lineTo(cB.x, cB.y - cH);
  g.lineTo(cD.x, cD.y - cH);
  g.lineTo(cC.x, cC.y - cH);
  g.closePath();
  g.fill();
  // капот и багажник (крыша кузова)
  g.fillStyle = shade(color, 1.08);
  for (const [x0, x1] of [[0, 0.18], [cab, 1]]) {
    const p1 = P(L * x0, 0, Hh), p2 = P(L * x1, 0, Hh), p3 = P(L * x1, Wd, Hh), p4 = P(L * x0, Wd, Hh);
    g.beginPath();
    g.moveTo(p1.x, p1.y);
    g.lineTo(p2.x, p2.y);
    g.lineTo(p3.x, p3.y);
    g.lineTo(p4.x, p4.y);
    g.closePath();
    g.fill();
  }
  if (wreck) {
    g.fillStyle = "rgba(138,74,40,0.65)";
    const r = mulberry32(4);
    for (let i = 0; i < 8; i++) g.fillRect(60 + r() * 110, 40 + r() * 60, 5 + r() * 12, 3 + r() * 8);
  }
  // фары/фонари
  g.fillStyle = "#c9c04a";
  g.fillRect(B.x - 4, B.y - 30, 4, 4);
  return c;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * k, 0, 255) | 0,
    g = clamp(((n >> 8) & 255) * k, 0, 255) | 0,
    b = clamp((n & 255) * k, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}

// забор-рабица: сегмент 1 м вдоль оси
function makeFence(axis) {
  const c = mkCanvas(64, 76);
  const g = c.getContext("2d");
  const a = axis === "x" ? 1 : -1;
  const oy = 22; // подъём, чтобы верх забора влезал в канвас
  // сетка
  g.save();
  g.beginPath();
  g.moveTo(32, oy + 16);
  g.lineTo(32 + a * 32, oy + 32);
  g.lineTo(32 + a * 32, oy + 32 - 34);
  g.lineTo(32, oy + 16 - 34);
  g.closePath();
  g.clip();
  g.strokeStyle = "rgba(120,124,120,0.55)";
  g.lineWidth = 1;
  for (let i = -8; i < 12; i++) {
    g.beginPath();
    g.moveTo(32 + a * i * 4, oy + 16 + i * 2 - 40);
    g.lineTo(32 + a * (i * 4 + 40), oy + 16 + i * 2 + 20 - 20);
    g.stroke();
    g.beginPath();
    g.moveTo(32 + a * i * 4, oy + 16 + i * 2);
    g.lineTo(32 + a * (i * 4 + 40), oy + 16 + i * 2 + 20 - 40);
    g.stroke();
  }
  g.restore();
  // столб и верхняя нить
  g.strokeStyle = "#3a3f3a";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(32, oy + 16);
  g.lineTo(32, oy - 18);
  g.stroke();
  g.strokeStyle = "rgba(90,94,90,0.9)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(32, oy - 18);
  g.lineTo(32 + a * 32, oy - 2);
  g.stroke();
  return c;
}

// ---------- персонажи ----------
function makeActor(kind, pose) {
  const c = mkCanvas(64, 96);
  const g = c.getContext("2d");
  const cx = 32;
  const zombie = kind === "zombie";
  const skin = zombie ? "#8a9a7a" : "#c8a080";
  const cloth = zombie ? "#5a4a38" : "#4a5560";
  const pants = zombie ? "#3a3f3a" : "#2e3440";
  const bob = pose ? 2 : 0;
  const lean = zombie ? 4 : 0;
  // ноги
  g.fillStyle = pants;
  g.fillRect(cx - 7 + (pose ? 3 : 0), 58, 6, 26 - bob);
  g.fillRect(cx + 2 - (pose ? 3 : 0), 58 + bob, 6, 26 - bob);
  // торс
  g.fillStyle = cloth;
  g.beginPath();
  g.roundRect(cx - 10 + lean, 30, 20, 30, 5);
  g.fill();
  // руки
  g.fillStyle = shade2(cloth, 0.85);
  g.fillRect(cx - 13 + lean, 33, 5, 22);
  g.fillRect(cx + 9 + lean, 33 + (pose ? 2 : 0), 5, 22);
  // голова
  g.fillStyle = skin;
  g.beginPath();
  g.arc(cx + lean, 22, 9, 0, 7);
  g.fill();
  if (!zombie) {
    g.fillStyle = "#3a3f45";
    g.beginPath();
    g.arc(cx, 19, 9, Math.PI, Math.PI * 2);
    g.fill(); // капюшон
  } else {
    g.fillStyle = PAL.blood;
    g.fillRect(cx + lean - 4, 28, 6, 4);
  }
  return c;
}
function shade2(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * k, 0, 255) | 0,
    g = clamp(((n >> 8) & 255) * k, 0, 255) | 0,
    b = clamp((n & 255) * k, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}

// ---------- генератор компактного города ----------
// Нормативы (docs/visual-redesign-qwen.md): дорога 8 м + тротуары по 3 м с обеих сторон,
// квартал 62×62 м с периметральной застройкой, двор с деревьями и пропсами.
const ROAD = 8,
  SW = 3,
  BLOCK = 62,
  PITCH = ROAD + SW + BLOCK + SW; // 76
const NB = Number(new URLSearchParams(location.search).get("nb")) || 19; // кварталов по оси → ~1.46 км при 19
const SIZE = NB * PITCH + ROAD + SW * 2;
const ground = new Uint8Array(SIZE * SIZE);
const gflag = new Uint8Array(SIZE * SIZE); // 1=осевая вдоль Y, 2=вдоль X

// сюжетные POI: ключ "bk,bl" (индексы квартала)
const POIS = {
  "1,1": "park",
  "2,2": "supermarket",
  "3,6": "school",
  "6,2": "hospital",
  "5,3": "police",
  "0,1": "gas",
};

let buildings = [];
let trees = [],
  lamps = [],
  benches = [],
  containers = [],
  tires = [],
  barrels = [],
  cars = [],
  fences = [];

// архетипы зданий (спрайт общий на архетип — советская типовая застройка)
const ARCH_ROW = [
  { w: 30, h: 12, floors: 2, style: "panel" },
  { w: 24, h: 12, floors: 3, style: "panel" },
  { w: 20, h: 14, floors: 1, style: "brick" }, // магазин
];
const ARCH_COL = [{ w: 12, h: 24, floors: 3, style: "brick" }];
const ARCH_KIOSK = { w: 6, h: 5, floors: 1, style: "kiosk" };

function genCity(seed = 11) {
  const T0 = performance.now();
  const mark = (name) => console.log(`[gen] ${name}: ${(performance.now() - T0).toFixed(0)}ms`);
  const r = mulberry32(seed);
  // земля: дороги/тротуары по сетке, кварталы — трава
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const rx = x % PITCH,
        ry = y % PITCH;
      const onRoadX = rx < ROAD,
        onRoadY = ry < ROAD;
      let t = T_GRASS;
      if (onRoadX || onRoadY) t = T_ASPHALT;
      else if (rx < ROAD + SW || ry < ROAD + SW || rx >= PITCH - SW || ry >= PITCH - SW) t = T_SIDEWALK;
      ground[y * SIZE + x] = t;
      if (rx === 4 && !onRoadY) gflag[y * SIZE + x] = 1;
      if (ry === 4 && !onRoadX) gflag[y * SIZE + x] = 2;
    }
  mark("ground");
  // кварталы
  for (let bk = 0; bk < NB; bk++)
    for (let bl = 0; bl < NB; bl++) {
      const bx0 = bk * PITCH + ROAD + SW,
        by0 = bl * PITCH + ROAD + SW;
      const poi = POIS[bk + "," + bl];
      if (poi) genPoiBlock(bx0, by0, poi, mulberry32(seed * 3000 + bk * 91 + bl * 7));
      else genBlock(bx0, by0, mulberry32(seed * 1000 + bk * 91 + bl * 7));
    }
  mark("blocks");
  // уличные машины вдоль дорог
  for (let k = 0; k <= NB; k++) {
    const rx0 = k * PITCH;
    for (let d = 18; d < SIZE - 10; d += 26 + Math.floor(r() * 18)) {
      if (d % PITCH < 12 || d % PITCH > PITCH - 4) continue; // не на перекрёстках
      if (r() < 0.55) cars.push({ x: rx0 + 5.9, y: d, axis: "y", color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]), wreck: r() < 0.3 });
      if (r() < 0.55) cars.push({ x: d, y: rx0 + 5.9, axis: "x", color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]), wreck: r() < 0.3 });
    }
    // фонари по краю тротуаров
    for (let d = 14; d < SIZE - 6; d += 26) {
      if (d % PITCH < ROAD + SW + 1 && d % PITCH < ROAD + 2) continue;
      lamps.push({ x: rx0 + ROAD + 1.6, y: d });
      lamps.push({ x: d, y: rx0 + ROAD + 1.6 });
    }
  }
  mark("streets");
  buildSolidIndex();
  mark("solidIndex");
  // зомби: по кварталам и улицам (не внутри зданий)
  let placed = 0,
    guard = 0;
  const target = NB * NB + 80;
  while (placed < target && guard++ < target * 20) {
    const zx = 14 + r() * (SIZE - 28),
      zy = 14 + r() * (SIZE - 28);
    if (solidRectAt(zx, zy, 0.5)) continue;
    zombies.push({
      x: zx,
      y: zy,
      r: 0.35,
      pose: placed % 2,
      animT: r() * 5,
      tx: 0,
      ty: 0,
      retarget: 0,
    });
    placed++;
  }
  mark("zombies");
  // полы внутри зданий
  for (const b of buildings)
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) ground[y * SIZE + x] = T_FLOOR;
  mark("floors");
}

function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}

function genBlock(bx0, by0, r) {
  // северная и южная стороны — горизонтальные дома
  for (const side of [0, 1]) {
    if (r() < 0.15) continue; // иногда разрыв застройки
    const by = side === 0 ? by0 + 1 : by0 + BLOCK - 13;
    let x = bx0 + 2 + Math.floor(r() * 4);
    while (x < bx0 + BLOCK - 22) {
      const arch = r() < 0.12 ? ARCH_ROW[2] : pick(r, ARCH_ROW.slice(0, 2));
      if (x + arch.w > bx0 + BLOCK - 2) break;
      buildings.push({ id: buildings.length, x, y: by, ...arch, doorU: Math.round(arch.w / 2) });
      if (r() < 0.5) containers.push({ x: x + arch.w / 2 + 3, y: by + arch.h + 1.4 });
      if (r() < 0.3) barrels.push({ x: x + 2 + r() * arch.w, y: by + arch.h + 1.2 });
      x += arch.w + 3 + Math.floor(r() * 8);
    }
  }
  // западная и восточная стороны — торцевые вертикальные
  for (const side of [0, 1]) {
    if (r() < 0.4) continue;
    const bx = side === 0 ? bx0 + 1 : bx0 + BLOCK - 13;
    let y = by0 + 15 + Math.floor(r() * 5);
    while (y < by0 + BLOCK - 26) {
      const arch = ARCH_COL[0];
      if (y + arch.h > by0 + BLOCK - 2) break;
      buildings.push({ id: buildings.length, x: bx, y, ...arch, doorU: 6 });
      y += arch.h + 4 + Math.floor(r() * 8);
    }
  }
  // двор
  genCourtyard(bx0, by0, r);
  // киоск у квартала
  if (r() < 0.45) {
    const kx = bx0 + 16 + Math.floor(r() * 30),
      ky = r() < 0.5 ? by0 + BLOCK - 6 : by0 + 2;
    buildings.push({ id: buildings.length, x: kx, y: ky, ...ARCH_KIOSK, doorU: 3 });
  }
}

function genCourtyard(bx0, by0, r) {
  const cx0 = bx0 + 16,
    cy0 = by0 + 16,
    cs = BLOCK - 34; // ядро двора ~28×28
  // дорожки крестом
  const mid = Math.floor(cs / 2);
  for (let i = 0; i < cs; i++)
    for (const o of [-1, 0, 1]) {
      const gx = cx0 + i,
        gy = cy0 + mid + o;
      if (ground[gy * SIZE + gx] === T_GRASS) ground[gy * SIZE + gx] = T_PATH;
      const gx2 = cx0 + mid + o,
        gy2 = cy0 + i;
      if (ground[gy2 * SIZE + gx2] === T_GRASS) ground[gy2 * SIZE + gx2] = T_PATH;
    }
  // фича двора: площадка / парковка / просто газон
  const feature = r();
  if (feature < 0.4) {
    // детская площадка с рабицей
    const px = cx0 + 6,
      py = cy0 + 6;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    fences.push(
      { x0: px, y0: py, x1: px + 3, y1: py, axis: "x" },
      { x0: px + 5, y0: py, x1: px + 8, y1: py, axis: "x" },
      { x0: px, y0: py + 8, x1: px + 8, y1: py + 8, axis: "x" },
      { x0: px, y0: py, x1: px, y1: py + 8, axis: "y" },
      { x0: px + 8, y0: py, x1: px + 8, y1: py + 8, axis: "y" },
    );
    benches.push({ x: px + 10.5, y: py + 3 }, { x: px + 10.5, y: py + 6 });
  } else if (feature < 0.65) {
    // парковка во дворе
    for (let i = 0; i < 4; i++)
      if (r() < 0.7) cars.push({ x: cx0 + 4 + i * 6, y: cy0 + 4, axis: "y", color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283"]), wreck: r() < 0.4 });
    tires.push({ x: cx0 + 20, y: cy0 + 6 });
  }
  // деревья во дворе
  const nTrees = 3 + Math.floor(r() * 4);
  for (let i = 0; i < nTrees; i++) {
    const tx = cx0 + 2 + r() * (cs - 4),
      ty = cy0 + 2 + r() * (cs - 4);
    if (ground[ty | 0][0] === undefined) continue;
    if (Math.abs((tx - cx0) - mid) < 2.5 || Math.abs((ty - cy0) - mid) < 2.5) continue; // не на дорожках
    trees.push({ x: tx, y: ty, dead: r() < 0.3, v: Math.floor(r() * 3) });
  }
  // деревья вдоль улиц квартала
  for (let i = 0; i < 3; i++) {
    if (r() < 0.6) trees.push({ x: bx0 - 4.5 + r(), y: by0 + 8 + r() * (BLOCK - 16), dead: r() < 0.35, v: Math.floor(r() * 3) });
    if (r() < 0.6) trees.push({ x: bx0 + 8 + r() * (BLOCK - 16), y: by0 - 4.5 + r(), dead: r() < 0.35, v: Math.floor(r() * 3) });
  }
}

// POI-кварталы: крупные сюжетные здания с окружением
function genPoiBlock(bx0, by0, kind, r) {
  const put = (x, y, w, h, floors, style, name) => {
    buildings.push({ id: buildings.length, x, y, w, h, floors, style, doorU: Math.round(w / 2), poi: name });
  };
  if (kind === "school") {
    put(bx0 + 11, by0 + 8, 40, 20, 2, "brick", "Школа");
    // спортплощадка с рабицей на юге
    const px = bx0 + 11,
      py = by0 + 36;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 28; x++) ground[(py + y) * SIZE + px + x] = T_SAND;
    fences.push(
      { x0: px, y0: py, x1: px + 28, y1: py, axis: "x" },
      { x0: px, y0: py + 20, x1: px + 12, y1: py + 20, axis: "x" },
      { x0: px + 16, y0: py + 20, x1: px + 28, y1: py + 20, axis: "x" },
      { x0: px, y0: py, x1: px, y1: py + 20, axis: "y" },
      { x0: px + 28, y0: py, x1: px + 28, y1: py + 20, axis: "y" },
    );
  } else if (kind === "hospital") {
    put(bx0 + 13, by0 + 10, 36, 18, 4, "panel", "Больница");
    for (let i = 0; i < 4; i++) trees.push({ x: bx0 + 10 + r() * 42, y: by0 + 34 + r() * 20, dead: false, v: i % 3 });
    containers.push({ x: bx0 + 29, y: by0 + 30 });
  } else if (kind === "supermarket") {
    put(bx0 + 17, by0 + 6, 28, 16, 1, "brick", "Супермаркет");
    // парковка перед магазином
    for (let y = 0; y < 18; y++) for (let x = 0; x < 30; x++) ground[(by0 + 26 + y) * SIZE + bx0 + 16 + x] = T_ASPHALT;
    for (let i = 0; i < 5; i++)
      if (r() < 0.8) cars.push({ x: bx0 + 19 + i * 5.4, y: by0 + 30, axis: "y", color: pick(r, ["#7a3a2a", "#4a5560", "#9a9283", "#5a5e46"]), wreck: r() < 0.35 });
    lamps.push({ x: bx0 + 18, y: by0 + 44 }, { x: bx0 + 44, y: by0 + 44 });
  } else if (kind === "police") {
    put(bx0 + 19, by0 + 12, 24, 12, 2, "panel", "Полиция");
    cars.push({ x: bx0 + 24, y: by0 + 27, axis: "x", color: "#3a4a5c", wreck: false });
    fences.push({ x0: bx0 + 19, y0: by0 + 30, x1: bx0 + 43, y1: by0 + 30, axis: "x" });
  } else if (kind === "gas") {
    put(bx0 + 10, by0 + 10, 8, 6, 1, "kiosk", "АЗС");
    // нависающий козырёк колонок — плоская крыша на столбах (просто две колонки-контейнера)
    for (let y = 0; y < 10; y++) for (let x = 0; x < 24; x++) ground[(by0 + 24 + y) * SIZE + bx0 + 8 + x] = T_ASPHALT;
    containers.push({ x: bx0 + 14, y: by0 + 28 }, { x: bx0 + 24, y: by0 + 28 });
    lamps.push({ x: bx0 + 8, y: by0 + 24 }, { x: bx0 + 32, y: by0 + 24 });
  } else if (kind === "park") {
    // парк: без застройки, плотные деревья, скамейки, редкие аллеи
    for (let y = 0; y < BLOCK; y++)
      for (let x = 0; x < BLOCK; x++)
        if (x % 24 < 2 || y % 24 < 2) {
          const gx = bx0 + x,
            gy = by0 + y;
          if (ground[gy * SIZE + gx] === T_GRASS) ground[gy * SIZE + gx] = T_PATH;
        }
    for (let i = 0; i < 22; i++)
      trees.push({ x: bx0 + 3 + r() * (BLOCK - 6), y: by0 + 3 + r() * (BLOCK - 6), dead: r() < 0.4, v: Math.floor(r() * 3) });
    benches.push({ x: bx0 + 20, y: by0 + 20 }, { x: bx0 + 40, y: by0 + 42 }, { x: bx0 + 42, y: by0 + 18 });
    lamps.push({ x: bx0 + 14, y: by0 + 14 }, { x: bx0 + 48, y: by0 + 48 });
  }
}

// пространственный индекс твёрдых объектов (коллизии за O(1))
const SOLID_CELL = 16;
let solidGrid = new Map();
function addSolid(x, y, w, h, kind) {
  const x0 = Math.floor(x / SOLID_CELL),
    x1 = Math.floor((x + w) / SOLID_CELL);
  const y0 = Math.floor(y / SOLID_CELL),
    y1 = Math.floor((y + h) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const k = cx + "," + cy;
      if (!solidGrid.has(k)) solidGrid.set(k, []);
      solidGrid.get(k).push({ x, y, w, h, kind });
    }
}
function buildSolidIndex() {
  solidGrid = new Map();
  for (const b of buildings) addSolid(b.x, b.y, b.w, b.h, "building");
  for (const c of cars) addSolid(c.x, c.y, c.axis === "x" ? 4.4 : 1.8, c.axis === "x" ? 1.8 : 4.4, "car");
  for (const t of trees) addSolid(t.x - 0.4, t.y - 0.4, 0.8, 0.8, "tree");
  for (const l of lamps) addSolid(l.x - 0.15, l.y - 0.15, 0.3, 0.3, "lamp");
  for (const f of fences)
    addSolid(f.x0, f.y0 - (f.axis === "x" ? 0.05 : 0), f.axis === "x" ? f.x1 - f.x0 : 0.1, f.axis === "x" ? 0.1 : f.y1 - f.y0, "fence");
}

// ---------- чанки ----------
const CH = 8; // тайлов на сторону чанка
const chunkCache = new Map();
let groundSet = null;
let bakeCount = 0;
const DBG_SKIP = new Set((new URLSearchParams(location.search).get("no") || "").split(",").filter(Boolean));

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return T_GRASS;
  return ground[(y | 0) * SIZE + (x | 0)];
}

function bakeChunk(cx, cy) {
  bakeCount++;
  const c = mkCanvas(CH * 64 + 4, CH * 32 + 4); // 516×260 с полем 2px под вылет тайлов
  const g = c.getContext("2d");
  const ax = cx * CH,
    ay = cy * CH;
  // вершина ромба тайла (tx,ty) в локальных координатах канваса
  const local = (wx, wy) => ({
    x: (wx - wy - (ax - ay)) * 32 + CH * 32 + 2,
    y: (wx + wy - (ax + ay)) * 16 + 2,
  });
  // земля со сплошной текстурной заливкой (ключ TEX + multiply-тонировка в палитру)
  const TEXFILL = {
    [T_ASPHALT]: { tex: "asphalt", tint: "#5a616b" },
    [T_GRASS]: { tex: "dead_grass", tint: "#a09c80" },
    [T_DIRT]: { tex: "dirt", tint: null },
    [T_SIDEWALK]: { tex: "sidewalk", tint: "#9a9da2" },
    [T_FLOOR]: { tex: "wood_floor", tint: null },
    [T_PATH]: { tex: "dirt", tint: "#9a9278" },
    [T_SAND]: { tex: "dirt", tint: "#b0a888" },
  };
  const fillTextured = (t, tx, ty, p) => {
    const spec = TEXFILL[t],
      img = tex2x(spec.tex, DBG_SKIP.has("tint") ? null : spec.tint);
    if (!img) return false;
    g.save();
    g.translate(p.x, p.y);
    g.beginPath();
    g.moveTo(0, -1); // верхняя вершина ромба = точка (tx,ty)
    g.lineTo(32 + 1, 16);
    g.lineTo(0, 32 + 1);
    g.lineTo(-32 - 1, 16);
    g.closePath();
    g.clip();
    const o = local(0, 0);
    g.setTransform(32, 16, -32, 16, o.x, o.y);
    // рисуем ТОЛЬКО нужный срез 32×32 px композита, а не весь 1024²
    const period = 32; // композит 1024px на 32 м = 32 px/м
    const u0 = ((tx % period) + period) % period,
      v0 = ((ty % period) + period) % period;
    g.drawImage(img, u0 * 32, v0 * 32, 32, 32, tx, ty, 1, 1);
    g.restore();
    return true;
  };
  for (let ty = ay; ty < ay + CH; ty++)
    for (let tx = ax; tx < ax + CH; tx++) {
      const t = tileAt(tx, ty);
      const p = local(tx, ty);
      if (TEXFILL[t] && TEX[TEXFILL[t].tex] && fillTextured(t, tx, ty, p)) continue;
      const v = Math.floor(h2(tx, ty, 9) * 4);
      g.drawImage(groundSet[t][v], p.x - 34, p.y - 2);
    }
  // разметка осевых
  g.strokeStyle = "#b7a23c";
  g.lineWidth = 2;
  g.setLineDash([14, 12]);
  for (let ty = ay; ty < ay + CH; ty++)
    for (let tx = ax; tx < ax + CH; tx++) {
      const f = gflag[(ty | 0) * SIZE + (tx | 0)] || 0;
      if (!f) continue;
      const p1 = local(tx + 0.5, ty + (f === 1 ? 0 : 0.5));
      const p2 = local(tx + 0.5, ty + (f === 1 ? 1 : 0.5));
      const q1 = f === 2 ? local(tx, ty + 0.5) : p1;
      const q2 = f === 2 ? local(tx + 1, ty + 0.5) : p2;
      g.beginPath();
      g.moveTo(q1.x, q1.y);
      g.lineTo(q2.x, q2.y);
      g.stroke();
    }
  g.setLineDash([]);
  // бордюры: кромка тротуара к проезжей части
  if (!DBG_SKIP.has("curb"))
    for (let ty = ay - 1; ty <= ay + CH; ty++)
    for (let tx = ax - 1; tx <= ax + CH; tx++) {
      if (tileAt(tx, ty) !== T_SIDEWALK) continue;
      const p = local(tx, ty);
      const edges = [
        [T_ASPHALT === tileAt(tx, ty - 1), p.x, p.y - 16, p.x + 32, p.y], // север
        [T_ASPHALT === tileAt(tx + 1, ty), p.x + 32, p.y, p.x, p.y + 16], // восток
        [T_ASPHALT === tileAt(tx, ty + 1), p.x, p.y + 16, p.x - 32, p.y], // юг
        [T_ASPHALT === tileAt(tx - 1, ty), p.x - 32, p.y, p.x, p.y - 16], // запад
      ];
      for (const [hit, x1, y1, x2, y2] of edges) {
        if (!hit) continue;
        g.strokeStyle = "rgba(16,20,26,0.55)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x1, y1 + 1);
        g.lineTo(x2, y2 + 1);
        g.stroke();
        g.strokeStyle = "#83868c";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x1, y1 - 1);
        g.lineTo(x2, y2 - 1);
        g.stroke();
      }
    }
  // тени зданий (солнце с NW → тень на SE) + AO у основания
  if (DBG_SKIP.has("shadow")) return { canvas: c, ax, ay, sx: (ax - ay - CH) * 32 - 2, sy: (ax + ay) * 16 - 2, w: CH * 64 + 4, h: CH * 32 + 4 };
  for (const b of buildings) {
    // тень улетает на ~3 м за footprint — смотрим с запасом
    if (b.x + b.w + 4 < ax || b.y + b.h + 4 < ay || b.x - 1 > ax + CH || b.y - 1 > ay + CH) continue;
    const Z = b.floors * 3;
    const off = { x: Z * 7, y: Z * 3.5 };
    const pts = [
      [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
    ].map(([wx, wy]) => local(wx, wy));
    g.fillStyle = "rgba(16,20,26,0.30)";
    g.beginPath();
    // экструзия: сдвинутый полигон + боковые грани тени
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) g.lineTo(pts[i].x, pts[i].y);
    for (let i = 3; i >= 0; i--) g.lineTo(pts[i].x + off.x, pts[i].y + off.y);
    g.closePath();
    g.fill();
    // AO-полоса у южного и восточного основания
    g.strokeStyle = "rgba(16,20,26,0.28)";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(pts[3].x, pts[3].y + 2);
    g.lineTo(pts[2].x, pts[2].y + 2);
    g.lineTo(pts[1].x, pts[1].y + 2);
    g.stroke();
    // пепельные наносы у стен
    g.fillStyle = "rgba(194,190,178,0.13)";
    g.beginPath();
    g.moveTo(pts[3].x, pts[3].y + 7);
    g.lineTo(pts[2].x, pts[2].y + 7);
    g.lineTo(pts[2].x, pts[2].y + 12);
    g.lineTo(pts[3].x, pts[3].y + 12);
    g.closePath();
    g.fill();
  }
  // масляные пятна на дорогах (только без текстуры — текстура уже содержит свои)
  const r = mulberry32(cx * 733 + cy * 91 + 1);
  if (!TEX.asphalt)
    for (let i = 0; i < 4; i++) {
      const wx = ax + r() * CH,
        wy = ay + r() * CH;
      if (tileAt(wx | 0, wy | 0) !== T_ASPHALT) continue;
      const p = local(wx, wy);
      g.fillStyle = "rgba(14,16,20,0.35)";
      g.beginPath();
      g.ellipse(p.x, p.y, 10 + r() * 18, 4 + r() * 8, 0, 0, 7);
      g.fill();
    }
  // листва/хвоя под деревьями
  for (const t of trees) {
    if (t.x < ax || t.x >= ax + CH || t.y < ay || t.y >= ay + CH) continue;
    const p = local(t.x, t.y);
    g.fillStyle = t.dead ? "rgba(90,74,56,0.4)" : "rgba(61,71,53,0.5)";
    for (let i = 0; i < 14; i++) g.fillRect(p.x - 24 + r() * 48, p.y - 10 + r() * 22, 2.5, 1.6);
  }
  return { canvas: c, ax, ay, sx: (ax - ay - CH) * 32 - 2, sy: (ax + ay) * 16 - 2, w: CH * 64 + 4, h: CH * 32 + 4 };
}

function getChunk(cx, cy) {
  const k = cx + "," + cy;
  let ch = chunkCache.get(k);
  if (!ch) {
    ch = bakeChunk(cx, cy);
    chunkCache.set(k, ch);
  }
  return ch;
}

// ---------- актёры ----------
const player = { x: PITCH + 11 + 31, y: PITCH + 11 + 31, r: 0.35, speed: 0, pose: 0, animT: 0 };
const zombies = [];

// ---------- спрайты ----------
let SPR = null;
const buildingSpriteCache = new Map();
function buildingSprite(b) {
  const key = `${b.w}x${b.h}x${b.floors}x${b.style}x${b.doorU}`;
  let s = buildingSpriteCache.get(key);
  if (!s) {
    s = bakeBuilding(b, key.split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7));
    buildingSpriteCache.set(key, s);
  }
  return s;
}
function buildSprites() {
  groundSet = makeGroundSet();
  const carSpriteCache = new Map();
  const carSprite = (car) => {
    const key = car.color + car.axis + (car.wreck ? "w" : "");
    if (!carSpriteCache.has(key)) carSpriteCache.set(key, makeCar(car.color, car.wreck, car.axis));
    return carSpriteCache.get(key);
  };
  SPR = {
    trees: [0, 1, 2].map((v) => makeTree(false, v)),
    deadTrees: [0, 1, 2].map((v) => makeTree(true, v)),
    lamp: makeLamp(),
    bench: makeBench(),
    container: makeContainer(),
    tires: makeTires(),
    fenceX: makeFence("x"),
    fenceY: makeFence("y"),
    cars: cars.map(carSprite),
    player: [makeActor("player", 0), makeActor("player", 1)],
    zombie: [makeActor("zombie", 0), makeActor("zombie", 1)],
  };
}

// ---------- ввод ----------
const keys = {};
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyN") night = !night;
  if (e.code === "KeyZ") zoom = zoom === 1 ? 2 : 1;
});
addEventListener("keyup", (e) => (keys[e.code] = false));
let night = false;
let zoom = 1;

// ---------- обновление ----------
const cam = { x: PITCH + 11 + 31, y: PITCH + 11 + 31 };
function solidRectAt(x, y, r) {
  const x0 = Math.floor((x - r) / SOLID_CELL),
    x1 = Math.floor((x + r) / SOLID_CELL);
  const y0 = Math.floor((y - r) / SOLID_CELL),
    y1 = Math.floor((y + r) / SOLID_CELL);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const cell = solidGrid.get(cx + "," + cy);
      if (!cell) continue;
      for (const s of cell) {
        if (s.kind === "tree") {
          if (Math.hypot(x - (s.x + 0.4), y - (s.y + 0.4)) < 0.5 + r) return true;
        } else if (x > s.x - r && x < s.x + s.w + r && y > s.y - r && y < s.y + s.h + r) return true;
      }
    }
  return false;
}
function moveActor(a, dx, dy) {
  if (!solidRectAt(a.x + dx, a.y, a.r)) a.x += dx;
  if (!solidRectAt(a.x, a.y + dy, a.r)) a.y += dy;
  a.x = clamp(a.x, 1, SIZE - 1);
  a.y = clamp(a.y, 1, SIZE - 1);
}
function update(dt) {
  // WASD от экрана: W = вверх, D = вправо. В изометрии экранная ось = диагональ мира.
  const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const iy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  if (ix || iy) {
    const sp = (keys.ShiftLeft ? 5.4 : 3.2) * dt;
    const wx = ix + iy,
      wy = iy - ix;
    const n = Math.hypot(wx, wy);
    moveActor(player, (wx / n) * sp, (wy / n) * sp);
    player.animT += dt * 7;
    player.pose = Math.floor(player.animT) % 2;
  }
  for (const z of zombies) {
    // дальние зомби спят (не обновляем, не видны на экране)
    if (Math.abs(z.x - player.x) + Math.abs(z.y - player.y) > 80) continue;
    z.retarget -= dt;
    const dp = Math.hypot(player.x - z.x, player.y - z.y);
    if (dp < 6) {
      z.tx = player.x;
      z.ty = player.y;
    } else if (z.retarget <= 0) {
      z.retarget = 2 + h2(z.x | 0, z.y | 0, performance.now() | 0) * 4;
      z.tx = clamp(z.x + (h2(z.x | 0, z.y | 0, 5) - 0.5) * 24, 2, SIZE - 2);
      z.ty = clamp(z.y + (h2(z.x | 0, z.y | 0, 6) - 0.5) * 24, 2, SIZE - 2);
    }
    const dx = z.tx - z.x,
      dy = z.ty - z.y,
      d = Math.hypot(dx, dy);
    if (d > 0.3) {
      moveActor(z, (dx / d) * 0.85 * dt, (dy / d) * 0.85 * dt);
      z.animT += dt * 4;
      z.pose = Math.floor(z.animT) % 2;
    }
  }
  cam.x += (player.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (player.y - cam.y) * Math.min(1, dt * 6);
}

// ---------- освещение ----------
const lightCv = mkCanvas(W / 2, H / 2);
const lightCtx = lightCv.getContext("2d");
const warmCv = mkCanvas(W / 2, H / 2);
const warmCtx = warmCv.getContext("2d");

// пепел (screen-space)
const ashP = [];
for (let i = 0; i < 160; i++)
  ashP.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 1.8, p: Math.random() * 7, layer: i % 2 });

// ---------- рендер ----------
let drawCalls = 0;
function render(now) {
  drawCalls = 0;
  const camS = w2s(cam.x, cam.y);
  const toX = (sx) => (sx - camS.x) * zoom + W / 2;
  const toY = (sy) => (sy - camS.y) * zoom + H / 2;
  ctx.fillStyle = PAL.dark;
  ctx.fillRect(0, 0, W, H);
  drawCalls++;

  // земля-чанки: сначала отсев по видимости, потом bake
  const nCh = Math.ceil(SIZE / CH);
  const cw = (CH * 64 + 4) * zoom,
    chh = (CH * 32 + 4) * zoom;
  for (let cy = -2; cy < nCh + 2; cy++)
    for (let cx = -2; cx < nCh + 2; cx++) {
      const sx = (cx - cy - 1) * 256 - 2,
        sy = (cx + cy) * 128 - 2;
      const dx = (sx - camS.x) * zoom + W / 2,
        dy = (sy - camS.y) * zoom + H / 2;
      if (dx > W || dy > H || dx + cw < 0 || dy + chh < 0) continue;
      const ch = getChunk(cx, cy);
      ctx.drawImage(ch.canvas, dx, dy, cw, chh);
      drawCalls++;
    }
  // LRU: держим не более 600 чанков (~320 МБ потолок)
  if (chunkCache.size > 600) {
    let farKey = null,
      farD = -1;
    for (const [k, ch] of chunkCache) {
      const d = Math.hypot(ch.sx + 256 - camS.x, ch.sy + 128 - camS.y);
      if (d > farD) {
        farD = d;
        farKey = k;
      }
    }
    if (farKey) chunkCache.delete(farKey);
  }

  // высокий слой: z-сортировка по max(wx+wy) футпринта
  const items = [];
  const inside = playerInsideBuilding();
  // предпроверка видимости по якорю (мировые метры) и полуразмерам спрайта (px)
  const vis = (x, y, hw, hh) => {
    const sx = (x - y) * 32,
      sy = (x + y) * 16;
    const dx = (sx - camS.x) * zoom + W / 2,
      dy = (sy - camS.y) * zoom + H / 2;
    return dx + hw > -60 && dx - hw < W + 60 && dy + hh > -60 && dy - hh < H + 60;
  };
  for (const b of buildings) {
    if (!vis(b.x + b.w / 2, b.y + b.h / 2, (b.w + b.h) * 16 + 60, ((b.w + b.h) * 16 + b.floors * 96) / 2 + 60)) continue;
    items.push({ depth: b.x + b.w + (b.y + b.h), layer: 1, f: () => drawBuilding(b, toX, toY, inside === b) });
  }
  for (const t of trees) {
    if (!vis(t.x, t.y, 70, 120)) continue;
    items.push({
      depth: t.x + t.y,
      layer: 1,
      f: () => {
        const p = w2s(t.x, t.y);
        // спрайты Gemini: якорь низ-центр; дерево ~5,5–6,5 м
        const key = t.dead ? "tree_dead" : t.v === 1 ? "tree_birch" : "tree";
        const img = SPRTEX[key];
        if (img) {
          const h = (176 + t.v * 24) * zoom,
            w = h * (img.width / img.height);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        } else {
          ctx.drawImage(t.dead ? SPR.deadTrees[t.v] : SPR.trees[t.v], toX(p.x) - 64 * zoom, toY(p.y) - 150 * zoom, 128 * zoom, 160 * zoom);
        }
        drawCalls++;
      },
    });
  }
  for (const l of lamps) {
    if (!vis(l.x, l.y, 30, 110)) continue;
    items.push({
      depth: l.x + l.y,
      layer: 1,
      f: () => {
        const p = w2s(l.x, l.y);
        ctx.drawImage(SPR.lamp, toX(p.x) - 24 * zoom, toY(p.y) - 200 * zoom, 48 * zoom, 208 * zoom);
        drawCalls++;
      },
    });
  }
  for (const bch of benches) {
    if (!vis(bch.x, bch.y, 45, 30)) continue;
    items.push({
      depth: bch.x + bch.y,
      layer: 1,
      f: () => {
        const p = w2s(bch.x, bch.y);
        const img = SPRTEX.bench;
        if (img) {
          const w = 66 * zoom, // скамейка ~2 м длиной
            h = w * (img.height / img.width);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        } else ctx.drawImage(SPR.bench, toX(p.x) - 40 * zoom, toY(p.y) - 40 * zoom, 80 * zoom, 48 * zoom);
        drawCalls++;
      },
    });
  }
  for (const cn of containers) {
    if (!vis(cn.x, cn.y, 40, 35)) continue;
    items.push({
      depth: cn.x + cn.y,
      layer: 1,
      f: () => {
        const p = w2s(cn.x, cn.y);
        const img = SPRTEX.dumpster;
        if (img) {
          const w = 66 * zoom,
            h = w * (img.height / img.width);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        } else ctx.drawImage(SPR.container, toX(p.x) - 36 * zoom, toY(p.y) - 48 * zoom, 72 * zoom, 56 * zoom);
        drawCalls++;
      },
    });
  }
  for (const t of tires) {
    if (!vis(t.x, t.y, 32, 25)) continue;
    items.push({
      depth: t.x + t.y,
      layer: 1,
      f: () => {
        const p = w2s(t.x, t.y);
        const img = SPRTEX.tires;
        if (img) {
          const w = 48 * zoom,
            h = w * (img.height / img.width);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        } else ctx.drawImage(SPR.tires, toX(p.x) - 28 * zoom, toY(p.y) - 36 * zoom, 56 * zoom, 40 * zoom);
        drawCalls++;
      },
    });
  }
  for (const br of barrels) {
    if (!vis(br.x, br.y, 20, 22)) continue;
    items.push({
      depth: br.x + br.y,
      layer: 1,
      f: () => {
        const p = w2s(br.x, br.y);
        const img = SPRTEX.barrel;
        if (img) {
          const w = 30 * zoom, // бочка ~0,9 м
            h = w * (img.height / img.width);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        }
        drawCalls++;
      },
    });
  }
  for (const f of fences)
    for (let u = f.x0; u < (f.axis === "x" ? f.x1 : f.x0 + 1); u++)
      for (let v = f.y0; v < (f.axis === "y" ? f.y1 : f.y0 + 1); v++) {
        if (!vis(u + 0.5, v + 0.5, 36, 40)) continue;
        items.push({
          depth: u + v + 0.5,
          layer: 1,
          f: () => {
            const p = w2s(u, v);
            ctx.drawImage(f.axis === "x" ? SPR.fenceX : SPR.fenceY, toX(p.x) - 32 * zoom, toY(p.y) - 38 * zoom, 64 * zoom, 76 * zoom);
            drawCalls++;
          },
        });
      }
  cars.forEach((car, i) => {
    const w = car.axis === "x" ? 4.4 : 1.8,
      h = car.axis === "x" ? 1.8 : 4.4;
    if (!vis(car.x + w / 2, car.y + h / 2, 120, 90)) return;
    items.push({
      depth: car.x + w + (car.y + h),
      layer: 1,
      f: () => {
        const p = w2s(car.x, car.y);
        ctx.drawImage(SPR.cars[i], toX(p.x) - 112 * zoom, toY(p.y) - 46 * zoom, 224 * zoom, 170 * zoom);
        drawCalls++;
      },
    });
  });
  for (const z of zombies) {
    if (!vis(z.x, z.y, 40, 55)) continue;
    items.push({ depth: z.x + z.y + 0.01, layer: 2, f: () => drawActor(z, SPR.zombie, toX, toY) });
  }
  items.push({ depth: player.x + player.y + 0.01, layer: 2, f: () => drawActor(player, SPR.player, toX, toY) });

  items.sort((a, b) => a.depth - b.depth || a.layer - b.layer);
  for (const it of items) it.f();

  // ночь
  if (night) renderNight(toX, toY, inside);

  // пепел поверх всего
  ctx.fillStyle = "rgba(194,190,178,0.5)";
  for (const a of ashP) {
    ctx.globalAlpha = 0.2 + 0.25 * a.s * 0.4;
    ctx.fillRect(a.x, a.y, a.s, a.s * 0.8);
  }
  ctx.globalAlpha = 1;
  drawCalls++;

  // виньетка
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = night ? 0.55 : 0.4;
  ctx.drawImage(vignette, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  drawCalls++;
}

function drawBuilding(b, toX, toY, ghost) {
  const spr = buildingSprite(b);
  const ox = (b.x - b.y) * 32 + spr.minX,
    oy = (b.x + b.y) * 16 + spr.minY;
  const dx = toX(ox),
    dy = toY(oy);
  if (dx > W || dy > H || dx + spr.canvas.width * zoom < 0 || dy + spr.canvas.height * zoom < 0) return;
  if (ghost) ctx.globalAlpha = 0.15;
  ctx.drawImage(spr.canvas, dx, dy, spr.canvas.width * zoom, spr.canvas.height * zoom);
  drawCalls++;
  if (ghost) ctx.globalAlpha = 1;
}

function drawActor(a, sprites, toX, toY) {
  const p = w2s(a.x, a.y);
  // контактная тень
  ctx.fillStyle = "rgba(16,20,26,0.35)";
  ctx.beginPath();
  ctx.ellipse(toX(p.x), toY(p.y), 14 * zoom, 6 * zoom, 0, 0, 7);
  ctx.fill();
  const img = SPRTEX[a === player ? "survivor" : "zombie"];
  if (img) {
    const h = 78 * zoom; // ~2,4 м — читаемость важнее строгого масштаба (как в PZ)
    const w = h * (img.width / img.height);
    const bob = Math.sin(a.animT * 2.2) * 2.5 * zoom;
    ctx.save();
    ctx.translate(toX(p.x), toY(p.y));
    ctx.rotate(Math.sin(a.animT * 2.2) * 0.04);
    ctx.drawImage(img, -w / 2, -h + bob, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(sprites[a.pose], toX(p.x) - 32 * zoom, toY(p.y) - 88 * zoom, 64 * zoom, 96 * zoom);
  }
  drawCalls += 2;
}

function renderNight(toX, toY, inside) {
  const L = lightCtx,
    s = 0.5; // half-res
  L.globalCompositeOperation = "source-over";
  L.fillStyle = "rgba(10,14,24,0.72)";
  L.fillRect(0, 0, W / 2, H / 2);
  L.globalCompositeOperation = "destination-out";
  for (const l of lamps) {
    const p = w2s(l.x, l.y);
    L.drawImage(glowLamp, (toX(p.x) - 144 * zoom) * s, (toY(p.y) - 40 * zoom) * s, 288 * zoom * s, 144 * zoom * s);
  }
  const pp = w2s(player.x, player.y);
  // центр эллипса — на середине тела персонажа, а не на ступнях
  L.drawImage(glowPlayer, (toX(pp.x) - 220 * zoom) * s, (toY(pp.y) - 158 * zoom) * s, 440 * zoom * s, 220 * zoom * s);
  // тёплый ореол
  const Wc = warmCtx;
  Wc.globalCompositeOperation = "source-over";
  Wc.fillStyle = "#000";
  Wc.fillRect(0, 0, W / 2, H / 2);
  Wc.globalCompositeOperation = "lighter";
  for (const l of lamps) {
    const p = w2s(l.x, l.y);
    Wc.drawImage(glowWarmLamp, (toX(p.x) - 144 * zoom) * s, (toY(p.y) - 40 * zoom) * s, 288 * zoom * s, 144 * zoom * s);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCv, 0, 0, W, H);
  // холодная «лунная» подсветка, чтобы читались силуэты зданий
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(60,76,110,0.14)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(warmCv, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = false;
  // светящиеся окна — после затемнения, их не гасим
  ctx.globalCompositeOperation = "lighter";
  for (const b of buildings) {
    if (b === inside) continue;
    const spr = buildingSprite(b);
    const ox = (b.x - b.y) * 32 + spr.minX,
      oy = (b.x + b.y) * 16 + spr.minY;
    const dx = toX(ox),
      dy = toY(oy);
    if (dx > W || dy > H || dx + spr.canvas.width * zoom < 0 || dy + spr.canvas.height * zoom < 0) continue;
    ctx.drawImage(spr.litCanvas, dx, dy, spr.litCanvas.width * zoom, spr.litCanvas.height * zoom);
    drawCalls++;
  }
  ctx.globalCompositeOperation = "source-over";
  drawCalls += 2;
}

function playerInsideBuilding() {
  for (const b of buildings)
    if (player.x > b.x + 0.2 && player.x < b.x + b.w - 0.2 && player.y > b.y + 0.2 && player.y < b.y + b.h - 0.2) return b;
  return null;
}

// ---------- главный цикл ----------
let lastT = performance.now();
let fpsE = 60,
  msE = 16;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  const t0 = performance.now();
  update(dt);
  render(t / 1000);
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
  hud.textContent = `ПЕПЕЛОПАД · iso-прототип · город ${SIZE}×${SIZE} м · зданий ${buildings.length}
FPS ${fpsE.toFixed(0)} · кадр ${msE.toFixed(1)} мс · drawImage ${drawCalls} · чанков ${chunkCache.size}
позиция ${player.x.toFixed(1)}, ${player.y.toFixed(1)} · ${night ? "НОЧЬ" : "день"} · zoom ×${zoom}
WASD — движение · Shift — бег · N — день/ночь · Z — зум
Зайди в подъезд (коричневая дверь) — сработает cutaway`;
  requestAnimationFrame(frame);
}

async function boot() {
  await loadTextures();
  await loadSpriteTex();
  genCity(Number(new URLSearchParams(location.search).get("seed")) || 11);
  buildSprites();
  fitViewport();
  addEventListener("resize", fitViewport);
  // отладочный доступ из консоли/тестов
  window.__iso = {
    player,
    zombies,
    cam,
    buildings,
    chunkCache,
    getChunk,
    teleport: (x, y) => {
      player.x = x;
      player.y = y;
      cam.x = x;
      cam.y = y;
    },
    setNight: (v) => (night = v),
  };
  requestAnimationFrame(frame);
}
boot();
