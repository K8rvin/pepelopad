export function renderHome({
  ctx,
  W,
  H,
  HOME,
  TI,
  S,
  SC,
  homeAfter,
  homeRain,
  homeStage,
  dialogActive,
  homeFlash,
  P,
}) {
  ctx.fillStyle = "#080a07";
  ctx.fillRect(0, 0, W, H);
  const ox = W / 2 - HOME.w * 8 * SC;
  const oy = H / 2 - HOME.h * 8 * SC;
  const hs = (x, y) => ({ x: ox + x * SC, y: oy + y * SC });

  for (let y = 0; y < HOME.h; y++) {
    for (let x = 0; x < HOME.w; x++) {
      const s = hs(x * 16, y * 16);
      ctx.drawImage(TI[HOME.t[x + y * HOME.w]], s.x, s.y, 16 * SC, 16 * SC);
    }
  }

  const win = hs(8 * 16, 0);
  const ww = 4 * 16 * SC;
  const wh = 2.2 * 16 * SC;
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x + 4, win.y + 4, ww - 8, wh - 8);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, win.y, 0, win.y + wh);
  sky.addColorStop(0, homeAfter ? "#3a1c18" : "#1a2438");
  sky.addColorStop(1, homeAfter ? "#c96a35" : "#4a3a58");
  ctx.fillStyle = sky;
  ctx.fillRect(win.x, win.y, ww, wh);

  for (let i = 0; i < 8; i++) {
    const bx = win.x + (i * ww) / 8;
    const bw = ww / 8 - 2;
    const bh = 12 + ((i * 17) % 22);
    ctx.fillStyle = "#101418";
    ctx.fillRect(bx, win.y + wh - bh - 6, bw, bh);
    if (homeAfter && i % 3 === 0) {
      ctx.fillStyle = "#ffb23e";
      ctx.fillRect(bx + 2, win.y + wh - bh - 4, 3, 6);
    }
  }
  if (homeAfter) {
    for (let i = 0; i < 4; i++) {
      const zx = win.x + ((homeRain * 12 + i * 47) % (ww + 20)) - 10;
      ctx.fillStyle = "#151a14";
      ctx.fillRect(zx, win.y + wh - 13, 4, 8);
      ctx.fillRect(zx + 1, win.y + wh - 17, 2, 3);
    }
  }
  ctx.restore();
  ctx.strokeStyle = "#3a2f20";
  ctx.lineWidth = 5;
  ctx.strokeRect(win.x + 2, win.y + 2, ww - 4, wh - 4);

  for (const furniture of HOME.furn) {
    const s = hs(furniture.x * 16, furniture.y * 16);
    ctx.drawImage(
      furniture.spr,
      s.x,
      s.y,
      furniture.w * 16 * SC,
      furniture.h * 16 * SC,
    );
  }
  const door = hs(9.5 * 16, 13 * 16);
  ctx.drawImage(S.h_door, door.x, door.y - 16 * SC, 32 * SC, 16 * SC);

  const objective = HOME.objs[homeStage];
  if (objective && !dialogActive) {
    const s = hs(objective.x, objective.y);
    ctx.strokeStyle =
      "rgba(255,178,62," +
      (0.45 + Math.sin(performance.now() / 180) * 0.25) +
      ")";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 22, s.y - 22, 44, 44);
  }

  const player = hs(P.x, P.y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 4, 5 * SC, 3 * SC, 0, 0, 7);
  ctx.fill();
  ctx.drawImage(
    S.player,
    player.x - 6 * SC,
    player.y - 9 * SC,
    12 * SC,
    14 * SC,
  );

  if (homeFlash > 0) {
    ctx.fillStyle = "rgba(255,238,190," + homeFlash * 0.8 + ")";
    ctx.fillRect(0, 0, W, H);
  }
}
