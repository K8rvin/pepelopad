export function findNearestFreePosition(
  x,
  y,
  isFree,
  { maxRadius = 192, step = 16 } = {},
) {
  for (let radius = step; radius <= maxRadius; radius += step) {
    const count = Math.max(8, Math.ceil((Math.PI * 2 * radius) / step));
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2,
        candidate = {
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        };
      if (isFree(candidate.x, candidate.y)) return candidate;
    }
  }
  return null;
}
