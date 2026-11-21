import { describe, expect, it } from "vitest";
import { createCity, buildSolidIndex } from "../src/iso/world/cityGen.js";
import { getInterior } from "../src/iso/world/interiors.js";
import { spawnZombie, initActors } from "../src/iso/systems/actors.js";
import {
  createCombat,
  initCombat,
  updateCombat,
  releaseBow,
} from "../src/iso/systems/combat.js";
import { createInventory, addItem } from "../src/iso/systems/inventory.js";

// широкое здание с коридорным интерьером: коридор горизонтальный, чистый
function cityWithWideBuilding() {
  const city = createCity(11, 3);
  buildSolidIndex(city);
  const b = city.buildings.find((b) => b.w >= b.h && b.w >= 10);
  b.floors = 2; // до первого getInterior — коридорный генератор
  const it = getInterior(city, b);
  return { city, b, it };
}

function armedPlayer(x, y) {
  const inv = createInventory();
  addItem(inv, "arrow", 5);
  const C = createCombat();
  initCombat(5);
  C.bowDrawing = true;
  C.bowCharge = 1;
  return { C, inv, player: { x, y, r: 0.35, level: 0 } };
}

function shoot(C, inv, player, aim, city, frames = 30) {
  const fired = releaseBow(C, player, aim, inv, city);
  for (let i = 0; i < frames; i++)
    updateCombat(C, city, player, aim, 1 / 60, i / 60, false);
  return fired;
}

describe("стрельба внутри зданий", () => {
  it("стрела попадает в зомби в том же здании (коридор)", () => {
    initActors(5);
    const { city, b, it } = cityWithWideBuilding();
    const cy = b.y + (it.corrA + it.corrB) / 2;
    const { C, inv, player } = armedPlayer(b.x + 2, cy);
    const z = spawnZombie(city, b.x + 6, cy, "walker");
    const fired = shoot(C, inv, player, { x: b.x + 8, y: cy }, city);
    expect(fired).toBe(true);
    expect(z.hp).toBeLessThan(70);
  });

  it("стрела не проходит сквозь внутреннюю перегородку", () => {
    initActors(5);
    const { city, b, it } = cityWithWideBuilding();
    const room = it.rooms.find((r) => r.y1 === 0 && r.x2 - r.x1 >= 6);
    const cy = b.y + (it.corrA + it.corrB) / 2;
    // стрелок у западного края комнаты, зомби в её центре — линия режет стену
    const { C, inv, player } = armedPlayer(b.x + room.x1 + 0.8, cy);
    const zx = b.x + (room.x1 + room.x2) / 2,
      zy = b.y + it.corrA / 2;
    const z = spawnZombie(city, zx, zy, "walker");
    shoot(C, inv, player, { x: zx, y: zy }, city);
    expect(z.hp).toBe(70);
    expect(C.arrows.length).toBe(0);
  });

  it("стрела с улицы входит через дверной проём и бьёт зомби у входа", () => {
    initActors(5);
    const { city, b, it } = cityWithWideBuilding();
    const dx = b.x + it.doorU;
    const { C, inv, player } = armedPlayer(dx, b.y + b.h + 3);
    const z = spawnZombie(city, dx, b.y + b.h - 0.2, "walker");
    shoot(C, inv, player, { x: dx, y: b.y + b.h - 1 }, city);
    expect(z.hp).toBeLessThan(70);
  });

  it("стрела с улицы не проходит сквозь глухую стену", () => {
    initActors(5);
    const { city, b } = cityWithWideBuilding();
    const sx = b.x + 1.5; // вдали от дверного проёма
    const { C, inv, player } = armedPlayer(sx, b.y + b.h + 3);
    // глубже силуэта (±0,5 м): стрела должна умереть на стене, а не достать
    const z = spawnZombie(city, sx, b.y + b.h - 1.5, "walker");
    shoot(C, inv, player, { x: sx, y: b.y + b.h - 2 }, city);
    expect(z.hp).toBe(70);
    expect(C.arrows.length).toBe(0);
  });
});
