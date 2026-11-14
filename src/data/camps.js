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

export const CAMP_DEFINITIONS = {
  camp_bridge: {
    leader: "Марта",
    specialization: "Медицина и обмен",
    facilities: ["clinic"],
    residents: ["Марта", "Оксана", "Тимур", "Вадим"],
    mission: {
      id: "camp_bridge_medicine",
      title: "Мост: лекарства",
      desc: "Марта просит передать лагерю «Мост» две аптечки.",
      goals: [["supply_medkit", 2]],
      reward: { xp: 120, trust: 4, items: [["bandage", 3]] },
    },
  },
  camp_farm: {
    leader: "Илья",
    specialization: "Еда и семена",
    facilities: ["garden"],
    residents: ["Илья", "Соня", "Михаил", "Алина"],
    mission: {
      id: "camp_farm_food",
      title: "Ферма: продовольствие",
      desc: "Илья просит передать лагерю «Ферма» четыре консервы.",
      goals: [["supply_can", 4]],
      reward: { xp: 110, trust: 4, items: [["seeds", 4]] },
    },
  },
  camp_depot: {
    leader: "Серый",
    specialization: "Ремонт и детали",
    facilities: ["wall"],
    residents: ["Серый", "Гена", "Руслан", "Лев"],
    mission: {
      id: "camp_depot_parts",
      title: "Депо: запчасти",
      desc: "Серый просит передать лагерю «Депо» три запчасти.",
      goals: [["supply_parts", 3]],
      reward: { xp: 140, trust: 4, items: [["repairkit", 1]] },
    },
  },
  camp_school: {
    leader: "Надежда",
    specialization: "Убежище и спасение",
    facilities: ["wall"],
    residents: ["Надежда", "Лена", "Павел", "Ира"],
    mission: {
      id: "camp_school_bandages",
      title: "Школа: перевязка",
      desc: "Надежда просит передать школьному лагерю два бинта.",
      goals: [["supply_bandage", 2]],
      reward: { xp: 100, trust: 4, items: [["can", 2]] },
    },
  },
};
