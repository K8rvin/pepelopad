export function speedZoomFactor(speed, maxSpeed) {
  if (!(maxSpeed > 0)) return 1;
  const ratio = Math.min(1, Math.max(0, Math.abs(speed) / maxSpeed));
  return 1 - ratio * 0.3;
}

export function shortestArc(from, to) {
  const angle = to === undefined ? from : to - from;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function lerpAngle(from, to, t) {
  return from + shortestArc(from, to) * t;
}

export function screenToWorld(sx, sy, cam, W, H, SC) {
  const scale = SC * (cam.zoom ?? 1);
  const rotation = cam.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = (sx - W / 2) / scale;
  const dy = (sy - H / 2) / scale;
  return {
    x: cam.x + dx * cos + dy * sin,
    y: cam.y - dx * sin + dy * cos,
  };
}

export function worldToScreen(x, y, cam, W, H, SC) {
  const scale = SC * (cam.zoom ?? 1);
  const rotation = cam.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = x - cam.x;
  const dy = y - cam.y;
  return {
    x: (dx * cos - dy * sin) * scale + W / 2,
    y: (dx * sin + dy * cos) * scale + H / 2,
  };
}

export function createCameraTransforms({ cam, getViewport, getScale }) {
  const toScreen = (x, y) => {
    const viewport = getViewport();
    const W = viewport.width ?? viewport.w ?? viewport.W;
    const H = viewport.height ?? viewport.h ?? viewport.H;
    return worldToScreen(x, y, cam, W, H, getScale());
  };
  const toWorld = (sx, sy) => {
    const viewport = getViewport();
    const W = viewport.width ?? viewport.w ?? viewport.W;
    const H = viewport.height ?? viewport.h ?? viewport.H;
    return screenToWorld(sx, sy, cam, W, H, getScale());
  };
  return { worldToScreen: toScreen, screenToWorld: toWorld, w2s: toScreen };
}
