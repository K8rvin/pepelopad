import { describe, it, expect } from "vitest";
import { createLoading } from "../src/iso/ui/loading.js";

function els() {
  return {
    root: {
      removed: false,
      remove() {
        this.removed = true;
      },
    },
    sub: { textContent: "Загрузка модулей…" },
    fill: { style: { width: "0%" } },
    pct: { textContent: "0%" },
  };
}

describe("полоска загрузки", () => {
  it("set обновляет полосу, проценты и пояснение этапа", () => {
    const e = els();
    const l = createLoading(e);
    l.set(0.42, "Загрузка текстур и спрайтов…");
    expect(e.fill.style.width).toBe("42%");
    expect(e.pct.textContent).toBe("42%");
    expect(e.sub.textContent).toBe("Загрузка текстур и спрайтов…");
  });
  it("кламп 0..1 и округление до целых процентов", () => {
    const e = els();
    const l = createLoading(e);
    l.set(-0.5);
    expect(e.fill.style.width).toBe("0%");
    l.set(1.7);
    expect(e.fill.style.width).toBe("100%");
    l.set(0.333);
    expect(e.pct.textContent).toBe("33%");
  });
  it("без label пояснение не затирается", () => {
    const e = els();
    const l = createLoading(e);
    l.set(0.1, "Генерация города…");
    l.set(0.2);
    expect(e.sub.textContent).toBe("Генерация города…");
  });
  it("done удаляет оверлей", () => {
    const e = els();
    createLoading(e).done();
    expect(e.root.removed).toBe(true);
  });
  it("отсутствующие элементы — no-op, не падает", () => {
    const l = createLoading();
    expect(() => {
      l.set(0.5, "Этап");
      l.done();
    }).not.toThrow();
  });
});
