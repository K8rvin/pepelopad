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

  it("ограничивает скорость и расходует топливо по пройденной дистанции", () => {
    const c = car();
    advanceVehicle(c, { ...controls, boost: true }, 10);
    expect(c.speed).toBeLessThanOrEqual(400 * 1.22);
    expect(consumeVehicleFuel(c, 0)).toBe(0);
    expect(c.fuel).toBe(50);
    expect(consumeVehicleFuel(c, 160000)).toBeCloseTo(0.8);
    expect(c.fuel).toBeCloseTo(49.2);
    c.fuel = 0;
    consumeVehicleFuel(c, 160000);
    expect(c.fuel).toBe(0);
  });

  it("учитывает навык механика при расходе топлива", () => {
    const c = car();
    consumeVehicleFuel(c, 160000, 2);
    expect(c.fuel).toBeCloseTo(50 - 0.8 * 0.84);
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
    expect((vehicleDefinition("sedan").maxSpeed * 3.6) / 16).toBe(90);
    expect(vehicleDefinition("sedan").fuelUse * 100000 * 16).toBe(8);
  });

  it("использует топливо на мотоцикле и мышечную тягу без бака", () => {
    const motorcycle = { ...car(), type: "motorcycle", fuel: 0 };
    expect(advanceVehicle(motorcycle, controls, 0.1).dx).toBe(0);
    for (const type of ["bicycle", "scooter"]) {
      const humanPowered = {
        ...car(),
        type,
        fuel: 0,
        engineHp: 0,
        broken: true,
      };
      const movement = advanceVehicle(humanPowered, controls, 0.1);
      expect(movement.dx).toBeGreaterThan(0);
      const healthy = { ...car(), type, fuel: 0, engineHp: 100 };
      expect(advanceVehicle(healthy, controls, 0.1).dx).toBeCloseTo(
        movement.dx,
      );
      expect(humanPowered.broken).toBe(false);
      expect(consumeVehicleFuel(humanPowered, 160000)).toBe(0);
      expect(humanPowered.fuel).toBe(0);
      expect(humanPowered.maxFuel).toBe(0);
    }
  });

  it("нормализует автомобиль из старого сохранения", () => {
    const c = normalizeVehicle({
      type: "truck",
      hp: 80,
      fuel: 30,
      broken: true,
    });
    expect(c.maxHp).toBe(220);
    expect(c.maxFuel).toBe(120);
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
