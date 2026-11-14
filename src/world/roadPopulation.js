import { h2 } from "../core/rng.js";
import { normalizeVehicle } from "../systems/vehicles.js";
import { osmSolidAt } from "./osmCollision.js";
import { osmWayWidth } from "./osmMap.js";

const ROAD_BLOCK = 448;
const TYPES = [
  "sedan",
  "blue",
  "taxi",
  "sedan",
  "truck",
  "police",
  "ambulance",
  "motorcycle",
  "motorcycle",
  "bicycle",
  "bicycle",
  "scooter",
];

export function populationTarget({
  day,
  night,
  difficulty,
  districtDanger,
  raidDanger,
  density,
  calm,
  endless,
}) {
  const raw =
    (14 + Math.min(day, 14) * 1.8 + (night ? 9 : 0)) *
      difficulty *
      districtDanger *
      raidDanger *
      density -
    calm +
    (endless ? 3 : 0);
  return Math.max(10, Math.min(55, Math.round(raw)));
}

export function createRoadPopulation(world) {
  const cars = [],
    byBlock = new Map(),
    spawnByBlock = new Map(),
    occupied = new Map(),
    add = (index, key, value) => {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(value);
    },
    blockKey = (x, y) =>
      `${Math.floor(x / ROAD_BLOCK)},${Math.floor(y / ROAD_BLOCK)}`,
    hasNearbyCar = (x, y) => {
      const cx = Math.floor(x / 64),
        cy = Math.floor(y / 64);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          for (const car of occupied.get(`${cx + dx},${cy + dy}`) || [])
            if ((car.x - x) ** 2 + (car.y - y) ** 2 < 36 * 36) return true;
      return false;
    };
  for (const way of world.ways) {
    const highway = way.tags.highway;
    if (!highway) continue;
    for (let edge = 1; edge < way.points.length; edge++) {
      const a = way.points[edge - 1],
        b = way.points[edge],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy);
      if (length < 24) continue;
      const tx = dx / length,
        ty = dy / length,
        angle = Math.atan2(dy, dx);
      for (let distance = 48; distance < length - 24; distance += 64) {
        const point = {
            x: a[0] + tx * distance,
            y: a[1] + ty * distance,
            angle,
          },
          key = blockKey(point.x, point.y);
        if (!osmSolidAt(point.x, point.y, world, 7))
          add(spawnByBlock, key, point);
      }
      if (
        [
          "footway",
          "path",
          "steps",
          "pedestrian",
          "construction",
          "proposed",
        ].includes(highway)
      )
        continue;
      for (let distance = 160; distance < length - 48; distance += 560) {
        const value = h2(way.id, edge, Math.floor(distance));
        if (value > 0.72) continue;
        const side = value < 0.29 ? -1 : 1,
          offset = Math.max(8, osmWayWidth(way) / 2 - 16),
          x = a[0] + tx * distance - ty * offset * side,
          y = a[1] + ty * distance + tx * offset * side;
        if (osmSolidAt(x, y, world, 16)) continue;
        if (hasNearbyCar(x, y)) continue;
        const car = {
          id: `road:${way.id}:${edge}:${distance}`,
          x,
          y,
          angle,
          type: TYPES[
            Math.floor(h2(way.id, edge, distance + 7) * TYPES.length)
          ],
          locked: h2(way.id, edge, distance + 13) < 0.28,
          broken: h2(way.id, edge, distance + 19) < 0.35,
        };
        normalizeVehicle(car);
        car.fuel =
          car.maxFuel * (0.08 + h2(way.id, edge, distance + 23) * 0.67);
        car.hp = car.maxHp * (0.55 + h2(way.id, edge, distance + 29) * 0.45);
        cars.push(car);
        add(occupied, `${Math.floor(x / 64)},${Math.floor(y / 64)}`, car);
        add(byBlock, blockKey(x, y), car);
      }
    }
  }
  if (cars.length > 4000) {
    const selected = Array.from(
      { length: 4000 },
      (_, index) => cars[Math.floor((index * cars.length) / 4000)],
    );
    cars.splice(0, cars.length, ...selected);
    byBlock.clear();
    for (const car of cars) add(byBlock, blockKey(car.x, car.y), car);
  }
  return {
    cars,
    carsForBlock(bx, by) {
      return byBlock.get(`${bx},${by}`) || [];
    },
    spawnPointsNear(x, y, radius = 30 * 16) {
      const points = [];
      for (
        let by = Math.floor((y - radius) / ROAD_BLOCK);
        by <= Math.floor((y + radius) / ROAD_BLOCK);
        by++
      )
        for (
          let bx = Math.floor((x - radius) / ROAD_BLOCK);
          bx <= Math.floor((x + radius) / ROAD_BLOCK);
          bx++
        ) {
          for (const point of spawnByBlock.get(`${bx},${by}`) || [])
            if ((point.x - x) ** 2 + (point.y - y) ** 2 <= radius * radius)
              points.push(point);
        }
      return points;
    },
  };
}
