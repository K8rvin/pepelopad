// Лаборатория походки (клавиша G): варианты рядом на одном спрайте, шаг на
// месте с бегущей разметкой; «применить» переключает походку в игре (R.gait).
// DOM принадлежит этому модулю; кадры рисует renderGaitLab из главного цикла.
import { GAITS, GAIT_LIST } from "../render/gait.js";
import { SPRTEX } from "../render/assets.js";

export function createGaitLab() {
  return { open: false, el: null, rows: [] };
}

export function toggleGaitLab(L, R) {
  if (!L.el) build(L, R);
  L.open = !L.open;
  L.el.style.display = L.open ? "flex" : "none";
  if (L.open) syncButtons(L, R);
}

function build(L, R) {
  const el = document.createElement("div");
  el.id = "gaitlab";
  el.innerHTML =
    '<div class="gl-head">ЛАБОРАТОРИЯ ПОХОДКИ · G<button id="glClose">×</button></div>';
  for (const g of GAIT_LIST) {
    const row = document.createElement("div");
    row.className = "gl-row";
    row.innerHTML =
      '<canvas width="100" height="120"></canvas>' +
      `<div class="gl-txt"><b>${g.name}</b><span>${g.desc}</span>` +
      `<button data-gait="${g.key}">применить</button></div>`;
    el.appendChild(row);
    const btn = row.querySelector("button");
    btn.addEventListener("click", () => {
      R.gait = g.key;
      syncButtons(L, R);
    });
    L.rows.push({ key: g.key, cv: row.querySelector("canvas"), btn });
  }
  el.querySelector("#glClose").addEventListener("click", () =>
    toggleGaitLab(L, R),
  );
  document.body.appendChild(el);
  L.el = el;
}

function syncButtons(L, R) {
  for (const r of L.rows) {
    const on = R.gait === r.key;
    r.btn.textContent = on ? "в игре ✓" : "применить";
    r.btn.classList.toggle("sel", on);
  }
}

export function renderGaitLab(L, R, SPR, t) {
  const img = SPRTEX.survivor || SPR.player[0];
  if (!img) return;
  const u = 1.2;
  const h = 78 * u,
    w = h * (img.width / img.height);
  for (const r of L.rows) {
    const g = r.cv.getContext("2d");
    g.clearRect(0, 0, r.cv.width, r.cv.height);
    g.strokeStyle = "#3b4148";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 112);
    g.lineTo(100, 112);
    g.stroke();
    // бегущая разметка: шаг на месте читается как движение
    g.strokeStyle = "#5b6065";
    g.setLineDash([6, 8]);
    g.lineDashOffset = (t * 150) % 14;
    g.beginPath();
    g.moveTo(0, 115);
    g.lineTo(100, 115);
    g.stroke();
    g.setLineDash([]);
    g.save();
    g.translate(50, 112);
    g.fillStyle = "rgba(16,20,26,0.35)";
    g.beginPath();
    g.ellipse(0, 0, 14 * u, 6 * u, 0, 0, 7);
    g.fill();
    GAITS[r.key](g, img, w, h, u, t * 10, true);
    g.restore();
  }
}
