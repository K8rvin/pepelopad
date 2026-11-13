import { mb32, h2 } from "../core/rng.js";
import { mod } from "../core/math.js";
import { CELL } from "../core/constants.js";
import { crosswalkAt } from "./city.js";
import { POI } from "../data/world.js";

export function createTerrainTiles(cx, cy, seed) {
  const random = mb32((h2(cx, cy, seed) * 1e9) | 0);
  const tiles = new Uint8Array(256);

  for (let i = 0; i < 256; i++) {
    const gx = cx * 16 + (i % 16);
    const gy = cy * 16 + Math.floor(i / 16);
    const mx = mod(gx, CELL);
    const my = mod(gy, CELL);
    if (mx < 4 && my < 4) tiles[i] = 2;
    else if (crosswalkAt(gx, gy)) tiles[i] = 29;
    else if (mx < 4) tiles[i] = mx === 2 ? 28 : 2;
    else if (my < 4) tiles[i] = my === 2 ? 27 : 2;
    else if (mx === 4 || my === 4 || mx === 27 || my === 27) tiles[i] = 3;
    else tiles[i] = random() < 0.05 ? 1 : 0;
  }

  return tiles;
}

export function stampBuilding(tiles, chunk, building) {
  const definition = POI[building.type];
  const x0 = building.x - chunk.cx * 16;
  const y0 = building.y - chunk.cy * 16;
  const set = (x, y, value) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) tiles[x + y * 16] = value;
  };

  for (let y = 0; y < building.h; y++) {
    for (let x = 0; x < building.w; x++) set(x0 + x, y0 + y, definition.floor);
  }
  for (let x = 0; x < building.w; x++) {
    set(x0 + x, y0, definition.wall);
    set(x0 + x, y0 + building.h - 1, definition.wall);
  }
  for (let y = 0; y < building.h; y++) {
    set(x0, y0 + y, definition.wall);
    set(x0 + building.w - 1, y0 + y, definition.wall);
  }
  for (let x = 2; x < building.w - 2; x += 3) set(x0 + x, y0, 8);
  for (let y = 2; y < building.h - 2; y += 3) {
    set(x0, y0 + y, 8);
    set(x0 + building.w - 1, y0 + y, 8);
  }
  set(x0 + Math.floor(building.w / 2), y0 + building.h - 1, definition.floor);
}

export function stampBase(tiles, chunk) {
  const set = (gx, gy, value) => {
    const x = gx - chunk.cx * 16;
    const y = gy - chunk.cy * 16;
    if (x >= 0 && x < 16 && y >= 0 && y < 16) tiles[x + y * 16] = value;
  };

  for (let gy = chunk.cy * 16; gy < chunk.cy * 16 + 16; gy++) {
    for (let gx = chunk.cx * 16; gx < chunk.cx * 16 + 16; gx++) {
      if (gx >= 6 && gx <= 25 && gy >= 6 && gy <= 25) set(gx, gy, 0);
      if (gx === 11 && gy >= 14 && gy <= 25) set(gx, gy, 1);
      if (gy === 16 && gx >= 6 && gx <= 25) set(gx, gy, 1);
      if (gx >= 13 && gx <= 19 && gy >= 13 && gy <= 19) set(gx, gy, 9);
      if (gx >= 8 && gx <= 14 && gy >= 8 && gy <= 13) {
        set(gx, gy, 4);
        if (gx === 8 || gx === 14 || gy === 8 || gy === 13) set(gx, gy, 6);
        if ((gx === 10 || gx === 12) && gy === 8) set(gx, gy, 8);
      }
      if (gx === 11 && gy === 13) set(gx, gy, 4);
      if (gx >= 20 && gx <= 23 && gy >= 20 && gy <= 23) set(gx, gy, 21);
    }
  }
}

export function stampProps(tiles, chunk, props) {
  for (const prop of props) {
    const x = Math.floor(prop.x - chunk.cx * 16);
    const y = Math.floor(prop.y - chunk.cy * 16);
    if (x < 0 || x >= 16 || y < 0 || y >= 16) continue;
    const index = x + y * 16;
    if (tiles[index] === 0 || tiles[index] === 1)
      tiles[index] = prop.type === "tree" ? 14 : 15;
  }
}
