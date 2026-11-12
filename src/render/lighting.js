import { clamp } from "../core/math.js";

export function renderLighting({
  ctx,
  lx,
  LC,
  W,
  H,
  SC,
  dark,
  state,
  P,
  CARS,
  SMAP,
  CAMPS,
  visChunks,
  LG,
  now,
  w2s,
}) {
  if (dark > 0.02) {
    lx.globalCompositeOperation = "source-over";
    lx.clearRect(0, 0, W, H);
    lx.fillStyle = "rgba(7,9,20," + dark + ")";
    lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = "destination-out";

    const punch = (x, y, radius, alpha) => {
      const s = w2s(x, y);
      const gradient = lx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
      gradient.addColorStop(0, "rgba(255,255,255," + alpha + ")");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      lx.fillStyle = gradient;
      lx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
    };

    if (state !== "menu" && P) {
      if (P.inCar) {
        const car = CARS.get(P.inCar);
        punch(
          car.x + Math.cos(car.angle) * 70,
          car.y + Math.sin(car.angle) * 70,
          120,
          0.9,
        );
        punch(car.x, car.y, 60, 0.8);
      } else {
        punch(P.x, P.y, P.flash ? 80 : 52, 0.95);
        if (P.flash)
          punch(
            P.x + Math.cos(P.aim) * 72,
            P.y + Math.sin(P.aim) * 72,
            80,
            0.85,
          );
      }
    }
    for (const structure of SMAP.values()) {
      if (structure.t === "fire")
        punch(
          structure.x * 16 + 8,
          structure.y * 16 + 8,
          80 + Math.sin(now * 7) * 6,
          0.95,
        );
      if (structure.t === "generator")
        punch(structure.x * 16 + 8, structure.y * 16 + 8, 80, 0.8);
      if (structure.t === "radioTower")
        punch(structure.x * 16 + 8, structure.y * 16 + 8, 70, 0.6);
    }
    for (const camp of CAMPS.values()) punch(camp.x, camp.y, 110, 0.8);
    for (const chunk of visChunks) {
      if (chunk.nest?.alive)
        punch(chunk.nest.x, chunk.nest.y, 70 + Math.sin(now * 2.4) * 8, 0.85);
    }
    for (const light of LG)
      punch(
        light.x,
        light.y,
        light.r * SC,
        clamp(light.life / light.max, 0, 1),
      );
    ctx.drawImage(LC, 0, 0, W, H);
  }

  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, radius, color, alpha) => {
    const s = w2s(x, y);
    const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
    gradient.addColorStop(0, "rgba(" + color + "," + alpha + ")");
    gradient.addColorStop(1, "rgba(" + color + ",0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
  };
  for (const structure of SMAP.values()) {
    if (structure.t === "fire")
      glow(structure.x * 16 + 8, structure.y * 16 + 4, 70, "255,150,60", 0.14);
  }
  for (const camp of CAMPS.values())
    glow(camp.x, camp.y, 100, "127,184,216", 0.1);
  for (const chunk of visChunks) {
    if (chunk.nest?.alive)
      glow(chunk.nest.x, chunk.nest.y, 80, "166,232,60", 0.12);
  }
  for (const light of LG)
    glow(
      light.x,
      light.y,
      light.r * SC,
      light.col,
      0.25 * clamp(light.life / light.max, 0, 1),
    );
  ctx.globalCompositeOperation = "source-over";
}
