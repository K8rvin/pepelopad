export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i],
      [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function projectToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    length = Math.hypot(dx, dy),
    lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared)
    return {
      x: ax,
      y: ay,
      along: 0,
      length: 0,
      distanceSquared: (x - ax) ** 2 + (y - ay) ** 2,
    };
  const along =
    Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) *
    length;
  const px = ax + (dx * along) / length,
    py = ay + (dy * along) / length;
  return {
    x: px,
    y: py,
    along,
    length,
    distanceSquared: (x - px) ** 2 + (y - py) ** 2,
  };
}

function makeOpening(way, edgeIndex, along, kind, source, width) {
  const points = way.points,
    a = points[edgeIndex],
    b = points[(edgeIndex + 1) % points.length],
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy),
    tx = dx / length,
    ty = dy / length,
    x = a[0] + tx * along,
    y = a[1] + ty * along;
  let nx = -ty,
    ny = tx;
  if (pointInPolygon(x + nx, y + ny, points)) {
    nx = -nx;
    ny = -ny;
  }
  return {
    id: `${way.id}:${kind}:${edgeIndex}:${Math.round(along)}`,
    wayId: way.id,
    edgeIndex,
    along,
    x,
    y,
    tx,
    ty,
    nx,
    ny,
    kind,
    source,
    width,
    halfWidth: width / 2,
  };
}

export function createBuildingAccess(way, entrancePoints = []) {
  const points = way.points,
    edgeCount =
      points.length > 2 &&
      points[0][0] === points.at(-1)[0] &&
      points[0][1] === points.at(-1)[1]
        ? points.length - 1
        : points.length,
    edges = [];
  let perimeter = 0;
  for (let index = 0; index < edgeCount; index++) {
    const a = points[index],
      b = points[(index + 1) % points.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > 0) edges.push({ index, a, b, length });
    perimeter += length;
  }
  if (!edges.length) return [];
  const openings = [],
    occupiedEdges = new Set();
  for (const entrance of entrancePoints) {
    let nearest = null;
    for (const edge of edges) {
      const projected = projectToSegment(
        entrance.x,
        entrance.y,
        edge.a[0],
        edge.a[1],
        edge.b[0],
        edge.b[1],
      );
      if (
        !nearest ||
        projected.distanceSquared < nearest.projected.distanceSquared
      )
        nearest = { edge, projected };
    }
    if (nearest && nearest.projected.distanceSquared <= 64) {
      const width = Math.min(32, Math.max(12, nearest.edge.length - 8)),
        along = Math.max(
          width / 2,
          Math.min(nearest.edge.length - width / 2, nearest.projected.along),
        );
      openings.push(
        makeOpening(way, nearest.edge.index, along, "door", "osm", width),
      );
      occupiedEdges.add(nearest.edge.index);
    }
  }
  const doorTarget = Math.min(6, Math.max(1, Math.floor(perimeter / 560)));
  for (const edge of [...edges].sort(
    (a, b) => b.length - a.length || a.index - b.index,
  )) {
    if (
      openings.filter((opening) => opening.kind === "door").length >= doorTarget
    )
      break;
    if (occupiedEdges.has(edge.index)) continue;
    const width = Math.min(32, Math.max(12, edge.length - 8));
    if (edge.length < 20) continue;
    openings.push(
      makeOpening(way, edge.index, edge.length / 2, "door", "generated", width),
    );
    occupiedEdges.add(edge.index);
  }
  for (const edge of edges) {
    if (edge.length < 56) continue;
    for (let along = 32; along < edge.length - 24; along += 64) {
      if (
        openings.some(
          (opening) =>
            opening.edgeIndex === edge.index &&
            Math.abs(opening.along - along) < opening.halfWidth + 24,
        )
      )
        continue;
      openings.push(
        makeOpening(way, edge.index, along, "window", "generated", 24),
      );
    }
  }
  return openings;
}

export function circleHitsBuildingWalls(x, y, radius, way) {
  const openings = way.openings || [],
    edgeCount =
      way.points.length > 2 &&
      way.points[0][0] === way.points.at(-1)[0] &&
      way.points[0][1] === way.points.at(-1)[1]
        ? way.points.length - 1
        : way.points.length;
  for (let index = 0; index < edgeCount; index++) {
    const a = way.points[index],
      b = way.points[(index + 1) % way.points.length],
      projected = projectToSegment(x, y, a[0], a[1], b[0], b[1]),
      wallRadius = radius + 4;
    if (projected.distanceSquared > wallRadius * wallRadius) continue;
    const opening = openings.find(
      (candidate) =>
        candidate.edgeIndex === index &&
        Math.abs(projected.along - candidate.along) <=
          candidate.halfWidth + radius * 0.25,
    );
    if (!opening) return way;
  }
  return null;
}

export function distanceToBuildingWalls(x, y, points) {
  let best = Infinity;
  const edgeCount =
    points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]
      ? points.length - 1
      : points.length;
  for (let index = 0; index < edgeCount; index++) {
    const a = points[index],
      b = points[(index + 1) % points.length];
    best = Math.min(
      best,
      Math.sqrt(projectToSegment(x, y, a[0], a[1], b[0], b[1]).distanceSquared),
    );
  }
  return best;
}

export function findInteriorPoints(points, count = 2) {
  const box = boundsOfPoints(points),
    cx = (box.minX + box.maxX) / 2,
    cy = (box.minY + box.maxY) / 2,
    candidates = [];
  for (let y = Math.floor(box.minY / 16) * 16 + 8; y < box.maxY; y += 16)
    for (let x = Math.floor(box.minX / 16) * 16 + 8; x < box.maxX; x += 16)
      if (
        pointInPolygon(x, y, points) &&
        distanceToBuildingWalls(x, y, points) >= 24
      )
        candidates.push({ x, y, distance: Math.hypot(x - cx, y - cy) });
  candidates.sort((a, b) => a.distance - b.distance);
  const result = [];
  for (const candidate of candidates) {
    if (
      result.every(
        (point) =>
          Math.hypot(point.x - candidate.x, point.y - candidate.y) >= 48,
      )
    )
      result.push(candidate);
    if (result.length === count) break;
  }
  return result;
}

function boundsOfPoints(points) {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    maxX: Math.max(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}
