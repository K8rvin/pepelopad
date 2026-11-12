import { clamp } from "../core/math.js";
import { ZT } from "../data/enemies.js";
import { WEAPONS } from "../data/weapons.js";

export function renderActors({
  ctx,
  Z,
  P,
  state,
  S,
  SC,
  now,
  w2s,
  drawWeaponOverlay,
}) {
  const entities = [];

  for (const zombie of Z) {
    entities.push({
      y: zombie.y + zombie.r,
      f: () => {
        const type = ZT[zombie.type];
        const image = S[type.spr + (zombie.elite ? "_e" : "")] || S.walker;
        const s = w2s(zombie.x, zombie.y + Math.sin(now * 8 + zombie.bob));
        const width = image.width * SC * (zombie.elite ? 1.1 : 1);
        const height = image.height * SC * (zombie.elite ? 1.1 : 1);
        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, zombie.r * SC, zombie.r * SC * 0.5, 0, 0, 7);
        ctx.fill();
        ctx.save();
        ctx.translate(Math.round(s.x), Math.round(s.y));
        if (zombie.vx < -2 || (zombie.st === "chase" && zombie.tx < zombie.x))
          ctx.scale(-1, 1);
        ctx.drawImage(image, -width / 2, -height + 5 * SC, width, height);
        ctx.restore();
        if (zombie.flash > 0) {
          ctx.fillStyle = "rgba(255,255,255," + zombie.flash * 4 + ")";
          ctx.fillRect(s.x - width / 2, s.y - height + 5 * SC, width, height);
        }
        if (zombie.hp < zombie.max) {
          ctx.fillStyle = "#12150d";
          ctx.fillRect(s.x - 12, s.y - height + 2, 24, 4);
          ctx.fillStyle = "#e04338";
          ctx.fillRect(
            s.x - 11,
            s.y - height + 3,
            22 * clamp(zombie.hp / zombie.max, 0, 1),
            2,
          );
        }
      },
    });
  }

  if (state !== "menu" && P && !P.inCar) {
    entities.push({
      y: P.y + P.r,
      f: () => {
        const s = w2s(P.x, P.y + (P.moving ? Math.sin(now * 10) : 0));
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, 5 * SC, 3 * SC, 0, 0, 7);
        ctx.fill();
        ctx.save();
        ctx.translate(Math.round(s.x), Math.round(s.y));
        if (P.iframe > 0 && Math.floor(now * 20) % 2) ctx.globalAlpha = 0.45;
        ctx.save();
        if (Math.cos(P.aim) < 0) ctx.scale(-1, 1);
        ctx.drawImage(S.player, -6 * SC, -9 * SC, 12 * SC, 14 * SC);
        ctx.restore();
        if (P.owned[P.weapon]) drawWeaponOverlay();
        ctx.restore();
        if (P.rl > 0 && WEAPONS[P.weapon].auto) {
          const progress = 1 - P.rl / (P.rlMax || 1);
          ctx.strokeStyle = "rgba(255,178,62,.22)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(s.x, s.y - 4, 18, -Math.PI / 2, Math.PI * 1.5);
          ctx.stroke();
          ctx.strokeStyle = "#ffb23e";
          ctx.beginPath();
          ctx.arc(
            s.x,
            s.y - 4,
            18,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * progress,
          );
          ctx.stroke();
          ctx.fillStyle = "#ffb23e";
          ctx.font = '7px "Press Start 2P"';
          ctx.textAlign = "center";
          ctx.fillText(Math.round(progress * 100) + "%", s.x, s.y - 26);
          ctx.textAlign = "left";
        }
      },
    });
  }

  return entities;
}
