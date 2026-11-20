// Запечённые спрайты зданий: стены (Gemini-текстуры или процедурные), крыша,
// окна (дневные + светящиеся ночные), дверь, вентиляция. Общий спрайт на архетип.
import { mulberry32, h2 } from "../core/rng.js";
import { PAL, mkCanvas, w2s, ZH } from "../core/geo.js";
import { TEX, SPRTEX } from "./assets.js";

// процедурные текстуры стен/крыши (fallback)
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
      for (let x = (y / 12) % 2 ? 0 : 16; x < 96; x += 32)
        g.fillRect(x, y, 1.5, 12);
  } else if (style === "kiosk") {
    g.fillStyle = "#565b52";
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "rgba(16,20,26,0.4)";
    for (let x = 0; x < 96; x += 8) g.fillRect(x, 0, 2, 96);
    g.fillStyle = "rgba(138,74,40,0.35)";
    for (let i = 0; i < 6; i++)
      g.fillRect(r() * 90, r() * 60, 3, 20 + r() * 30);
  } else {
    g.fillStyle = PAL.panel;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = "rgba(40,38,30,0.35)";
    g.fillRect(0, 0, 96, 2);
    g.fillRect(47, 0, 2, 96);
    g.fillRect(95, 0, 1, 96);
  }
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

// сайдинг пригородного дома (горизонтальная доска)
function makeSidingTexture() {
  const c = mkCanvas(96, 96);
  const g = c.getContext("2d");
  const r = mulberry32(131);
  g.fillStyle = "#8f9484";
  g.fillRect(0, 0, 96, 96);
  for (let y = 0; y < 96; y += 8) {
    g.fillStyle = "rgba(16,20,26,0.25)";
    g.fillRect(0, y + 7, 96, 1.5);
    g.fillStyle = "rgba(230,230,220,0.12)";
    g.fillRect(0, y, 96, 1);
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(16,20,26,0.06)" : "rgba(230,230,220,0.05)";
    g.fillRect(r() * 96, r() * 96, 1 + r() * 2, 1 + r() * 2);
  }
  return c;
}

// черепица двускатной крыши (гонты со смещением рядов)
function makeShingleTexture() {
  const c = mkCanvas(64, 64);
  const g = c.getContext("2d");
  const r = mulberry32(477);
  g.fillStyle = "#6a625a";
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    g.fillStyle = "rgba(16,20,26,0.3)";
    g.fillRect(0, y + 7, 64, 1.5);
    for (let x = (y / 8) % 2 ? 0 : 8; x < 64; x += 16) {
      g.fillStyle = "rgba(16,20,26,0.22)";
      g.fillRect(x, y, 1.5, 8);
    }
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() < 0.6 ? "rgba(16,20,26,0.08)" : "rgba(230,230,220,0.07)";
    g.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1 + r() * 2);
  }
  return c;
}

let wallTex = null,
  roofTex = null,
  shingleTex = null;
function ensureFallbackTextures() {
  if (!wallTex)
    wallTex = {
      panel: makePanelTexture("panel"),
      brick: makePanelTexture("brick"),
      kiosk: makePanelTexture("kiosk"),
      house: makeSidingTexture(),
    };
  if (!roofTex) roofTex = makeRoofTexture();
  if (!shingleTex) shingleTex = makeShingleTexture();
}

// окна
function makeWindowSprite(lit) {
  const c = mkCanvas(30, 46);
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,18,14,0.85)";
  g.fillRect(0, 0, 30, 46);
  g.fillStyle = "#8f8a7c";
  g.fillRect(2, 2, 26, 40);
  g.fillStyle = lit ? PAL.warm : "#22303c";
  g.fillRect(4, 4, 22, 36);
  if (lit) {
    g.fillStyle = "#ffe3b0";
    g.fillRect(7, 7, 8, 12);
    g.fillStyle = "rgba(20,16,8,0.55)";
    g.fillRect(4, 20, 22, 3);
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
  g.fillRect(1, 42, 28, 4);
  return c;
}

// световые спрайты (эллипсы 2:1 для iso)
export function makeGlowSprite(w, h, color, inner = 0.12) {
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(inner, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  g.translate(-w / 2, -h / 2);
  g.fillStyle = grad;
  g.fillRect(0, (h - w) / 2, w, w);
  g.restore();
  return c;
}

let winDay = null,
  winLit = null,
  glowWarmWin = null;
function ensureWindowSprites() {
  if (!winDay) winDay = makeWindowSprite(false);
  if (!winLit) winLit = makeWindowSprite(true);
  if (!glowWarmWin)
    glowWarmWin = makeGlowSprite(90, 60, "rgba(255,180,92,0.85)");
}

// запечь спрайт здания в локальных координатах (как будто здание в (0,0))
function bakeBuilding(b, seedKey) {
  ensureFallbackTextures();
  ensureWindowSprites();
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
  // двускатная крыша дома: конёк вдоль длинной оси на +1,6 м
  const house = b.style === "house";
  const wide = b.w >= b.h;
  const Zr = Z + 1.6;
  const rA = house
    ? wide
      ? w2s(bx, by + b.h / 2, Zr)
      : w2s(bx + b.w / 2, by, Zr)
    : null;
  const rB = house
    ? wide
      ? w2s(bx + b.w, by + b.h / 2, Zr)
      : w2s(bx + b.w / 2, by + b.h, Zr)
    : null;
  const corners = [c000, c100, c010, c110, c00z, c10z, c11z, c01z];
  if (house) corners.push(rA, rB);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
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
    g.fillStyle = g.createPattern(tex, "repeat");
    g.fillRect(0, 0, lenMeters * 32, Z * 32);
    if (darker) {
      g.fillStyle = "rgba(16,20,26,0.22)";
      g.fillRect(0, 0, lenMeters * 32, Z * 32);
    }
    g.fillStyle = "rgba(16,20,26,0.45)";
    g.fillRect(0, Z * 32 - 3, lenMeters * 32, 3);
    g.restore();
  }
  wall(c100, -1, b.h, true); // восточная, в тени
  wall(c010, 1, b.w, false); // южная
  // крыша: плоская (рубероид) или двускатная (черепица) у домов
  if (house) {
    // видимый скат: южный у широких домов, восточный у вытянутых
    const slope = wide ? [c01z, c11z, rB, rA] : [c10z, c11z, rB, rA];
    const gable = wide ? [c10z, c11z, rB] : [c01z, c11z, rB];
    const sm = wide
      ? [1, 0.5, -1, 0.5 + 3.2 / b.h, rA.x - minX, rA.y - minY]
      : [-1, 0.5, 1, 0.5 + 3.2 / b.w, rA.x - minX, rA.y - minY];
    const ss = wide ? [b.w * 32, (b.h / 2) * 32] : [b.h * 32, (b.w / 2) * 32];
    const gm = wide
      ? [-1, 0.5, 0, -1, c10z.x - minX, c10z.y - minY]
      : [1, 0.5, 0, -1, c01z.x - minX, c01z.y - minY];
    const gs = wide ? b.h * 32 : b.w * 32;
    const poly = (pts) => {
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
    };
    // дальний скат (северный у широких, западный у вытянутых): при подъёме
    // камеры 26,6° и уклоне крыши ~20° над коньком видна его полоса
    const far = wide ? [c00z, c10z, rB, rA] : [c00z, c01z, rB, rA];
    const fm = wide
      ? [1, 0.5, 1, -0.5 - 3.2 / b.h, rA.x - minX, rA.y - minY]
      : [-1, 0.5, -1, -0.5 - 3.2 / b.w, rA.x - minX, rA.y - minY];
    const fs = wide ? [b.w * 32, (b.h / 2) * 32] : [b.h * 32, (b.w / 2) * 32];
    g.save();
    poly(far);
    g.clip();
    g.setTransform(...fm);
    g.fillStyle = g.createPattern(TEX.roof_shingles || shingleTex, "repeat");
    g.fillRect(0, 0, fs[0], fs[1]);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "rgba(16,20,26,0.35)";
    g.fill();
    g.restore();
    g.save();
    poly(slope);
    g.clip();
    g.setTransform(...sm);
    g.fillStyle = g.createPattern(TEX.roof_shingles || shingleTex, "repeat");
    g.fillRect(0, 0, ss[0], ss[1]);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "rgba(40,44,48,0.25)";
    g.fill();
    g.restore();
    g.save();
    poly(gable);
    g.clip();
    g.setTransform(...gm);
    g.fillStyle = g.createPattern(tex, "repeat");
    g.fillRect(0, 0, gs, 52); // v вверх (d=-1): фронтон над кромкой стены
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "rgba(16,20,26,0.22)";
    g.fill();
    g.restore();
    // конёк и кромки ската
    g.strokeStyle = "rgba(16,20,26,0.7)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(rA.x, rA.y);
    g.lineTo(rB.x, rB.y);
    g.moveTo(slope[0].x, slope[0].y);
    g.lineTo(rA.x, rA.y);
    g.moveTo(slope[1].x, slope[1].y);
    g.lineTo(rB.x, rB.y);
    g.stroke();
  } else {
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
      g.fillStyle = g.createPattern(TEX.roof_felt, "repeat");
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
    // вентиляция на плоской крыше
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
  }
  // окна + ночная подложка
  const lit = mkCanvas(cnv.width, cnv.height);
  const gl = lit.getContext("2d");
  gl.translate(-minX, -minY);
  const faces = [
    { dx: 1, len: b.w },
    { dx: 0, len: b.h },
  ];
  let wi = 0;
  for (const f of faces)
    for (let fl = 0; fl < b.floors; fl++)
      for (let u = 1.8; u < f.len - 1.8; u += 2.5) {
        if (f.dx === 1 && fl === 0 && Math.abs(u - b.doorU) < 1.6) continue;
        const base =
          f.dx === 1
            ? w2s(bx + u, by + b.h, fl * 3 + 0.9)
            : w2s(bx + b.w, by + u, fl * 3 + 0.9);
        if (SPRTEX.win_intact) {
          // окно Gemini, наклонённое по стене; учитываем сдвиг канваса (-minX, -minY)
          g.save();
          g.setTransform(
            f.dx === 1 ? 1 : -1,
            0.5,
            0,
            1,
            base.x - minX - (f.dx === 1 ? 22 : 0),
            base.y - minY,
          );
          g.drawImage(SPRTEX.win_intact, 0, -48, 45, 48);
          g.restore();
        } else {
          g.drawImage(winDay, base.x - 15, base.y - 46 + 4);
        }
        if (h2(seedKey + fl, wi, 3) < 0.3) {
          gl.drawImage(winLit, base.x - 15, base.y - 46 + 4);
          gl.globalAlpha = 0.5;
          gl.drawImage(glowWarmWin, base.x - 45, base.y - 46);
          gl.globalAlpha = 1;
        }
        wi++;
      }
  // дверь на южной грани
  const dp = w2s(bx + b.doorU, by + b.h, 0);
  if (SPRTEX.door_entry) {
    g.save();
    g.setTransform(1, 0.5, 0, 1, dp.x - minX - 17, dp.y - minY + 4);
    g.drawImage(SPRTEX.door_entry, 0, -72, 34, 72);
    g.restore();
    g.fillStyle = "#ffb45c";
    g.fillRect(dp.x - 13, dp.y - 74, 26, 3); // козырёк-лампа
    g.fillStyle = "#6f6650";
    g.fillRect(dp.x - 20, dp.y + 2, 40, 4); // ступень
  } else {
    g.fillStyle = "#241d14";
    g.fillRect(dp.x - 16, dp.y - 68, 32, 68);
    g.fillStyle = "#4a3b26";
    g.fillRect(dp.x - 13, dp.y - 64, 26, 64);
    g.fillStyle = "#ffb45c";
    g.fillRect(dp.x - 13, dp.y - 70, 26, 3);
    g.fillStyle = "#6f6650";
    g.fillRect(dp.x - 20, dp.y - 4, 40, 4);
  }
  return { canvas: cnv, litCanvas: lit, minX, minY };
}
const spriteCache = new Map();
export function buildingSprite(b) {
  const key = `${b.w}x${b.h}x${b.floors}x${b.style}x${b.doorU}`;
  let s = spriteCache.get(key);
  if (!s) {
    const seedKey = key
      .split("")
      .reduce((a, ch) => ((a * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0, 7);
    s = bakeBuilding(b, seedKey);
    spriteCache.set(key, s);
  }
  return s;
}

// экранная позиция спрайта здания-экземпляра
export function buildingSpriteOffset(b) {
  const spr = buildingSprite(b);
  return {
    ox: (b.x - b.y) * 32 + spr.minX,
    oy: (b.x + b.y) * 16 + spr.minY,
    spr,
  };
}
