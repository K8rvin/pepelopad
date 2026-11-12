export function drawWeaponOverlay({ ctx, P, S, SC }) {
  const weapon = P.weapon;
  const aim = P.aim;
  const flip = Math.cos(aim) < 0;
  ctx.save();
  ctx.rotate(aim);
  if (flip) ctx.scale(1, -1);

  if (weapon === "bow" || weapon === "crossbow") {
    const progress =
      P.rl > 0 ? 1 - P.rl / (P.rlMax || 1) : P.mags[weapon] > 0 ? 1 : 0;
    ctx.strokeStyle = "#8a6a3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(9 * SC, 0, 5 * SC, -1.25, 1.25);
    ctx.stroke();
    const pull = (3 + progress * 4) * SC;
    ctx.strokeStyle = "#d9cba6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9 * SC + Math.cos(-1.25) * 5 * SC, -Math.sin(1.25) * 5 * SC);
    ctx.lineTo(9 * SC - pull, 0);
    ctx.lineTo(9 * SC + Math.cos(1.25) * 5 * SC, Math.sin(1.25) * 5 * SC);
    ctx.stroke();
    if (progress > 0.25) {
      ctx.strokeStyle = "#d9cba6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(9 * SC - pull, 0);
      ctx.lineTo(15 * SC, 0);
      ctx.stroke();
      ctx.fillStyle = "#9aa0a8";
      ctx.fillRect(15 * SC, -1, 3, 2);
    }
    if (weapon === "crossbow") {
      ctx.fillStyle = "#5c4a32";
      ctx.fillRect(4 * SC, -SC, 8 * SC, 2 * SC);
    }
  } else {
    const sprite = S["gun_" + weapon];
    ctx.drawImage(
      sprite,
      3 * SC,
      -3 * SC,
      sprite.width * SC,
      sprite.height * SC,
    );
  }

  ctx.restore();
}
