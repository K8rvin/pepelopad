import { describe, expect, it } from "vitest";
import {
  createCity,
  buildSolidIndex,
  solidRectAt,
} from "../src/iso/world/cityGen.js";
import { initVehicles, updateVehicle } from "../src/iso/systems/vehicles.js";
import { createLoot, nearestContainer } from "../src/iso/systems/loot.js";
import { createCombat } from "../src/iso/systems/combat.js";

function emptyCity() {
  const city = createCity(1, 1);
  city.buildings.length = 0;
  city.buildingGrid = new Map();
  city.cars.length = 0;
  city.zombies.length = 0;
  city.trees.length = 0;
  city.lamps.length = 0;
  city.fences.length = 0;
  city.containers.length = 0;
  city.barrels.length = 0;
  city.benches.length = 0;
  city.tires.length = 0;
  buildSolidIndex(city);
  return city;
}

const drive = (city, car, frames, combat) => {
  for (let i = 0; i < frames; i++)
    updateVehicle(city, car, { KeyW: true }, { x: 0, y: 0 }, combat, 1 / 60);
};

describe("машина сносит мелкие объекты", () => {
  it("столб сбивается на скорости, машина проезжает, свет гаснет", () => {
    const city = emptyCity();
    city.lamps.push({ x: 50, y: 40 });
    city.cars.push({ x: 44, y: 39.6, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    const combat = createCombat();
    drive(city, car, 300, combat);
    expect(city.lamps[0].dead).toBe(true);
    expect(car.x).toBeGreaterThan(50); // проехала сквозь снесённый столб
    expect(solidRectAt(city, 50, 40, 0.3)).toBe(false);
    expect(combat.debris.length).toBeGreaterThan(0);
  });

  it("контейнер сбивается и больше не обыскивается", () => {
    const city = emptyCity();
    city.containers.push({ x: 50, y: 40 });
    city.cars.push({ x: 44, y: 39.6, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const loot = createLoot(city);
    const car = city.cars[0];
    car.fuel = 40;
    drive(city, car, 300, createCombat());
    expect(city.containers[0].dead).toBe(true);
    expect(nearestContainer(loot, 50, 40, 2)).toBeNull();
  });

  it("на малой скорости столб не сносится (машина стопорится)", () => {
    const city = emptyCity();
    city.lamps.push({ x: 50, y: 40 });
    city.cars.push({ x: 46, y: 39.6, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    car.v = 2; // ниже порога сноса 2.5 м/с
    updateVehicle(
      city,
      car,
      { KeyW: true },
      { x: 0, y: 0 },
      createCombat(),
      1 / 60,
    );
    expect(city.lamps[0].dead).toBeFalsy(); // не снесён
    expect(car.v).toBeLessThanOrEqual(0); // отскок/стоп
  });

  it("дерево не сбивается даже на скорости", () => {
    const city = emptyCity();
    city.trees.push({ x: 50, y: 40.4, dead: false, v: 0 }); // на осевой линии машины
    city.cars.push({ x: 44, y: 39.5, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    drive(city, car, 300, createCombat());
    expect(city.trees[0].dead).toBe(false);
    expect(car.x).toBeLessThan(50);
  });
});
