export const CAMP_UPGRADES = {
  wall: {
    name: "Стены",
    description: "Ограда вокруг палаток; новые секции видны в лагере.",
    cost: { wood: 8, scrap: 6 },
  },
  garden: {
    name: "Огород",
    description: "Грядки для собственных припасов.",
    cost: { wood: 6, seeds: 4 },
  },
  tower: {
    name: "Вышка",
    description: "Дозорные стреляют по зомби; каждый уровень добавляет охрану.",
    cost: { wood: 10, scrap: 8, elec: 2 },
  },
  clinic: {
    name: "Лазарет",
    description: "Медицинский пост внутри лагеря.",
    cost: { cloth: 6, chem: 4, medkit: 1 },
  },
};
