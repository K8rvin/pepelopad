import { d2, K } from "../core/math.js";

export function spatialKey(x, y, cellSize = 128) {
  return K(Math.floor(x / cellSize), Math.floor(y / cellSize));
}

export function addToSpatialGrid(grid, entity, cellSize = 128) {
  const key = spatialKey(entity.x, entity.y, cellSize);
  if (!grid.has(key)) grid.set(key, new Set());
  grid.get(key).add(entity.id);
  entity._g = key;
}

export function moveInSpatialGrid(grid, entity, cellSize = 128) {
  const key = spatialKey(entity.x, entity.y, cellSize);
  if (key === entity._g) return;
  grid.get(entity._g)?.delete(entity.id);
  addToSpatialGrid(grid, entity, cellSize);
}

export function nearInSpatialGrid(
  grid,
  entities,
  x,
  y,
  radius,
  cellSize = 128,
) {
  const result = [];
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  const range = Math.ceil(radius / cellSize);

  for (let yy = cy - range; yy <= cy + range; yy++) {
    for (let xx = cx - range; xx <= cx + range; xx++) {
      const cell = grid.get(K(xx, yy));
      if (!cell) continue;
      for (const id of cell) {
        const entity = entities.get(id);
        if (entity && d2(x, y, entity.x, entity.y) < radius * radius)
          result.push(entity);
      }
    }
  }

  return result;
}
