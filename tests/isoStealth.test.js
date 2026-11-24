import { describe, expect, it } from "vitest";
import { hasLineOfSight, noiseProfile } from "../src/iso/systems/stealth.js";
import {
  spawnZombie,
  updatePlayer,
  updateZombies,
} from "../src/iso/systems/actors.js";
import { buildBuildingGrid } from "../src/iso/world/interiors.js";

function openCity() {
  return {
    SIZE: 200,
    zombies: [],
    buildings: [],
    buildingGrid: new Map(),
    solidGrid: new Map(),
    brokenWindows: new Map(),
    storyLocks: [],
    storyObjects: [],
  };
}

function player(x, y) {
  return {
    x,
    y,
    r: 0.35,
    level: 0,
    moving: false,
    sprinting: false,
    crouched: false,
    stamina: 100,
  };
}

function cityWithWall() {
  const city = openCity();
  const b = { id: 1, x: 40, y: 40, w: 10, h: 10, floors: 1, doorU: 5 };
  city.buildings.push(b);
  buildBuildingGrid(city);
  return city;
}

describe("профиль шума и движение", () => {
  it("присед, шаг и спринт имеют разные радиусы и заметность", () => {
    expect(noiseProfile(player(0, 0))).toMatchObject({
      noiseRadius: 1.5,
      visionK: 1,
    });
    expect(noiseProfile({ ...player(0, 0), crouched: true })).toMatchObject({
      noiseRadius: 0.8,
      visionK: 0.6,
    });
    expect(
      noiseProfile({ ...player(0, 0), crouched: true, moving: true }),
    ).toMatchObject({ noiseRadius: 2, visionK: 0.6 });
    expect(
      noiseProfile({ ...player(0, 0), moving: true, sprinting: true }),
    ).toMatchObject({ noiseRadius: 9, visionK: 1.25 });
  });

  it("присед замедляет и запрещает спринт", () => {
    const city = openCity();
    const p = player(50, 50);
    updatePlayer(city, p, { KeyW: true }, 0.5);
    const normalDistance = Math.hypot(p.x - 50, p.y - 50);
    expect(normalDistance).toBeCloseTo(1.6, 5);

    const crouched = player(50, 50);
    crouched.crouched = true;
    crouched.stamina = 50;
    updatePlayer(city, crouched, { KeyW: true, ShiftLeft: true }, 0.5);
    expect(Math.hypot(crouched.x - 50, crouched.y - 50)).toBeCloseTo(0.88, 5);
    expect(crouched.sprinting).toBe(false);
    expect(crouched.stamina).toBeGreaterThan(50);
  });
});

describe("прямая видимость", () => {
  it("стена блокирует LOS, дверной проём пропускает, этажи разделены", () => {
    const city = cityWithWall();
    const outside = player(35, 45);
    const inside = player(45, 45);
    expect(hasLineOfSight(city, outside, inside)).toBe(false);
    expect(hasLineOfSight(city, inside, player(45, 55))).toBe(true);
    expect(hasLineOfSight(city, inside, { ...player(45, 55), level: 1 })).toBe(
      false,
    );
  });
});

describe("обнаружение зомби", () => {
  it("не замечает игрока через стену, но видит внутри помещения", () => {
    const city = cityWithWall();
    const p = player(38, 45);
    p.crouched = true;
    const z = spawnZombie(city, 42, 45);
    updateZombies(city, city.zombies, p, 0.1);
    expect(z.alertT).toBeLessThanOrEqual(0);

    p.x = 41;
    updateZombies(city, city.zombies, p, 0.1);
    expect(z.alertT).toBeGreaterThan(0);
  });

  it("присед уменьшает радиус зрения, спринт слышен издалека", () => {
    const city = openCity();
    const p = player(50, 50);
    p.crouched = true;
    const z = spawnZombie(city, 55, 50);
    updateZombies(city, city.zombies, p, 0.1);
    expect(z.alertT).toBeLessThanOrEqual(0);

    p.crouched = false;
    z.alertT = 0;
    updateZombies(city, city.zombies, p, 0.1);
    expect(z.alertT).toBeGreaterThan(0);

    const far = spawnZombie(city, 58, 50);
    p.moving = true;
    p.sprinting = true;
    z.alertT = 0;
    updateZombies(city, city.zombies, p, 0.1);
    expect(far.alertT).toBeGreaterThan(0);
  });

  it("сработавшая тревога не исчезает мгновенно за укрытием", () => {
    const city = cityWithWall();
    const p = player(38, 45);
    p.crouched = true;
    const z = spawnZombie(city, 42, 45);
    z.alertT = 2;
    z.tx = 41;
    z.ty = 45;
    updateZombies(city, city.zombies, p, 0.1);
    expect(z.alertT).toBeGreaterThan(0);
    expect(z.alertT).toBeLessThan(2);
    expect(z.tx).toBe(41);
  });
});
