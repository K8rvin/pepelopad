// Основной проход: земля-чанки → высокий слой (z-сортировка по max(x+y)) →
// ночное освещение → пепел → виньетка. Рендер только читает состояние.
import { w2s, mkCanvas, PAL } from "../core/geo.js";
import { CH, getChunk, bakeChunk, evictIfNeeded } from "./chunks.js";
import {
  buildingSprite,
  hasBuildingSprite,
  drainLitQueue,
} from "./buildings.js";
import { renderNight } from "./lighting.js";
import { SPRTEX } from "./assets.js";
import { reconcileStreetDepths } from "./streetDepth.js";
import { GAITS } from "./gait.js";
import {
  getInterior,
  wallWithGaps,
  buildingAtPoint,
} from "../world/interiors.js";
import { carDims, carCenter, tileAt } from "../world/cityGen.js";
import { T_ASPHALT, T_SIDEWALK } from "./tiles.js";
import { CAR_SHAPES } from "../data/carShapes.js";
import { FURNITURE } from "../data/furniture.js";
import { ZTYPES } from "../data/zombies.js";
import { campDef } from "../systems/camps.js";

export function createRenderer() {
  return {
    chunkCache: new Map(),
    drawCalls: 0,
    vignette: null,
    bFade: new Map(), // buildingId → текущая альфа фейда (состояние рендера, не игры)
    bakeQueue: new Set(), // ключи чанков, ждущих полной запечки по бюджету
    phQueue: new Set(), // ключи чанков, ждущих lite-запечки placeholder'а
    phCache: new Map(), // lite-placeholder'ы (дешёвая земля без текстур/теней)
    bldQueue: new Map(), // buildingId → здание, ждущее запечки фасада
    gait: "bob", // вариант походки по умолчанию (B, решение пользователя 21.11.2026)
  };
}

// дешёвая «коробка» здания на время бюджетной запечки фасада: стены + крыша
function drawBuildingMassing(ctx, b, toX, toY, alpha) {
  const H = b.floors * 3;
  const c = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.h],
    [b.x, b.y + b.h],
  ].map(([x, y]) => ({ g: w2s(x, y), t: w2s(x, y, H) }));
  const quad = (i, j, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(toX(c[i].g.x), toY(c[i].g.y));
    ctx.lineTo(toX(c[j].g.x), toY(c[j].g.y));
    ctx.lineTo(toX(c[j].t.x), toY(c[j].t.y));
    ctx.lineTo(toX(c[i].t.x), toY(c[i].t.y));
    ctx.closePath();
    ctx.fill();
  };
  ctx.globalAlpha = alpha;
  quad(3, 2, "#8a8378"); // южная стена
  quad(2, 1, "#767065"); // восточная стена
  ctx.fillStyle = "#7c786e";
  ctx.beginPath();
  ctx.moveTo(toX(c[0].t.x), toY(c[0].t.y));
  for (let i = 1; i < 4; i++) ctx.lineTo(toX(c[i].t.x), toY(c[i].t.y));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// здание перекрывает игрока на экране: игрок севернее/западнее юго-восточного
// угла (иначе актёр рисуется поверх) и его силуэт попадает в bbox спрайта.
// Чистая функция в экранных координатах w2s (без cam/zoom — они общие).
export function occludesPlayer(b, px, py) {
  if (px > b.x + b.w - 0.2 || py > b.y + b.h - 0.2) return false;
  const sx = (px - py) * 32,
    sy = (px + py) * 16;
  const sx0 = (b.x - b.y - b.h) * 32,
    sx1 = (b.x + b.w - b.y) * 32;
  const sy0 = (b.x + b.y) * 16 - b.floors * 96 - 20,
    sy1 = (b.x + b.w + b.y + b.h) * 16;
  return sx > sx0 && sx < sx1 && sy - 60 < sy1 && sy > sy0;
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
  loot,
  aim,
  now,
  lootNearest,
  uiOpen,
  questTarget,
  inCar,
  npcs,
  stairsNear,
  windowNear,
  search,
  camps,
  base,
  levelFx,
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
  const camCx = Math.floor(cam.x / CH),
    camCy = Math.floor(cam.y / CH);
  // упреждающая очередь вокруг камеры: при ходьбе чанки запекаются до входа
  // в кадр, плоские ромбы остаются только для резких телепортов
  for (let cy = camCy - 4; cy <= camCy + 4; cy++)
    for (let cx = camCx - 4; cx <= camCx + 4; cx++) {
      const k = cx + "," + cy;
      if (R.chunkCache.has(k)) continue;
      if (R.phCache.has(k)) R.bakeQueue.add(k);
      else R.phQueue.add(k);
    }
  for (let cy = -2; cy < nCh + 2; cy++)
    for (let cx = -2; cx < nCh + 2; cx++) {
      const sx = (cx - cy - 1) * 256 - 2,
        sy = (cx + cy) * 128 - 2;
      const dx = (sx - camS.x) * zoom + W / 2,
        dy = (sy - camS.y) * zoom + H / 2;
      if (dx > W || dy > H || dx + cw < 0 || dy + chh < 0) continue;
      const k = cx + "," + cy;
      const ch = R.chunkCache.get(k);
      if (ch) {
        ctx.drawImage(ch.canvas, dx, dy, cw, chh);
        R.drawCalls++;
        continue;
      }
      // под камерой — полная запечка сразу; периферия — lite-placeholder и
      // очередь полной запечки с бюджетом кадра: телепорт не фризит на
      // синхронной запечке десятков чанков
      const ph = R.phCache.get(k);
      if (ph) {
        ctx.drawImage(ph.canvas, dx, dy, cw, chh);
        R.bakeQueue.add(k);
      } else {
        // плоский ромб (1 путь) до lite-запечки; lite и полная — в очередях
        R.phQueue.add(k);
        const t = tileAt(city, cx * CH + 4, cy * CH + 4);
        ctx.fillStyle =
          t === T_ASPHALT
            ? PAL.asphalt
            : t === T_SIDEWALK
              ? PAL.concrete
              : PAL.grass;
        const ax = cx * CH,
          ay = cy * CH;
        const q = [
          [ax, ay],
          [ax + CH, ay],
          [ax + CH, ay + CH],
          [ax, ay + CH],
        ].map(([x, y]) => w2s(x, y));
        ctx.beginPath();
        ctx.moveTo(toX(q[0].x), toY(q[0].y));
        for (let i = 1; i < 4; i++) ctx.lineTo(toX(q[i].x), toY(q[i].y));
        ctx.closePath();
        ctx.fill();
      }
      R.drawCalls++;
    }
  // общий бюджет запечки ≤6 мс за кадр (фасады → lite → полная земля):
  // одна тяжёлая запечка может превысить бюджет, но кадр остаётся <25 мс
  const bakeT0 = performance.now();
  const bakeOver = () => performance.now() - bakeT0 > 6;
  for (const [id, b] of [...R.bldQueue]) {
    if (bakeOver()) break;
    buildingSprite(b);
    R.bldQueue.delete(id);
  }
  drainLitQueue(bakeOver);
  for (const k of [...R.phQueue]) {
    if (bakeOver()) break;
    const [qx, qy] = k.split(",").map(Number);
    if (Math.abs(qx - camCx) > 6 || Math.abs(qy - camCy) > 6) {
      R.phQueue.delete(k);
      continue;
    }
    const ph = bakeChunk(city, groundSet, qx, qy, true);
    if (R.phCache.size > 900) R.phCache.clear();
    R.phCache.set(k, ph);
    R.phQueue.delete(k);
    R.bakeQueue.add(k);
  }
  if (R.bakeQueue.size) {
    for (const k of [...R.bakeQueue]) {
      const [qx, qy] = k.split(",").map(Number);
      if (Math.abs(qx - camCx) > 6 || Math.abs(qy - camCy) > 6)
        R.bakeQueue.delete(k);
    }
    const keys = [...R.bakeQueue]
      .map((k) => k.split(",").map(Number))
      .sort(
        (a, b) =>
          Math.hypot(a[0] - camCx, a[1] - camCy) -
          Math.hypot(b[0] - camCx, b[1] - camCy),
      );
    for (const [qx, qy] of keys) {
      if (bakeOver()) break;
      getChunk(city, groundSet, R.chunkCache, qx, qy);
      R.bakeQueue.delete(qx + "," + qy);
    }
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
  // обломки снесённых машиной объектов
  if (combat)
    for (const d of combat.debris) {
      const p = w2s(d.x, d.y, 0.3);
      ctx.globalAlpha = Math.max(0, 1 - d.t / 0.8);
      ctx.fillStyle = d.col;
      ctx.fillRect(
        toX(p.x) - 2 * zoom,
        toY(p.y) - 2 * zoom,
        4 * zoom,
        3 * zoom,
      );
      ctx.globalAlpha = 1;
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
  // base — вторичный ключ сортировки: при общем бусте от здания порядок
  // актёров между собой решает их собственная глубина, а не глубина здания
  const push = (depth, layer, f, base = depth) =>
    items.push({ depth, layer, f, base });

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
    if (inside === b) {
      // внутри: стены и мебель — ОТДЕЛЬНЫМИ сортированными элементами (не слот здания!)
      const it = getInterior(null, b);
      const segs = interiorSegments(b, it, city);
      for (const s of segs) {
        const d = Math.max(
          b.x + s.x1 + (b.y + s.y1),
          b.x + s.x2 + (b.y + s.y2),
        );
        push(d, 1, () => drawWallSeg(ctx, b, s, toX, toY, zoom, player));
      }
      for (const f of it.furniture || []) {
        const d = b.x + f.x + f.w + (b.y + f.y + f.h);
        push(d, 1.5, () =>
          drawFurnItem(ctx, b, f, toX, toY, zoom, player, loot, it),
        );
      }
    } else {
      // снаружи: здание, прячущее игрока, плавно уходит в прозрачность
      const target = occludesPlayer(b, player.x, player.y) ? 0.3 : 1;
      let a = R.bFade.get(b.id);
      if (a === undefined) a = 1;
      a += (target - a) * 0.25;
      if (Math.abs(a - target) < 0.02) a = target;
      R.bFade.set(b.id, a);
      const depth = b.x + b.w + (b.y + b.h);
      if (hasBuildingSprite(b))
        push(depth, 1, () =>
          drawBuilding(
            ctx,
            b,
            toX,
            toY,
            zoom,
            false,
            player,
            city.brokenWindows.get(b.id),
            loot,
            a,
          ),
        );
      else {
        // фасад ещё не запечён: коробка-placeholder, запечка в бюджете кадра
        R.bldQueue.set(b.id, b);
        push(depth, 1, () => drawBuildingMassing(ctx, b, toX, toY, a));
      }
    }
  }
  const streetEntries = [];
  for (const t of city.trees) {
    if (!vis(t.x, t.y, 70, 120)) continue;
    const p = w2s(t.x, t.y);
    const key = t.dead ? "tree_dead" : t.v === 1 ? "tree_birch" : "tree";
    const img = SPRTEX[key];
    const h = img ? 176 + t.v * 24 : 160;
    const w = img ? h * (img.width / img.height) : 128;
    streetEntries.push({
      base: t.x + t.y,
      depth: actorDepth(city, t),
      bounds: {
        left: img ? p.x - w / 2 : p.x - 64,
        top: img ? p.y - h : p.y - 150,
        right: img ? p.x + w / 2 : p.x + 64,
        bottom: img ? p.y : p.y + 10,
      },
      draw: () => {
        if (img) {
          ctx.drawImage(
            img,
            toX(p.x) - (w / 2) * zoom,
            toY(p.y) - h * zoom,
            w * zoom,
            h * zoom,
          );
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
      },
    });
  }
  for (const l of city.lamps) {
    if (l.dead || !vis(l.x, l.y, 30, 110)) continue;
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
    if (bch.dead || !vis(bch.x, bch.y, 45, 30)) continue;
    const p = w2s(bch.x, bch.y);
    const img = SPRTEX.bench;
    const w = img ? 66 : 80;
    const h = img ? w * (img.height / img.width) : 48;
    streetEntries.push({
      base: bch.x + bch.y,
      depth: actorDepth(city, bch),
      bounds: {
        left: img ? p.x - w / 2 : p.x - 40,
        top: img ? p.y - h : p.y - 40,
        right: img ? p.x + w / 2 : p.x + 40,
        bottom: img ? p.y : p.y + 8,
      },
      draw: () => {
        if (img) {
          ctx.drawImage(
            img,
            toX(p.x) - (w / 2) * zoom,
            toY(p.y) - h * zoom,
            w * zoom,
            h * zoom,
          );
        } else {
          ctx.drawImage(
            SPR.bench,
            toX(p.x) - 40 * zoom,
            toY(p.y) - 40 * zoom,
            80 * zoom,
            48 * zoom,
          );
        }
        R.drawCalls++;
      },
    });
  }
  for (const entry of reconcileStreetDepths(streetEntries))
    push(entry.depth, 1, entry.draw, entry.base);
  for (const cn of city.containers) {
    if (cn.dead || !vis(cn.x, cn.y, 40, 35)) continue;
    // парный тест со зданиями: контейнер перед домом — на переднем плане
    push(actorDepth(city, cn), 1, () => {
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
    if (t.dead || !vis(t.x, t.y, 32, 25)) continue;
    push(actorDepth(city, t), 1, () => {
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
    if (br.dead || !vis(br.x, br.y, 20, 22)) continue;
    push(actorDepth(city, br), 1, () => {
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
  for (const f of city.fences) {
    if (f.dead) continue;
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
  }
  // машины не рисуем, когда игрок внутри здания (снаружи скрыты стенами)
  if (!inside)
    city.cars.forEach((car, i) => {
      const cd = carDims(car);
      if (!vis(car.x + cd.w / 2, car.y + cd.h / 2, 130, 100)) return;
      push(car.x + cd.w + (car.y + cd.h), 1, () =>
        drawCar(ctx, car, i, toX, toY, zoom),
      );
    });
  player._insideB = inside;
  for (const z of zombies) {
    if (z.dead) continue;
    // зомби другого этажа не рисуем (игрок upstairs/downstairs)
    if ((z.level || 0) !== (player.level || 0)) continue;
    if (!vis(z.x, z.y, 40, 55)) continue;
    z._insideB = inside || buildingAtPoint(city, z.x, z.y);
    push(
      actorDepth(city, z),
      2,
      () => drawActor(ctx, z, SPR, toX, toY, zoom, false, null, null, R.gait),
      z.x + z.y,
    );
  }
  if (!inCar)
    push(
      actorDepth(city, player) + 0.01,
      2,
      () =>
        drawActor(ctx, player, SPR, toX, toY, zoom, true, combat, aim, R.gait),
      player.x + player.y,
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
        const spriteKey = n.id ? `npc_${n.id}` : "survivor";
        const img = SPRTEX[spriteKey] || SPRTEX.survivor;
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

  // лагеря выживших: палатки, ящики, костёр и NPC
  if (camps)
    for (const c of camps) {
      if (!vis(c.x, c.y, 170, 150)) continue;
      for (const [ox, oy, col] of [
        [-3.2, -2.2, "#5a6248"],
        [2.6, -3.0, "#6a6252"],
      ]) {
        const tx = c.x + ox,
          ty = c.y + oy;
        push(
          actorDepth(city, { x: tx, y: ty, r: 1 }),
          1,
          () => drawTent(ctx, tx, ty, col, toX, toY, zoom),
          tx + ty,
        );
      }
      for (const [ox, oy] of [
        [-2.2, 2.0],
        [3.0, 1.6],
      ]) {
        const tx = c.x + ox,
          ty = c.y + oy;
        push(
          actorDepth(city, { x: tx, y: ty, r: 0.5 }),
          1,
          () => drawCrate(ctx, tx, ty, toX, toY, zoom),
          tx + ty,
        );
      }
      push(c.x + c.y, 1, () => drawFire(ctx, c.x, c.y, toX, toY, zoom, now));
      const def = campDef(c);
      push(
        actorDepth(city, { x: c.x + 1, y: c.y + 1, r: 0.35 }),
        2,
        () => drawCampNpc(ctx, c, def, player, toX, toY, zoom),
        c.x + c.y + 2,
      );
    }

  // база игрока: флаг, баррикады, жилые модули, грядки, склад, жители
  if (base && base.founded && vis(base.x, base.y, 220, 180)) {
    const bx = base.x,
      by = base.y;
    push(bx + by, 1, () => drawFlag(ctx, bx, by, toX, toY, zoom), bx + by);
    const nBar = base.structures.filter((id) => id === "barricade").length;
    for (let i = 0; i < nBar * 3; i++) {
      const a = (i / (nBar * 3)) * Math.PI * 2;
      const tx = bx + Math.cos(a) * 5,
        ty = by + Math.sin(a) * 5;
      push(
        actorDepth(city, { x: tx, y: ty, r: 0.5 }),
        1,
        () => drawCrate(ctx, tx, ty, toX, toY, zoom),
        tx + ty,
      );
    }
    const nHouse = base.structures.filter((id) => id === "housing").length;
    for (let i = 0; i < nHouse; i++) {
      const tx = bx - 3 + i * 3,
        ty = by - 3;
      push(
        actorDepth(city, { x: tx, y: ty, r: 1 }),
        1,
        () => drawTent(ctx, tx, ty, "#5a6248", toX, toY, zoom),
        tx + ty,
      );
    }
    const nGarden = base.structures.filter((id) => id === "garden").length;
    for (let i = 0; i < nGarden; i++) {
      const tx = bx + 3,
        ty = by - 2 + i * 2;
      push(
        tx + ty,
        0.5,
        () => drawGarden(ctx, tx, ty, toX, toY, zoom),
        tx + ty,
      );
    }
    if (base.structures.includes("storage"))
      push(
        actorDepth(city, { x: bx + 2, y: by + 2, r: 0.5 }),
        1,
        () => drawCrate(ctx, bx + 2, by + 2, toX, toY, zoom),
        bx + by + 4,
      );
    for (let i = 0; i < base.residents; i++) {
      const tx = bx + 1 + i * 1.5,
        ty = by + 1;
      push(
        actorDepth(city, { x: tx, y: ty, r: 0.35 }),
        2,
        () =>
          drawCampNpc(
            ctx,
            { x: tx - 1, y: ty - 1 },
            { npc: { name: "Житель" } },
            player,
            toX,
            toY,
            zoom,
          ),
        tx + ty,
      );
    }
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
        // экранное направление полёта из мирового курса
        const vx = (a.dx - a.dy) * 32,
          vy = (a.dx + a.dy) * 16;
        const vl = Math.hypot(vx, vy) || 1;
        const ux = vx / vl,
          uy = vy / vl;
        const px = -uy,
          py = ux;
        const L = 15 * zoom;
        const tx = dx - ux * L,
          ty = dy - uy * L;
        // древко
        ctx.strokeStyle = "#c9b98f";
        ctx.lineWidth = 1.6 * zoom;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(dx - ux * 3 * zoom, dy - uy * 3 * zoom);
        ctx.stroke();
        // наконечник
        ctx.fillStyle = "#8f8a7c";
        ctx.beginPath();
        ctx.moveTo(dx + ux * 3 * zoom, dy + uy * 3 * zoom);
        ctx.lineTo(
          dx - ux * 4 * zoom + px * 2.2 * zoom,
          dy - uy * 4 * zoom + py * 2.2 * zoom,
        );
        ctx.lineTo(
          dx - ux * 4 * zoom - px * 2.2 * zoom,
          dy - uy * 4 * zoom - py * 2.2 * zoom,
        );
        ctx.closePath();
        ctx.fill();
        // оперение
        ctx.strokeStyle = "#e0d8c0";
        ctx.lineWidth = 1.2 * zoom;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(
          tx + ux * 3 * zoom + px * 2.4 * zoom,
          ty + uy * 3 * zoom + py * 2.4 * zoom,
        );
        ctx.moveTo(tx, ty);
        ctx.lineTo(
          tx + ux * 3 * zoom - px * 2.4 * zoom,
          ty + uy * 3 * zoom - py * 2.4 * zoom,
        );
        ctx.stroke();
        R.drawCalls += 3;
      });
    }
  }

  // золотые искры празднования уровня (поверх актёров, под ночью/пеплом)
  if (levelFx)
    for (const s of levelFx.sparks) {
      push(s.x + s.y, 3, () => {
        const p = w2s(s.x, s.y, s.z);
        const dx = toX(p.x),
          dy = toY(p.y);
        if (dx < -20 || dx > W + 20 || dy < -20 || dy > H + 20) return;
        const k = Math.max(0, 1 - s.t / s.life);
        const r = (2 + 2 * k) * zoom;
        // ореол + яркое ядро: искра читается на любом фоне без shadowBlur
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = "#ffb45c";
        ctx.fillRect(dx - r * 1.3, dy - r * 1.3, r * 2.6, r * 2.6);
        ctx.globalAlpha = k;
        ctx.fillStyle = s.gold ? "#ffd76a" : "#fff3c4";
        ctx.fillRect(dx - r / 2, dy - r / 2, r, r);
        ctx.globalAlpha = 1;
        R.drawCalls += 2;
      });
    }

  items.sort(
    (a, b) => a.depth - b.depth || a.base - b.base || a.layer - b.layer,
  );
  for (const it of items) it.f();

  if (night) {
    renderNight({ ctx, L, city, player, inside, toX, toY, zoom, W, H, camps });
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

  // полоса HP Матки, когда она на экране
  const boss = zombies.find((z) => !z.dead && z.type === "boss");
  if (boss && vis(boss.x, boss.y, 90, 140)) {
    const bp = w2s(boss.x, boss.y);
    const bx = toX(bp.x),
      by = toY(bp.y) - 130 * zoom;
    const bw = 70 * zoom;
    ctx.fillStyle = "rgba(16,20,26,0.75)";
    ctx.fillRect(bx - bw / 2 - 2, by - 2, bw + 4, 10 * zoom + 4);
    ctx.fillStyle = "#8a2a22";
    ctx.fillRect(
      bx - bw / 2,
      by,
      (bw * Math.max(0, boss.hp)) / ZTYPES.boss.hp,
      10 * zoom,
    );
    ctx.font = `${10 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#e0b0a0";
    ctx.fillText("МАТКА", bx, by - 5 * zoom);
    ctx.textAlign = "left";
    R.drawCalls += 3;
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
  // шкала обыска над контейнером
  if (search) {
    const p = w2s(search.c.x, search.c.y);
    const dx = toX(p.x),
      dy = toY(p.y) - 46 * zoom;
    const bw = 44 * zoom;
    ctx.fillStyle = "rgba(16,20,26,0.75)";
    ctx.fillRect(dx - bw / 2 - 2, dy - 2, bw + 4, 8 * zoom + 4);
    ctx.fillStyle = "#ffb23e";
    ctx.fillRect(
      dx - bw / 2,
      dy,
      bw * Math.min(1, search.t / search.dur),
      8 * zoom,
    );
    ctx.font = `${10 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ece5d0";
    ctx.fillText("Обыск...", dx, dy - 6 * zoom);
    ctx.textAlign = "left";
    R.drawCalls += 3;
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

function drawBuilding(
  ctx,
  b,
  toX,
  toY,
  zoom,
  ghost,
  player,
  brokenSet,
  loot,
  alpha = 1,
) {
  if (ghost) {
    // внутри: вместо shell — интерьер (перегородки к югу/востоку от игрока — полупрозрачные)
    drawInteriorWalls(ctx, b, toX, toY, zoom, player);
    drawFurniture(ctx, b, toX, toY, zoom, player, loot);
    return;
  }
  ctx.globalAlpha = alpha;
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
      ctx.translate(bx - (face === "S" ? 22 * zoom : 0), by);
      ctx.transform(face === "S" ? 1 : -1, 0.5, 0, 1, 0, 0);
      ctx.fillStyle = "#11181b";
      ctx.fillRect(6 * zoom, -42 * zoom, 33 * zoom, 37 * zoom);
      ctx.drawImage(SPRTEX.win_broken, 0, -48 * zoom, 45 * zoom, 48 * zoom);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// машина: процедурная тень под полным курсом (T-матрица) + процедурная iso-модель
// кузова (точные проекции боксов на любой курс — без ступенек турнтейбла).
// Gemini-турнтейблы 8/16 кадров отвергнуты: неравномерная сетка курсов и плоские
// виды (три генерации 16, см. этап 18 плана). Это НЕ ctx.rotate спрайта.

function drawCar(ctx, car, i, toX, toY, zoom) {
  const cc = carCenter(car);
  const p = w2s(cc.x, cc.y);
  const sx = toX(p.x),
    sy = toY(p.y);
  const heading = car.heading ?? (car.axis === "x" ? 0 : Math.PI / 2);
  // тень капсулой по форме машины: локальные оси кузова проецируем изометрически
  // (x → ((cos−sin)·32, (cos+sin)·16), y → ((−sin−cos)·32, (−sin+cos)·16) пкс/м)
  const c = Math.cos(heading),
    s = Math.sin(heading);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.transform(
    (c - s) * 32 * zoom,
    (c + s) * 16 * zoom,
    (-s - c) * 32 * zoom,
    (-s + c) * 16 * zoom,
    0,
    0,
  );
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#10141a";
  {
    // капсула 4,7 × 2,0 м вдоль оси машины
    const L = 4.7,
      Wd = 2.0,
      r = Wd / 2;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + r, -Wd / 2);
    ctx.lineTo(L / 2 - r, -Wd / 2);
    ctx.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-L / 2 + r, Wd / 2);
    ctx.arc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const shape = CAR_SHAPES[car.wreck ? "wreck" : car.kind || "sedan"];
  // c/s (cos/sin курса) объявлены выше для тени
  const pt = (lx, ly, z) => {
    const q = w2s(cc.x + lx * c - ly * s, cc.y + lx * s + ly * c, z);
    return { x: toX(q.x), y: toY(q.y) };
  };
  const poly = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fill();
  };
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
    const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
    const b = Math.min(255, (n & 255) * f) | 0;
    return `rgb(${r},${g},${b})`;
  };
  const base = shape.charred ? "#4a4038" : car.color || "#7a3a2a";
  const glass = shape.charred ? "#141210" : "#22303c";
  // бокс: 4 боковые грани painter-сортировкой по глубине + верх.
  // inset сужает верхнюю прямоугольную грань → скосы лобового/заднего стекла
  const box = (l0, l1, w0, w1, z0, z1, sideCol, topCol, inset) => {
    const cor = [
      [l0, w0],
      [l1, w0],
      [l1, w1],
      [l0, w1],
    ];
    const top = inset
      ? [
          [l0 + inset.dl0, w0 + inset.dw],
          [l1 - inset.dl1, w0 + inset.dw],
          [l1 - inset.dl1, w1 - inset.dw],
          [l0 + inset.dl0, w1 - inset.dw],
        ]
      : cor;
    const faces = [];
    for (let e = 0; e < 4; e++) {
      const a = cor[e],
        b = cor[(e + 1) % 4];
      const ta = top[e],
        tb = top[(e + 1) % 4];
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const nl = Math.hypot(ex, ey) || 1;
      const nx = ey / nl,
        ny = -ex / nl;
      const wnx = nx * c - ny * s,
        wny = nx * s + ny * c;
      const f = 0.62 + 0.38 * Math.max(0, wny * 0.85 + wnx * 0.15);
      faces.push({ d: mx * c - my * s + mx * s + my * c, a, b, ta, tb, f });
    }
    faces.sort((p, q) => p.d - q.d);
    for (const fc of faces) {
      ctx.fillStyle = shade(sideCol, fc.f);
      poly([
        pt(fc.a[0], fc.a[1], z0),
        pt(fc.b[0], fc.b[1], z0),
        pt(fc.tb[0], fc.tb[1], z1),
        pt(fc.ta[0], fc.ta[1], z1),
      ]);
    }
    ctx.fillStyle = topCol;
    poly(top.map(([x, y]) => pt(x, y, z1)));
  };
  // колёса под кузовом
  ctx.fillStyle = "#191c1e";
  for (const lx of [-shape.wheelbase / 2, shape.wheelbase / 2])
    for (const ly of [-shape.track / 2, shape.track / 2]) {
      const q = pt(lx, ly, 0.3);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 0.33 * 32 * zoom, 0.33 * 16 * zoom, 0, 0, 7);
      ctx.fill();
    }
  const hl = shape.len / 2;
  box(
    -hl,
    hl,
    -shape.wid / 2,
    shape.wid / 2,
    shape.body.z0,
    shape.body.z1,
    base,
    shade(base, 1.08),
  );
  // бамперы
  const bump = shape.charred ? "#26221e" : "#2e3134";
  box(
    hl - 0.06,
    hl + 0.1,
    -shape.wid / 2 + 0.08,
    shape.wid / 2 - 0.08,
    0.28,
    0.5,
    bump,
    shade(bump, 1.2),
  );
  box(
    -hl - 0.1,
    -hl + 0.06,
    -shape.wid / 2 + 0.08,
    shape.wid / 2 - 0.08,
    0.28,
    0.5,
    bump,
    shade(bump, 1.2),
  );
  // арки колёс на видимом борту (нормаль борта смотрит в камеру)
  const sideLy = c - s >= 0 ? shape.wid / 2 : -shape.wid / 2;
  const archAng = Math.atan2((c + s) * 16, (c - s) * 32);
  ctx.fillStyle = "rgba(16,18,20,0.85)";
  for (const lx of [-shape.wheelbase / 2, shape.wheelbase / 2]) {
    const q = pt(lx, sideLy, 0.42);
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, 0.36 * 32 * zoom, 0.3 * 32 * zoom, archAng, 0, 7);
    ctx.fill();
  }
  const cb = shape.cabin;
  box(
    cb.l0,
    cb.l1,
    -cb.w,
    cb.w,
    cb.z0,
    cb.z1,
    glass,
    shape.charred ? shade(base, 0.8) : shade(base, 1.12),
    shape.cabinInset,
  );
  // фары и габариты
  ctx.fillStyle = shape.charred ? "#3a3733" : "#d9cba6";
  for (const ly of [-shape.wid * 0.32, shape.wid * 0.32]) {
    const q = pt(hl, ly, shape.body.z1 - 0.12);
    ctx.fillRect(q.x - 2 * zoom, q.y - 2 * zoom, 4 * zoom, 3 * zoom);
  }
  ctx.fillStyle = "#8a2a22";
  for (const ly of [-shape.wid * 0.32, shape.wid * 0.32]) {
    const q = pt(-hl, ly, shape.body.z1 - 0.12);
    ctx.fillRect(q.x - 2 * zoom, q.y - 2 * zoom, 4 * zoom, 3 * zoom);
  }
}

// стены интерьера + фасадные с проёмами — как сортированные сегменты.
// Длинные стены режем на куски ≤1 м: painter-порядок по max(x+y) работает
// только локально, иначе северная стена рисуется поверх мебели перед ней.
function interiorSegments(b, it, city) {
  const walls = [];
  const chunk = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(len));
    for (let i = 0; i < n; i++)
      walls.push({
        x1: x1 + ((x2 - x1) * i) / n,
        y1: y1 + ((y2 - y1) * i) / n,
        x2: x1 + ((x2 - x1) * (i + 1)) / n,
        y2: y1 + ((y2 - y1) * (i + 1)) / n,
        inside: true,
      });
  };
  for (const w of it.walls) chunk(w.x1, w.y1, w.x2, w.y2);
  const du = it.doorU,
    W = b.w,
    H = b.h;
  const broken = city.brokenWindows?.get(b.id);
  const southGaps = [[du, 0.7]],
    eastGaps = [];
  if (broken)
    for (const key of broken) {
      const [face, u] = key.split(":");
      if (face === "S") southGaps.push([Number(u), 0.6]);
      else eastGaps.push([Number(u), 0.6]);
    }
  for (const [x1, y1, x2, y2] of [
    [0, 0, W, 0],
    ...wallWithGaps(0, H, W, H, southGaps),
    [0, 0, 0, H],
    ...wallWithGaps(W, 0, W, H, eastGaps),
  ])
    chunk(x1, y1, x2, y2);
  return walls;
}

// один сегмент стены (1 м) с кэпом; к югу/востоку от игрока — полупрозрачный
function drawWallSeg(ctx, b, s, toX, toY, zoom, player) {
  const hgt = 32 * zoom;
  const plx = player ? player.x - b.x : 0,
    ply = player ? player.y - b.y : 0;
  const horizontal = s.y1 === s.y2;
  const fade =
    (horizontal && s.y1 > ply + 0.1) || (!horizontal && s.x1 > plx + 0.1);
  if (fade) ctx.globalAlpha = 0.25;
  // куски стены перекрываются на 2 см: иначе AA-кромки дают светлые швы
  const dx = s.x2 - s.x1,
    dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ex = (dx / len) * 0.02,
    ey = (dy / len) * 0.02;
  const a = w2s(b.x + s.x1 - ex, b.y + s.y1 - ey);
  const c = w2s(b.x + s.x2 + ex, b.y + s.y2 + ey);
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

// мебель как отдельный сортированный элемент
function drawFurnItem(ctx, b, f, toX, toY, zoom, player, loot, it) {
  const st = FURNITURE[f.kind] || FURNITURE.table;
  const cx = b.x + f.x + f.w / 2,
    cy = b.y + f.y + f.h / 2;
  const p = w2s(cx, cy);
  const dx = toX(p.x),
    dy = toY(p.y);
  const plx = player ? player.x - b.x : 0,
    ply = player ? player.y - b.y : 0;
  const fade = cy - b.y > ply + 0.1 || cx - b.x > plx + 0.1;
  if (fade) ctx.globalAlpha = 0.55;
  const hgt = st.h * 32 * zoom;
  // спрайт мебели (этап 18): якорь низ-центр по южному углу footprint
  const img = SPRTEX["furn_" + f.kind];
  if (img) {
    const sp = w2s(b.x + f.x + f.w, b.y + f.y + f.h);
    // ширина по footprint; высоту ограничиваем физическим боксом
    // Генеративные спрайты могут иметь более крутой ракурс: высота ограничивается физическим боксом.
    let dw = (f.w + f.h) * 32 * zoom,
      dh = dw * (img.height / img.width);
    const maxH = (st.h * 32 + (f.w + f.h) * 16) * zoom * 1.15;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * (img.width / img.height);
    }
    ctx.drawImage(img, toX(sp.x) - dw / 2, toY(sp.y) - dh, dw, dh);
    const cont = it.containers.find(
      (c) => Math.abs(b.x + c.x - cx) < 1 && Math.abs(b.y + c.y - cy) < 1,
    );
    if (cont && loot && !loot.opened.has(cont.id)) {
      ctx.fillStyle = "#ffb23e";
      ctx.beginPath();
      ctx.arc(dx, dy - hgt - 8 * zoom, 3.5 * zoom, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }
  const s = w2s(b.x + f.x, b.y + f.y + f.h);
  const e = w2s(b.x + f.x + f.w, b.y + f.y);
  ctx.fillStyle = st.c;
  ctx.beginPath();
  ctx.moveTo(toX(s.x), toY(s.y) - hgt);
  ctx.lineTo(toX(e.x), toY(e.y) - hgt);
  ctx.lineTo(toX(e.x), toY(e.y));
  ctx.lineTo(toX(s.x), toY(s.y));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = st.top;
  ctx.beginPath();
  const a1 = w2s(b.x + f.x, b.y + f.y),
    a2 = w2s(b.x + f.x + f.w, b.y + f.y),
    a3 = w2s(b.x + f.x + f.w, b.y + f.y + f.h),
    a4 = w2s(b.x + f.x, b.y + f.y + f.h);
  ctx.moveTo(toX(a1.x), toY(a1.y) - hgt);
  ctx.lineTo(toX(a2.x), toY(a2.y) - hgt);
  ctx.lineTo(toX(a3.x), toY(a3.y) - hgt);
  ctx.lineTo(toX(a4.x), toY(a4.y) - hgt);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(16,20,26,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const cont = it.containers.find(
    (c) => Math.abs(b.x + c.x - cx) < 1 && Math.abs(b.y + c.y - cy) < 1,
  );
  if (cont && loot && !loot.opened.has(cont.id)) {
    ctx.fillStyle = "#ffb23e";
    ctx.beginPath();
    ctx.arc(dx, dy - hgt - 8 * zoom, 3.5 * zoom, 0, 7);
    ctx.fill();
  }
  if (fade) ctx.globalAlpha = 1;
}

// мебель интерьера: изо-коробки по типу; контейнеры — бейдж до обыска
function drawFurniture(ctx, b, toX, toY, zoom, player, loot) {
  const it = getInterior(null, b);
  if (!it.furniture) return;
  const plx = player ? player.x - b.x : 0,
    ply = player ? player.y - b.y : 0;
  for (const f of it.furniture) {
    const st = FURNITURE[f.kind] || FURNITURE.table;
    const cx = b.x + f.x + f.w / 2,
      cy = b.y + f.y + f.h / 2;
    const p = w2s(cx, cy);
    const dx = toX(p.x),
      dy = toY(p.y);
    const fade = cy - b.y > ply + 0.1 || cx - b.x > plx + 0.1;
    if (fade) ctx.globalAlpha = 0.55;
    const wpx = f.w * 32 * zoom,
      hpx = f.h * 32 * zoom,
      hgt = st.h * 32 * zoom;
    // изо-коробка: южная и восточная грани + верх
    const s = w2s(b.x + f.x, b.y + f.y + f.h);
    const e = w2s(b.x + f.x + f.w, b.y + f.y);
    ctx.fillStyle = st.c;
    ctx.beginPath();
    ctx.moveTo(toX(s.x), toY(s.y) - hgt);
    ctx.lineTo(toX(e.x), toY(e.y) - hgt);
    ctx.lineTo(toX(e.x), toY(e.y));
    ctx.lineTo(toX(s.x), toY(s.y));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = st.top;
    ctx.beginPath();
    const a1 = w2s(b.x + f.x, b.y + f.y),
      a2 = w2s(b.x + f.x + f.w, b.y + f.y),
      a3 = w2s(b.x + f.x + f.w, b.y + f.y + f.h),
      a4 = w2s(b.x + f.x, b.y + f.y + f.h);
    ctx.moveTo(toX(a1.x), toY(a1.y) - hgt);
    ctx.lineTo(toX(a2.x), toY(a2.y) - hgt);
    ctx.lineTo(toX(a3.x), toY(a3.y) - hgt);
    ctx.lineTo(toX(a4.x), toY(a4.y) - hgt);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(16,20,26,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // бейдж контейнера до обыска
    const isContainer = it.containers.some(
      (c) => Math.abs(b.x + c.x - cx) < 1 && Math.abs(b.y + c.y - cy) < 1,
    );
    if (
      isContainer &&
      loot &&
      !loot.opened.has(
        it.containers.find(
          (c) => Math.abs(b.x + c.x - cx) < 1 && Math.abs(b.y + c.y - cy) < 1,
        )?.id,
      )
    ) {
      ctx.fillStyle = "#ffb23e";
      ctx.beginPath();
      ctx.arc(dx, dy - hgt - 8 * zoom, 3.5 * zoom, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

// глубина актёра по парному тесту (Qwen): актёр ПЕРЕД объектом, если южнее его
// южной кромки ИЛИ восточнее восточной → рисуется после. Проверяются ближайшие
// здания, машины, а внутри — стены и мебель активного здания.
function actorDepth(city, a) {
  const r = a.r || 0.35;
  let d = a.x + a.y + 0.01;
  const cx = Math.floor(a.x / 16),
    cy = Math.floor(a.y / 16);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cell = city.buildingGrid?.get(cx + dx + "," + (cy + dy));
      if (cell)
        for (const b of cell) {
          const bx1 = b.x + b.w,
            by1 = b.y + b.h,
            bd = bx1 + by1;
          if (a.x + r > bx1 || a.y + r > by1) d = Math.max(d, bd + 0.01);
        }
      const scell = city.solidGrid?.get(cx + dx + "," + (cy + dy));
      if (scell)
        for (const s of scell) {
          if (s.kind !== "car") continue;
          const cx1 = s.x + s.w,
            cy1 = s.y + s.h,
            cd = cx1 + cy1;
          if (a.x + r > cx1 || a.y + r > cy1) d = Math.max(d, cd + 0.01);
        }
    }
  // внутри здания: парный тест по стенам и мебели
  const ib = a._insideB;
  if (ib) {
    const it = getInterior(null, ib);
    for (const s of it.walls) {
      const sd = Math.max(
        ib.x + s.x1 + (ib.y + s.y1),
        ib.x + s.x2 + (ib.y + s.y2),
      );
      const horiz = s.y1 === s.y2;
      if ((horiz && a.y + r > ib.y + s.y1) || (!horiz && a.x + r > ib.x + s.x1))
        d = Math.max(d, sd + 0.01);
    }
    for (const f of it.furniture || []) {
      const fd = ib.x + f.x + f.w + (ib.y + f.y + f.h);
      if (a.x + r > ib.x + f.x + f.w || a.y + r > ib.y + f.y + f.h)
        d = Math.max(d, fd + 0.01);
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

// tint-варианты спрайта зомби по типам (кэш рендера, не состояние игры)
const zTintCache = new Map();
function tintedZombie(img, tint) {
  let c = zTintCache.get(tint);
  if (!c) {
    c = mkCanvas(img.width, img.height);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    zTintCache.set(tint, c);
  }
  return c;
}

function drawActor(
  ctx,
  a,
  SPR,
  toX,
  toY,
  zoom,
  isPlayer,
  combat = null,
  aim = null,
  gait = "bob",
) {
  const p = w2s(a.x, a.y);
  const zt = isPlayer ? null : ZTYPES[a.type || "walker"];
  const scale = zt?.scale ?? 1;
  ctx.fillStyle = "rgba(16,20,26,0.35)";
  ctx.beginPath();
  ctx.ellipse(toX(p.x), toY(p.y), 14 * zoom * scale, 6 * zoom * scale, 0, 0, 7);
  ctx.fill();
  const bowSprite = isPlayer && combat?.bowDrawing && SPRTEX.survivor_bow_draw;
  const base = bowSprite || SPRTEX[isPlayer ? "survivor" : "zombie"];
  const img = base && zt?.tint ? tintedZombie(base, zt.tint) : base;
  if (img) {
    const h = (base === SPRTEX.survivor_bow_draw ? 96 : 78) * zoom * scale; // ~2,4 м — читаемость важнее строгого масштаба (как в PZ)
    const w = h * (img.width / img.height);
    const aimPoint =
      base === SPRTEX.survivor_bow_draw && aim ? w2s(aim.x, aim.y) : null;
    const flip = aimPoint && aimPoint.x < p.x;
    // походка — выбираемый вариант (лаборатория G); фаза от дистанции
    // (walkPh), поэтому бег чаще ходьбы; стоя — спрайт ровно
    ctx.save();
    ctx.translate(toX(p.x), toY(p.y));
    if (flip) ctx.scale(-1, 1);
    const bob = (GAITS[gait] || GAITS.doll)(
      ctx,
      img,
      w,
      h,
      zoom * scale,
      a.walkPh || 0,
      a.moving,
    );
    // факел в руке игрока
    if (isPlayer && a.torch) {
      const fx = w * 0.32,
        fy = -h * 0.55 + bob;
      const f = 0.8 + 0.25 * Math.sin(a.animT * 9);
      ctx.fillStyle = "#c96a35";
      ctx.beginPath();
      ctx.moveTo(fx - 3 * zoom, fy);
      ctx.quadraticCurveTo(fx, fy - 10 * zoom * f, fx + 3 * zoom, fy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffb23e";
      ctx.beginPath();
      ctx.moveTo(fx - 1.5 * zoom, fy);
      ctx.quadraticCurveTo(fx, fy - 6 * zoom * f, fx + 1.5 * zoom, fy);
      ctx.closePath();
      ctx.fill();
    }
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

// палатка-пирамида: 4 грани painter-сортировкой, южная светлее
function drawTent(ctx, x, y, col, toX, toY, zoom) {
  const b = 1.2,
    d = 0.9,
    h = 1.5;
  const cor = [
    [-b, -d],
    [b, -d],
    [b, d],
    [-b, d],
  ];
  const apex = w2s(x, y, h);
  const faces = [];
  for (let e = 0; e < 4; e++) {
    const a = cor[e],
      bb = cor[(e + 1) % 4];
    const mx = (a[0] + bb[0]) / 2,
      my = (a[1] + bb[1]) / 2;
    faces.push({ d: mx + my, a, bb });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const f of faces) {
    const shade = f.d > 0 ? 1 : 0.72;
    const n = parseInt(col.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * shade) | 0;
    const g = Math.min(255, ((n >> 8) & 255) * shade) | 0;
    const bl = Math.min(255, (n & 255) * shade) | 0;
    ctx.fillStyle = `rgb(${r},${g},${bl})`;
    const p1 = w2s(x + f.a[0], y + f.a[1], 0);
    const p2 = w2s(x + f.bb[0], y + f.bb[1], 0);
    ctx.beginPath();
    ctx.moveTo(toX(p1.x), toY(p1.y));
    ctx.lineTo(toX(p2.x), toY(p2.y));
    ctx.lineTo(toX(apex.x), toY(apex.y));
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(16,20,26,0.5)";
  ctx.lineWidth = 1;
  const p1 = w2s(x - b, y + d, 0);
  const p2 = w2s(x + b, y + d, 0);
  ctx.beginPath();
  ctx.moveTo(toX(p1.x), toY(p1.y));
  ctx.lineTo(toX(apex.x), toY(apex.y));
  ctx.lineTo(toX(p2.x), toY(p2.y));
  ctx.stroke();
}

function drawCrate(ctx, x, y, toX, toY, zoom) {
  const w = 0.9,
    d = 0.7,
    h = 0.6;
  const s = w2s(x, y + d, 0),
    e = w2s(x + w, y, 0);
  const hgt = h * 32 * zoom;
  ctx.fillStyle = "#6a5a3a";
  ctx.beginPath();
  ctx.moveTo(toX(s.x), toY(s.y) - hgt);
  ctx.lineTo(toX(e.x), toY(e.y) - hgt);
  ctx.lineTo(toX(e.x), toY(e.y));
  ctx.lineTo(toX(s.x), toY(s.y));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7a6844";
  const a1 = w2s(x, y, 0),
    a2 = w2s(x + w, y, 0),
    a3 = w2s(x + w, y + d, 0),
    a4 = w2s(x, y + d, 0);
  ctx.beginPath();
  ctx.moveTo(toX(a1.x), toY(a1.y) - hgt);
  ctx.lineTo(toX(a2.x), toY(a2.y) - hgt);
  ctx.lineTo(toX(a3.x), toY(a3.y) - hgt);
  ctx.lineTo(toX(a4.x), toY(a4.y) - hgt);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(16,20,26,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFire(ctx, x, y, toX, toY, zoom, now) {
  const p = w2s(x, y, 0);
  const dx = toX(p.x),
    dy = toY(p.y);
  // брёвна
  ctx.strokeStyle = "#3a2e22";
  ctx.lineWidth = 3 * zoom;
  ctx.beginPath();
  ctx.moveTo(dx - 8 * zoom, dy - 2 * zoom);
  ctx.lineTo(dx + 8 * zoom, dy + 2 * zoom);
  ctx.moveTo(dx - 6 * zoom, dy + 3 * zoom);
  ctx.lineTo(dx + 7 * zoom, dy - 3 * zoom);
  ctx.stroke();
  // пламя с мерцанием
  const f = 0.8 + 0.25 * Math.sin(now * 9) + 0.1 * Math.sin(now * 23);
  const fh = 16 * zoom * f;
  ctx.fillStyle = "#c96a35";
  ctx.beginPath();
  ctx.moveTo(dx - 5 * zoom, dy);
  ctx.quadraticCurveTo(dx - 2 * zoom, dy - fh * 0.6, dx, dy - fh);
  ctx.quadraticCurveTo(dx + 3 * zoom, dy - fh * 0.5, dx + 5 * zoom, dy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffb23e";
  ctx.beginPath();
  ctx.moveTo(dx - 2.5 * zoom, dy);
  ctx.quadraticCurveTo(dx, dy - fh * 0.55, dx + 2.5 * zoom, dy);
  ctx.closePath();
  ctx.fill();
}

function drawFlag(ctx, x, y, toX, toY, zoom) {
  const p = w2s(x, y, 0);
  const dx = toX(p.x),
    dy = toY(p.y);
  ctx.strokeStyle = "#3a2e22";
  ctx.lineWidth = 2 * zoom;
  ctx.beginPath();
  ctx.moveTo(dx, dy);
  ctx.lineTo(dx, dy - 40 * zoom);
  ctx.stroke();
  ctx.fillStyle = "#c96a35";
  ctx.beginPath();
  ctx.moveTo(dx, dy - 40 * zoom);
  ctx.lineTo(dx + 16 * zoom, dy - 35 * zoom);
  ctx.lineTo(dx, dy - 30 * zoom);
  ctx.closePath();
  ctx.fill();
}

function drawGarden(ctx, x, y, toX, toY, zoom) {
  const p = w2s(x, y, 0);
  const dx = toX(p.x),
    dy = toY(p.y);
  ctx.fillStyle = "#4a3a28";
  ctx.beginPath();
  ctx.ellipse(dx, dy, 20 * zoom, 10 * zoom, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#5a7a3a";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(dx + i * 10 * zoom, dy - 2 * zoom, 4 * zoom, 3 * zoom, 0, 0, 7);
    ctx.fill();
  }
}

function drawCampNpc(ctx, c, def, player, toX, toY, zoom) {
  const x = c.x + 1,
    y = c.y + 1;
  const p = w2s(x, y);
  ctx.fillStyle = "rgba(16,20,26,0.35)";
  ctx.beginPath();
  ctx.ellipse(toX(p.x), toY(p.y), 14 * zoom, 6 * zoom, 0, 0, 7);
  ctx.fill();
  const spriteKey = {
    park: "npc_oleg",
    school: "npc_vera",
    police: "npc_sanych",
  }[c.id];
  const img = SPRTEX[spriteKey] || SPRTEX.survivor;
  if (img) {
    const h = 78 * zoom,
      w = h * (img.width / img.height);
    ctx.drawImage(img, toX(p.x) - w / 2, toY(p.y) - h, w, h);
  }
  if (Math.hypot(player.x - x, player.y - y) < 6) {
    ctx.font = `${11 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#0a0c09";
    ctx.fillText(def.npc.name, toX(p.x) + 1, toY(p.y) - 84 * zoom + 1);
    ctx.fillStyle = "#a6e83c";
    ctx.fillText(def.npc.name, toX(p.x), toY(p.y) - 84 * zoom);
    ctx.fillStyle = "#9a9478";
    ctx.fillText("E — лагерь", toX(p.x), toY(p.y) - 70 * zoom);
    ctx.textAlign = "left";
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
