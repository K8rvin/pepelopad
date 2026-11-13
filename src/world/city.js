import { h2 } from "../core/rng.js";
import { mod } from "../core/math.js";
import { CELL, CITY_R } from "../core/constants.js";

const SPECIAL_BLOCKS = {
  "0,0": "base",
  "2,0": "supermarket",
  "0,2": "gunstore",
  "-2,0": "hospital",
  "1,1": "gas",
  "1,-1": "garage",
  "-1,1": "police",
  "2,-1": "warehouse",
  "5,-4": "quarry",
  "4,2": "camp_bridge",
  "-4,-3": "camp_farm",
  "6,-1": "camp_depot",
};

export function cityRadiusAt(bx, by, seed) {
  const angle = Math.atan2(by, bx);
  const noise = h2(
    Math.floor(Math.cos(angle) * 10),
    Math.floor(Math.sin(angle) * 10),
    seed ^ 77,
  );
  return CITY_R + noise * 3;
}

export function districtOf(bx, by, seed) {
  const distance = Math.hypot(bx, by);
  if (distance > cityRadiusAt(bx, by, seed)) return "outskirts";
  if (bx === 0 && by === 0) return "home";
  if (distance < 2.2) return "residential";
  if (distance < 4.5)
    return h2(bx, by, seed ^ 3) < 0.5 ? "commercial" : "civic";
  if (distance < 7)
    return h2(bx, by, seed ^ 5) < 0.55 ? "industrial" : "residential";
  return "suburb";
}

export function specialBlock(bx, by) {
  return SPECIAL_BLOCKS[`${bx},${by}`];
}

export function roadAt(gx, gy) {
  return mod(gx, CELL) < 4 || mod(gy, CELL) < 4;
}

export function pavedAt(gx, gy) {
  const mx = mod(gx, CELL),
    my = mod(gy, CELL);
  return roadAt(gx, gy) || mx === 4 || my === 4 || mx === 27 || my === 27;
}

export function crosswalkAt(gx, gy) {
  const mx = mod(gx, CELL),
    my = mod(gy, CELL);
  return (mx === 2 && my === 12) || (mx === 12 && my === 2);
}

export function buildingFits(buildings, gx, gy, w, h, margin = 1) {
  for (const b of buildings) {
    if (
      gx < b.x + b.w + margin &&
      gx + w + margin > b.x &&
      gy < b.y + b.h + margin &&
      gy + h + margin > b.y
    ) {
      return false;
    }
  }
  return true;
}

export function carTileFits(carTiles, gx, gy) {
  for (const [x, y] of carTiles)
    if (Math.abs(gx - x) < 2 && Math.abs(gy - y) < 2) return false;
  return true;
}
