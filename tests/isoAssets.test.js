import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPRITE_FILES } from "../src/iso/render/assets.js";

const GPT_KEYS = [
  "tree_dead",
  "tree_birch",
  "win_intact",
  "win_broken",
  "win_lit",
  "survivor",
  "survivor_bow_draw",
  "survivor_bow_release",
  "npc_oleg",
  "npc_vera",
  "npc_sanych",
  "npc_raya",
  "npc_masha",
  "furn_sink",
  "furn_stove",
  "furn_toilet",
  "furn_bathtub",
  "furn_bathroom_sink",
  "furn_nightstand",
  "furn_dresser",
  "furn_armchair",
  "furn_tv",
  "furn_bookcase",
];

const file = (path) => new URL(`../${path}`, import.meta.url);

describe("GPT-ассеты и ссылки загрузчика", () => {
  it("все отобранные ID имеют runtime RGBA PNG, исходник и метаданные", () => {
    for (const key of GPT_KEYS) {
      const runtime = SPRITE_FILES[key];
      expect(runtime, key).toBeTruthy();
      expect(runtime.startsWith("tmp/"), key).toBe(false);
      const png = readFileSync(file(`public/${runtime}`));
      expect(png.subarray(1, 4).toString("ascii"), key).toBe("PNG");
      expect(png[25], `${key}: color type`).toBe(6);
      const source = `assets-src/generated/gpt_${key}_v1.png`;
      expect(existsSync(file(source)), key).toBe(true);
      const metadata = JSON.parse(readFileSync(file(`${source}.json`), "utf8"));
      expect(metadata.id).toBe(key);
      expect(metadata.source).toBe("GPT");
      expect(metadata.prompt.length).toBeGreaterThan(20);
      expect(metadata.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(metadata.runtime).toBe(`public/${runtime}`);
      expect(metadata.runtimeSize).toEqual([
        png.readUInt32BE(16),
        png.readUInt32BE(20),
      ]);
    }
  });

  it("повторяемый обработчик и все пути загрузчика существуют", () => {
    expect(existsSync(file("scripts/process_gpt_assets.py"))).toBe(true);
    for (const [key, path] of Object.entries(SPRITE_FILES))
      expect(existsSync(file(`public/${path}`)), key).toBe(true);
  });
});
