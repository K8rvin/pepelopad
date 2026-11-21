// Синтезированные звуки через WebAudio — без ассетов и зависимостей.
// Контекст создаётся лениво при первом вызове (после жеста пользователя);
// если аудио недоступно или запрещено политикой autoplay — молча пропускаем.
let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// повышение уровня: восходящее арпеджио C5-E5-G5-C6 с мягким затуханием
export function playLevelUp() {
  try {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = i === notes.length - 1 ? "sine" : "triangle";
      o.frequency.value = f;
      const t = t0 + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.6);
    });
  } catch {
    // аудио — не критичный путь: игра продолжается без звука
  }
}
