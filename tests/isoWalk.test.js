import { describe, expect, it } from "vitest";
import { createCity, buildSolidIndex } from "../src/iso/world/cityGen.js";
import { solidRectAt } from "../src/iso/world/cityGen.js";
import {
  updatePlayer,
  updateZombies,
  spawnZombie,
  initActors,
  alertZombie,
  STRIDE,
} from "../src/iso/systems/actors.js";

function openCity() {
  const city = createCity(11, 3);
  buildSolidIndex(city);
  return city;
}

function openSpot(city) {
  // экранное D = мировое (+x,−y)/√2; путь до 5,6 м (секунда бега) свободен
  const ux = Math.SQRT1_2,
    uy = -Math.SQRT1_2;
  for (let y = 20; y < city.SIZE - 20; y += 7)
    for (let x = 20; x < city.SIZE - 20; x += 7) {
      let ok = true;
      for (let d = 0; d <= 5.6; d += 0.4)
        if (solidRectAt(city, x + ux * d, y + uy * d, 0.4)) {
          ok = false;
          break;
        }
      if (ok) return { x, y };
    }
  throw new Error("нет свободной точки");
}

describe("походка от дистанции", () => {
  it("фаза шага растёт от пройденного пути, бег чаще ходьбы", () => {
    const city = openCity();
    const spot = openSpot(city);
    const walk = { ...spot, r: 0.35, level: 0 };
    const run = { ...spot, r: 0.35, level: 0 };
    for (let i = 0; i < 60; i++) {
      updatePlayer(city, walk, { KeyD: true }, 1 / 60);
      updatePlayer(city, run, { KeyD: true, ShiftLeft: true }, 1 / 60);
    }
    const expectWalk = ((3.2 * 1) / STRIDE) * Math.PI * 2;
    expect(walk.walkPh).toBeGreaterThan(expectWalk * 0.8);
    expect(walk.walkPh).toBeLessThan(expectWalk * 1.05);
    expect(run.walkPh / walk.walkPh).toBeGreaterThan(1.5);
    expect(run.walkPh / walk.walkPh).toBeLessThan(1.85);
  });

  it("стояние и упор в стену не анимируют походку", () => {
    const city = openCity();
    const spot = openSpot(city);
    const p = { ...spot, r: 0.35, level: 0 };
    updatePlayer(city, p, {}, 1 / 60);
    expect(p.moving).toBe(false);
    expect(p.walkPh || 0).toBe(0);
    // лицом к западной стене здания: шаг вперёд заблокирован
    const b = city.buildings[0];
    const wall = { x: b.x - 0.45, y: b.y + b.h / 2, r: 0.35, level: 0 };
    for (let i = 0; i < 30; i++)
      updatePlayer(city, wall, { KeyD: true }, 1 / 60);
    expect(wall.moving).toBe(false);
    expect(wall.walkPh || 0).toBe(0);
  });

  it("зомби накапливает фазу только когда реально идёт", () => {
    initActors(5);
    const city = openCity();
    const spot = openSpot(city);
    const player = { ...spot, r: 0.35, level: 0 };
    // зомби на проверенном свободном луче: идёт обратно к игроку по нему же
    const z = spawnZombie(
      city,
      spot.x + Math.SQRT1_2 * 6,
      spot.y - Math.SQRT1_2 * 6,
      "walker",
    );
    const ph0 = z.walkPh;
    alertZombie(z, player.x, player.y, 60);
    for (let i = 0; i < 30; i++)
      updateZombies(city, city.zombies, player, 1 / 60, 1);
    expect(z.moving).toBe(true);
    expect(z.walkPh).not.toBe(ph0);
  });
});
