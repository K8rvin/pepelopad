export function screenToWorld(sx, sy, cam, W, H, SC) {
  return {
    x: cam.x + (sx - W / 2) / SC,
    y: cam.y + (sy - H / 2) / SC,
  };
}

export function worldToScreen(x, y, cam, W, H, SC) {
  return {
    x: (x - cam.x) * SC + W / 2,
    y: (y - cam.y) * SC + H / 2,
  };
}
