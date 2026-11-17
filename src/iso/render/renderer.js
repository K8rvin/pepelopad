// Основной проход: земля-чанки → высокий слой (z-сортировка по max(x+y)) →
// ночное освещение → пепел → виньетка. Рендер только читает состояние.
import { w2s, mkCanvas, PAL } from "../core/geo.js";
import { CH, getChunk, evictIfNeeded } from "./chunks.js";
import { buildingSprite } from "./buildings.js";
import { renderNight } from "./lighting.js";
import { SPRTEX } from "./assets.js";
import { getInterior } from "../world/interiors.js";

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
  questTarget,
  inCar,
  npcs,
  stairsNear,
  windowNear,
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
      drawBuilding(
        ctx,
        b,
        toX,
        toY,
        zoom,
        inside === b,
        player,
        city.brokenWindows.get(b.id),
      ),
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
    if (!vis(car.x + w / 2, car.y + h / 2, 130, 100)) return;
    push(car.x + w + (car.y + h), 1, () => {
      // центр машины на экране, поворот по курсу (изо-проекция вектора курса)
      const p = w2s(car.x + w / 2, car.y + h / 2);
      const img = car.wreck
        ? SPRTEX.car_wreck
        : i % 3 === 2
          ? SPRTEX.car_van
          : SPRTEX.car_sedan;
      ctx.save();
      ctx.translate(toX(p.x), toY(p.y));
      if (car.heading !== undefined) {
        const vx = Math.cos(car.heading),
          vy = Math.sin(car.heading);
        const sAng = Math.atan2((vx + vy) * 16, (vx - vy) * 32);
        // спрайты Gemini смотрят влево; процедурная коробка — по базовой оси
        ctx.rotate(
          sAng -
            (img
              ? Math.PI
              : car.axis === "x"
                ? Math.atan2(16, 32)
                : Math.atan2(16, -32)),
        );
      }
      if (img) {
        const wpx = 170 * zoom,
          hpx = wpx * (img.height / img.width);
        ctx.drawImage(img, -wpx / 2, -hpx / 2, wpx, hpx);
      } else {
        ctx.drawImage(
          SPR.cars[i],
          -112 * zoom,
          -85 * zoom,
          224 * zoom,
          170 * zoom,
        );
      }
      ctx.restore();
      R.drawCalls++;
    });
  });
  for (const z of zombies) {
    if (z.dead) continue;
    if (!vis(z.x, z.y, 40, 55)) continue;
    push(actorDepth(city, z), 2, () =>
      drawActor(ctx, z, SPR, toX, toY, zoom, false),
    );
  }
  if (!inCar)
    push(actorDepth(city, player) + 0.01, 2, () =>
      drawActor(ctx, player, SPR, toX, toY, zoom, true),
    );

  // NPC (спрайт выжившего + подпись вблизи)
  if (npcs)
    for (const n of npcs) {
      if (!vis(n.x, n.y, 45, 60)) continue;
      push(n.x + n.y, 2, () => {
        const p = w2s(n.x, n.y);
        ctx.fillStyle = "rgba(16,20,26,0.35)";
        ctx.beginPath();
        ctx.ellipse(toX(p.x), toY(p.y), 14 * zoom, 6 * zoom, 0, 0, 7);
        ctx.fill();
        const img = SPRTEX.survivor;
        if (img) {
          const h = 78 * zoom,
            w = h * (img.width / img.height);
          ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
        }
        if (Math.hypot(player.x - n.x, player.y - n.y) < 6) {
          ctx.font = `${11 * zoom}px monospace`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#0a0c09";
          ctx.fillText(n.name, toX(p.x) + 1, toY(p.y) - 84 * zoom + 1);
          ctx.fillStyle = "#a6e83c";
          ctx.fillText(n.name, toX(p.x), toY(p.y) - 84 * zoom);
          ctx.fillStyle = "#9a9478";
          ctx.fillText("E — говорить", toX(p.x), toY(p.y) - 70 * zoom);
          ctx.textAlign = "left";
        }
        R.drawCalls += 2;
      });
    }

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
  // окно: подсказка разбития
  if (windowNear && !inCar && !(combat && combat.dead)) {
    const p = w2s(windowNear.x, windowNear.y);
    const dx = toX(p.x),
      dy = toY(p.y) - 40 * zoom;
    ctx.font = `${12 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#0a0c09";
    ctx.fillText("B — разбить окно", dx + 1, dy + 1);
    ctx.fillStyle = "#7fb8d8";
    ctx.fillText("B — разбить окно", dx, dy);
    ctx.textAlign = "left";
    R.drawCalls++;
  }
  // лестница внутри здания: ступени + подсказка
  if (inside && !inCar) {
    const it = getInterior(null, inside);
    if (it.stairs) {
      const sx = inside.x + it.stairs.x + it.stairs.w / 2,
        sy = inside.y + it.stairs.y + it.stairs.h / 2;
      const p = w2s(sx, sy);
      const dx = toX(p.x),
        dy = toY(p.y);
      // ступени
      ctx.fillStyle = "#4a453c";
      for (let i = 0; i < 4; i++)
        ctx.fillRect(
          dx - 14 * zoom + i * 2 * zoom,
          dy - i * 5 * zoom,
          (24 - i * 3) * zoom,
          4 * zoom,
        );
      if (stairsNear) {
        ctx.font = `${12 * zoom}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb23e";
        const canUp = player.level < inside.floors - 1,
          canDown = player.level > 0;
        ctx.fillText(
          canUp && canDown
            ? "E — наверх · X — вниз"
            : canUp
              ? "E — наверх"
              : "X — вниз",
          dx,
          dy - 26 * zoom,
        );
        ctx.textAlign = "left";
      }
      R.drawCalls++;
    }
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
  // маркер цели квеста: пульс над зданием или стрелка у края
  if (questTarget) {
    const p = w2s(
      questTarget.x + questTarget.w / 2,
      questTarget.y + questTarget.h / 2,
      questTarget.floors * 3,
    );
    let dx = toX(p.x),
      dy = toY(p.y);
    const off = dx < 20 || dx > W - 20 || dy < 20 || dy > H - 20;
    if (off) {
      // стрелка к цели от центра экрана
      const cx = W / 2,
        cy = H / 2;
      const ang = Math.atan2(dy - cy, dx - cx);
      dx = cx + Math.cos(ang) * (Math.min(W, H) / 2 - 50);
      dy = cy + Math.sin(ang) * (Math.min(W, H) / 2 - 50);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffb23e";
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const pulse = 1 + Math.sin(now * 4) * 0.2;
      ctx.strokeStyle = "#ffb23e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 14 * pulse * zoom, 7 * pulse * zoom, 0, 0, 7);
      ctx.stroke();
    }
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

function drawBuilding(ctx, b, toX, toY, zoom, ghost, player, brokenSet) {
  if (ghost) {
    // внутри: вместо shell — интерьер (перегородки к югу/востоку от игрока — полупрозрачные)
    drawInteriorWalls(ctx, b, toX, toY, zoom, player);
    return;
  }
  const spr = buildingSprite(b);
  const ox = (b.x - b.y) * 32 + spr.minX,
    oy = (b.x + b.y) * 16 + spr.minY;
  const dx = toX(ox),
    dy = toY(oy);
  ctx.drawImage(
    spr.canvas,
    dx,
    dy,
    spr.canvas.width * zoom,
    spr.canvas.height * zoom,
  );
  // разбитые окна поверх фасада (первый этаж)
  if (brokenSet && SPRTEX.win_broken) {
    for (const key of brokenSet) {
      const [face, us] = key.split(":");
      const u = Number(us);
      const base =
        face === "S"
          ? w2s(b.x + u, b.y + b.h, 0.9)
          : w2s(b.x + b.w, b.y + u, 0.9);
      const bx = toX(base.x),
        by = toY(base.y);
      ctx.save();
      ctx.translate(bx, by);
      ctx.transform(face === "S" ? 1 : -1, 0.5, 0, 1, 0, 0);
      ctx.drawImage(
        SPRTEX.win_broken,
        face === "S" ? -22 * zoom : 0,
        -48 * zoom,
        45 * zoom,
        48 * zoom,
      );
      ctx.restore();
    }
  }
}

// низкие перегородки интерьера (1 м) со светлым кэпом; к югу/востоку от игрока — полупрозрачные
function drawInteriorWalls(ctx, b, toX, toY, zoom, player) {
  const it = getInterior(null, b);
  const hgt = 32 * zoom;
  const walls = [...it.walls];
  const du = it.doorU,
    W = b.w,
    H = b.h;
  walls.push(
    { x1: 0, y1: 0, x2: W, y2: 0 },
    { x1: 0, y1: H, x2: du - 0.7, y2: H },
    { x1: du + 0.7, y1: H, x2: W, y2: H },
    { x1: 0, y1: 0, x2: 0, y2: H },
    { x1: W, y1: 0, x2: W, y2: H },
  );
  const plx = player ? player.x - b.x : 0,
    ply = player ? player.y - b.y : 0;
  for (const sgm of walls) {
    // перегородка к югу (ниже) или к востоку (правее) от игрока — прозрачнее
    const horizontal = sgm.y1 === sgm.y2;
    const fade =
      (horizontal && sgm.y1 > ply + 0.1) || (!horizontal && sgm.x1 > plx + 0.1);
    if (fade) ctx.globalAlpha = 0.38;
    const a = w2s(b.x + sgm.x1, b.y + sgm.y1);
    const c = w2s(b.x + sgm.x2, b.y + sgm.y2);
    const ax = toX(a.x),
      ay = toY(a.y),
      cx2 = toX(c.x),
      cy2 = toY(c.y);
    ctx.fillStyle = "#56524a";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(cx2, cy2 - hgt);
    ctx.lineTo(ax, ay - hgt);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7a7568";
    ctx.lineWidth = Math.max(1, 3 * zoom);
    ctx.beginPath();
    ctx.moveTo(ax, ay - hgt);
    ctx.lineTo(cx2, cy2 - hgt);
    ctx.stroke();
    if (fade) ctx.globalAlpha = 1;
  }
}

// глубина актёра с учётом зданий: перед южной/восточной стеной — поверх неё
function actorDepth(city, a) {
  let d = a.x + a.y + 0.01;
  const cx = Math.floor(a.x / 16),
    cy = Math.floor(a.y / 16);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cell = city.buildingGrid?.get(cx + dx + "," + (cy + dy));
      if (!cell) continue;
      for (const b of cell) {
        const bd = b.x + b.w + (b.y + b.h); // передний угол здания
        if (bd <= d) continue;
        // актёр в пределах «передней полосы» фасада (юг или восток)
        const south =
          a.y > b.y + b.h - 0.3 &&
          a.y < b.y + b.h + 2.0 &&
          a.x > b.x - 1 &&
          a.x < b.x + b.w + 1;
        const east =
          a.x > b.x + b.w - 0.3 &&
          a.x < b.x + b.w + 2.0 &&
          a.y > b.y - 1 &&
          a.y < b.y + b.h + 1;
        if (south || east) d = bd + 0.01;
      }
    }
  return d;
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
