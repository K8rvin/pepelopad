import { describe, expect, it } from "vitest";
import { createCity, buildSolidIndex } from "../src/iso/world/cityGen.js";
import { buildingAtPoint, getInterior } from "../src/iso/world/interiors.js";
import {
  spawnZombie,
  updateZombies,
  initActors,
  alertZombie,
} from "../src/iso/systems/actors.js";
import { createCombat, updateCombat } from "../src/iso/systems/combat.js";

function cityWithHouse() {
  const city = createCity(11, 3);
  buildSolidIndex(city);
  return city;
}

describe("зомби внутри зданий", () => {
  it("зомби снаружи заходит через дверь к игроку внутри", () => {
    initActors(5);
    const city = cityWithHouse();
    const b = city.buildings[0];
    const it = getInterior(city, b);
    const player = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: 0.35, level: 0 };
    const z = spawnZombie(city, b.x + it.doorU, b.y + b.h + 3, "walker");
    alertZombie(z, player.x, player.y, 60); // услышал игрока внутри
    for (let i = 0; i < 900; i++)
      updateZombies(city, city.zombies, player, 1 / 60, 1);
    expect(buildingAtPoint(city, z.x, z.y)).toBe(b);
  });

  it("зомби поднимается по лестнице за игроком на этаж", () => {
    initActors(5);
    const city = cityWithHouse();
    const b = city.buildings[0];
    b.floors = 2; // до первого getInterior
    const it = getInterior(city, b);
    expect(it.stairs).toBeTruthy();
    const sx = b.x + it.stairs.x + it.stairs.w / 2,
      sy = b.y + it.stairs.y + it.stairs.h / 2;
    const player = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: 0.35, level: 1 };
    const z = spawnZombie(city, sx, sy, "walker");
    z.level = 0;
    updateZombies(city, city.zombies, player, 1 / 60, 1);
    expect(z.level).toBe(1);
  });

  it("зомби другого этажа не кусает игрока", () => {
    const city = cityWithHouse();
    const player = { x: 50, y: 50, r: 0.35, level: 1 };
    const z = spawnZombie(city, 50.3, 50, "walker");
    z.level = 0;
    z.attackCd = 0;
    const C = createCombat();
    updateCombat(C, city, player, { x: 0, y: 0 }, 0.05, 0, false);
    expect(C.playerHp).toBe(100);
  });
});
