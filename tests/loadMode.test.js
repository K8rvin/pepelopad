import { describe, expect, it } from "vitest";
import { resolveLoadMode } from "../src/persistence/loadMode.js";

describe("режим загрузки", () => {
  it("восстанавливает смерть", () => {
    expect(resolveLoadMode({ dead: true, Q: { main: 2 } }, 10)).toBe("dead");
  });

  it("восстанавливает экран финала", () => {
    expect(
      resolveLoadMode({ dead: false, Q: { main: 10, endless: false } }, 10),
    ).toBe("ending");
  });

  it("не показывает финал повторно в бесконечном режиме", () => {
    expect(
      resolveLoadMode({ dead: false, Q: { main: 10, endless: true } }, 10),
    ).toBe("play");
  });

  it("загружает обычную игру", () => {
    expect(resolveLoadMode({ dead: false, Q: { main: 3 } }, 10)).toBe("play");
  });
});
