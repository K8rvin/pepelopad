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
    id: "torch",
    name: "Факел",
    out: { id: "torch", n: 1 },
    inputs: { wood: 1, cloth: 1 },
  },
];
