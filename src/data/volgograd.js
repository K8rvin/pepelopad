export const VOLGOGRAD_SITES = {
  base: {
    ref: "node/6429297365",
    name: "Рубеж у Волгограда I",
    osmName: "Волгоград I",
    kind: "base",
  },
  supermarket: {
    ref: "way/844049423",
    name: "Супермаркет «Калина»",
    osmName: "Пятёрочка",
    kind: "supermarket",
  },
  gunstore: {
    ref: "node/3710174147",
    name: "Оружейный «Калибр»",
    osmName: "Защита",
    kind: "gunstore",
  },
  hospital: {
    ref: "way/123686711",
    name: "Больница",
    osmName: "Больница № 3",
    kind: "hospital",
  },
  gas: {
    ref: "way/96826014",
    name: "АЗС / машины",
    osmName: "Лукойл",
    kind: "gas",
  },
  garage: {
    ref: "way/105348124",
    name: "Автосервис",
    osmName: "МУП «Автокоммунтранс»",
    kind: "garage",
  },
  police: {
    ref: "way/124061100",
    name: "Участок",
    osmName: "Отдел линейной полиции",
    kind: "police",
  },
  warehouse: {
    ref: "way/405297814",
    name: "Склад",
    osmName: "Пони-Экспресс",
    kind: "warehouse",
  },
  camp_bridge: {
    ref: "way/669296037",
    name: "Лагерь «Мост»",
    osmName: "Волгоградский мост",
    kind: "camp",
  },
  camp_farm: {
    ref: "way/158574145",
    name: "Лагерь «Ферма»",
    osmName: "Парк «Сказка»",
    kind: "camp",
  },
  camp_depot: {
    ref: "way/111175996",
    name: "Лагерь «Депо»",
    osmName: "Волгоградский грузовой порт",
    kind: "camp",
  },
  mamayev: {
    ref: "node/3201500614",
    name: "Карьер",
    osmName: "Мамаев курган",
    kind: "nest",
  },
  mill: {
    ref: "way/123802770",
    name: "Мельница Гергардта",
    osmName: "Мельница Гергардта",
    kind: "landmark",
  },
  pavlov: {
    ref: "relation/20144900",
    name: "Дом Павлова",
    osmName: "Дом Павлова",
    kind: "landmark",
  },
  riverport: {
    ref: "way/153018096",
    name: "Речной вокзал",
    osmName: "Туристический вокзал",
    kind: "landmark",
  },
};

export const VOLGOGRAD_QUEST_TARGETS = {
  m1: ["supermarket"],
  m2: ["gunstore"],
  m3: ["hospital"],
  m4: ["gas"],
  m5: ["police", "warehouse"],
  m6: ["camp_bridge"],
  m7: ["mamayev"],
  m8: ["base"],
  m10: ["mamayev"],
};
