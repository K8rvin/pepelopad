export function attachMapInteractions({
  canvas,
  controller,
  cellSize,
  onSelect,
  onClear,
  onHover,
  isEnabled = () => true,
}) {
  let drag = null;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  };
  const down = (event) => {
    if (!isEnabled() || (event.button !== 0 && event.button !== 2)) return;
    const p = point(event);
    drag = { ...p, lastX: p.x, lastY: p.y, button: event.button, moved: false };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event) => {
    if (!isEnabled()) return;
    const p = point(event);
    onHover?.(p);
    if (!drag) return;
    const dx = (p.x - drag.lastX) / cellSize();
    const dy = (p.y - drag.lastY) / cellSize();
    if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4 * p.scale) drag.moved = true;
    controller.panBy(-dx, -dy);
    drag.lastX = p.x;
    drag.lastY = p.y;
  };
  const up = (event) => {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (!finished.moved) {
      if (finished.button === 0) onSelect(point(event));
      else onClear();
    }
  };
  const wheel = (event) => {
    if (!isEnabled()) return;
    event.preventDefault();
    const zoom = controller.getState().zoom;
    controller.setZoom(zoom * (event.deltaY < 0 ? 1.25 : 0.8));
  };
  const contextmenu = (event) => event.preventDefault();
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("contextmenu", contextmenu);
}
