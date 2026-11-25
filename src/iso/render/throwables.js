import { w2s } from "../core/geo.js";
import { WEAPONS } from "../data/weapons.js";
import { ZTYPES } from "../data/zombies.js";
import { throwTarget } from "../systems/combat.js";

function flame(ctx, x, y, size, phase) {
  const sway = Math.sin(phase) * size * 0.18;
  ctx.fillStyle = "#e66b2e";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.45, y);
  ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.65, x + sway, y - size);
  ctx.quadraticCurveTo(x + size * 0.55, y - size * 0.45, x + size * 0.45, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffc45c";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.2, y);
  ctx.quadraticCurveTo(x, y - size * 0.55, x + sway * 0.5, y - size * 0.65);
  ctx.quadraticCurveTo(x + size * 0.25, y - size * 0.2, x + size * 0.2, y);
  ctx.closePath();
  ctx.fill();
}

export function drawThrowable(ctx, p, toX, toY, zoom) {
  const point = w2s(p.x, p.y, p.h);
  const x = toX(point.x),
    y = toY(point.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.t * 12);
  ctx.fillStyle = "#1a1712";
  ctx.fillRect(-3 * zoom, -6 * zoom, 6 * zoom, 12 * zoom);
  ctx.fillStyle = "#657553";
  ctx.fillRect(-2 * zoom, -4 * zoom, 4 * zoom, 9 * zoom);
  ctx.fillStyle = "#9a7638";
  ctx.fillRect(-2 * zoom, 1 * zoom, 4 * zoom, 4 * zoom);
  ctx.fillStyle = "#a8b8c6";
  ctx.fillRect(1 * zoom, -9 * zoom, 5 * zoom, 2 * zoom);
  flame(ctx, 6 * zoom, -7 * zoom, 7 * zoom, p.t * 19);
  ctx.restore();
  return 5;
}

export function drawFirePatch(ctx, fire, toX, toY, zoom, now) {
  const point = w2s(fire.x, fire.y);
  const x = toX(point.x),
    y = toY(point.y);
  const fade = Math.min(1, (fire.duration - fire.t) / 0.8);
  ctx.globalAlpha = 0.32 * fade;
  ctx.fillStyle = "#6d3826";
  ctx.beginPath();
  ctx.ellipse(x, y, fire.radius * 32 * zoom, fire.radius * 16 * zoom, 0, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.9 * fade;
  for (let i = 0; i < 11; i++) {
    const angle = fire.seed + i * 2.399;
    const radius = fire.radius * (0.15 + ((i * 37) % 10) * 0.065);
    const fp = w2s(
      fire.x + Math.cos(angle) * radius,
      fire.y + Math.sin(angle) * radius,
    );
    const size = (13 + (i % 4) * 4) * zoom;
    flame(
      ctx,
      toX(fp.x),
      toY(fp.y),
      size * (0.85 + 0.15 * Math.sin(now * 13 + i)),
      now * 11 + i * 1.7,
    );
  }
  ctx.globalAlpha = 1;
  return 23;
}

export function drawBurningActor(ctx, actor, toX, toY, zoom, now) {
  const point = w2s(actor.x, actor.y);
  const scale = actor.type ? ZTYPES[actor.type || "walker"].scale : 1;
  const x = toX(point.x),
    y = toY(point.y);
  ctx.globalAlpha = Math.min(1, actor.burnT * 2) * 0.85;
  for (let i = 0; i < 3; i++)
    flame(
      ctx,
      x + (i - 1) * 9 * zoom * scale,
      y - (18 + i * 13) * zoom * scale,
      (15 - i * 2) * zoom * scale,
      now * 12 + i * 2.1,
    );
  ctx.globalAlpha = 1;
  return 6;
}

export function drawThrowAim(ctx, player, aim, toX, toY, zoom) {
  const target = throwTarget(player, aim);
  const point = w2s(target.x, target.y);
  const x = toX(point.x),
    y = toY(point.y);
  const clamped =
    target.distance < Math.hypot(aim.x - player.x, aim.y - player.y);
  ctx.strokeStyle = clamped ? "rgba(255,178,62,0.9)" : "rgba(255,196,92,0.65)";
  ctx.lineWidth = 1.5 * zoom;
  ctx.setLineDash([5 * zoom, 4 * zoom]);
  ctx.beginPath();
  ctx.ellipse(
    x,
    y,
    WEAPONS.molotov.radius * 32 * zoom,
    WEAPONS.molotov.radius * 16 * zoom,
    0,
    0,
    7,
  );
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(230,107,46,0.12)";
  ctx.fill();
  return 2;
}
