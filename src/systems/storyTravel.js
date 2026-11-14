const PIXELS_PER_METER = 16;
const ROUTE_FACTOR = 1.25;
const SPEED_KMH = 50;

export function estimateStoryTravel(from, to, vehicleDefinition) {
  const straightMeters =
    Math.hypot(to.x - from.x, to.y - from.y) / PIXELS_PER_METER;
  const routeMeters = straightMeters * ROUTE_FACTOR;
  const litersPer100Km = (vehicleDefinition?.fuelUse || 0) * 100000 * 16;
  return {
    straightMeters,
    routeMeters,
    fuel: (routeMeters / 100000) * litersPer100Km,
    hours: routeMeters / 1000 / SPEED_KMH,
  };
}

export function storyTravelLock({
  mapOpen,
  siege,
  target,
  player,
  car,
  definition,
}) {
  if (!mapOpen) return "Быстрое путешествие доступно только на большой карте";
  if (siege) return "Во время осады нельзя покинуть позицию";
  if (!target) return "Нет активной сюжетной цели";
  if (!car || player?.inCar !== car.id) return "Сядь в текущий автомобиль";
  if (definition?.humanPowered) return "Нужен автомобиль с топливом";
  if (
    car.dead ||
    car.broken ||
    car.locked ||
    car.hp <= 0 ||
    car.engineHp <= 0 ||
    car.tireHp <= 0
  )
    return "Автомобиль не на ходу";
  const estimate = estimateStoryTravel(player, target, definition);
  if (estimate.straightMeters <= 1200) return "Цель ближе 1200 м";
  if (car.fuel + 1e-9 < estimate.fuel) return "Недостаточно топлива";
  return null;
}

export function advanceTravelClock(clock, hours) {
  const total = clock.tod + hours;
  return {
    day: clock.day + Math.floor(total / 24),
    tod: total % 24,
  };
}
