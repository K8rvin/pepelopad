// Полоска загрузки: этапы выставляет boot(), ассеты сообщают прогресс по файлам.
// DOM-элементы инжектируются снаружи (конвенция ui/), отсутствие элементов — no-op.
export function createLoading({ root, sub, fill, pct } = {}) {
  let lastPct = -1;
  function set(frac, label) {
    const p = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    if (p !== lastPct) {
      lastPct = p;
      if (fill) fill.style.width = p + "%";
      if (pct) pct.textContent = p + "%";
    }
    if (label && sub && sub.textContent !== label) sub.textContent = label;
  }
  function done() {
    if (root) root.remove();
  }
  return { set, done };
}
