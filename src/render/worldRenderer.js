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
    const x0 = Math.floor((cam.x - W / 2 / SC) / 256) - 1;
    const x1 = Math.floor((cam.x + W / 2 / SC) / 256) + 1;
    const y0 = Math.floor((cam.y - H / 2 / SC) / 256) - 1;
    const y1 = Math.floor((cam.y + H / 2 / SC) / 256) + 1;

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const chunk = getChunk(gx, gy);
        visChunks.push(chunk);
        const s = w2s(gx * 256, gy * 256);
        ctx.drawImage(
          chunk.canvas,
          Math.round(s.x),
          Math.round(s.y),
          256 * SC,
          256 * SC,
        );
      }
    }

    renderBuildingInterior({
      ctx,
      building: getActiveBuilding(),
      floorId: getFloorId(),
      stairs: getStairs(),
      SC,
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
          s.x - 5 * SC * pulse,
          s.y - 5 * SC * pulse,
          10 * SC * pulse,
          10 * SC * pulse,
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
        s.x - 6 * SC,
        s.y - 6 * SC,
        12 * SC,
        12 * SC,
      );
    }

    const entities = [
      ...renderWorldObjects({
        ctx,
        visChunks,
        SMAP,
        S,
        SC,
        now,
        w2s,
        mainQuest,
        searching,
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
        SC,
        w2s,
        S,
        now,
        carSpriteKey,
        PT,
        rnd,
      }),
      ...renderActors({ ctx, Z, P, state, S, SC, now, w2s, drawWeaponOverlay }),
    ];
    entities.sort((a, b) => a.y - b.y);
    for (const entity of entities) entity.f();
    renderRailVehicles({
      ctx,
      vehicles: RAIL_VEHICLES,
      S,
      SC,
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
      SC,
      now,
      w2s,
      rnd,
      W,
      H,
    });
    renderVfx({ ctx, effects: VFX, assets: VFX_ASSETS, now, w2s, SC });

    if (buildSel && state === "play") {
      const w = screenToWorld(mouse.x, mouse.y);
      const tx = Math.floor(w.x / 16);
      const ty = Math.floor(w.y / 16);
      const ok =
        !solidAt(tx, ty) && tileAt(tx, ty) !== 10 && !buildLocked(buildSel);
      const s = w2s(tx * 16, ty * 16);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(S[buildSel], s.x, s.y, 16 * SC, 16 * SC);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? "rgba(166,232,60,.9)" : "rgba(224,67,56,.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x, s.y, 16 * SC, 16 * SC);
    }

    renderLighting({
      ctx,
      lx,
      LC,
      W,
      H,
      SC,
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
      SC,
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
      SC,
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
