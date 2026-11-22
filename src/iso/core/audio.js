// Звук: WebAudio, процедурные эффекты и эмбиент — без внешних файлов.
// Контекст создаётся лениво на первом жесте (autoplay policy браузера).
// В среде без AudioContext (unit-тесты) все вызовы — безопасный no-op.
export function createAudio() {
  let ctx = null,
    master = null,
    sfxBus = null,
    ambBus = null,
    noiseBuf = null;
  let engine = null; // {osc, gain, filter}
  let amb = null; // {nodes:[], gain, kind}
  const volumes = { master: 0.7, sfx: 0.9, amb: 0.5 };

  function ensure() {
    if (ctx) return true;
    const AC =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volumes.master;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = volumes.sfx;
    sfxBus.connect(master);
    ambBus = ctx.createGain();
    ambBus.gain.value = volumes.amb;
    ambBus.connect(master);
    // 2 с белого шума — источник для всех шумовых эффектов
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function now() {
    return ctx.currentTime;
  }

  // одиночный тон с огибающей и опциональным скольжением частоты
  function tone({ f = 440, f2, type = "sine", dur = 0.15, g = 0.2, at = 0 }) {
    const t0 = now() + at;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(g, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // шумовой всплеск через фильтр
  function noise({
    dur = 0.15,
    g = 0.3,
    type = "lowpass",
    f = 800,
    f2,
    q = 1,
    at = 0,
  }) {
    const t0 = now() + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, t0);
    if (f2)
      flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    flt.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(g, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt).connect(gn).connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const SFX = {
    uiClick: () => tone({ f: 760, type: "square", dur: 0.04, g: 0.1 }),
    uiOpen: () => {
      tone({ f: 480, dur: 0.06, g: 0.12 });
      tone({ f: 700, dur: 0.07, g: 0.12, at: 0.05 });
    },
    uiClose: () => {
      tone({ f: 660, dur: 0.06, g: 0.1 });
      tone({ f: 420, dur: 0.07, g: 0.1, at: 0.04 });
    },
    pickup: () => tone({ f: 880, f2: 1240, dur: 0.07, g: 0.16 }),
    loot: () => {
      // закрытие контейнера с добычей: мягкий стук + короткий подъём
      noise({ dur: 0.08, g: 0.2, f: 300 });
      tone({ f: 520, dur: 0.07, g: 0.14, at: 0.05 });
      tone({ f: 780, dur: 0.1, g: 0.14, at: 0.12 });
    },
    empty: () => tone({ f: 220, f2: 160, dur: 0.12, g: 0.12 }),
    bowDraw: () =>
      noise({ dur: 0.5, g: 0.08, type: "bandpass", f: 300, f2: 900, q: 3 }),
    bowRelease: () => {
      noise({ dur: 0.12, g: 0.3, type: "highpass", f: 2200, f2: 500 });
      tone({ f: 220, f2: 90, type: "triangle", dur: 0.1, g: 0.2 });
    },
    hit: () => {
      noise({ dur: 0.08, g: 0.35, f: 320 });
      tone({ f: 130, f2: 70, dur: 0.06, g: 0.25 });
    },
    kill: () => {
      noise({ dur: 0.24, g: 0.4, f: 220, f2: 90 });
      tone({ f: 90, f2: 40, type: "sawtooth", dur: 0.2, g: 0.2 });
    },
    hurt: () => {
      tone({ f: 110, f2: 55, type: "sawtooth", dur: 0.22, g: 0.4 });
      noise({ dur: 0.12, g: 0.3, f: 400 });
    },
    bite: () => {
      noise({ dur: 0.1, g: 0.35, type: "bandpass", f: 900, q: 2 });
      tone({ f: 160, f2: 90, dur: 0.08, g: 0.2 });
    },
    growl: () => {
      const f = 65 + Math.random() * 45;
      tone({ f, f2: f * 0.7, type: "sawtooth", dur: 0.55, g: 0.18 });
      tone({ f: f * 1.5, f2: f, type: "sawtooth", dur: 0.5, g: 0.1, at: 0.05 });
      noise({ dur: 0.5, g: 0.08, f: 350 });
    },
    eat: () => {
      for (let i = 0; i < 3; i++)
        noise({
          dur: 0.06,
          g: 0.2,
          type: "bandpass",
          f: 600 + i * 200,
          q: 2,
          at: i * 0.12,
        });
    },
    bandage: () => {
      noise({ dur: 0.14, g: 0.12, type: "highpass", f: 1500 });
      noise({ dur: 0.14, g: 0.1, type: "highpass", f: 1800, at: 0.16 });
    },
    craft: () => {
      tone({ f: 210, type: "square", dur: 0.04, g: 0.2 });
      noise({ dur: 0.06, g: 0.25, f: 500 });
      tone({ f: 180, type: "square", dur: 0.04, g: 0.18, at: 0.14 });
      noise({ dur: 0.06, g: 0.22, f: 450, at: 0.14 });
    },
    glass: () => {
      noise({ dur: 0.3, g: 0.4, type: "highpass", f: 3200 });
      for (let i = 0; i < 4; i++)
        tone({
          f: 2400 + Math.random() * 2600,
          dur: 0.08,
          g: 0.08,
          at: 0.03 + i * 0.05,
        });
    },
    door: () => {
      tone({ f: 120, f2: 80, dur: 0.09, g: 0.2 });
      noise({ dur: 0.1, g: 0.15, f: 300 });
    },
    refuel: () => {
      for (let i = 0; i < 3; i++)
        noise({ dur: 0.1, g: 0.15, f: 500 + i * 120, at: i * 0.14 });
    },
    torch: () =>
      noise({ dur: 0.25, g: 0.2, type: "highpass", f: 900, f2: 2400 }),
    levelup: () => {
      tone({ f: 600, dur: 0.1, g: 0.16 });
      tone({ f: 800, dur: 0.1, g: 0.16, at: 0.09 });
      tone({ f: 1050, dur: 0.16, g: 0.16, at: 0.18 });
    },
    quest: () => {
      tone({ f: 520, dur: 0.12, g: 0.18 });
      tone({ f: 700, dur: 0.12, g: 0.18, at: 0.11 });
      tone({ f: 920, dur: 0.22, g: 0.18, at: 0.22 });
    },
    death: () => {
      tone({ f: 85, f2: 28, type: "sawtooth", dur: 1.6, g: 0.4 });
      noise({ dur: 1.4, g: 0.2, f: 200, f2: 60 });
    },
    respawn: () => tone({ f: 300, f2: 620, dur: 0.4, g: 0.2 }),
    raid: () => {
      tone({ f: 150, type: "sawtooth", dur: 0.5, g: 0.3 });
      tone({ f: 110, type: "sawtooth", dur: 0.6, g: 0.3, at: 0.45 });
    },
    boss: () => {
      tone({ f: 55, f2: 33, type: "sawtooth", dur: 1.2, g: 0.45 });
      noise({ dur: 1.0, g: 0.25, f: 260, f2: 90 });
    },
    carHit: () => {
      noise({ dur: 0.2, g: 0.5, f: 260 });
      tone({ f: 95, f2: 50, type: "square", dur: 0.15, g: 0.3 });
    },
    knock: () => {
      noise({ dur: 0.16, g: 0.35, f: 600, f2: 200 });
      tone({ f: 150, f2: 80, dur: 0.1, g: 0.2 });
    },
  };

  // непрерывный звук двигателя: пила + фильтр, высота от скорости
  function engineStart() {
    if (!ctx || engine) return;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 42;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter).connect(gain).connect(sfxBus);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.1, now() + 0.2);
    engine = { osc, gain, filter };
  }
  function engineStop() {
    if (!engine) return;
    const e = engine;
    engine = null;
    e.gain.gain.exponentialRampToValueAtTime(0.0001, now() + 0.25);
    e.osc.stop(now() + 0.35);
  }
  function engineUpdate(speed01) {
    if (!engine) return;
    const s = Math.min(1, Math.max(0, speed01));
    engine.osc.frequency.setTargetAtTime(42 + s * 95, now(), 0.08);
    engine.filter.frequency.setTargetAtTime(320 + s * 620, now(), 0.08);
    engine.gain.gain.setTargetAtTime(0.09 + s * 0.09, now(), 0.1);
  }

  // эмбиент: день — ветер; ночь — ветер + низкий дрон + «сверчки» (LFO-шум).
  // Без таймеров: всё крутится осцилляторами, кроссфейд при смене.
  function ambience(kind) {
    if (!ctx) return;
    if (amb && amb.kind === kind) return;
    if (amb) {
      const old = amb;
      old.gain.gain.setTargetAtTime(0.0001, now(), 0.6);
      old.nodes.forEach((n) => {
        try {
          n.stop(now() + 2.5);
        } catch {}
      });
    }
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(ambBus);
    const nodes = [];
    // ветер: шум через низкий фильтр с медленным LFO громкости
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = kind === "night" ? 260 : 420;
    const wg = ctx.createGain();
    wg.gain.value = kind === "night" ? 0.05 : 0.07;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG).connect(wg.gain);
    wind.connect(wf).connect(wg).connect(gain);
    wind.start();
    lfo.start();
    nodes.push(wind, lfo);
    if (kind === "night") {
      const drone = ctx.createOscillator();
      drone.type = "sine";
      drone.frequency.value = 55;
      const dg = ctx.createGain();
      dg.gain.value = 0.05;
      drone.connect(dg).connect(gain);
      drone.start();
      nodes.push(drone);
      // сверчки: узкополосный шум ~4.2 кГц, пульс 9 Гц
      const cr = ctx.createBufferSource();
      cr.buffer = noiseBuf;
      cr.loop = true;
      const cf = ctx.createBiquadFilter();
      cf.type = "bandpass";
      cf.frequency.value = 4200;
      cf.Q.value = 12;
      const cg = ctx.createGain();
      cg.gain.value = 0.012;
      const pulse = ctx.createOscillator();
      pulse.frequency.value = 9;
      const pg = ctx.createGain();
      pg.gain.value = 0.012;
      pulse.connect(pg).connect(cg.gain);
      cr.connect(cf).connect(cg).connect(gain);
      cr.start();
      pulse.start();
      nodes.push(cr, pulse);
    }
    gain.gain.setTargetAtTime(1, now(), 0.8);
    amb = { nodes, gain, kind };
  }

  return {
    volumes,
    get ready() {
      return !!ctx;
    },
    get state() {
      return ctx ? ctx.state : "none";
    },
    unlock() {
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    setVolumes(v) {
      Object.assign(volumes, v);
      if (!ctx) return;
      master.gain.setTargetAtTime(volumes.master, now(), 0.05);
      sfxBus.gain.setTargetAtTime(volumes.sfx, now(), 0.05);
      ambBus.gain.setTargetAtTime(volumes.amb, now(), 0.05);
    },
    play(name) {
      if (!ctx || ctx.state !== "running") return;
      SFX[name]?.();
    },
    engineStart,
    engineStop,
    engineUpdate,
    ambience,
    stopAll() {
      engineStop();
      if (amb) {
        amb.nodes.forEach((n) => {
          try {
            n.stop();
          } catch {}
        });
        amb = null;
      }
    },
  };
}
