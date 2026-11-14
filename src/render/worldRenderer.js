import { renderWorldObjects } from "./worldObjects.js";
import { renderCampsAndVehicles } from "./campsAndVehicles.js";
import { renderActors } from "./actors.js";
import { renderParticles } from "./particles.js";
import { renderLighting } from "./lighting.js";
import { renderGuidance } from "./guidance.js";
import { renderVfx } from "./vfx.js";
import { renderBuildingInterior } from "./buildingInterior.js";
import { renderRailVehicles } from "./railVehicles.js";

export function createWorldRenderer(deps) {
  const {
    ctx,
    lx,
    LC,
    SC,
    getSC,
    cam,
    getW,
    getH,
    getShake,
    rnd,
    getChunk,
    setVisChunks,
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
    carsNear,
    NPCS,
    Z,
    VFX,
    VFX_ASSETS,
    RAIL_VEHICLES,
    getState,
    getP,
    getActiveBuilding,
    getFloorId,
    getStairs,
    getInteriorLayout,
    isContainerActive,
    getBuildSel,
    mouse,
    screenToWorld,
    solidAt,
    tileAt,
    buildLocked,
    mainQuest,
    getSearching,
    getBench,
    carSpriteKey,
    drawWeaponOverlay,
    darkness,
    questTargetWorld,
    isTouch,
    getRecoil,
    w2s,
  } = deps;

  return function renderWorld() {
    const W = getW();
    const H = getH();
    const scale = (getSC ? getSC() : SC) * (cam.zoom ?? 1);
    const rotation = cam.rotation ?? 0;
    const state = getState();
    const P = getP();
    const shake = getShake();
    const buildSel = getBuildSel();
    const searching = getSearching();
    const bench = getBench();
    const recoil = getRecoil();
    const visChunks = [];
    setVisChunks(visChunks);

    ctx.fillStyle = "#090b08";
    ctx.fillRect(0, 0, W, H);
    const sx = shake > 0 ? (rnd() - 0.5) * shake * 2 : 0;
    const sy = shake > 0 ? (rnd() - 0.5) * shake * 2 : 0;
    const saveCam = { x: cam.x, y: cam.y };
    cam.x += sx;
    cam.y += sy;
    const chunkRadius = 256 * Math.SQRT1_2;
    const visibleRadius = Math.hypot(W, H) / (2 * scale) + chunkRadius;
    const x0 = Math.floor((cam.x - visibleRadius) / 256);
    const x1 = Math.ceil((cam.x + visibleRadius) / 256);
    const y0 = Math.floor((cam.y - visibleRadius) / 256);
    const y1 = Math.ceil((cam.y + visibleRadius) / 256);

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        if (
          Math.hypot(gx * 256 + 128 - cam.x, gy * 256 + 128 - cam.y) >
          visibleRadius
        )
          continue;
        const chunk = getChunk(gx, gy);
        visChunks.push(chunk);
        const s = w2s(gx * 256, gy * 256);
        if (rotation) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(rotation);
          ctx.drawImage(chunk.canvas, 0, 0, 256 * scale, 256 * scale);
          ctx.restore();
        } else {
          ctx.drawImage(
            chunk.canvas,
            Math.round(s.x),
            Math.round(s.y),
            256 * scale,
            256 * scale,
          );
        }
      }
    }

    renderBuildingInterior({
      ctx,
      building: getActiveBuilding(),
      floorId: getFloorId(),
      stairs: getStairs(),
      layout: getInteriorLayout(),
      S,
      SC: scale,
      rotation,
      w2s,
    });

    const now = performance.now() / 1000;
    for (const chunk of visChunks) {
      if (!chunk.nest?.alive) continue;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + now * 0.1;
        const x = chunk.nest.x + Math.cos(angle) * 52;
        const y = chunk.nest.y + Math.sin(angle) * 52;
        const s = w2s(x, y);
        const pulse = 1 + Math.sin(now * 3 + i) * 0.1;
        ctx.drawImage(
          S.pod,
          s.x - 5 * scale * pulse,
          s.y - 5 * scale * pulse,
          10 * scale * pulse,
          10 * scale * pulse,
        );
      }
    }

    for (const drop of DR) {
      const s = w2s(drop.x, drop.y + Math.sin(drop.t * 3) * 2);
      const item = ITEMS[drop.id];
      if (item && item.r >= 2) {
        ctx.fillStyle =
          "rgba(255,178,62," + (0.18 + Math.sin(drop.t * 4) * 0.08) + ")";
        ctx.fillRect(s.x - 2, s.y - 38, 4, 38);
      }
      ctx.drawImage(
        ICONS[drop.id] || ICONS.scrap,
        s.x - 6 * scale,
        s.y - 6 * scale,
        12 * scale,
        12 * scale,
      );
    }

    const entities = [
      ...renderWorldObjects({
        ctx,
        visChunks,
        SMAP,
        S,
        SC: scale,
        rotation,
        now,
        w2s,
        mainQuest,
        searching,
        isContainerActive,
        bench,
        cam,
        W,
        H,
      }),
      ...renderCampsAndVehicles({
        ctx,
        CAMPS,
        CARS,
        carsNear,
        NPCS,
        cam,
        W,
        H,
        SC: scale,
        rotation,
        w2s,
        S,
        now,
        carSpriteKey,
        PT,
        rnd,
      }),
      ...renderActors({
        ctx,
        Z,
        P,
        state,
        S,
        SC: scale,
        rotation,
        now,
        w2s,
        drawWeaponOverlay,
      }),
    ];
    entities.sort((a, b) => a.y - b.y);
    for (const entity of entities) entity.f();
    renderRailVehicles({
      ctx,
      vehicles: RAIL_VEHICLES,
      S,
      SC: scale,
      rotation,
      cam,
      W,
      H,
      w2s,
    });

    renderParticles({
      ctx,
      PR,
      CL,
      PT,
      TX: [],
      ash: [],
      S,
      SC: scale,
      rotation,
      now,
      w2s,
      rnd,
      W,
      H,
    });
    renderVfx({ ctx, effects: VFX, assets: VFX_ASSETS, now, w2s, SC: scale });

    if (buildSel && state === "play") {
      const w = screenToWorld(mouse.x, mouse.y);
      const tx = Math.floor(w.x / 16);
      const ty = Math.floor(w.y / 16);
      const ok =
        !solidAt(tx, ty) && tileAt(tx, ty) !== 10 && !buildLocked(buildSel);
      const s = w2s(tx * 16, ty * 16);
      const size = 16 * scale;
      ctx.globalAlpha = 0.55;
      if (rotation) {
        const center = w2s(tx * 16 + 8, ty * 16 + 8);
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);
        ctx.drawImage(S[buildSel], -size / 2, -size / 2, size, size);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ok ? "rgba(166,232,60,.9)" : "rgba(224,67,56,.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(S[buildSel], s.x, s.y, size, size);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ok ? "rgba(166,232,60,.9)" : "rgba(224,67,56,.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x, s.y, size, size);
      }
    }

    renderLighting({
      ctx,
      lx,
      LC,
      W,
      H,
      SC: scale,
      dark: darkness(),
      state,
      P,
      CARS,
      SMAP,
      CAMPS,
      visChunks,
      LG: deps.LG,
      now,
      w2s,
    });
    renderParticles({
      ctx,
      PR: [],
      CL: [],
      PT: [],
      TX,
      ash,
      S,
      SC: scale,
      rotation,
      now,
      w2s,
      rnd,
      W,
      H,
    });
    renderGuidance({
      ctx,
      state,
      P,
      W,
      H,
      SC: scale,
      rotation,
      w2s,
      target: questTargetWorld(),
      mouse,
      isTouch,
      Z,
      recoil,
    });

    cam.x = saveCam.x;
    cam.y = saveCam.y;
  };
}
