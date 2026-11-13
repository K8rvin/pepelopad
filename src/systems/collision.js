import { clamp, d2, K } from "../core/math.js";

export function getSolid(tx, ty, context, exCar) {
  const key = K(tx, ty);
  const structure = context.structures.get(key);
  if (structure && !(structure.t === "gate" && structure.open))
    return { kind: "struct", o: structure };
  const container = context.containers.get(key);
  if (container) return { kind: "cont", o: container };

  for (const car of context.carsNear(tx * 16 + 8, ty * 16 + 8, 24)) {
    if (car.id === exCar || car.dead) continue;
    const px = clamp(tx * 16 + 8, car.x - 16, car.x + 16);
    const py = clamp(ty * 16 + 8, car.y - 10, car.y + 10);
    if (d2(tx * 16 + 8, ty * 16 + 8, px, py) < 100)
      return { kind: "car", o: car };
  }

  if (context.solidTiles.has(context.tileAt(tx, ty))) return { kind: "tile" };
  const osm = context.osmSolidAt?.(tx * 16 + 8, ty * 16 + 8, 0);
  if (osm) return { kind: "tile", o: osm };
  return null;
}

export function circleHit(x, y, radius, context, exCar) {
  const x0 = Math.floor((x - radius) / 16);
  const x1 = Math.floor((x + radius) / 16);
  const y0 = Math.floor((y - radius) / 16);
  const y1 = Math.floor((y + radius) / 16);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = getSolid(tx, ty, context, exCar);
      if (!solid) continue;
      let px = clamp(x, tx * 16, tx * 16 + 16);
      let py = clamp(y, ty * 16, ty * 16 + 16);
      if (solid.kind === "car") {
        px = clamp(x, solid.o.x - 16, solid.o.x + 16);
        py = clamp(y, solid.o.y - 10, solid.o.y + 10);
      }
      if (d2(x, y, px, py) < radius * radius) return solid;
    }
  }

  const osm = context.osmSolidAt?.(x, y, radius);
  if (osm) return { kind: "tile", o: osm };
  return null;
}

export function moveBody(body, dx, dy, context, exCar) {
  let bx = false;
  let by = false;
  let hit = null;

  if (dx) {
    const current = circleHit(body.x + dx, body.y, body.r, context, exCar);
    if (!current) body.x += dx;
    else {
      bx = true;
      hit = current;
    }
  }
  if (dy) {
    const current = circleHit(body.x, body.y + dy, body.r, context, exCar);
    if (!current) body.y += dy;
    else {
      by = true;
      hit = hit || current;
    }
  }

  return { bx, by, hit };
}
