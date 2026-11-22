// Настройки игрока: хранятся отдельно от сейва — переживают «Новую игру».
// Владелец данных — этот модуль; localStorage передаётся явно (без глобалов).
const KEY = "mertvyj_settings";

export const DEFAULT_SETTINGS = {
  master: 0.7,
  sfx: 0.9,
  amb: 0.5,
  debug: false,
};

// нормализация произвольного объекта: кламп громкостей 0..1, debug — boolean
export function mergeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === "object") {
    for (const k of ["master", "sfx", "amb"]) {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) s[k] = Math.min(1, Math.max(0, v));
    }
    s.debug = !!raw.debug;
  }
  return s;
}

export function loadSettings(storage) {
  try {
    return mergeSettings(JSON.parse(storage.getItem(KEY)));
  } catch {
    return mergeSettings(null);
  }
}

export function saveSettings(settings, storage) {
  storage.setItem(KEY, JSON.stringify(mergeSettings(settings)));
}
