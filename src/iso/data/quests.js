// Квестовая цепочка нового города (данные; привязка к POI из cityGen).
// Типы целей: kill (N зомби), loot (N предметов id из контейнеров), visit (POI).
export const QUESTS = [
  {
    id: "m1",
    name: "Осмотреться",
    desc: "Парк кишит. Троих — из лука, тихо.",
    goals: [{ type: "kill", n: 3 }],
    reward: [["arrow", 8]],
  },
  {
    id: "m2",
    name: "Супермаркет",
    desc: "Дойди до супермаркета и найди 2 тушёнки (мусорки и бочки).",
    goals: [
      { type: "visit", poi: "Супермаркет" },
      { type: "loot", id: "can", n: 2 },
    ],
    reward: [["meds", 1]],
  },
  {
    id: "m3",
    name: "Участок",
    desc: "Загляни в отделение полиции.",
    goals: [{ type: "visit", poi: "Полиция" }],
    reward: [["part", 2]],
  },
  {
    id: "m4",
    name: "Больница",
    desc: "Больница на северо-востоке. Принеси 2 бинта.",
    goals: [
      { type: "visit", poi: "Больница" },
      { type: "loot", id: "meds", n: 2 },
    ],
    reward: [["can", 2]],
  },
  {
    id: "m5",
    name: "Топливо",
    desc: "АЗС на западе: 2 канистры бензина. Пригодится для машины.",
    goals: [
      { type: "visit", poi: "АЗС" },
      { type: "loot", id: "fuel", n: 2 },
    ],
    reward: [["arrow", 10]],
  },
];
