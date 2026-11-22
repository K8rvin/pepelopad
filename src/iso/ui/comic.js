// Комикс-слой — фишка стиля: мало кадров анимации + комиксовые акценты ситуаций.
// Владелец состояния облачков и всплывающих надписей; рендер только читает.
// Облачко: белый пузырь с хвостиком и тёмной обводкой, крупный читаемый текст.
export function createComic() {
  return { bubbles: [], floats: [] };
}

// облачко над мировой точкой (x,y); kind: say | alert | think
export function say(C, x, y, text, kind = "say", ttl = 1.7) {
  // одно активное облачко над точкой — новое заменяет старое
  C.bubbles = C.bubbles.filter((b) => Math.hypot(b.x - x, b.y - y) > 0.5);
  C.bubbles.push({ x, y, text, kind, t: 0, ttl });
  if (C.bubbles.length > 6) C.bubbles.shift();
}

// всплывающие «+N предмет» над контейнером, вверх с затуханием, каскадом
export function lootFloat(C, x, y, items) {
  items.forEach((it, i) => {
    C.floats.push({
      x,
      y,
      text: `+${it.n} ${it.name}`,
      t: -i * 0.14,
      ttl: 1.5,
    });
  });
}

export function updateComic(C, dt) {
  for (const b of C.bubbles) b.t += dt;
  C.bubbles = C.bubbles.filter((b) => b.t < b.ttl);
  for (const f of C.floats) f.t += dt;
  C.floats = C.floats.filter((f) => f.t < f.ttl);
}
