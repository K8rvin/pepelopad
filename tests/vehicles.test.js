import { describe, expect, it } from "vitest";
import {
  advanceVehicle,
  consumeVehicleFuel,
  damageVehicle,
  normalizeVehicle,
  vehicleDefinition,
} from "../src/systems/vehicles.js";

const car = () => ({ speed: 0, angle: 0, fuel: 50, broken: false });
const controls = {
  active: true,
  accel: 1,
  steer: 0,
  boost: false,
  handbrake: false,
};

describe("физика автомобиля", () => {
  it("разгоняется и движется при наличии топлива", () => {
    const c = car();
    const movement = advanceVehicle(c, controls, 0.1);
    expect(c.speed).toBeGreaterThan(0);
    expect(movement.dx).toBeGreaterThan(0);
    expect(movement.dy).toBe(0);
  });

  it("не разгоняется с пустым баком или поломкой", () => {
    const empty = car();
    empty.fuel = 0;
    const broken = car();
    broken.broken = true;
    expect(advanceVehicle(empty, controls, 0.1).dx).toBe(0);
    expect(advanceVehicle(broken, controls, 0.1).dx).toBe(0);
  });

  it("поворачивает только при достаточной скорости", () => {
    const c = car();
    c.speed = 2;
    advanceVehicle(c, { ...controls, accel: 0, steer: 1 }, 0.1);
    expect(c.angle).toBe(0);
    c.speed = 80;
    advanceVehicle(c, { ...controls, accel: 0, steer: 1 }, 0.1);
    expect(c.angle).toBeGreaterThan(0);
  });

  it("ограничивает скорость и расходует топливо", () => {
    const c = car();
    advanceVehicle(c, { ...controls, boost: true }, 10);
    expect(c.speed).toBeLessThanOrEqual(155 * 1.22);
    consumeVehicleFuel(c, 1);
    expect(c.fuel).toBeLessThan(50);
    c.fuel = 0;
    consumeVehicleFuel(c, 1);
    expect(c.fuel).toBe(0);
  });

  it("замедляется без водителя", () => {
    const c = car();
    c.speed = 100;
    advanceVehicle(c, { ...controls, active: false }, 0.1);
    expect(c.speed).toBeLessThan(100);
  });

  it("различает вместимость, скорость и экономичность классов", () => {
    expect(vehicleDefinition("truck").trunkSlots).toBeGreaterThan(
      vehicleDefinition("sedan").trunkSlots,
    );
    expect(vehicleDefinition("police").maxSpeed).toBeGreaterThan(
      vehicleDefinition("truck").maxSpeed,
    );
    expect(vehicleDefinition("taxi").fuelUse).toBeLessThan(
      vehicleDefinition("sedan").fuelUse,
    );
  });

  it("нормализует автомобиль из старого сохранения", () => {
    const c = normalizeVehicle({
      type: "truck",
      hp: 80,
      fuel: 30,
      broken: true,
    });
    expect(c.maxHp).toBe(220);
    expect(c.maxFuel).toBe(160);
    expect(c.engineHp).toBe(0);
    expect(c.tireHp).toBe(100);
    expect(c.broken).toBe(true);
  });

  it("повреждает двигатель и колёса при столкновении", () => {
    const c = { ...car(), type: "sedan", hp: 100 };
    damageVehicle(c, 40, true);
    expect(c.hp).toBe(60);
    expect(c.engineHp).toBe(68);
    expect(c.tireHp).toBe(56);
    c.speed = 80;
    advanceVehicle(c, { ...controls, accel: 0, steer: 1 }, 0.1);
    expect(c.angle).toBeLessThan(0.19);
    expect(c.angle).toBeGreaterThan(0);
  });

  it("останавливает двигатель и уничтожает кузов независимо", () => {
    const engine = { ...car(), hp: 100, engineHp: 10 };
    damageVehicle(engine, 13, true);
    expect(engine.dead).toBe(false);
    expect(engine.broken).toBe(true);
    expect(advanceVehicle(engine, controls, 0.1).dx).toBe(0);
    damageVehicle(engine, 200);
    expect(engine.dead).toBe(true);
    expect(engine.speed).toBe(0);
  });
});
