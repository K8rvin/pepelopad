import { w2s } from "../core/geo.js";

export function drawMeleeSwing(
  ctx,
  actor,
  swing,
  toX,
  toY,
  zoom,
  style = "weapon",
) {
  const pp = w2s(actor.x, actor.y);
  const t = 1 - swing.swingT / 0.22;
  const amt = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.3;
  const ox = Math.cos(swing.swingAng) * amt,
    oy = Math.sin(swing.swingAng) * amt;
  const px = toX(pp.x) + (ox - oy) * 32 * zoom,
    py = toY(pp.y) - 40 * zoom + (ox + oy) * 16 * zoom;
  const ca = Math.cos(swing.swingAng),
    sa = Math.sin(swing.swingAng);
  const sang = Math.atan2((ca + sa) * 16, (ca - sa) * 32);
  if (style === "arc") {
    const k = swing.swingT / 0.22;
    ctx.strokeStyle = `rgba(236,229,208,${0.75 * k})`;
    ctx.lineWidth = 3 * zoom;
    ctx.beginPath();
    ctx.arc(px, py, 26 * zoom, sang - 0.9, sang + 0.9);
    ctx.stroke();
    return 1;
  }
  const kind = swing.swingWeapon || "knife";
  const lengths = {
    bat: 30,
    baton: 28,
    axe: 27,
    crowbar: 28,
    hammer: 22,
    knife: 18,
  };
  const len = (lengths[kind] || lengths.knife) * zoom;
  const sweep = -1.2 + 2.0 * t * t;
  for (const [back, alpha] of [
    [0.12, 0.16],
    [0.06, 0.28],
  ]) {
    const s2 = -1.2 + 2.0 * Math.max(0, t - back) ** 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(sang + s2);
    ctx.strokeStyle = `rgba(236,229,208,${alpha})`;
    ctx.lineWidth = (["bat", "baton", "axe"].includes(kind) ? 5 : 3) * zoom;
    ctx.beginPath();
    ctx.moveTo(6 * zoom, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(sang + sweep);
  if (kind === "bat" || kind === "baton") {
    ctx.fillStyle = kind === "bat" ? "#8a6a42" : "#41474b";
    ctx.beginPath();
    ctx.moveTo(4 * zoom, -2 * zoom);
    ctx.lineTo(len, -4 * zoom);
    ctx.lineTo(len, 4 * zoom);
    ctx.lineTo(4 * zoom, 2 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kind === "bat" ? "#5a4228" : "#24292c";
    ctx.fillRect(0, -1.5 * zoom, 6 * zoom, 3 * zoom);
  } else if (kind === "axe") {
    ctx.fillStyle = "#765234";
    ctx.fillRect(2 * zoom, -2 * zoom, len - 2 * zoom, 4 * zoom);
    ctx.fillStyle = "#b8bec2";
    ctx.beginPath();
    ctx.moveTo(len - 9 * zoom, -3 * zoom);
    ctx.lineTo(len - 2 * zoom, -10 * zoom);
    ctx.lineTo(len + 5 * zoom, -7 * zoom);
    ctx.lineTo(len + 5 * zoom, 5 * zoom);
    ctx.lineTo(len - 2 * zoom, 8 * zoom);
    ctx.lineTo(len - 9 * zoom, 3 * zoom);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "crowbar") {
    ctx.strokeStyle = "#59636a";
    ctx.lineWidth = 3 * zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(4 * zoom, 0);
    ctx.lineTo(len, 0);
    ctx.quadraticCurveTo(len + 5 * zoom, 0, len + 4 * zoom, -6 * zoom);
    ctx.stroke();
    ctx.lineCap = "butt";
  } else if (kind === "hammer") {
    ctx.fillStyle = "#765234";
    ctx.fillRect(2 * zoom, -2 * zoom, len - 4 * zoom, 4 * zoom);
    ctx.fillStyle = "#626b70";
    ctx.fillRect(len - 7 * zoom, -6 * zoom, 10 * zoom, 12 * zoom);
  } else {
    ctx.fillStyle = "#c8ccd0";
    ctx.beginPath();
    ctx.moveTo(5 * zoom, -1.5 * zoom);
    ctx.lineTo(len, 0);
    ctx.lineTo(5 * zoom, 1.5 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2c1c";
    ctx.fillRect(0, -1.5 * zoom, 5 * zoom, 3 * zoom);
  }
  ctx.restore();
  return 3;
}
