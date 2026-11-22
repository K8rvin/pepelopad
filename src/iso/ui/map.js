// Карта: миникарта (север сверху) + большая карта с pan/zoom и маркером.
// Только читает состояние мира. Чистые хелперы проекции вынесены для тестов.
import { ROAD, PITCH } from "../world/cityGen.js";
import { campDef } from "../systems/camps.js";

export function worldToMap(wx, wy, view) {
  return {
    x: (wx - view.cx) * view.scale + view.w / 2,
    y: (wy - view.cy) * view.scale + view.h / 2,
  };
}

export function mapToWorld(mx, my, view) {
  return {
    x: (mx - view.w / 2) / view.scale + view.cx,
    y: (my - view.h / 2) / view.scale + view.cy,
  };
}

export function clampView(view, SIZE) {
  return {
    ...view,
    scale: Math.min(4, Math.max(0.04, view.scale)),
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
};

export function createMap({ minimapCanvas, bigRoot, city }) {
  const SIZE = city.SIZE;
  const mm = minimapCanvas.getContext("2d");
  const MM = 168;
  minimapCanvas.width = MM;
  minimapCanvas.height = MM;

  bigRoot.innerHTML = `
    <canvas id="bigmapCv"></canvas>
    <div id="bigmapTitle">Карта района</div>
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
  let view = { cx: SIZE / 2, cy: SIZE / 2, scale: 0.3, w: 800, h: 600 };
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
    view.scale = (Math.min(view.w, view.h) / SIZE) * 0.92;
  }

  function drawWorld(g, v, s, labels) {
    g.fillStyle = "#14170f";
    g.fillRect(0, 0, v.w, v.h);
    // дороги: сетка кварталов
    g.fillStyle = "#33383d";
    for (let k = 0; k <= city.nb; k++) {
      const a = worldToMap(k * PITCH, 0, v);
      const rw = ROAD * v.scale;
      g.fillRect(a.x, 0, Math.max(1, rw), v.h);
      const b = worldToMap(0, k * PITCH, v);
      g.fillRect(0, b.y, v.w, Math.max(1, rw));
    }
    // здания
    for (const b of city.buildings) {
      const p = worldToMap(b.x, b.y, v);
      const w = b.w * v.scale,
        h = b.h * v.scale;
      if (p.x > v.w || p.y > v.h || p.x + w < 0 || p.y + h < 0) continue;
      g.fillStyle = b.poi ? POI_COLOR[b.poi] || "#8a8676" : "#565b52";
      g.fillRect(p.x, p.y, Math.max(1, w), Math.max(1, h));
      if (labels && b.poi && v.scale > 0.12) {
        g.fillStyle = "#ece5d0";
        g.font = "11px monospace";
        g.textAlign = "center";
        g.fillText(b.poi, p.x + w / 2, p.y - 4);
      }
    }
    // лагеря
    if (s.camps)
      for (const c of s.camps) {
        const p = worldToMap(c.x, c.y, v);
        g.fillStyle = "#e07a3a";
        g.beginPath();
        g.arc(p.x, p.y, labels ? 5 : 3, 0, 7);
        g.fill();
        if (labels && v.scale > 0.12) {
          g.fillStyle = "#e0a070";
          g.font = "10px monospace";
          g.textAlign = "center";
          g.fillText(campDef(c).name, p.x, p.y + 14);
        }
      }
    // база
    if (s.base?.founded) {
      const p = worldToMap(s.base.x, s.base.y, v);
      g.fillStyle = "#7ac06a";
      g.fillRect(p.x - 4, p.y - 4, 8, 8);
      if (labels) {
        g.fillStyle = "#a0d890";
        g.font = "10px monospace";
        g.textAlign = "center";
        g.fillText("База", p.x, p.y + 16);
      }
    }
    // зомби рядом с игроком
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
    // цель квеста
    if (s.questTarget) {
      const b = s.questTarget;
      const p = worldToMap(b.x + b.w / 2, b.y + b.h / 2, v);
      const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
      g.strokeStyle = "#ffb23e";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, labels ? pulse + 4 : pulse, 0, 7);
      g.stroke();
      if (labels) {
        g.fillStyle = "#ffb23e";
        g.font = "bold 11px monospace";
        g.textAlign = "center";
        g.fillText("Цель", p.x, p.y - 12);
      }
    }
    // маркер пользователя
    if (marker) {
      const p = worldToMap(marker.x, marker.y, v);
      g.strokeStyle = "#e06a9a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(p.x - 5, p.y - 5);
      g.lineTo(p.x + 5, p.y + 5);
      g.moveTo(p.x + 5, p.y - 5);
      g.lineTo(p.x - 5, p.y + 5);
      g.stroke();
    }
    // игрок
    const pp = worldToMap(s.player.x, s.player.y, v);
    g.fillStyle = "#10141a";
    g.beginPath();
    g.arc(pp.x, pp.y, labels ? 6 : 4, 0, 7);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(pp.x, pp.y, labels ? 4 : 2.5, 0, 7);
    g.fill();
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
      scale: MM / 240,
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

  // взаимодействие с большой картой
  bigRoot.querySelector("#bigmapClose").addEventListener("click", close);
  bigCv.addEventListener("mousedown", (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: 0 };
  });
  addEventListener("mousemove", (e) => {
    if (!drag || !bigOpen) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    view.cx = drag.cx - dx / view.scale;
    view.cy = drag.cy - dy / view.scale;
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
