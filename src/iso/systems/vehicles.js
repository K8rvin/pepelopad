// Машины (спроектировано заново): посадка/высадка, вождение (W газ, S тормоз/задний,
// A/D руль), топливо в литрах, таран зомби, урон машине, багажник (отдельное хранилище).
// Битые (wreck) — недвижимы, это пропсы.
import { clamp } from "../core/rng.js";
import { solidRectAt, buildSolidIndex } from "../world/cityGen.js";

const ACCEL = 9; // м/с²
const MAX_SPEED = 22; // ~80 км/ч
const BRAKE = 16;
const DRAG = 0.9;
const STEER = 1.9; // рад/с на полном ходу
const FUEL_PER_M = 0.008; // ~8 л/100 км
const TANK = 40;

export function initVehicles(city) {
  city.cars.forEach((c, i) => {
    c.vid = i;
    c.fuel = c.wreck ? 0 : 6 + ((i * 7) % 30);
    c.hp = c.wreck ? 0 : 100;
    c.heading = c.axis === "x" ? 0 : Math.PI / 2;
    c.v = 0;
    c.trunk = null; // слоты создаются при первом открытии
  });
}

export function nearestCar(city, x, y, r = 3) {
  let best = null,
    bd = r;
  for (const c of city.cars) {
    const w = c.axis === "x" ? 4.4 : 1.8,
      h = c.axis === "x" ? 1.8 : 4.4;
    const cx = c.x + w / 2,
      cy = c.y + h / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bd + 1.5) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function enterCar(state, car, player) {
  state.inCar = car;
  player.x = car.x + (car.axis === "x" ? 2.2 : 0.9);
  player.y = car.y + (car.axis === "x" ? 0.9 : 2.2);
}

export function exitCar(city, state, player) {
  const car = state.inCar;
  if (!car) return;
  // выход сбоку от машины в свободную точку
  const w = car.axis === "x" ? 4.4 : 1.8,
    h = car.axis === "x" ? 1.8 : 4.4;
  const spots = [
    { x: car.x - 1, y: car.y + h / 2 },
    { x: car.x + w + 1, y: car.y + h / 2 },
    { x: car.x + w / 2, y: car.y - 1 },
    { x: car.x + w / 2, y: car.y + h + 1 },
  ];
  const spot = spots.find((s) => !solidRectAt(city, s.x, s.y, 0.5)) || spots[0];
  player.x = spot.x;
  player.y = spot.y;
  car.v = 0;
  state.inCar = null;
}

export function updateVehicle(city, car, keys, player, combat, dt, rng) {
  // газ/тормоз/руль
  const fwd = keys.KeyW ? 1 : 0,
    back = keys.KeyS ? 1 : 0;
  const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  if (car.fuel <= 0) {
    car.v *= Math.max(0, 1 - DRAG * dt * 3);
  } else {
    if (fwd) car.v = Math.min(MAX_SPEED, car.v + ACCEL * dt);
    if (back) car.v = Math.max(-MAX_SPEED * 0.4, car.v - BRAKE * dt);
  }
  car.v *= Math.max(0, 1 - DRAG * dt * (fwd || back ? 0.25 : 1.2));
  // полная остановка после движения → перестроить сетку коллизий (машина на новом месте)
  if (car.moved && Math.abs(car.v) < 0.15) {
    car.moved = false;
    buildSolidIndex(city);
  }
  if (Math.abs(car.v) > 0.2) {
    car.heading +=
      steer * STEER * dt * Math.min(1, Math.abs(car.v) / 8) * Math.sign(car.v);
  }
  // движение с коллизией: два круга (перед/зад)
  const dx = Math.cos(car.heading) * car.v * dt,
    dy = Math.sin(car.heading) * car.v * dt;
  const w = car.axis === "x" ? 4.4 : 1.8,
    h = car.axis === "x" ? 1.8 : 4.4;
  const nx = car.x + dx,
    ny = car.y + dy;
  const fx =
      nx + Math.cos(car.heading) * (w / 2) * (car.axis === "x" ? 1 : 1) * 0,
    fy = ny; // центр коробки достаточно для прототипа
  const hw = w / 2,
    hh = h / 2;
  const cx = nx + hw,
    cy = ny + hh;
  const hit =
    solidRectAt(
      city,
      cx + Math.cos(car.heading) * hw,
      cy + Math.sin(car.heading) * hh,
      1.0,
      car,
    ) ||
    solidRectAt(
      city,
      cx - Math.cos(car.heading) * hw,
      cy - Math.sin(car.heading) * hh,
      1.0,
      car,
    );
  if (hit) {
    if (Math.abs(car.v) > 6) {
      car.hp = Math.max(0, car.hp - Math.abs(car.v));
      combat.shake = 8;
    }
    car.v = -car.v * 0.25; // отскок
  } else {
    car.x = nx;
    car.y = ny;
    car.moved = true;
    car.fuel = Math.max(0, car.fuel - Math.abs(car.v) * dt * FUEL_PER_M);
  }
  // таран зомби
  for (const z of city.zombies) {
    if (z.dead) continue;
    if (Math.abs(z.x - cx) + Math.abs(z.y - cy) > 6) continue;
    const d = Math.hypot(z.x - cx, z.y - cy);
    if (d < 2.2 && Math.abs(car.v) > 3) {
      z.hp = (z.hp ?? 70) - Math.abs(car.v) * 9;
      combat.blood.push({ x: z.x, y: z.y, r: 1, t: 0 });
      if (z.hp <= 0) {
        z.dead = true;
        combat.kills++;
        combat.corpses.push({ x: z.x, y: z.y, t: 0, pose: 1 });
        combat.onKill?.();
      }
      car.hp = Math.max(0, car.hp - 1.5);
      car.v *= 0.88;
      combat.shake = Math.max(combat.shake, 4);
    }
  }
  // игрок едет с машиной
  player.x = car.x + hw;
  player.y = car.y + hh;
}

// заправка из инвентаря: перелить fuel-предметы в бак. Возвращает литры или 0.
export function refuelCar(car, inv, countItem, removeItem) {
  const have = countItem(inv, "fuel");
  if (!have || car.fuel >= TANK) return 0;
  const take = Math.min(have, TANK - car.fuel);
  removeItem(inv, "fuel", take);
  car.fuel += take;
  return take;
}

export function fuelText(car) {
  return `${car.fuel.toFixed(1)} / ${TANK} л`;
}
