export const DISTRICTS = {
  home: {
    name: "Рубеж и окрестности",
    danger: 0.5,
    enemies: ["walker", "dog"],
    loot: [
      ["wood", 0.2, 1],
      ["cloth", 0.15, 1],
    ],
  },
  residential: {
    name: "Жилой район",
    danger: 0.9,
    enemies: ["walker", "walker", "runner", "dog"],
    loot: [
      ["can", 0.16, 1],
      ["cloth", 0.14, 1],
    ],
  },
  commercial: {
    name: "Торговый район",
    danger: 1,
    enemies: ["walker", "runner", "dog", "screamer"],
    loot: [
      ["can", 0.2, 2],
      ["valuables", 0.08, 1],
    ],
  },
  civic: {
    name: "Гражданский район",
    danger: 1.2,
    enemies: ["walker", "runner", "riot", "spitter"],
    loot: [
      ["bandage", 0.18, 1],
      ["chem", 0.12, 1],
    ],
  },
  industrial: {
    name: "Промышленный район",
    danger: 1.4,
    enemies: ["walker", "runner", "brute", "riot"],
    loot: [
      ["scrap", 0.3, 2],
      ["parts", 0.12, 1],
    ],
  },
  suburb: {
    name: "Окраина",
    danger: 0.75,
    enemies: ["walker", "dog", "dog", "runner"],
    loot: [
      ["wood", 0.25, 2],
      ["seeds", 0.12, 1],
    ],
  },
  outskirts: {
    name: "Заражённая даль",
    danger: 1.55,
    enemies: ["runner", "stalker", "brute", "howler", "spitter"],
    loot: [
      ["chem", 0.14, 1],
      ["elec", 0.1, 1],
    ],
  },
};
