import { h2 } from "../core/rng.js";

export function pointAlongRoute(route, distance) {
  const total = route.length,
    wrapped = ((distance % total) + total) % total;
  let remaining = wrapped;
  for (let index = 1; index < route.points.length; index++) {
    const a = route.points[index - 1],
      b = route.points[index],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    if (remaining <= length || index === route.points.length - 1) {
      const t = length ? Math.max(0, Math.min(1, remaining / length)) : 0;
      return { x: a[0] + dx * t, y: a[1] + dy * t, angle: Math.atan2(dy, dx) };
    }
    remaining -= length;
  }
  return { x: route.points[0][0], y: route.points[0][1], angle: 0 };
}

export function advanceRailVehicle(vehicle, dt) {
  vehicle.distance += vehicle.speed * vehicle.direction * dt;
  if (vehicle.distance > vehicle.route.length) {
    vehicle.distance = vehicle.route.length;
    vehicle.direction = -1;
  } else if (vehicle.distance < 0) {
    vehicle.distance = 0;
    vehicle.direction = 1;
  }
  return vehicle;
}

export function railVehicleParts(vehicle) {
  const parts = [];
  for (let index = 0; index < vehicle.carriages + 1; index++) {
    const distance = Math.max(
        0,
        Math.min(
          vehicle.route.length,
          vehicle.distance - vehicle.direction * index * 28,
        ),
      ),
      point = pointAlongRoute(vehicle.route, distance);
    parts.push({
      id: `${vehicle.id}:${index}`,
      kind: vehicle.kind === "tram" || index === 0 ? vehicle.kind : "carriage",
      x: point.x,
      y: point.y,
      angle: point.angle,
      vehicleId: vehicle.id,
    });
  }
  return parts;
}

export function createRailPopulation(world) {
  const candidates = world.ways
    .filter((way) => ["rail", "tram", "light_rail"].includes(way.tags.railway))
    .filter((way) => way.points.length > 1)
    .map((way) => {
      const points = way.points;
      let length = 0;
      for (let index = 1; index < points.length; index++)
        length += Math.hypot(
          points[index][0] - points[index - 1][0],
          points[index][1] - points[index - 1][1],
        );
      return { way, length };
    })
    .filter((route) => route.length > 400)
    .sort((a, b) => a.way.id - b.way.id);
  const vehicles = [],
    used = new Set();
  for (const candidate of candidates) {
    const kind = candidate.way.tags.railway === "rail" ? "train" : "tram",
      limit = kind === "train" ? 3 : 4;
    if (vehicles.filter((vehicle) => vehicle.kind === kind).length >= limit)
      continue;
    const routeKey =
      candidate.way.tags.name ||
      candidate.way.tags.ref ||
      `${kind}:${candidate.way.id}`;
    if (used.has(routeKey)) continue;
    used.add(routeKey);
    const value = h2(candidate.way.id, 0, 73),
      route = {
        id: candidate.way.id,
        points: candidate.way.points,
        length: candidate.length,
      },
      distance = value * candidate.length,
      direction = value < 0.5 ? -1 : 1,
      vehicle = {
        id: `${kind}:${candidate.way.id}`,
        kind,
        route,
        distance,
        direction,
        speed: kind === "train" ? 54 : 40,
        carriages: kind === "train" ? 3 : 0,
      };
    Object.assign(vehicle, pointAlongRoute(route, distance));
    vehicles.push(vehicle);
  }
  return vehicles;
}
