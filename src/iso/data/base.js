// База игрока с выжившими (данные отдельно от механик, этап 17).
// Постройки стекаются (несколько баррикад/жилых модулей/грядок).
export const BASE_START_SLOTS = 8;
export const BASE_START_CAPACITY = 2;

export const BASE_STRUCTURES = [
  {
    id: "barricade",
    name: "Баррикады",
    desc: "+2 защиты: ночной рейд на базу слабее",
    cost: { wood: 6, scrap: 4 },
    defense: 2,
  },
  {
    id: "housing",
    name: "Жилой модуль",
    desc: "+2 места для жителей",
    cost: { wood: 8, cloth: 4 },
    capacity: 2,
  },
  {
    id: "storage",
    name: "Склад",
    desc: "+8 слотов склада базы",
    cost: { wood: 6, scrap: 2 },
    slots: 8,
  },
  {
    id: "garden",
    name: "Грядка",
    desc: "+2 тушёнки в склад базы каждый день",
    cost: { wood: 4, cloth: 2 },
    produce: { id: "can", n: 2 },
  },
  {
    id: "workshop",
    name: "Мастерская",
    desc: "+2 детали в склад базы каждый день",
    cost: { scrap: 6, wood: 4 },
    produce: { id: "part", n: 2 },
  },
];
