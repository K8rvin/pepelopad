// Основной проход: земля-чанки → высокий слой (z-сортировка по max(x+y)) →
// ночное освещение → пепел → виньетка. Рендер только читает состояние.
import { w2s, mkCanvas, PAL } from "../core/geo.js";
import { CH, getChunk, evictIfNeeded } from "./chunks.js";
import { buildingSprite } from "./buildings.js";
import { renderNight } from "./lighting.js";
import { SPRTEX } from "./assets.js";

export function createRenderer() {
  return {
    chunkCache: new Map(),
    drawCalls: 0,
    vignette: null,
  };
}

export function bakeVignette(W, H) {
  const c = mkCanvas(W, H);
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.42,
    W / 2,
    H / 2,
    H * 0.78,
  );
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(108,106,98,1)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
}

export function renderWorld({
  ctx,
  R,
  city,
  player,
  zombies,
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
  now,
  lootNearest,
  uiOpen,
}) {
  R.drawCalls = 0;
  const shake = combat ? combat.shake : 0;
  const camS = w2s(cam.x, cam.y);
  if (shake > 0) {
    camS.x += Math.sin(now * 47) * shake;
    camS.y += Math.cos(now * 31) * shake;
  }
  const toX = (sx) => (sx - camS.x) * zoom + W / 2;
  const toY = (sy) => (sy - camS.y) * zoom + H / 2;
  ctx.fillStyle = PAL.dark;
  ctx.fillRect(0, 0, W, H);
  R.drawCalls++;

  // земля-чанки: сначала отсев по видимости, потом bake
  const nCh = Math.ceil(city.SIZE / CH);
  const cw = (CH * 64 + 4) * zoom,
    chh = (CH * 32 + 4) * zoom;
  for (let cy = -2; cy < nCh + 2; cy++)
    for (let cx = -2; cx < nCh + 2; cx++) {
      const sx = (cx - cy - 1) * 256 - 2,
        sy = (cx + cy) * 128 - 2;
      const dx = (sx - camS.x) * zoom + W / 2,
        dy = (sy - camS.y) * zoom + H / 2;
      if (dx > W || dy > H || dx + cw < 0 || dy + chh < 0) continue;
      ctx.drawImage(
        getChunk(city, groundSet, R.chunkCache, cx, cy).canvas,
        dx,
        dy,
        cw,
        chh,
      );
      R.drawCalls++;
    }
  evictIfNeeded(R.chunkCache, camS.x, camS.y);

  // кровь на земле (плоская, до высокого слоя)
  if (combat)
    for (const b of combat.blood) {
      const p = w2s(b.x, b.y);
      const dx = toX(p.x),
        dy = toY(p.y);
      if (dx < -60 || dx > W + 60 || dy < -60 || dy > H + 60) continue;
      ctx.fillStyle = `rgba(109,43,37,${0.55 * Math.max(0, 1 - b.t / 60)})`;
      ctx.beginPath();
      ctx.ellipse(dx, dy, b.r * 32 * zoom, b.r * 16 * zoom, 0, 0, 7);
      ctx.fill();
      R.drawCalls++;
    }

  // высокий слой
  const items = [];
  const inside = playerInside(city, player);
  const vis = (x, y, hw, hh) => {
    const sx = (x - y) * 32,
      sy = (x + y) * 16;
    const dx = (sx - camS.x) * zoom + W / 2,
      dy = (sy - camS.y) * zoom + H / 2;
    return (
      dx + hw > -60 && dx - hw < W + 60 && dy + hh > -60 && dy - hh < H + 60
    );
  };
  const push = (depth, layer, f) => items.push({ depth, layer, f });

  for (const b of city.buildings) {
    if (
      !vis(
        b.x + b.w / 2,
        b.y + b.h / 2,
        (b.w + b.h) * 16 + 60,
        ((b.w + b.h) * 16 + b.floors * 96) / 2 + 60,
      )
    )
      continue;
    push(b.x + b.w + (b.y + b.h), 1, () =>
      drawBuilding(ctx, b, toX, toY, zoom, inside === b),
    );
  }
  for (const t of city.trees) {
    if (!vis(t.x, t.y, 70, 120)) continue;
    push(t.x + t.y, 1, () => {
      const p = w2s(t.x, t.y);
      const key = t.dead ? "tree_dead" : t.v === 1 ? "tree_birch" : "tree";
      const img = SPRTEX[key];
      if (img) {
        const h = (176 + t.v * 24) * zoom,
          w = h * (img.width / img.height);
        ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
      } else {
        ctx.drawImage(
          t.dead ? SPR.deadTrees[t.v] : SPR.trees[t.v],
          toX(p.x) - 64 * zoom,
          toY(p.y) - 150 * zoom,
          128 * zoom,
          160 * zoom,
        );
      }
      R.drawCalls++;
    });
  }
  for (const l of city.lamps) {
    if (!vis(l.x, l.y, 30, 110)) continue;
    push(l.x + l.y, 1, () => {
      const p = w2s(l.x, l.y);
      ctx.drawImage(
        SPR.lamp,
        toX(p.x) - 24 * zoom,
        toY(p.y) - 200 * zoom,
        48 * zoom,
        208 * zoom,
      );
      R.drawCalls++;
    });
  }
  for (const bch of city.benches) {
    if (!vis(bch.x, bch.y, 45, 30)) continue;
    push(bch.x + bch.y, 1, () => {
      const p = w2s(bch.x, bch.y);
      const img = SPRTEX.bench;
      if (img) {
        const w = 66 * zoom,
          h = w * (img.height / img.width);
        ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
      } else
        ctx.drawImage(
          SPR.bench,
          toX(p.x) - 40 * zoom,
          toY(p.y) - 40 * zoom,
          80 * zoom,
          48 * zoom,
        );
      R.drawCalls++;
    });
  }
  for (const cn of city.containers) {
    if (!vis(cn.x, cn.y, 40, 35)) continue;
    push(cn.x + cn.y, 1, () => {
      const p = w2s(cn.x, cn.y);
      const img = SPRTEX.dumpster;
      if (img) {
        const w = 66 * zoom,
          h = w * (img.height / img.width);
        ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
      } else
        ctx.drawImage(
          SPR.container,
          toX(p.x) - 36 * zoom,
          toY(p.y) - 48 * zoom,
          72 * zoom,
          56 * zoom,
        );
      R.drawCalls++;
    });
  }
  for (const t of city.tires) {
    if (!vis(t.x, t.y, 32, 25)) continue;
    push(t.x + t.y, 1, () => {
      const p = w2s(t.x, t.y);
      const img = SPRTEX.tires;
      if (img) {
        const w = 48 * zoom,
          h = w * (img.height / img.width);
        ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
      } else
        ctx.drawImage(
          SPR.tires,
          toX(p.x) - 28 * zoom,
          toY(p.y) - 36 * zoom,
          56 * zoom,
          40 * zoom,
        );
      R.drawCalls++;
    });
  }
  for (const br of city.barrels) {
    if (!vis(br.x, br.y, 20, 22)) continue;
    push(br.x + br.y, 1, () => {
      const p = w2s(br.x, br.y);
      const img = SPRTEX.barrel;
      if (img) {
        const w = 30 * zoom,
          h = w * (img.height / img.width);
        ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
      }
      R.drawCalls++;
    });
  }
  for (const f of city.fences)
    for (let u = f.x0; u < (f.axis === "x" ? f.x1 : f.x0 + 1); u++)
      for (let v = f.y0; v < (f.axis === "y" ? f.y1 : f.y0 + 1); v++) {
        if (!vis(u + 0.5, v + 0.5, 36, 40)) continue;
        push(u + v + 0.5, 1, () => {
          const p = w2s(u, v);
          ctx.drawImage(
            f.axis === "x" ? SPR.fenceX : SPR.fenceY,
            toX(p.x) - 32 * zoom,
            toY(p.y) - 38 * zoom,
            64 * zoom,
            76 * zoom,
          );
          R.drawCalls++;
        });
      }
  city.cars.forEach((car, i) => {
    const w = car.axis === "x" ? 4.4 : 1.8,
      h = car.axis === "x" ? 1.8 : 4.4;
    if (!vis(car.x + w / 2, car.y + h / 2, 120, 90)) return;
    push(car.x + w + (car.y + h), 1, () => {
      const p = w2s(car.x, car.y);
      ctx.drawImage(
        SPR.cars[i],
        toX(p.x) - 112 * zoom,
        toY(p.y) - 46 * zoom,
        224 * zoom,
        170 * zoom,
      );
      R.drawCalls++;
    });
  });
  for (const z of zombies) {
    if (z.dead) continue;
    if (!vis(z.x, z.y, 40, 55)) continue;
    push(z.x + z.y + 0.01, 2, () =>
      drawActor(ctx, z, SPR, toX, toY, zoom, false),
    );
  }
  push(player.x + player.y + 0.01, 2, () =>
    drawActor(ctx, player, SPR, toX, toY, zoom, true),
  );

  // трупы и стрелы в полёте
  if (combat) {
    for (const c of combat.corpses) {
      if (!vis(c.x, c.y, 40, 30)) continue;
      push(c.x + c.y, 1.5, () => drawCorpse(ctx, c, SPR, toX, toY, zoom));
    }
    for (const a of combat.arrows) {
      push(a.x + a.y + 0.02, 2, () => {
        const p = w2s(a.x, a.y, 0.9); // стрела летит на высоте ~0,9 м
        const dx = toX(p.x),
          dy = toY(p.y);
        ctx.strokeStyle = "#d9cba6";
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - a.dx * 10 * zoom, dy - a.dy * 6 * zoom);
        ctx.stroke();
        R.drawCalls++;
      });
    }
  }

  items.sort((a, b) => a.depth - b.depth || a.layer - b.layer);
  for (const it of items) it.f();

  if (night) {
    renderNight({ ctx, L, city, player, inside, toX, toY, zoom, W, H });
    R.drawCalls += 2;
  }

  // пепел поверх всего
  ctx.fillStyle = "rgba(194,190,178,0.5)";
  for (const a of ashP) {
    ctx.globalAlpha = 0.2 + 0.25 * a.s * 0.4;
    ctx.fillRect(a.x, a.y, a.s, a.s * 0.8);
  }
  ctx.globalAlpha = 1;
  R.drawCalls++;

  // виньетка
  if (R.vignette) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = night ? 0.55 : 0.4;
    ctx.drawImage(R.vignette, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    R.drawCalls++;
  }

  // боевые оверлеи: прицел, дуга натяжения, вспышка урона, смерть
  if (combat && !combat.dead) {
    // прицел в точке aim
    const ap = w2s(aim.x, aim.y);
    const ax = toX(ap.x),
      ay = toY(ap.y);
    ctx.strokeStyle = "rgba(194,190,178,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ax, ay, 8 * zoom, 4 * zoom, 0, 0, 7);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,178,62,0.9)";
    ctx.fillRect(ax - 1, ay - 1, 2, 2);
    R.drawCalls += 2;
    // дуга натяжения над головой игрока
    if (combat.bowDrawing) {
      const pp = w2s(player.x, player.y);
      const px = toX(pp.x),
        py = toY(pp.y) - 74 * zoom;
      ctx.strokeStyle = "rgba(42,46,40,0.8)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px, py, 14 * zoom, Math.PI, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = combat.bowCharge > 0.99 ? "#a6e83c" : "#ffb23e";
      ctx.beginPath();
      ctx.arc(px, py, 14 * zoom, Math.PI, Math.PI + Math.PI * combat.bowCharge);
      ctx.stroke();
      R.drawCalls += 2;
    }
  }
  // вспышка урона
  if (combat && combat.hurtFlash > 0) {
    ctx.fillStyle = `rgba(224,67,56,${0.28 * combat.hurtFlash})`;
    ctx.fillRect(0, 0, W, H);
    R.drawCalls++;
  }
  // подсказка обыска у контейнера
  if (lootNearest && !uiOpen && !(combat && combat.dead)) {
    const p = w2s(lootNearest.x, lootNearest.y);
    const dx = toX(p.x),
      dy = toY(p.y) - 46 * zoom;
    ctx.font = `${12 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#0a0c09";
    ctx.fillText("E — обыскать", dx + 1, dy + 1);
    ctx.fillStyle = "#ffb23e";
    ctx.fillText("E — обыскать", dx, dy);
    ctx.textAlign = "left";
    R.drawCalls++;
  }
  // смерть
  if (combat && combat.dead) {
    const a = Math.min(0.85, combat.deadT * 0.5);
    ctx.fillStyle = `rgba(10,10,10,${a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#c2beb2";
    ctx.font = `${28 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("ТЫ ПОГИБ", W / 2, H / 2 - 20);
    ctx.font = `${13 * zoom}px monospace`;
    ctx.fillStyle = "#9a9478";
    ctx.fillText("R — возродиться у парка", W / 2, H / 2 + 14);
    ctx.textAlign = "left";
    R.drawCalls += 3;
  }
  return inside;
}

function drawBuilding(ctx, b, toX, toY, zoom, ghost) {
  const spr = buildingSprite(b);
  const ox = (b.x - b.y) * 32 + spr.minX,
    oy = (b.x + b.y) * 16 + spr.minY;
  const dx = toX(ox),
    dy = toY(oy);
  if (ghost) ctx.globalAlpha = 0.15;
  ctx.drawImage(
    spr.canvas,
    dx,
    dy,
    spr.canvas.width * zoom,
    spr.canvas.height * zoom,
  );
  if (ghost) ctx.globalAlpha = 1;
}

function drawCorpse(ctx, c, SPR, toX, toY, zoom) {
  // павший зомби: спрайт на боку, затухание после 3 с
  const p = w2s(c.x, c.y);
  const alpha = c.t > 3 ? Math.max(0, 1 - (c.t - 3) / 3) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(toX(p.x), toY(p.y));
  ctx.rotate(c.pose ? 1.45 : -1.45); // на бок
  ctx.scale(zoom * 0.9, zoom * 0.55); // сплющен к земле
  ctx.drawImage(SPR.zombie[0], -32, -88, 64, 96);
  ctx.restore();
}

function drawActor(ctx, a, SPR, toX, toY, zoom, isPlayer) {
  const p = w2s(a.x, a.y);
  ctx.fillStyle = "rgba(16,20,26,0.35)";
  ctx.beginPath();
  ctx.ellipse(toX(p.x), toY(p.y), 14 * zoom, 6 * zoom, 0, 0, 7);
  ctx.fill();
  const img = SPRTEX[isPlayer ? "survivor" : "zombie"];
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
    ctx.drawImage(
      (isPlayer ? SPR.player : SPR.zombie)[a.pose],
      toX(p.x) - 32 * zoom,
      toY(p.y) - 88 * zoom,
      64 * zoom,
      96 * zoom,
    );
  }
}

export function playerInside(city, player) {
  for (const b of city.buildings)
    if (
      player.x > b.x + 0.2 &&
      player.x < b.x + b.w - 0.2 &&
      player.y > b.y + 0.2 &&
      player.y < b.y + b.h - 0.2
    )
      return b;
  return null;
}
