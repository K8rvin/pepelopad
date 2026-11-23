// Предметы новой игры: данные отдельно от механик (правило AGENTS.md).
export const ITEMS = {
  wood: { name: "Дерево", stack: 20, icon: "🪵" },
  scrap: { name: "Металлолом", stack: 20, icon: "⚙️" },
  cloth: { name: "Ткань", stack: 20, icon: "🧵" },
  can: { name: "Тушёнка", stack: 10, icon: "🥫" },
  meds: { name: "Бинт", stack: 10, icon: "🩹" },
  arrow: { name: "Стрелы", stack: 40, icon: "🏹" },
  fuel: { name: "Бензин (л)", stack: 20, icon: "⛽" },
  part: { name: "Деталь", stack: 10, icon: "🔩" },
  torch: { name: "Факел", stack: 5, icon: "🔥" },
  bat: { name: "Бита", stack: 1, icon: "🏏" },
  knife: { name: "Нож", stack: 1, icon: "🔪" },
  antibiotics: { name: "Антибиотики", stack: 5, icon: "💊", unique: true },
  insulin: { name: "Инсулин", stack: 2, icon: "💉", unique: true },
  battery: { name: "Батарея", stack: 2, icon: "🔋", unique: true },
  meal: { name: "Горячая еда", stack: 5, icon: "🍲" },
  medkit: { name: "Аптечка", stack: 3, icon: "⛑️" },
};
