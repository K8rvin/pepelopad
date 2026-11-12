import { clamp, dist, d2 } from "../core/math.js";

export function renderGuidance({
  ctx,
  state,
  P,
  W,
  H,
  SC,
  w2s,
  target,
  mouse,
  isTouch,
  Z,
  recoil,
}) {
  if (state !== "play") return;

  if (target) {
    const s = w2s(target.x, target.y);
    if (s.x < 40 || s.x > W - 40 || s.y < 40 || s.y > H - 40) {
      const angle = Math.atan2(target.y - P.y, target.x - P.x);
      const ex = clamp(W / 2 + Math.cos(angle) * (W / 2 - 60), 50, W - 50);
      const ey = clamp(H / 2 + Math.sin(angle) * (H / 2 - 70), 60, H - 90);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.fillStyle = target.siege ? "#e04338" : "#ffb23e";
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = target.siege ? "#e04338" : "#ffb23e";
      ctx.fillText(
        Math.round(dist(P.x, P.y, target.x, target.y) / 16) + "м",
        ex - 14,
        ey + 24,
      );
    }
  }

  if (!isTouch && !P.inCar) {
    const gap = 7 + recoil;
    const mx = mouse.x;
    const my = mouse.y;
    let hot = false;
    for (const zombie of Z) {
      const s = w2s(zombie.x, zombie.y);
      if (d2(mx, my, s.x, s.y - 14) < (zombie.r * SC + 8) ** 2) {
        hot = true;
        break;
      }
    }
    ctx.strokeStyle = hot ? "#e04338" : "#a6e83c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - gap - 6, my);
    ctx.lineTo(mx - gap, my);
    ctx.moveTo(mx + gap, my);
    ctx.lineTo(mx + gap + 6, my);
    ctx.moveTo(mx, my - gap - 6);
    ctx.lineTo(mx, my - gap);
    ctx.moveTo(mx, my + gap);
    ctx.lineTo(mx, my + gap + 6);
    ctx.stroke();
    ctx.fillStyle = hot ? "#e04338" : "#a6e83c";
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }
}
