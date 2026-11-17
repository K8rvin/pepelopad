// Процедурные спрайты-заглушки (фонарь, забор, скамейка, контейнер, покрышки,
// машина, персонаж) — используются, если Gemini-спрайт не загружен.
import { mulberry32 } from "../core/rng.js";
import { PAL, mkCanvas, w2s, ZH, shade } from "../core/geo.js";

export function makeTree(dead, variant) {
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
      g.fillStyle =
        h2local(i, variant) < 0.25
          ? "#55614a"
          : h2local(i, variant, 2) < 0.5
            ? PAL.bush
            : "#3d4735";
      g.beginPath();
      g.ellipse(px, py, 9 + r() * 12, 6 + r() * 8, 0, 0, 7);
      g.fill();
    }
  }
  return c;
}
function h2local(i, v, s = 0) {
  return (
    ((Math.imul(i + 1, 2654435761) ^
      Math.imul(v + 1, 40503) ^
      Math.imul(s + 1, 97)) >>>
      0) /
    4294967296
  );
}

export function makeLamp() {
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

export function makeBench() {
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

export function makeContainer() {
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

export function makeTires() {
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

export function makeCar(color, wreck, axis) {
  // машина 4.4×1.8 м, высота 1.45 м
  const L = 4.4,
    Wd = 1.8,
    Hh = 1.45;
  const c = mkCanvas(224, 170);
  const g = c.getContext("2d");
  const P = (wx, wy, wz) => {
    const p = w2s(axis === "x" ? wx : wy, axis === "x" ? wy : wx, wz);
    return { x: p.x + 112, y: p.y + 46 };
  };
  const A = P(0, 0, 0),
    B = P(L, 0, 0),
    C = P(0, Wd, 0),
    D = P(L, Wd, 0);
  const Dz = (p) => ({ x: p.x, y: p.y - Hh * ZH });
  const Az = Dz(A),
    Bz = Dz(B),
    Cz = Dz(C),
    Dzz = Dz(D);
  g.fillStyle = "#15181b";
  for (const [wx, wy] of [
    [0.9, 0],
    [3.5, 0],
    [0.9, Wd],
    [3.5, Wd],
  ]) {
    const p = P(wx, wy, 0);
    g.beginPath();
    g.ellipse(p.x, p.y - 4, 11, 6, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(C.x, C.y);
  g.lineTo(D.x, D.y);
  g.lineTo(Dzz.x, Dzz.y);
  g.lineTo(Cz.x, Cz.y);
  g.closePath();
  g.fill();
  g.fillStyle = shade(color, 0.78);
  g.beginPath();
  g.moveTo(B.x, B.y);
  g.lineTo(D.x, D.y);
  g.lineTo(Dzz.x, Dzz.y);
  g.lineTo(Bz.x, Bz.y);
  g.closePath();
  g.fill();
  const cab = 0.62;
  const cA = P(L * 0.18, Wd * 0.12, Hh),
    cB = P(L * cab, Wd * 0.12, Hh),
    cC = P(L * 0.18, Wd * 0.88, Hh),
    cD = P(L * cab, Wd * 0.88, Hh);
  const cH = 0.55 * ZH;
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
  g.fillStyle = shade(color, 1.12);
  g.beginPath();
  g.moveTo(cA.x, cA.y - cH);
  g.lineTo(cB.x, cB.y - cH);
  g.lineTo(cD.x, cD.y - cH);
  g.lineTo(cC.x, cC.y - cH);
  g.closePath();
  g.fill();
  g.fillStyle = shade(color, 1.08);
  for (const [x0, x1] of [
    [0, 0.18],
    [cab, 1],
  ]) {
    const p1 = P(L * x0, 0, Hh),
      p2 = P(L * x1, 0, Hh),
      p3 = P(L * x1, Wd, Hh),
      p4 = P(L * x0, Wd, Hh);
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
    for (let i = 0; i < 8; i++)
      g.fillRect(60 + r() * 110, 40 + r() * 60, 5 + r() * 12, 3 + r() * 8);
  }
  g.fillStyle = "#c9c04a";
  g.fillRect(B.x - 4, B.y - 30, 4, 4);
  return c;
}

// забор-рабица: сегмент 1 м вдоль оси
export function makeFence(axis) {
  const c = mkCanvas(64, 76);
  const g = c.getContext("2d");
  const a = axis === "x" ? 1 : -1;
  const oy = 22;
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

export function makeActor(kind, pose) {
  const c = mkCanvas(64, 96);
  const g = c.getContext("2d");
  const cx = 32;
  const zombie = kind === "zombie";
  const skin = zombie ? "#8a9a7a" : "#c8a080";
  const cloth = zombie ? "#5a4a38" : "#4a5560";
  const pants = zombie ? "#3a3f3a" : "#2e3440";
  const bob = pose ? 2 : 0;
  const lean = zombie ? 4 : 0;
  g.fillStyle = pants;
  g.fillRect(cx - 7 + (pose ? 3 : 0), 58, 6, 26 - bob);
  g.fillRect(cx + 2 - (pose ? 3 : 0), 58 + bob, 6, 26 - bob);
  g.fillStyle = cloth;
  g.beginPath();
  g.roundRect(cx - 10 + lean, 30, 20, 30, 5);
  g.fill();
  g.fillStyle = shade(cloth, 0.85);
  g.fillRect(cx - 13 + lean, 33, 5, 22);
  g.fillRect(cx + 9 + lean, 33 + (pose ? 2 : 0), 5, 22);
  g.fillStyle = skin;
  g.beginPath();
  g.arc(cx + lean, 22, 9, 0, 7);
  g.fill();
  if (!zombie) {
    g.fillStyle = "#3a3f45";
    g.beginPath();
    g.arc(cx, 19, 9, Math.PI, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = PAL.blood;
    g.fillRect(cx + lean - 4, 28, 6, 4);
  }
  return c;
}
