import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("OSM-конвейер", () => {
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
  });
});
