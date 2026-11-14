import { describe, expect, it, vi } from "vitest";
import { worldToScreen } from "../src/render/camera.js";
import { createWorldRenderer } from "../src/render/worldRenderer.js";
import { renderCampsAndVehicles } from "../src/render/campsAndVehicles.js";
import { renderBuildingInterior } from "../src/render/buildingInterior.js";
import { renderRailVehicles } from "../src/render/railVehicles.js";
import { renderWorldObjects } from "../src/render/worldObjects.js";
import { renderParticles } from "../src/render/particles.js";
import { drawWeaponOverlay } from "../src/render/weaponRenderer.js";
import { renderActors } from "../src/render/actors.js";
import { renderGuidance } from "../src/render/guidance.js";

function context() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
  };
}

function worldRendererHarness(cam, scale = 3) {
  const ctx = context();
  const canvas = { id: "chunk" };
  const getChunk = vi.fn(() => ({ canvas, containers: [], nest: null }));
  const render = createWorldRenderer({
    ctx,
    lx: {},
    LC: {},
    SC: 99,
    getSC: () => scale,
    cam,
    getW: () => 100,
    getH: () => 100,
    getShake: () => 0,
    rnd: () => 0.5,
    getChunk,
    setVisChunks: vi.fn(),
    S: {},
    ICONS: {},
    ITEMS: {},
    DR: [],
    PR: [],
    CL: [],
    PT: [],
    TX: [],
    ash: [],
    SMAP: new Map(),
    CAMPS: new Map(),
    CARS: new Map(),
    NPCS: [],
    Z: [],
    VFX: [],
    VFX_ASSETS: {},
    RAIL_VEHICLES: [],
    getState: () => "menu",
    getP: () => null,
    getActiveBuilding: () => null,
    getFloorId: () => "outdoor",
    getStairs: () => [],
    getInteriorLayout: () => null,
    isContainerActive: () => true,
    getBuildSel: () => null,
    mouse: { x: 0, y: 0 },
    screenToWorld: () => ({ x: 0, y: 0 }),
    solidAt: () => false,
    tileAt: () => 0,
    buildLocked: () => false,
    mainQuest: () => null,
    getSearching: () => null,
    getBench: () => 0,
    carSpriteKey: () => "car",
    drawWeaponOverlay: vi.fn(),
    darkness: () => 0,
    questTargetWorld: () => null,
    isTouch: false,
    getRecoil: () => 0,
    w2s: (x, y) => worldToScreen(x, y, cam, 100, 100, scale),
    LG: [],
  });
  return { ctx, canvas, getChunk, render };
}

describe("world camera rendering", () => {
  it("keeps the original chunk draw path at rotation zero and zoom one", () => {
    const cam = { x: 0, y: 0 };
    const { ctx, canvas, render } = worldRendererHarness(cam);
    render();
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledWith(canvas, 50, 50, 768, 768);
  });

  it("rotates and zooms chunks and culls them radially", () => {
    const cam = { x: 0, y: 0, rotation: Math.PI / 2, zoom: 0.5 };
    const { ctx, canvas, getChunk, render } = worldRendererHarness(cam, 2);
    render();
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalledWith(canvas, 0, 0, 256, 256);
    expect(getChunk).toHaveBeenCalledWith(0, 0);
    expect(getChunk).not.toHaveBeenCalledWith(1, 1);
  });
});

describe("world orientation", () => {
  it("adds camera rotation to weapons", () => {
    const ctx = context();
    const P = {
      weapon: "bow",
      aim: 0.2,
      rl: 0,
      rlMax: 1,
      mags: { bow: 1 },
    };
    drawWeaponOverlay({ ctx, P, S: {}, SC: 3, rotation: 0.5 });
    expect(ctx.rotate).toHaveBeenCalledWith(0.7);
  });

  it("adds camera rotation to cars", () => {
    const ctx = context();
    const car = { x: 0, y: 0, angle: 0.2, flash: 0, broken: false };
    const entities = renderCampsAndVehicles({
      ctx,
      CAMPS: new Map(),
      CARS: new Map([["car", car]]),
      NPCS: [],
      cam: { x: 0, y: 0 },
      W: 100,
      H: 100,
      SC: 3,
      rotation: 0.5,
      w2s: (x, y) => ({ x, y }),
      S: { car: { width: 10, height: 5 } },
      now: 0,
      carSpriteKey: () => "car",
      PT: [],
      rnd: () => 1,
    });
    entities[0].f();
    expect(ctx.rotate).toHaveBeenCalledWith(0.7);
  });

  it("adds camera rotation to interior fixtures", () => {
    const ctx = context();
    renderBuildingInterior({
      ctx,
      building: {
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ],
        openings: [],
      },
      floorId: "ground",
      stairs: [],
      layout: {
        fixtures: [{ type: "table", x: 50, y: 50, w: 20, h: 10, angle: 0.2 }],
        internalWalls: [],
      },
      S: { h_table: {} },
      SC: 3,
      rotation: 0.5,
      w2s: (x, y) => ({ x, y }),
    });
    expect(ctx.rotate).toHaveBeenCalledWith(0.7);
  });

  it("adds camera rotation to rail vehicles", () => {
    const ctx = context();
    renderRailVehicles({
      ctx,
      vehicles: [
        {
          id: "train",
          kind: "train",
          route: {
            points: [
              [0, 0],
              [100, 0],
            ],
            length: 100,
          },
          distance: 10,
          direction: 1,
          carriages: 0,
        },
      ],
      S: { train: {} },
      SC: 3,
      rotation: 0.5,
      cam: { x: 0, y: 0 },
      W: 100,
      H: 100,
      w2s: (x, y) => ({ x, y }),
    });
    expect(ctx.rotate).toHaveBeenCalledWith(0.5);
  });

  it("rotates structures and turret vectors", () => {
    const ctx = context();
    const entities = renderWorldObjects({
      ctx,
      visChunks: [],
      SMAP: new Map([
        ["turret", { x: 0, y: 0, t: "turret", ang: 0.2, hp: 1, max: 1 }],
      ]),
      S: { turret: {} },
      SC: 3,
      rotation: 0.5,
      now: 0,
      w2s: (x, y) => ({ x, y }),
      mainQuest: () => null,
      searching: null,
      isContainerActive: () => true,
      bench: 0,
      cam: { x: 0, y: 0 },
      W: 100,
      H: 100,
    });
    entities[0].f();
    expect(ctx.rotate.mock.calls.map(([angle]) => angle)).toEqual([0.5, 0.7]);
  });

  it("adds camera rotation to projectile and slash vectors", () => {
    const ctx = context();
    renderParticles({
      ctx,
      PR: [{ type: "arrow", x: 0, y: 0, vx: 1, vy: 0 }],
      CL: [],
      PT: [{ type: "slash", x: 0, y: 0, a: 0.2, life: 1, max: 1 }],
      TX: [],
      ash: [],
      S: { arrowP: {} },
      SC: 3,
      rotation: 0.5,
      now: 0,
      w2s: (x, y) => ({ x, y }),
      rnd: () => 0.5,
      W: 100,
      H: 100,
    });
    expect(ctx.rotate).toHaveBeenCalledWith(0.5);
    const slash = ctx.arc.mock.calls[0];
    expect(slash.slice(0, 2)).toEqual([0, 0]);
    expect(slash[2]).toBeCloseTo(62.4);
    expect(slash[3]).toBeCloseTo(-0.3);
    expect(slash[4]).toBeCloseTo(1.7);
  });

  it("keeps the player billboard aligned with the rotated aim", () => {
    const ctx = context();
    const drawWeapon = vi.fn();
    const P = {
      x: 0,
      y: 0,
      r: 5,
      aim: 0,
      inCar: null,
      moving: false,
      iframe: 0,
      owned: { bow: true },
      weapon: "bow",
      rl: 0,
    };
    const entities = renderActors({
      ctx,
      Z: [],
      P,
      state: "play",
      S: { player: {} },
      SC: 3,
      rotation: Math.PI,
      now: 0,
      w2s: (x, y) => ({ x, y }),
      drawWeaponOverlay: drawWeapon,
    });
    entities[0].f();
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(drawWeapon).toHaveBeenCalledWith({ rotation: Math.PI, SC: 3 });
  });

  it("rotates offscreen guidance with the camera", () => {
    const ctx = context();
    renderGuidance({
      ctx,
      state: "play",
      P: { x: 0, y: 0, inCar: null },
      W: 100,
      H: 100,
      SC: 3,
      rotation: Math.PI / 2,
      w2s: (x, y) => ({ x, y }),
      target: { x: 1000, y: 0 },
      mouse: { x: 50, y: 50 },
      isTouch: true,
      Z: [],
      recoil: 0,
    });
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  });
});
