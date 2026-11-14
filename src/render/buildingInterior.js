function tracePolygon(ctx, points, w2s) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const point = w2s(x, y);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function strokeWallPart(ctx, points, w2s) {
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

export function renderBuildingInterior({
  ctx,
  building,
  floorId,
  stairs,
  SC,
  w2s,
}) {
  if (!building || floorId === "outdoor") return;
  ctx.fillStyle =
    floorId === "basement"
      ? "#252923"
      : floorId === "upper"
        ? "#3a3d32"
        : "#343a2f";
  tracePolygon(ctx, building.points, w2s);
  ctx.fill();
  ctx.strokeStyle = "#8a8574";
  ctx.lineWidth = 8 * SC;
  ctx.lineCap = "butt";
  const edgeCount =
    building.points[0][0] === building.points.at(-1)[0] &&
    building.points[0][1] === building.points.at(-1)[1]
      ? building.points.length - 1
      : building.points.length;
  for (let index = 0; index < edgeCount; index++) {
    const a = building.points[index],
      b = building.points[(index + 1) % building.points.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      tx = (b[0] - a[0]) / length,
      ty = (b[1] - a[1]) / length,
      openings = (building.openings || [])
        .filter((opening) => opening.edgeIndex === index)
        .sort((left, right) => left.along - right.along);
    let cursor = 0;
    const drawInterval = (from, to) => {
      if (to <= from) return;
      strokeWallPart(
        ctx,
        [
          w2s(a[0] + tx * from, a[1] + ty * from),
          w2s(a[0] + tx * to, a[1] + ty * to),
        ],
        w2s,
      );
    };
    for (const opening of openings) {
      drawInterval(cursor, Math.max(cursor, opening.along - opening.halfWidth));
      cursor = Math.min(length, opening.along + opening.halfWidth);
    }
    drawInterval(cursor, length);
  }
  for (const stair of stairs) {
    const point = w2s(stair.x, stair.y);
    ctx.fillStyle = "#171d18";
    ctx.fillRect(point.x - 18 * SC, point.y - 14 * SC, 36 * SC, 28 * SC);
    ctx.strokeStyle = "#ffb23e";
    ctx.lineWidth = 2 * SC;
    for (let index = 0; index < 4; index++) {
      ctx.beginPath();
      ctx.moveTo(point.x - 12 * SC, point.y + (9 - index * 6) * SC);
      ctx.lineTo(point.x + 12 * SC, point.y + (9 - index * 6) * SC);
      ctx.stroke();
    }
  }
}
