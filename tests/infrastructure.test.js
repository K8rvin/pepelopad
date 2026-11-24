import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("инфраструктура проекта", () => {
  it("использует index.html и src/iso/main.js как единственную точку входа", () => {
    const html = read("index.html");
    expect(html).toContain('<canvas id="cv">');
    expect(html).toContain('<script type="module" src="/src/iso/main.js">');
  });

  it("компилирует точку входа", () => {
    const result = spawnSync(process.execPath, ["--check", "src/iso/main.js"], {
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
