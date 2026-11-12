import { clamp } from "../core/math.js";
import { VEHICLES } from "../data/vehicles.js";

export function vehicleDefinition(type) {
  return VEHICLES[type] || VEHICLES.sedan;
}

export function normalizeVehicle(car) {
  const def = vehicleDefinition(car.type);
  car.maxHp = Number.isFinite(car.maxHp) ? car.maxHp : def.maxHp;
  car.maxFuel = Number.isFinite(car.maxFuel) ? car.maxFuel : def.maxFuel;
  car.engineHp = Number.isFinite(car.engineHp)
    ? car.engineHp
    : car.broken
      ? 0
      : 100;
  car.tireHp = Number.isFinite(car.tireHp) ? car.tireHp : 100;
  car.hp = clamp(Number.isFinite(car.hp) ? car.hp : car.maxHp, 0, car.maxHp);
  car.fuel = clamp(
    Number.isFinite(car.fuel) ? car.fuel : car.maxFuel,
    0,
    car.maxFuel,
  );
  car.broken = car.engineHp <= 0;
  return car;
}

export function damageVehicle(car, amount, collision = false) {
  normalizeVehicle(car);
  car.hp = Math.max(0, car.hp - amount);
  if (collision) {
    car.engineHp = clamp(car.engineHp - amount * 0.8, 0, 100);
    car.tireHp = clamp(car.tireHp - amount * 1.1, 0, 100);
  }
  car.broken = car.engineHp <= 0;
  car.dead = car.hp <= 0;
  if (car.dead) car.speed = 0;
  return { dead: car.dead, broken: car.broken };
}

export function advanceVehicle(car, controls, dt) {
  if (!controls.active) {
    car.speed *= Math.pow(0.1, dt);
    return { dx: 0, dy: 0 };
  }

  normalizeVehicle(car);
  const def = vehicleDefinition(car.type);
  const enginePower = 0.55 + car.engineHp * 0.0045;
  const tireControl = 0.45 + car.tireHp * 0.0055;
  if (car.fuel > 0 && !car.broken)
    car.speed += controls.accel * def.acceleration * enginePower * dt;
  const maxSpeed = def.maxSpeed * tireControl * (controls.boost ? 1.22 : 1);
  car.speed = clamp(car.speed, -def.reverseSpeed, maxSpeed);
  car.speed *= Math.pow(controls.accel ? 0.93 : 0.5, dt);
  if (controls.handbrake) car.speed *= Math.pow(0.03, dt);
  if (Math.abs(car.speed) > 3) {
    car.angle +=
      controls.steer *
      dt *
      def.handling *
      tireControl *
      clamp(car.speed / 90, -1.4, 1.4);
  }

  return {
    dx: Math.cos(car.angle) * car.speed * dt,
    dy: Math.sin(car.angle) * car.speed * dt,
  };
}

export function consumeVehicleFuel(car, dt, mechanicLevel = 0) {
  const def = vehicleDefinition(car.type);
  car.fuel = Math.max(
    0,
    car.fuel -
      Math.abs(car.speed) * dt * def.fuelUse * (1 - mechanicLevel * 0.08),
  );
}
