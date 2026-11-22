import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  loadSettings,
  saveSettings,
} from "../src/iso/persistence/settings.js";

function mockStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe("настройки", () => {
  it("mergeSettings: дефолты из null/мусора", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("abc")).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });
  it("кламп громкостей 0..1, debug — boolean", () => {
    const s = mergeSettings({ master: 2, sfx: -1, amb: 0.4, debug: 1 });
    expect(s.master).toBe(1);
    expect(s.sfx).toBe(0);
    expect(s.amb).toBe(0.4);
    expect(s.debug).toBe(true);
  });
  it("не-числа игнорируются", () => {
    const s = mergeSettings({ master: "loud" });
    expect(s.master).toBe(DEFAULT_SETTINGS.master);
  });
  it("save/load roundtrip через storage", () => {
    const st = mockStorage();
    saveSettings({ master: 0.3, sfx: 0.5, amb: 0.2, debug: true }, st);
    const s = loadSettings(st);
    expect(s.master).toBeCloseTo(0.3);
    expect(s.debug).toBe(true);
  });
  it("loadSettings: битый JSON → дефолты", () => {
    const st = mockStorage();
    st.setItem("mertvyj_settings", "{broken");
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
  });
});
