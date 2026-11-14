import { clamp, d2, K } from "../core/math.js";
import { vehicleDefinition } from "./vehicles.js";

function collisionHalfExtents(car) {
  const def = vehicleDefinition(car.type);
  return {
    x: def.collisionLength / 2,
    y: def.collisionWidth / 2,
  };
}

export function getSolid(tx, ty, context, exCar) {
  const key = K(tx, ty);
  const structure = context.structures.get(key);
  if (structure && !(structure.t === "gate" && structure.open))
    return { kind: "struct", o: structure };
  const container = context.containerAt
    ? context.containerAt(tx, ty)
    : context.containers.get(key);
  if (container) return { kind: "cont", o: container };

  for (const car of context.carsNear(tx * 16 + 8, ty * 16 + 8, 40)) {
    if (car.id === exCar || car.dead) continue;
    const half = collisionHalfExtents(car),
      px = clamp(tx * 16 + 8, car.x - half.x, car.x + half.x),
      py = clamp(ty * 16 + 8, car.y - half.y, car.y + half.y);
    if (d2(tx * 16 + 8, ty * 16 + 8, px, py) < half.y * half.y)
      return { kind: "car", o: car };
  }

  if (context.solidTiles.has(context.tileAt(tx, ty))) return { kind: "tile" };
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
        const half = collisionHalfExtents(solid.o);
        px = clamp(x, solid.o.x - half.x, solid.o.x + half.x);
        py = clamp(y, solid.o.y - half.y, solid.o.y + half.y);
      }
      if (d2(x, y, px, py) < radius * radius) return solid;
    }
  }

  const osm = context.osmSolidAt?.(x, y, radius);
  if (osm) return { kind: "tile", o: osm };
  const interior = context.interiorSolidAt?.(x, y, radius);
  if (interior) return { kind: "tile", o: interior };
  return null;
}

export function moveBody(body, dx, dy, context, exCar) {
  let bx = false;
  let by = false;
  let hit = null;
  const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2),
    ),
    stepX = dx / steps,
    stepY = dy / steps;

  for (let step = 0; step < steps; step++) {
    if (stepX) {
      const current = circleHit(body.x + stepX, body.y, body.r, context, exCar);
      if (!current) body.x += stepX;
      else {
        bx = true;
        hit = current;
      }
    }
    if (stepY) {
      const current = circleHit(body.x, body.y + stepY, body.r, context, exCar);
      if (!current) body.y += stepY;
      else {
        by = true;
        hit = hit || current;
      }
    }
  }

  return { bx, by, hit };
}
