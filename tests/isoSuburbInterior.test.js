import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  buildBuildingGrid,
  getInterior,
  solidInteriorAt,
} from "../src/iso/world/interiors.js";
import { suburbInterior } from "../src/iso/world/suburbInterior.js";

const GENERATED_KINDS = [
  "sink",
  "stove",
  "toilet",
  "bathtub",
  "bathroom_sink",
  "nightstand",
  "dresser",
  "armchair",
  "tv",
  "bookcase",
];

function reachableKeys(city, b, it) {
  const step = 0.25;
  const maxX = Math.floor(b.w / step) - 2;
  const maxY = Math.floor(b.h / step) - 2;
  const start = [Math.round(it.doorU / step), Math.round((b.h - 0.75) / step)];
  const key = (x, y) => `${x},${y}`;
  const queue = [start];
  const visited = new Set([key(...start)]);
  for (let head = 0; head < queue.length; head++) {
    const [ix, iy] = queue[head];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = ix + dx;
      const y = iy + dy;
      const k = key(x, y);
      if (x < 2 || y < 2 || x > maxX || y > maxY || visited.has(k)) continue;
      if (solidInteriorAt(city, b.x + x * step, b.y + y * step, 0.35)) continue;
      visited.add(k);
      queue.push([x, y]);
    }
  }
  return { visited, step, key };
}

describe("одноэтажные пригородные дома", () => {
  it("планировка детерминирована и содержит общую и приватную зоны", () => {
    const b = { id: 42, w: 11, h: 9, floors: 1, doorU: 5, style: "house" };
    const a = suburbInterior(b);
    expect(a).toEqual(suburbInterior(b));
    expect(new Set(a.rooms.map((room) => room.role))).toEqual(
      new Set([
        "master",
        "bedroom",
        "bathroom",
        "utility",
        "living",
        "kitchen",
        "hall",
      ]),
    );
    expect(a.stairs).toBeNull();
  });

  it("генератор использует все новые спрайты и упрощённые модели", () => {
    const city = createCity(11, 4);
    const kinds = new Set();
    for (const b of city.buildings) {
      if (b.style !== "house" && b.style !== "brick") continue;
      for (const item of getInterior(city, b).furniture) kinds.add(item.kind);
    }
    for (const kind of GENERATED_KINDS)
      expect(kinds.has(kind), kind).toBe(true);
    for (const kind of ["chair", "floor_lamp", "washer", "dryer"])
      expect(kinds.has(kind), kind).toBe(true);
  });

  it("мебель остаётся в границах и не пересекается, ID контейнеров уникальны", () => {
    const city = createCity(23, 4);
    const ids = new Set();
    for (const b of city.buildings) {
      if (b.style !== "house" && b.style !== "brick") continue;
      const it = getInterior(city, b);
      for (const item of it.furniture) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.x + item.w).toBeLessThanOrEqual(b.w);
        expect(item.y + item.h).toBeLessThanOrEqual(b.h);
      }
      for (let i = 0; i < it.furniture.length; i++)
        for (let j = i + 1; j < it.furniture.length; j++) {
          const a = it.furniture[i];
          const c = it.furniture[j];
          const hit = !(
            a.x + a.w <= c.x ||
            c.x + c.w <= a.x ||
            a.y + a.h <= c.y ||
            c.y + c.h <= a.y
          );
          expect(hit, `${b.id}: ${a.kind} / ${c.kind}`).toBe(false);
        }
      for (const container of it.containers) {
        expect(ids.has(container.id), container.id).toBe(false);
        ids.add(container.id);
      }
    }
  });

  it("от входа проходимы коридор и двери всех комнат с радиусом игрока", () => {
    const city = createCity(11, 4);
    const houses = city.buildings.filter(
      (b) => b.style === "house" || b.style === "brick",
    );
    for (const b of houses) {
      const isolated = {
        buildings: [b],
        brokenWindows: new Map(),
        buildingGrid: null,
      };
      buildBuildingGrid(isolated);
      const it = getInterior(isolated, b);
      const { visited, step, key } = reachableKeys(isolated, b, it);
      const hall = it.rooms.find((room) => room.role === "hall");
      const targets = [
        {
          id: "hall",
          x: (hall.x1 + hall.x2) / 2,
          y: hall.y1 + 0.7,
        },
      ];
      for (const room of it.rooms) {
        if (!room.doors?.length || room.role === "living") continue;
        const door = room.doors[0];
        targets.push({
          id: room.id,
          x:
            door.x +
            (room.side === "left" ? -0.55 : room.side === "right" ? 0.55 : 0),
          y: door.y + (room.role === "kitchen" ? -0.55 : 0),
        });
      }
      for (const target of targets) {
        const k = key(Math.round(target.x / step), Math.round(target.y / step));
        expect(visited.has(k), `дом ${b.id}, ${target.id}`).toBe(true);
      }
    }
  });
});
