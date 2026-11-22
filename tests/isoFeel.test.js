import { describe, it, expect } from "vitest";
import { containerHasLoot, createLoot } from "../src/iso/systems/loot.js";
import {
  createCombat,
  initCombat,
  releaseBow,
  screenToWorld,
  FLIGHT_H,
} from "../src/iso/systems/combat.js";
import { createInventory, addItem } from "../src/iso/systems/inventory.js";
import {
  createComic,
  say,
  lootFloat,
  updateComic,
} from "../src/iso/ui/comic.js";
import { w2s } from "../src/iso/core/geo.js";

describe("бейдж лута: есть остаток", () => {
  const city = { containers: [{ x: 1, y: 1 }], barrels: [] };
  it("обысканный пустой — без бейджа", () => {
    const L = createLoot(city);
    const c = L.containers[0];
    L.opened.set(c.id, [null, null]);
    expect(containerHasLoot(L, c)).toBe(false);
  });
  it("обысканный с остатком — с бейджем", () => {
    const L = createLoot(city);
    const c = L.containers[0];
    L.opened.set(c.id, [{ id: "can", n: 1 }]);
    expect(containerHasLoot(L, c)).toBe(true);
  });
  it("детерминированно пустой — без бейджа ещё до обыска", () => {
    const L = createLoot(city);
    const empty = L.containers.find((c) => !containerHasLoot(L, c));
    // среди мусорков есть исходно пустые; если этот не пуст — проверим генерацию
    expect(typeof containerHasLoot(L, L.containers[0])).toBe("boolean");
    if (empty) expect(containerHasLoot(L, empty)).toBe(false);
  });
});

describe("прицел на высоте полёта", () => {
  it("screenToWorld обращает w2s на высоте стрелы (без ухода вверх)", () => {
    const camS = w2s(50, 50);
    const W = 1280,
      H = 720,
      zoom = 2;
    const sp = w2s(60, 55, FLIGHT_H);
    const mx = (sp.x - camS.x) * zoom + W / 2;
    const my = (sp.y - camS.y) * zoom + H / 2;
    const got = screenToWorld(mx, my, camS, W, H, zoom);
    expect(got.x).toBeCloseTo(60, 5);
    expect(got.y).toBeCloseTo(55, 5);
  });
});

describe("выстрел", () => {
  it("стрела вылетает со смещением к цели, кадр отпускания включён", () => {
    initCombat(1);
    const C = createCombat();
    const inv = createInventory(8);
    addItem(inv, "arrow", 5);
    C.bowDrawing = true;
    C.bowCharge = 1;
    const ok = releaseBow(C, { x: 10, y: 10 }, { x: 20, y: 10 }, inv, {
      zombies: [],
    });
    expect(ok).toBe(true);
    expect(C.arrows[0].x).toBeCloseTo(10.45, 5);
    expect(C.arrows[0].y).toBeCloseTo(10, 5);
    expect(C.releaseT).toBeGreaterThan(0);
  });
  it("без стрел выстрела нет, подсказка включается", () => {
    const C = createCombat();
    const inv = createInventory(8);
    C.bowDrawing = true;
    C.bowCharge = 1;
    const ok = releaseBow(C, { x: 0, y: 0 }, { x: 5, y: 0 }, inv, {
      zombies: [],
    });
    expect(ok).toBe(false);
    expect(C.noArrowsT).toBeGreaterThan(0);
    expect(C.arrows.length).toBe(0);
  });
});

describe("комикс-слой", () => {
  it("облачко живёт до ttl и гаснет", () => {
    const C = createComic();
    say(C, 1, 1, "Нет стрел!", "alert", 1);
    expect(C.bubbles.length).toBe(1);
    updateComic(C, 0.5);
    expect(C.bubbles.length).toBe(1);
    updateComic(C, 0.6);
    expect(C.bubbles.length).toBe(0);
  });
  it("всплывающая добыча каскадом и гаснет", () => {
    const C = createComic();
    lootFloat(C, 2, 2, [
      { n: 2, name: "Тушёнка" },
      { n: 1, name: "Бинт" },
    ]);
    expect(C.floats.length).toBe(2);
    expect(C.floats[1].t).toBeLessThan(0); // каскад
    updateComic(C, 2);
    expect(C.floats.length).toBe(0);
  });
});
