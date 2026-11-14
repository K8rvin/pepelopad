import { circleHitsBuildingWalls, pointInPolygon } from "./buildingGeometry.js";
export { pointInPolygon };

export function distanceToSegmentSquared(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return (x - ax) ** 2 + (y - ay) ** 2;
  const t = Math.max(
    0,
    Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared),
  );
  const px = ax + t * dx,
    py = ay + t * dy;
  return (x - px) ** 2 + (y - py) ** 2;
}

export function circleHitsPolygon(x, y, radius, points) {
  if (pointInPolygon(x, y, points)) return true;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i],
      [bx, by] = points[(i + 1) % points.length];
    if (distanceToSegmentSquared(x, y, ax, ay, bx, by) <= radius * radius)
      return true;
  }
  return false;
}

export function osmSolidAt(x, y, world, radius = 0) {
  let candidates = world.ways;
  if (world.chunks) {
    candidates = [];
    const seen = new Set(),
      margin = Math.ceil(radius / world.chunkSize);
    for (
      let cx = Math.floor(x / world.chunkSize) - margin;
      cx <= Math.floor(x / world.chunkSize) + margin;
      cx++
    )
      for (
        let cy = Math.floor(y / world.chunkSize) - margin;
        cy <= Math.floor(y / world.chunkSize) + margin;
        cy++
      ) {
        const chunk = world.chunks.get(`${cx},${cy}`);
        if (!chunk) continue;
        for (const id of chunk.ways)
          if (!seen.has(id)) {
            seen.add(id);
            candidates.push(world.wayById.get(id));
          }
      }
  }
  for (const way of candidates) {
    if (!way || (!way.tags.building && way.tags.natural !== "water")) continue;
    const bounds = world.boundsByWay?.get(way.id);
    if (
      bounds &&
      (x + radius < bounds.minX ||
        x - radius > bounds.maxX ||
        y + radius < bounds.minY ||
        y - radius > bounds.maxY)
    )
      continue;
    if (way.tags.building) {
      const wall = circleHitsBuildingWalls(x, y, radius, way);
      if (wall) return wall;
    } else if (circleHitsPolygon(x, y, radius, way.points)) return way;
  }
  return null;
}
