// Рецепты крафта (данные отдельно от механик).
export const RECIPES = [
  {
    id: "arrows",
    name: "Стрелы ×6",
    out: { id: "arrow", n: 6 },
    inputs: { wood: 2, scrap: 1 },
  },
  {
    id: "bandage",
    name: "Бинт",
    out: { id: "meds", n: 1 },
    inputs: { cloth: 2 },
  },
  {
    id: "medkit",
    name: "Аптечка",
    out: { id: "medkit", n: 1 },
    inputs: { meds: 1, cloth: 2 },
  },
  {
    id: "torch",
    name: "Факел",
    out: { id: "torch", n: 1 },
    inputs: { wood: 1, cloth: 1 },
  },
  {
    id: "molotov",
    name: "Коктейль Молотова",
    out: { id: "molotov", n: 1 },
    inputs: { fuel: 1, cloth: 1 },
  },
  {
    id: "bat",
    name: "Бита",
    out: { id: "bat", n: 1 },
    inputs: { wood: 2, cloth: 1 },
  },
  {
    id: "knife",
    name: "Нож",
    out: { id: "knife", n: 1 },
    inputs: { scrap: 2, cloth: 1 },
  },
];
