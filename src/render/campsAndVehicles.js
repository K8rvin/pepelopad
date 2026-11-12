import { dist, ri } from "../core/math.js";

export function renderCampsAndVehicles({
  ctx,
  CAMPS,
  CARS,
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
}) {
  const entities = [];

  for (const camp of CAMPS.values()) {
    if (dist(camp.x, camp.y, cam.x, cam.y) > W / SC) continue;
    for (let i = 0; i < 4 + Math.min(camp.level - 1, 3); i++) {
      const angle = (i / (4 + Math.min(camp.level - 1, 3))) * Math.PI * 2;
      const s = w2s(
        camp.x + Math.cos(angle) * 50,
        camp.y + Math.sin(angle) * 50,
      );
      ctx.drawImage(S.tent, s.x - 24, s.y - 24, 48, 48);
    }
    for (let i = 0; i < camp.proj.wall * 4; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const s = w2s(
        camp.x + Math.cos(angle) * 88,
        camp.y + Math.sin(angle) * 88,
      );
      ctx.drawImage(S.fence, s.x - 16, s.y - 16, 32, 32);
    }
    for (let i = 0; i < camp.proj.garden; i++) {
      const s = w2s(camp.x - 70 + i * 24, camp.y + 70);
      ctx.drawImage(S.cont_garden, s.x - 16, s.y - 16, 32, 32);
    }
    for (let i = 0; i < camp.proj.clinic; i++) {
      const s = w2s(camp.x + 70, camp.y + 60 - i * 24);
      ctx.drawImage(S.medstation, s.x - 16, s.y - 16, 32, 32);
    }
    const fire = w2s(camp.x, camp.y);
    ctx.drawImage(
      S.fire[Math.floor(now * 6) % 2],
      fire.x - 24,
      fire.y - 24,
      48,
      48,
    );
    if (camp.proj.tower) {
      const tower = w2s(camp.x + 60, camp.y - 60);
      ctx.drawImage(S.watchtower, tower.x - 24, tower.y - 24, 48, 48);
    }
  }

  for (const car of CARS.values()) {
    if (dist(car.x, car.y, cam.x, cam.y) > W / SC + 120) continue;
    entities.push({
      y: car.y + 10,
      f: () => {
        const s = w2s(car.x, car.y);
        const image = S[carSpriteKey(car)];
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(car.angle);
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
    if (dist(npc.x, npc.y, cam.x, cam.y) > W / SC) continue;
    entities.push({
      y: npc.y + 6,
      f: () => {
        const s = w2s(npc.x, npc.y);
        ctx.drawImage(
          npc.leader ? S.leader : S.survivor,
          s.x - 18,
          s.y - 32,
          36,
          42,
        );
        if (npc.leader) {
          ctx.fillStyle = "#7fb8d8";
          ctx.font = '8px "Press Start 2P"';
          ctx.fillText("лидер", s.x - 18, s.y - 38);
        }
      },
    });
  }

  return entities;
}
