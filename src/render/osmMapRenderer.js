import { osmWayWidth, wayCategory } from "../world/osmMap.js";

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
    category === "vegetation" ||
    category === "poi"
  ) {
    ctx.closePath();
    ctx.fill();
  } else ctx.stroke();
}

export function renderOsmMap({ ctx, world, cam, W, H, SC, w2s }) {
  ctx.fillStyle = COLORS.land;
  ctx.fillRect(0, 0, W, H);
  const halfW = W / (2 * SC),
    halfH = H / (2 * SC),
    minX = cam.x - halfW,
    maxX = cam.x + halfW,
    minY = cam.y - halfH,
    maxY = cam.y + halfH;
  let ways = world.ways;
  if (world.chunks) {
    const seen = new Set();
    ways = [];
    for (
      let cx = Math.floor(minX / world.chunkSize);
      cx <= Math.floor(maxX / world.chunkSize);
      cx++
    )
      for (
        let cy = Math.floor(minY / world.chunkSize);
        cy <= Math.floor(maxY / world.chunkSize);
        cy++
      ) {
        const chunk = world.chunks.get(`${cx},${cy}`);
        if (!chunk) continue;
        for (const id of chunk.ways)
          if (!seen.has(id)) {
            seen.add(id);
            ways.push(world.wayById.get(id));
          }
      }
  }
  for (const way of ways) {
    const category = wayCategory(way.tags);
    if (category === "land") continue;
    const bounds = world.boundsByWay?.get(way.id);
    if (
      bounds &&
      (bounds.maxX < minX ||
        bounds.minX > maxX ||
        bounds.maxY < minY ||
        bounds.minY > maxY)
    )
      continue;
    const color = COLORS[category];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth =
      category === "road" || category === "railway"
        ? osmWayWidth(way) * SC
        : SC;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(category === "railway" ? [8 * SC, 5 * SC] : []);
    drawWay(ctx, way, w2s, category);
  }
  ctx.setLineDash([]);
}
