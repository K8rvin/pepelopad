import { renderActors } from "./actors.js";
import { renderParticles } from "./particles.js";
import { floorTileAt } from "../world/floorScene.js";

export function renderFloor({
  ctx,
  scene,
  containers,
  TI,
  S,
  SC,
  W,
  H,
  P,
  Z,
  now,
  w2s,
  drawWeaponOverlay,
  PR,
  PT,
  TX,
  rnd,
}) {
  ctx.fillStyle = "#080a07";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < scene.h; y++)
    for (let x = 0; x < scene.w; x++) {
      const s = w2s(x * 16, y * 16);
      ctx.drawImage(TI[floorTileAt(scene, x, y)], s.x, s.y, 16 * SC, 16 * SC);
    }
  for (const item of scene.furn) {
    const s = w2s(item.x * 16, item.y * 16);
    ctx.drawImage(S[item.spr], s.x, s.y, item.w * 16 * SC, item.h * 16 * SC);
  }
  for (const container of containers.values()) {
    const s = w2s(container.x * 16, container.y * 16),
      image = S[`cont_${container.type}${container.looted ? "_open" : ""}`];
    ctx.drawImage(image, s.x, s.y, 16 * SC, 16 * SC);
  }
  for (const stair of scene.stairs) {
    const s = w2s(stair.x, stair.y);
    ctx.strokeStyle = "#ffb23e";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 18, s.y - 18, 36, 36);
  }
  for (const entity of renderActors({
    ctx,
    Z,
    P,
    state: "floor",
    S,
    SC,
    now,
    w2s,
    drawWeaponOverlay,
  }))
    entity.f();
  renderParticles({
    ctx,
    PR,
    CL: [],
    PT,
    TX,
    ash: [],
    S,
    SC,
    now,
    w2s,
    rnd,
    W,
    H,
  });
}
