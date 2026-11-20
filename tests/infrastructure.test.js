import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("инфраструктура проекта", () => {
  it("не изменяет архивный эталон старой версии", () => {
    const hash = createHash("sha256")
      .update(read("Архив/index_v4.html"))
      .digest("hex");
    expect(hash).toBe(
      "52f76c8cd8303dfb407f626efd6385f637a17fcadbb6d7c4638ae602ba3951f6",
    );
  });

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
