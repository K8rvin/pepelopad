// Карта в ИЗОМЕТРИИ (как мир): миникарта-ромб + большая карта с pan/zoom/маркером.
// Полезные иконки: игрок, цель, лагеря, база, POI. Только читает состояние мира.
import { ROAD, PITCH } from "../world/cityGen.js";
import { campDef } from "../systems/camps.js";

// изометрическая проекция мира в экран карты (2:1, как рендер)
export function worldToMap(wx, wy, view) {
  const ix = (wx - wy) * 32,
    iy = (wx + wy) * 16;
  const cx = (view.cx - view.cy) * 32,
    cy = (view.cx + view.cy) * 16;
  return {
    x: (ix - cx) * view.scale + view.w / 2,
    y: (iy - cy) * view.scale + view.h / 2,
  };
}

export function mapToWorld(mx, my, view) {
  const ix = (mx - view.w / 2) / view.scale + (view.cx - view.cy) * 32;
  const iy = (my - view.h / 2) / view.scale + (view.cx + view.cy) * 16;
  return { x: (ix / 32 + iy / 16) / 2, y: (iy / 16 - ix / 32) / 2 };
}

export function clampView(view, SIZE) {
  return {
    ...view,
    scale: Math.min(0.3, Math.max(0.002, view.scale)),
    cx: Math.min(SIZE, Math.max(0, view.cx)),
    cy: Math.min(SIZE, Math.max(0, view.cy)),
  };
}

const POI_COLOR = {
  Парк: "#6a8a4a",
  Супермаркет: "#ffb23e",
  Школа: "#5a8ab0",
  Больница: "#c05a4a",
  Полиция: "#7a86c8",
  АЗС: "#d08a3c",
  Мотель: "#d0a03c",
  Автомастерская: "#8a9096",
};
const POI_LETTER = {
  Парк: "П",
  Супермаркет: "М",
  Школа: "Ш",
  Больница: "Б",
  Полиция: "О",
  АЗС: "З",
  Мотель: "М",
  Автомастерская: "А",
};

function quad(g, v, x1, y1, x2, y2) {
  const a = worldToMap(x1, y1, v),
    b = worldToMap(x2, y1, v),
    c = worldToMap(x2, y2, v),
    d = worldToMap(x1, y2, v);
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.lineTo(d.x, d.y);
  g.closePath();
}

export function createMap({ minimapCanvas, bigRoot, city }) {
  const SIZE = city.SIZE;
  const mm = minimapCanvas.getContext("2d");
  const MM = 168;
  minimapCanvas.width = MM;
  minimapCanvas.height = MM;

  bigRoot.innerHTML = `
    <canvas id="bigmapCv"></canvas>
    <div id="bigmapTitle">Карта района (изометрия)</div>
    <button id="bigmapClose">×</button>
    <div id="bigmapLegend">
      <span><i style="background:#fff"></i>Вы</span>
      <span><i style="background:#ffb23e"></i>Цель</span>
      <span><i style="background:#e07a3a"></i>Лагерь</span>
      <span><i style="background:#7ac06a"></i>База</span>
      <span><i style="background:#e06a9a"></i>Маркер</span>
    </div>
    <div id="bigmapHint">ЛКМ — маркер · колесо — зум · перетаскивание — обзор · M / Esc — закрыть</div>`;
  const bigCv = bigRoot.querySelector("#bigmapCv");
  const bg = bigCv.getContext("2d");
  let bigOpen = false;
  let view = { cx: SIZE / 2, cy: SIZE / 2, scale: 0.01, w: 800, h: 600 };
  let marker = null;
  let state = null;
  let acc = 0;
  let drag = null;

  function fitBig() {
    bigCv.width = innerWidth;
    bigCv.height = innerHeight;
    view.w = bigCv.width;
    view.h = bigCv.height;
  }
  function resetBigView() {
    view.cx = SIZE / 2;
    view.cy = SIZE / 2;
    view.scale =
      Math.min(view.w / (2 * SIZE * 32), view.h / (2 * SIZE * 16)) * 0.92;
  }

  function icon(g, x, y, kind, r) {
    g.save();
    g.translate(x, y);
    if (kind === "player") {
      g.fillStyle = "#10141a";
      g.beginPath();
      g.arc(0, 0, r + 2, 0, 7);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(0, -r - 1);
      g.lineTo(r, r);
      g.lineTo(0, r * 0.4);
      g.lineTo(-r, r);
      g.closePath();
      g.fill();
    } else if (kind === "quest") {
      g.fillStyle = "#ffb23e";
      g.beginPath();
      g.moveTo(0, -r - 2);
      g.lineTo(r + 2, 0);
      g.lineTo(0, r + 2);
      g.lineTo(-r - 2, 0);
      g.closePath();
      g.fill();
      g.fillStyle = "#10141a";
      g.font = `bold ${r + 2}px monospace`;
      g.textAlign = "center";
      g.fillText("!", 0, r * 0.5);
    } else if (kind === "camp") {
      g.fillStyle = "#e07a3a";
      g.beginPath();
      g.moveTo(0, -r - 1);
      g.lineTo(r + 1, r);
      g.lineTo(-r - 1, r);
      g.closePath();
      g.fill();
    } else if (kind === "base") {
      g.fillStyle = "#7ac06a";
      g.fillRect(-r, -r, r * 2, r * 2);
      g.fillStyle = "#10141a";
      g.fillRect(-r + 1, -r + 1, r, r);
    } else if (kind === "marker") {
      g.strokeStyle = "#e06a9a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-r, -r);
      g.lineTo(r, r);
      g.moveTo(r, -r);
      g.lineTo(-r, r);
      g.stroke();
    }
    g.restore();
  }

  function drawWorld(g, v, s, labels) {
    g.fillStyle = "#0d100b";
    g.fillRect(0, 0, v.w, v.h);
    // земля-ромб города
    quad(g, v, 0, 0, SIZE, SIZE);
    g.fillStyle = "#1a2016";
    g.fill();
    // дороги-полосы в изометрии
    g.fillStyle = "#33383d";
    for (let k = 0; k <= city.nb; k++) {
      quad(g, v, k * PITCH, 0, k * PITCH + ROAD, SIZE);
      g.fill();
      quad(g, v, 0, k * PITCH, SIZE, k * PITCH + ROAD);
      g.fill();
    }
    // здания-ромбы
    for (const b of city.buildings) {
      const p = worldToMap(b.x + b.w / 2, b.y + b.h / 2, v);
      if (p.x < -40 || p.x > v.w + 40 || p.y < -40 || p.y > v.h + 40) continue;
      quad(g, v, b.x, b.y, b.x + b.w, b.y + b.h);
      g.fillStyle = b.poi ? POI_COLOR[b.poi] || "#8a8676" : "#565b52";
      g.fill();
      if (b.poi) {
        g.fillStyle = "#10141a";
        g.font = `bold ${labels ? 11 : 8}px monospace`;
        g.textAlign = "center";
        g.fillText(POI_LETTER[b.poi] || "•", p.x, p.y + 3);
        if (labels && v.scale > 0.02) {
          g.fillStyle = "#ece5d0";
          g.font = "11px monospace";
          g.fillText(b.poi, p.x, p.y - 8);
        }
      }
    }
    // зомби рядом
    if (s.zombies) {
      g.fillStyle = "rgba(200,60,50,0.8)";
      let n = 0;
      for (const z of s.zombies) {
        if (z.dead) continue;
        if (Math.abs(z.x - s.player.x) + Math.abs(z.y - s.player.y) > 130)
          continue;
        const p = worldToMap(z.x, z.y, v);
        g.fillRect(p.x - 1, p.y - 1, 2, 2);
        if (++n > 300) break;
      }
    }
    if (s.camps)
      for (const c of s.camps) {
        const p = worldToMap(c.x, c.y, v);
        icon(g, p.x, p.y, "camp", labels ? 5 : 3);
        if (labels && v.scale > 0.02) {
          g.fillStyle = "#e0a070";
          g.font = "10px monospace";
          g.textAlign = "center";
          g.fillText(campDef(c).name, p.x, p.y + 14);
        }
      }
    if (s.base?.founded) {
      const p = worldToMap(s.base.x, s.base.y, v);
      icon(g, p.x, p.y, "base", labels ? 5 : 3);
      if (labels) {
        g.fillStyle = "#a0d890";
        g.font = "10px monospace";
        g.textAlign = "center";
        g.fillText("База", p.x, p.y + 16);
      }
    }
    if (s.questTarget) {
      const b = s.questTarget;
      const p = worldToMap(b.x + b.w / 2, b.y + b.h / 2, v);
      const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
      icon(g, p.x, p.y, "quest", labels ? pulse + 2 : pulse);
      if (labels) {
        g.fillStyle = "#ffb23e";
        g.font = "bold 11px monospace";
        g.textAlign = "center";
        g.fillText("Цель", p.x, p.y - 12);
      }
    }
    if (s.sideQuestTarget && s.sideQuestTarget !== s.questTarget) {
      const b = s.sideQuestTarget;
      const p = worldToMap(b.x + b.w / 2, b.y + b.h / 2, v);
      g.strokeStyle = "#6fc3d0";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, labels ? 7 : 4, 0, 7);
      g.stroke();
      if (labels) {
        g.fillStyle = "#9bd8e0";
        g.font = "10px monospace";
        g.fillText("Побочная", p.x, p.y - 10);
      }
    }
    if (marker) {
      const p = worldToMap(marker.x, marker.y, v);
      icon(g, p.x, p.y, "marker", 5);
    }
    const pp = worldToMap(s.player.x, s.player.y, v);
    icon(g, pp.x, pp.y, "player", labels ? 5 : 3.5);
    if (labels) {
      g.fillStyle = "#fff";
      g.font = "bold 11px monospace";
      g.textAlign = "center";
      g.fillText("Вы", pp.x, pp.y - 10);
    }
  }

  function drawMinimap(s) {
    const v = {
      cx: s.player.x,
      cy: s.player.y,
      scale: MM / (240 * 48),
      w: MM,
      h: MM,
    };
    drawWorld(mm, v, s, false);
    mm.strokeStyle = "#596248";
    mm.lineWidth = 1;
    mm.strokeRect(0.5, 0.5, MM - 1, MM - 1);
    mm.fillStyle = "#9a9478";
    mm.font = "9px monospace";
    mm.textAlign = "right";
    mm.fillText("M — карта", MM - 5, MM - 5);
  }

  function update(dt, s) {
    state = s;
    acc += dt;
    if (acc < 0.2) return;
    acc = 0;
    drawMinimap(s);
    if (bigOpen) drawWorld(bg, view, s, true);
  }

  function open() {
    if (bigOpen) return;
    bigOpen = true;
    fitBig();
    resetBigView();
    bigRoot.style.display = "block";
    if (state) drawWorld(bg, view, state, true);
  }
  function close() {
    bigOpen = false;
    bigRoot.style.display = "none";
  }

  bigRoot.querySelector("#bigmapClose").addEventListener("click", close);
  bigCv.addEventListener("mousedown", (e) => {
    const r = bigCv.getBoundingClientRect();
    const w = mapToWorld(e.clientX - r.left, e.clientY - r.top, view);
    drag = { wx: w.x, wy: w.y, moved: 0, sx: e.clientX, sy: e.clientY };
  });
  addEventListener("mousemove", (e) => {
    if (!drag || !bigOpen) return;
    drag.moved = Math.max(
      drag.moved,
      Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy),
    );
    const r = bigCv.getBoundingClientRect();
    const mx = e.clientX - r.left,
      my = e.clientY - r.top;
    // удерживаем схваченную точку мира под курсором
    const ixT = (drag.wx - drag.wy) * 32,
      iyT = (drag.wx + drag.wy) * 16;
    const A = (ixT - (mx - view.w / 2) / view.scale) / 32;
    const B = (iyT - (my - view.h / 2) / view.scale) / 16;
    view.cx = (A + B) / 2;
    view.cy = (B - A) / 2;
    view = clampView(view, SIZE);
    if (state) drawWorld(bg, view, state, true);
  });
  addEventListener("mouseup", (e) => {
    if (!drag || !bigOpen) return;
    if (drag.moved < 4) {
      const r = bigCv.getBoundingClientRect();
      marker = mapToWorld(e.clientX - r.left, e.clientY - r.top, view);
      if (state) drawWorld(bg, view, state, true);
    }
    drag = null;
  });
  bigCv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = bigCv.getBoundingClientRect();
      const mx = e.clientX - r.left,
        my = e.clientY - r.top;
      const before = mapToWorld(mx, my, view);
      view.scale *= e.deltaY < 0 ? 1.15 : 0.87;
      view = clampView(view, SIZE);
      const after = mapToWorld(mx, my, view);
      view.cx += before.x - after.x;
      view.cy += before.y - after.y;
      view = clampView(view, SIZE);
      if (state) drawWorld(bg, view, state, true);
    },
    { passive: false },
  );
  addEventListener("resize", () => {
    if (!bigOpen) return;
    fitBig();
    if (state) drawWorld(bg, view, state, true);
  });
  minimapCanvas.addEventListener("click", open);

  return {
    update,
    open,
    close,
    toggle: () => (bigOpen ? close() : open()),
    isOpen: () => bigOpen,
    getMarker: () => marker,
  };
}
