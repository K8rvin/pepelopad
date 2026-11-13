import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("инфраструктура проекта", () => {
  it("не изменяет замороженный эталон index_v4.html", () => {
    const hash = createHash("sha256")
      .update(read("index_v4.html"))
      .digest("hex");
    expect(hash).toBe(
      "52f76c8cd8303dfb407f626efd6385f637a17fcadbb6d7c4638ae602ba3951f6",
    );
  });

  it("использует index.html и src/main.js как игровую точку входа", () => {
    const html = read("index.html");
    expect(html).toContain('<canvas id="cv">');
    expect(html).toContain('<script type="module" src="/src/main.js">');
  });

  it("компилирует точку входа и игровой модуль", () => {
    for (const file of ["src/main.js", "src/game.js"]) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    }
  });
});
