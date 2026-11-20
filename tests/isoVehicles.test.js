import { describe, expect, it } from "vitest";
import {
  createCity,
  buildSolidIndex,
  solidRectAt,
  carDims,
  carCenter,
  CAR_LEN,
  CAR_WID,
} from "../src/iso/world/cityGen.js";
import {
  initVehicles,
  nearestCar,
  enterCar,
  exitCar,
  updateVehicle,
} from "../src/iso/systems/vehicles.js";

// минимальный пустой город: без зданий/машин/зомби/препятствий, только земля
function emptyCity(seed = 1) {
  const city = createCity(seed, 1);
  city.buildings.length = 0;
  city.buildingGrid = new Map();
  city.cars.length = 0;
  city.zombies.length = 0;
  city.trees.length = 0;
  city.lamps.length = 0;
  city.fences.length = 0;
  city.containers.length = 0;
  city.barrels.length = 0;
  city.tires.length = 0;
  buildSolidIndex(city);
  return city;
}

const combatStub = () => ({
  shake: 0,
  blood: [],
  corpses: [],
  kills: 0,
  onKill: null,
});

describe("iso-машины: габариты по курсу", () => {
  it("AABB следует за доминирующей осью курса", () => {
    const car = { axis: "x", heading: 0 };
    expect(carDims(car)).toEqual({ w: CAR_LEN, h: CAR_WID });
    car.heading = Math.PI / 2;
    expect(carDims(car)).toEqual({ w: CAR_WID, h: CAR_LEN });
    car.heading = Math.PI / 4 - 0.01;
    expect(carDims(car).w).toBe(CAR_LEN);
    car.heading = Math.PI / 4 + 0.01;
    expect(carDims(car).w).toBe(CAR_WID);
  });

  it("без heading габариты берутся от axis (генерация до initVehicles)", () => {
    expect(carDims({ axis: "x" })).toEqual({ w: CAR_LEN, h: CAR_WID });
    expect(carDims({ axis: "y" })).toEqual({ w: CAR_WID, h: CAR_LEN });
  });

  it("carCenter — центр текущего AABB", () => {
    const car = { x: 10, y: 20, axis: "x", heading: 0 };
    expect(carCenter(car)).toEqual({ x: 12.2, y: 20.9 });
    car.heading = Math.PI / 2;
    expect(carCenter(car)).toEqual({ x: 10.9, y: 22.2 });
  });
});

describe("iso-машины: посадка и выбор", () => {
  it("nearestCar выбирает ближайшую по центру и уважает фильтр", () => {
    const city = emptyCity();
    city.cars.push(
      { x: 20, y: 20, axis: "x", wreck: false },
      { x: 23, y: 20, axis: "x", wreck: false },
      { x: 20.5, y: 20, axis: "x", wreck: true },
    );
    initVehicles(city);
    // у первой машины: центр (22.2, 20.9); вторая ближе к (26,21)
    const near = nearestCar(city, 26, 21);
    expect(near).toBe(city.cars[1]);
    // остов ближе всего к (21,21), но фильтр его пропускает
    const drivable = nearestCar(city, 21, 21, 3, (c) => !c.wreck);
    expect(drivable).toBe(city.cars[0]);
  });

  it("enterCar ставит игрока в центр машины", () => {
    const city = emptyCity();
    city.cars.push({ x: 20, y: 20, axis: "x", wreck: false });
    initVehicles(city);
    const state = { inCar: null };
    const player = { x: 0, y: 0 };
    enterCar(state, city.cars[0], player);
    expect(state.inCar).toBe(city.cars[0]);
    expect(player.x).toBeCloseTo(22.2);
    expect(player.y).toBeCloseTo(20.9);
  });

  it("exitCar высаживает в свободную точку вне AABB машины", () => {
    const city = emptyCity();
    city.cars.push({ x: 30, y: 30, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const state = { inCar: city.cars[0] };
    const player = { x: 32.2, y: 30.9 };
    exitCar(city, state, player);
    expect(state.inCar).toBeNull();
    expect(solidRectAt(city, player.x, player.y, 0.5)).toBe(false);
    // и не внутри машины
    expect(
      player.x < 30 || player.x > 34.4 || player.y < 30 || player.y > 31.8,
    ).toBe(true);
  });

  it("exitCar находит выход, даже если машина в плотном пенале из заборов", () => {
    const city = emptyCity();
    city.cars.push({ x: 30, y: 30, axis: "x", wreck: false });
    // пенал вплотную к машине (30..34.4 × 30..31.8): внутри нет свободных точек
    city.fences.push(
      { x0: 29.3, y0: 29.3, x1: 35.1, y1: 29.3, axis: "x" },
      { x0: 29.3, y0: 32.5, x1: 35.1, y1: 32.5, axis: "x" },
      { x0: 29.3, y0: 29.3, x1: 29.3, y1: 32.5, axis: "y" },
      { x0: 35.1, y0: 29.3, x1: 35.1, y1: 32.5, axis: "y" },
    );
    initVehicles(city);
    buildSolidIndex(city);
    const state = { inCar: city.cars[0] };
    const player = { x: 32.2, y: 30.9 };
    exitCar(city, state, player);
    expect(solidRectAt(city, player.x, player.y, 0.5)).toBe(false);
    // кольцевой поиск вынес за пределы пенала
    expect(
      player.x < 29.3 || player.x > 35.1 || player.y < 29.3 || player.y > 32.5,
    ).toBe(true);
  });
});

describe("iso-машины: вождение", () => {
  it("перепад доминирующей оси в повороте не телепортирует центр", () => {
    const city = emptyCity();
    city.cars.push({ x: 40, y: 40, axis: "x", wreck: false });
    initVehicles(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    const keys = { KeyW: true, KeyD: true };
    const dt = 1 / 60;
    let prev = carCenter(car);
    let maxJump = 0;
    let crossed = false;
    for (let i = 0; i < 600; i++) {
      updateVehicle(city, car, keys, player, combat, dt);
      const cc = carCenter(car);
      maxJump = Math.max(maxJump, Math.hypot(cc.x - prev.x, cc.y - prev.y));
      prev = cc;
      const deg = ((car.heading * 180) / Math.PI) % 360;
      if (deg > 50) {
        crossed = true;
        break;
      }
    }
    expect(crossed).toBe(true);
    // шаг за кадр — это движение (≤ v·dt + запас), а не скачок AABB (~1,3 м)
    expect(maxJump).toBeLessThan(0.8);
    expect(carDims(car).w).toBe(CAR_WID);
  });

  it("руль: A влево (курс уменьшается), D вправо (курс растёт)", () => {
    const city = emptyCity();
    city.cars.push({ x: 40, y: 40, axis: "x", wreck: false });
    initVehicles(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    const run = (keys, frames) => {
      for (let i = 0; i < frames; i++)
        updateVehicle(city, car, keys, player, combat, 1 / 60);
    };
    // разгон вперёд, затем A
    run({ KeyW: true }, 60);
    car.heading = 0;
    run({ KeyW: true, KeyA: true }, 45);
    expect(car.heading).toBeLessThan(0); // влево (к северу)
    // D
    car.heading = 0;
    run({ KeyW: true, KeyD: true }, 45);
    expect(car.heading).toBeGreaterThan(0); // вправо (к югу)
  });

  it("задний ход: S разгоняет назад до ~40% максимума", () => {
    const city = emptyCity();
    city.cars.push({ x: 60, y: 60, axis: "x", wreck: false });
    initVehicles(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    const x0 = car.x;
    for (let i = 0; i < 180; i++)
      updateVehicle(city, car, { KeyS: true }, player, combat, 1 / 60);
    expect(car.v).toBeLessThan(0);
    expect(car.x).toBeLessThan(x0); // уехала назад (курс 0 — на запад)
  });

  it("задел носом — задним ходом отъезжает, не залипает", () => {
    const city = emptyCity();
    // несбиваемое препятствие поперёк пути (дерево на осевой, x=50); заборы сбиваемые
    city.trees.push({ x: 50, y: 40.4, dead: false, v: 0 });
    city.cars.push({ x: 44, y: 39.5, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    // едем вперёд до упора в забор
    for (let i = 0; i < 300; i++)
      updateVehicle(city, car, { KeyW: true }, player, combat, 1 / 60);
    const stuckX = car.x;
    expect(carCenter(car).x + CAR_LEN / 2).toBeLessThan(50.1); // не вошёл в забор
    // назад 2 с: должен отъехать, а не залипнуть на касании
    for (let i = 0; i < 120; i++)
      updateVehicle(city, car, { KeyS: true }, player, combat, 1 / 60);
    expect(car.x).toBeLessThan(stuckX - 2);
    // и снова вперёд — до упора (залипания нет)
    for (let i = 0; i < 300; i++)
      updateVehicle(city, car, { KeyW: true }, player, combat, 1 / 60);
    expect(car.x).toBeGreaterThan(stuckX - 0.5);
  });

  it("нос машины упирается в препятствие, а не входит в него", () => {
    const city = emptyCity();
    // несбиваемое препятствие поперёк пути (дерево на осевой); заборы сбиваемые
    city.trees.push({ x: 50, y: 40.4, dead: false, v: 0 });
    city.cars.push({ x: 40, y: 39.5, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    const keys = { KeyW: true };
    for (let i = 0; i < 600; i++)
      updateVehicle(city, car, keys, player, combat, 1 / 60);
    // нос (центр + 2,2 по курсу 0°) не зашёл за забор с учётом радиуса зонда
    expect(carCenter(car).x + CAR_LEN / 2).toBeLessThan(50);
    expect(car.hp).toBeLessThan(100); // был удар
  });

  it("после остановки сетка коллизий соответствует новой позиции", () => {
    const city = emptyCity();
    city.cars.push({ x: 20, y: 60, axis: "x", wreck: false });
    initVehicles(city);
    buildSolidIndex(city);
    const car = city.cars[0];
    car.fuel = 40;
    const player = { x: 0, y: 0 };
    const combat = combatStub();
    const keys = { KeyW: true };
    for (let i = 0; i < 90; i++)
      updateVehicle(city, car, keys, player, combat, 1 / 60);
    keys.KeyW = false;
    for (let i = 0; i < 600 && Math.abs(car.v) > 0.15; i++)
      updateVehicle(city, car, keys, player, combat, 1 / 60);
    const cc = carCenter(car);
    expect(cc.x).toBeGreaterThan(25); // уехала с места генерации
    const rects = [];
    for (const cell of city.solidGrid.values())
      for (const s of cell) if (s.ref === car) rects.push(s);
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0].x).toBeCloseTo(car.x);
    expect(rects[0].y).toBeCloseTo(car.y);
  });
});
