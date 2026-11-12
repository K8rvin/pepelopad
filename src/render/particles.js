import { clamp, lerp } from "../core/math.js";

export function renderParticles({
  ctx,
  PR,
  CL,
  PT,
  TX,
  ash,
  S,
  SC,
  now,
  w2s,
  rnd,
  W,
  H,
}) {
  for (const projectile of PR) {
    const s = w2s(projectile.x, projectile.y);
    const angle = Math.atan2(projectile.vy, projectile.vx);
    if (projectile.type === "arrow" || projectile.type === "crossbow") {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      const image = projectile.type === "arrow" ? S.arrowP : S.boltP;
      const width = projectile.type === "arrow" ? 24 : image.width * SC;
      const height = projectile.type === "arrow" ? 7 : image.height * SC;
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else if (projectile.type === "molotov") {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      ctx.drawImage(S.molotovP, -9, -12, 18, 24);
      ctx.restore();
    } else if (projectile.type === "spit") {
      ctx.fillStyle = "#a6e83c";
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    } else {
      ctx.strokeStyle = projectile.type === "rifle" ? "#ffe8c8" : "#ffb23e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(angle) * 14, s.y - Math.sin(angle) * 14);
      ctx.stroke();
    }
  }

  for (const cloud of CL) {
    const s = w2s(cloud.x, cloud.y);
    const alpha =
      clamp(cloud.life / cloud.max, 0, 1) * (cloud.fire ? 0.3 : 0.25);
    ctx.fillStyle = cloud.fire
      ? "rgba(255,120,40," + alpha + ")"
      : "rgba(140,210,60," + alpha + ")";
    ctx.beginPath();
    ctx.arc(s.x, s.y, cloud.r * SC * (1 + Math.sin(now * 2) * 0.06), 0, 7);
    ctx.fill();
  }

  for (const particle of PT) {
    const s = w2s(particle.x, particle.y);
    const alpha = clamp(particle.life / particle.max, 0, 1);
    if (particle.type === "px" || particle.type === "ember") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.col;
      ctx.fillRect(
        s.x,
        s.y,
        particle.size * SC * 0.7,
        particle.size * SC * 0.7,
      );
      ctx.globalAlpha = 1;
    } else if (particle.type === "ring") {
      const radius = lerp(particle.r1, particle.r0, alpha) * SC;
      ctx.strokeStyle = particle.col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, 7);
      ctx.stroke();
    } else if (particle.type === "slash") {
      ctx.strokeStyle = "rgba(236,229,208," + alpha + ")";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.3 * 16 * SC, particle.a - 1, particle.a + 1);
      ctx.stroke();
    }
  }

  const wind = Math.sin(now * 0.3) * 10;
  for (const particle of ash) {
    particle.y += particle.v / 60;
    particle.x +=
      (wind - particle.v * 0.4) / 60 + Math.sin(now + particle.ph) * 0.2;
    if (particle.y > H) {
      particle.y = -4;
      particle.x = rnd() * W;
    }
    if (particle.x < 0) particle.x = W;
    if (particle.x > W) particle.x = 0;
    ctx.fillStyle = "rgba(200,200,190," + particle.a + ")";
    ctx.fillRect(particle.x, particle.y, particle.s, particle.s);
  }

  for (const text of TX) {
    const s = w2s(text.x, text.y);
    ctx.globalAlpha = clamp(text.life / 0.4, 0, 1);
    ctx.font = text.size + 'px "Press Start 2P"';
    ctx.fillStyle = "#000";
    ctx.fillText(text.txt, s.x + 1, s.y + 1);
    ctx.fillStyle = text.col;
    ctx.fillText(text.txt, s.x, s.y);
    ctx.globalAlpha = 1;
  }
}
