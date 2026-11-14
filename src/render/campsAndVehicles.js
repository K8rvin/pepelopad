import { dist, ri } from "../core/math.js";
import { drawOrientedImage } from "./orientation.js";

export function renderCampsAndVehicles({
  ctx,
  CAMPS,
  CARS,
  carsNear,
  NPCS,
  cam,
  W,
  H = W,
  SC,
  rotation = 0,
  w2s,
  S,
  now,
  carSpriteKey,
  PT,
  rnd,
}) {
  const entities = [];
  const visibleRadius = Math.hypot(W, H) / (2 * SC);

  for (const camp of CAMPS.values()) {
    if (dist(camp.x, camp.y, cam.x, cam.y) > visibleRadius + 120) continue;
    for (let i = 0; i < 4 + Math.min(camp.level - 1, 3); i++) {
      const angle = (i / (4 + Math.min(camp.level - 1, 3))) * Math.PI * 2;
      const s = w2s(
        camp.x + Math.cos(angle) * 50,
        camp.y + Math.sin(angle) * 50,
      );
      const size = 16 * SC;
      drawOrientedImage(
        ctx,
        S.tent,
        s.x - size / 2,
        s.y - size / 2,
        size,
        size,
        rotation,
      );
    }
    for (let i = 0; i < camp.proj.wall * 4; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const s = w2s(
        camp.x + Math.cos(angle) * 88,
        camp.y + Math.sin(angle) * 88,
      );
      const size = (32 / 3) * SC;
      drawOrientedImage(
        ctx,
        S.fence,
        s.x - size / 2,
        s.y - size / 2,
        size,
        size,
        rotation,
      );
    }
    for (let i = 0; i < camp.proj.garden; i++) {
      const s = w2s(camp.x - 70 + i * 24, camp.y + 70);
      const size = (32 / 3) * SC;
      drawOrientedImage(
        ctx,
        S.cont_garden,
        s.x - size / 2,
        s.y - size / 2,
        size,
        size,
        rotation,
      );
    }
    for (let i = 0; i < camp.proj.clinic; i++) {
      const s = w2s(camp.x + 70, camp.y + 60 - i * 24);
      const size = (32 / 3) * SC;
      drawOrientedImage(
        ctx,
        S.medstation,
        s.x - size / 2,
        s.y - size / 2,
        size,
        size,
        rotation,
      );
    }
    const fire = w2s(camp.x, camp.y);
    const fireSize = 16 * SC;
    drawOrientedImage(
      ctx,
      S.fire[Math.floor(now * 6) % 2],
      fire.x - fireSize / 2,
      fire.y - fireSize / 2,
      fireSize,
      fireSize,
      rotation,
    );
    if (camp.proj.tower) {
      const tower = w2s(camp.x + 60, camp.y - 60);
      const size = 16 * SC;
      drawOrientedImage(
        ctx,
        S.watchtower,
        tower.x - size / 2,
        tower.y - size / 2,
        size,
        size,
        rotation,
      );
    }
  }

  const visibleCars = carsNear
    ? carsNear(cam.x, cam.y, visibleRadius + 120)
    : CARS.values();
  for (const car of visibleCars) {
    if (dist(car.x, car.y, cam.x, cam.y) > visibleRadius + 120) continue;
    entities.push({
      y: car.y + 10,
      f: () => {
        const s = w2s(car.x, car.y);
        const image = S[carSpriteKey(car)];
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(car.angle + rotation);
        ctx.drawImage(
          image,
          (-image.width * SC) / 2,
          (-image.height * SC) / 2,
          image.width * SC,
          image.height * SC,
        );
        if (car.flash > 0) {
          ctx.fillStyle = "rgba(255,255,255," + car.flash * 3 + ")";
          ctx.fillRect(
            (-image.width * SC) / 2,
            (-image.height * SC) / 2,
            image.width * SC,
            image.height * SC,
          );
        }
        ctx.restore();
        if (car.broken && !car.dead && rnd() < 0.05) {
          PT.push({
            type: "px",
            x: car.x,
            y: car.y - 8,
            vx: ri(-5, 5),
            vy: -20,
            life: 0.8,
            max: 0.8,
            col: "#555",
            size: 2,
            grav: 0,
          });
        }
      },
    });
  }

  for (const npc of NPCS) {
    if (dist(npc.x, npc.y, cam.x, cam.y) > visibleRadius + 60) continue;
    entities.push({
      y: npc.y + 6,
      f: () => {
        const s = w2s(npc.x, npc.y);
        ctx.drawImage(
          npc.leader ? S.leader : S.survivor,
          s.x - 6 * SC,
          s.y - (32 / 3) * SC,
          12 * SC,
          14 * SC,
        );
        if (npc.leader) {
          ctx.fillStyle = "#7fb8d8";
          ctx.font = '8px "Press Start 2P"';
          ctx.fillText("лидер", s.x - 6 * SC, s.y - (38 / 3) * SC);
        }
      },
    });
  }

  return entities;
}
