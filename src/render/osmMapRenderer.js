import { wayCategory } from "../world/osmMap.js";

const COLORS = {
  building: "#3c4137",
  road: "#4d4b43",
  railway: "#292d2a",
  water: "#254b5d",
  vegetation: "#263a25",
  poi: "#665238",
  land: "#2a3322",
};

function drawWay(ctx, way, w2s, category) {
  const points = way.points.map(([x, y]) => w2s(x, y));
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (
    category === "building" ||
    category === "water" ||
    category === "vegetation"
  ) {
    ctx.closePath();
    ctx.fill();
  } else ctx.stroke();
}

export function renderOsmMap({ ctx, world, cam, W, H, SC, w2s }) {
  ctx.fillStyle = COLORS.land;
  ctx.fillRect(0, 0, W, H);
  for (const way of world.ways) {
    const category = wayCategory(way.tags);
    if (
      !way.points.some(
        ([x, y]) =>
          Math.abs(x - cam.x) < W / SC && Math.abs(y - cam.y) < H / SC,
      )
    )
      continue;
    const color = COLORS[category];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = category === "road" ? 4 : category === "railway" ? 2 : 1;
    ctx.setLineDash(category === "railway" ? [8, 5] : []);
    drawWay(ctx, way, w2s, category);
  }
  ctx.setLineDash([]);
}
