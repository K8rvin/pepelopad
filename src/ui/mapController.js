export function createMapController({
  center = { x: 0, y: 0 },
  zoom = 1,
  minZoom = 0.5,
  maxZoom = 4,
  onChange = () => {},
} = {}) {
  const state = { center: { ...center }, zoom, waypoint: null };
  const notify = () => onChange({ ...state, center: { ...state.center } });
  return {
    getState: () => ({
      ...state,
      center: { ...state.center },
      waypoint: state.waypoint && { ...state.waypoint },
    }),
    setZoom(nextZoom) {
      state.zoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
      notify();
    },
    panBy(dx, dy) {
      state.center.x += dx;
      state.center.y += dy;
      notify();
    },
    setWaypoint(point) {
      state.waypoint = { ...point };
      notify();
    },
    clearWaypoint() {
      state.waypoint = null;
      notify();
    },
  };
}
