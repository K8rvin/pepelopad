import { describe, expect, it } from "vitest";
import { circleHit, getSolid, moveBody } from "../src/systems/collision.js";

const makeContext = () => ({
  structures: new Map(),
  containers: new Map(),
  solidTiles: new Set([6]),
  tileAt: () => 0,
  carsNear: () => [],
});

describe("столкновения", () => {
  it("определяет постройки, контейнеры и непроходимые тайлы", () => {
    const context = makeContext();
    const structure = { t: "fence" };
    const container = { type: "crate" };
    context.structures.set("1,0", structure);
    context.containers.set("2,0", container);
    context.tileAt = (x) => (x === 3 ? 6 : 0);
    expect(getSolid(1, 0, context).kind).toBe("struct");
    expect(getSolid(2, 0, context).kind).toBe("cont");
    expect(getSolid(3, 0, context).kind).toBe("tile");
    expect(getSolid(4, 0, context)).toBeNull();
  });

  it("пропускает открытые ворота", () => {
    const context = makeContext();
    context.structures.set("0,0", { t: "gate", open: true });
    expect(getSolid(0, 0, context)).toBeNull();
  });

  it("исключает собственный автомобиль, но не чужой", () => {
    const context = makeContext();
    const car = { id: "own", x: 8, y: 8, dead: false };
    context.carsNear = () => [car];
    expect(getSolid(0, 0, context, "own")).toBeNull();
    expect(getSolid(0, 0, context, "other").kind).toBe("car");
  });

  it("двигает по свободным осям и сообщает о блокировке", () => {
    const context = makeContext();
    context.tileAt = (x) => (x === 1 ? 6 : 0);
    const body = { x: 8, y: 8, r: 5 };
    const result = moveBody(body, 16, 8, context);
    expect(result.bx).toBe(true);
    expect(result.by).toBe(false);
    expect(body).toEqual({ x: 8, y: 16, r: 5 });
    expect(circleHit(20, 8, 5, context).kind).toBe("tile");
  });
});
