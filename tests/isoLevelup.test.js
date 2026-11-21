import { describe, expect, it } from "vitest";
import {
  createLevelUp,
  pushLevelUp,
  updateLevelUp,
} from "../src/iso/ui/levelup.js";

const ev = { kind: "skill", id: "archery", level: 1 };

describe("празднование повышения уровня", () => {
  it("первое повышение запускает баннер и рождает искры у игрока", () => {
    const L = createLevelUp();
    pushLevelUp(L, ev, 10, 20);
    const started = updateLevelUp(L, 1 / 60);
    expect(started).toMatchObject(ev);
    expect(L.active).toBeTruthy();
    expect(L.sparks.length).toBe(26);
    // искры рождаются у игрока и уже сместились на первом кадре
    expect(L.sparks[0].x).toBeCloseTo(10, 1);
    expect(L.sparks[0].y).toBeCloseTo(20, 1);
  });

  it("очередь показывается последовательно, один баннер за раз", () => {
    const L = createLevelUp();
    pushLevelUp(L, ev, 0, 0);
    pushLevelUp(L, { kind: "attr", id: "agility", level: 3 }, 0, 0);
    updateLevelUp(L, 0.01);
    expect(L.active.id).toBe("archery");
    let second = null;
    for (let i = 0; i < 300 && !second; i++) second = updateLevelUp(L, 1 / 60);
    expect(second?.id).toBe("agility");
    expect(L.queue.length).toBe(0);
  });

  it("без событий баннера и искр нет", () => {
    const L = createLevelUp();
    expect(updateLevelUp(L, 1 / 60)).toBeNull();
    expect(L.active).toBeNull();
    expect(L.sparks.length).toBe(0);
  });

  it("искры детерминированы по событию и гаснут со временем", () => {
    const a = createLevelUp(),
      b = createLevelUp();
    pushLevelUp(a, ev, 5, 5);
    pushLevelUp(b, ev, 5, 5);
    updateLevelUp(a, 0.01);
    updateLevelUp(b, 0.01);
    expect(a.sparks).toEqual(b.sparks);
    for (let i = 0; i < 200; i++) updateLevelUp(a, 1 / 60);
    expect(a.sparks.length).toBe(0);
  });
});
