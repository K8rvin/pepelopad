// Лагеря выживших (данные отдельно от механик, этап 17).
// Бартер: лагерь продаёт предметы за ресурсы; пожертвования ресурсов и
// выполненные поручения растят доверие; доверие открывает товар и жителей.
// Постройки дают ежедневное производство в склад лагеря или услугу.
export const TRUST_LEVELS = [0, 30, 80, 150];
export const TRUST_NAMES = ["Чужие", "Соседи", "Союзники", "Свои"];

// ценность пожертвования за единицу ресурса
export const DON_VALUES = {
  wood: 1,
  scrap: 1,
  cloth: 1,
  can: 2,
  meds: 3,
  fuel: 2,
  part: 3,
};

export const CAMPS = [
  {
    id: "school",
    name: "Школьный лагерь",
    poi: "Школа",
    spec: "medic",
    npc: {
      name: "Вера",
      lines: [
        "Я держу лазарет в спортзале. Бинты кончаются быстрее, чем дети перестают бояться.",
        "Принеси ткань или бинты — и я буду штопать тебя бесплатно. Раз в день, не наглей.",
      ],
    },
    stock: [
      { id: "meds", n: 2, cost: { cloth: 2 }, minTrust: 0 },
      { id: "can", n: 2, cost: { wood: 2 }, minTrust: 0 },
      { id: "meds", n: 3, cost: { can: 2 }, minTrust: 1 },
    ],
    upgrades: [
      {
        id: "lazaret",
        name: "Лазарет",
        desc: "Бесплатная перевязка +30 HP раз в день",
        cost: { wood: 6, cloth: 4 },
        service: "heal",
      },
      {
        id: "garden",
        name: "Огород",
        desc: "+2 тушёнки в склад лагеря каждый день",
        cost: { wood: 8, scrap: 2 },
        produce: { id: "can", n: 2 },
      },
    ],
  },
  {
    id: "park",
    name: "Парковый лагерь",
    poi: "park",
    spec: "scav",
    npc: {
      name: "Олег",
      lines: [
        "Парк мой. Я тут каждый куст наизусть знаю — и где что лежит, тоже.",
        "Мастерскую построим — стрелы пойдут потоком. Дерево и лом неси, не жмись.",
      ],
    },
    stock: [
      { id: "arrow", n: 6, cost: { wood: 1, scrap: 1 }, minTrust: 0 },
      { id: "fuel", n: 2, cost: { scrap: 2 }, minTrust: 1 },
      { id: "part", n: 1, cost: { scrap: 3 }, minTrust: 2 },
    ],
    upgrades: [
      {
        id: "workshop",
        name: "Мастерская",
        desc: "+6 стрел в склад лагеря каждый день",
        cost: { wood: 6, scrap: 4 },
        produce: { id: "arrow", n: 6 },
      },
      {
        id: "storage",
        name: "Склад",
        desc: "+1 деталь в склад лагеря каждый день",
        cost: { wood: 10 },
        produce: { id: "part", n: 1 },
      },
    ],
  },
  {
    id: "police",
    name: "Полицейский лагерь",
    poi: "Полиция",
    spec: "guard",
    npc: {
      name: "Саныч",
      lines: [
        "Участок держим. Патронов нет, но стрелы точим — лук тише и своё не кончится.",
        "Оружейку откроем — стрелы рекой. Лом неси, дерево тоже пригодится.",
      ],
    },
    stock: [
      { id: "arrow", n: 8, cost: { scrap: 1 }, minTrust: 0 },
      { id: "part", n: 2, cost: { scrap: 2 }, minTrust: 1 },
      { id: "fuel", n: 2, cost: { scrap: 3 }, minTrust: 1 },
    ],
    upgrades: [
      {
        id: "armory",
        name: "Оружейка",
        desc: "+8 стрел в склад лагеря каждый день",
        cost: { scrap: 8, wood: 4 },
        produce: { id: "arrow", n: 8 },
      },
      {
        id: "garage",
        name: "Гараж",
        desc: "+2 л бензина в склад лагеря каждый день",
        cost: { scrap: 6, part: 2 },
        produce: { id: "fuel", n: 2 },
      },
    ],
  },
  {
    id: "motel",
    name: "Мотель «Последний»",
    poi: "Мотель",
    spec: "guard",
    baseResidents: 5,
    npc: {
      name: "Виктор",
      lines: [
        "Здесь живут не за счёт стен. За счёт того, что кто-то каждый день их чинит.",
      ],
    },
    stock: [
      { id: "meal", n: 1, cost: { can: 1 }, minTrust: 1 },
      { id: "part", n: 1, cost: { scrap: 3 }, minTrust: 1 },
      { id: "meds", n: 2, cost: { cloth: 2 }, minTrust: 2 },
    ],
    upgrades: [
      {
        id: "infirmary",
        name: "Лазарет мотеля",
        desc: "Перевязка +30 HP раз в день",
        cost: { meds: 2, cloth: 2 },
        service: "heal",
      },
      {
        id: "kitchen",
        name: "Общая кухня",
        desc: "+1 горячая еда в склад каждый день",
        cost: { can: 3, wood: 2 },
        produce: { id: "meal", n: 1 },
      },
      {
        id: "workshop",
        name: "Мастерская мотеля",
        desc: "+1 деталь в склад каждый день",
        cost: { wood: 8, scrap: 4 },
        produce: { id: "part", n: 1 },
      },
    ],
  },
];

// поручения: доставь предметы → доверие + награда
export const REQUEST_POOL = [
  { id: "meds", n: 2, trust: 12, reward: [["can", 2]] },
  { id: "can", n: 3, trust: 10, reward: [["arrow", 6]] },
  { id: "fuel", n: 3, trust: 14, reward: [["part", 2]] },
  { id: "part", n: 2, trust: 12, reward: [["meds", 2]] },
  { id: "wood", n: 6, trust: 8, reward: [["can", 1]] },
  { id: "scrap", n: 6, trust: 8, reward: [["arrow", 4]] },
];
