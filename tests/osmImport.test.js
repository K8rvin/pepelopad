import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const hasPython = (() => {
  try {
    return (
      spawnSync("python", ["--version"], { encoding: "utf8" }).status === 0
    );
  } catch {
    return false;
  }
})();

// OSM-конвейер устаревает с переходом на сгенерированный город (этап 16);
// тест требует локальный Python — пропускаем там, где его нет.
describe.skipIf(!hasPython)("OSM-конвейер", () => {
  it("проверяет разбиение, XML, проекцию и объединение", () => {
    const result = spawnSync(
      "python",
      ["scripts/osm_import.py", "--self-test"],
      {
        encoding: "utf8",
      },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OSM import self-test: OK");
  }, 15000);
});
