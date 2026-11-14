export const STORY_TARGET_DETAILS = {
  m1: {
    parents: {
      event: "visit",
      goal: "visit_parents",
      interaction: "parents",
    },
    friend: {
      event: "visit",
      goal: "visit_friend",
      interaction: "friend",
    },
    girlfriend: {
      event: "visit",
      goal: "visit_girlfriend",
      interaction: "girlfriend",
    },
  },
  m2: {
    bartender: {
      event: "talk",
      goal: "talk_bartender",
      interaction: "bartender",
    },
    gunstore: {
      event: "talk",
      goal: "talk_gunstore",
      interaction: "gunstore",
      hostSiteId: "gunstore_host",
      grant: [
        ["bp_crossbow", 1],
        ["wood", 6],
        ["scrap", 6],
        ["cloth", 2],
      ],
    },
  },
  m3: {
    work: {
      event: "visit",
      goal: "visit_work",
      interaction: "work",
    },
  },
  m4: {
    police: {
      event: "talk",
      goal: "talk_police",
      interaction: "police",
    },
    camp_school: {
      event: "visit",
      goal: "visit_school",
      camp: "camp_school",
    },
  },
  m5: {
    school_medicine: {
      event: "visit",
      goal: "school_medicine",
      interaction: "medicine",
      grant: [["medkit", 2]],
    },
    school_food: {
      event: "visit",
      goal: "school_food",
      interaction: "food",
      grant: [["can", 4]],
    },
    school_rescue: {
      event: "rescue",
      goal: "school_rescue",
      interaction: "rescue",
    },
    camp_school: {
      event: "visit",
      goal: "return_school",
      camp: "camp_school",
      requires: "school_rescue",
    },
  },
  m6: {
    camp_school: {
      event: "camp",
      goal: "school_branch",
      camp: "camp_school",
    },
  },
};

export const STORY_DIALOGUES = {
  parents: [
    {
      who: "МАМА",
      text: "Артём! Мы закрылись у соседей. Не иди за нами — здесь безопасно.",
    },
    { who: "АРТЁМ", text: "Я вернусь, когда найду надёжное место для всех." },
  ],
  friend: [
    { who: "ДЕНИС", text: "Связь оборвалась. У меня почти не осталось еды." },
    { who: "АРТЁМ", text: "Держись. Сейчас решим, чем я могу помочь." },
  ],
  girlfriend: [
    {
      who: "ЛЕНА",
      text: "Я ухожу с соседями к школьному лагерю. Не теряй меня из виду на карте.",
    },
    { who: "АРТЁМ", text: "Доберусь до школы и найду тебя." },
  ],
  bartender: [
    {
      who: "БАРМЕН ОЛЕГ",
      text: "Я живой, если ты сомневаешься. За дверью уже неделю одни мертвецы.",
    },
    {
      who: "БАРМЕН ОЛЕГ",
      text: "Хозяин «Хищника» собирал арбалеты. Скажи ему, что я ещё должен ему кофе.",
    },
  ],
  gunstore: [
    {
      who: "ХОЗЯИН МАГАЗИНА",
      text: "Олег жив? Тогда помогу. Вот чертёж и детали для арбалета.",
    },
    {
      who: "ХОЗЯИН МАГАЗИНА",
      text: "Собери его на верстаке. Болты береги — тихое оружие спасает жизнь.",
    },
  ],
  work: [
    {
      who: "АРТЁМ",
      text: "Моя смена закончилась неделю назад. В раздевалке осталась записка: «Ушли к школе № 5».",
    },
    {
      who: "АРТЁМ",
      text: "Полицейский участок может знать, где сейчас эвакуированные.",
    },
  ],
  police: [
    {
      who: "СЕРЖАНТ",
      text: "Эвакуацию свернули. Оставшиеся держатся на спортплощадке школы № 5.",
    },
    {
      who: "СЕРЖАНТ",
      text: "Иди к лагерю на улице Репина. Им нужны лекарства, еда и люди.",
    },
  ],
  medicine: [
    {
      who: "АРТЁМ",
      text: "Аптека № 31. Здесь ещё остались перевязочные пакеты для школьного лагеря.",
    },
  ],
  food: [
    {
      who: "АРТЁМ",
      text: "Склад «Пятёрочки» не разграблен. Возьму консервы — лагерю хватит на вечер.",
    },
  ],
  rescue: [
    {
      who: "ВЫЖИВШИЙ",
      text: "Я видел дым над школой. Доберусь туда сам, только открой проход.",
    },
    {
      who: "АРТЁМ",
      text: "Дорога отмечена. Не жди меня — встретимся в лагере.",
    },
  ],
};

export const FRIEND_HELP_CHOICES = [
  {
    id: "supplies",
    label: "Оставить консервы",
    cost: ["can", 1],
    response: "Денис спрятал консервы и пообещал ждать весточки.",
  },
  {
    id: "refused",
    label: "Сначала найти лагерь",
    response: "Денис кивнул. Я вернусь за ним, когда узнаю безопасный путь.",
  },
];

export const SCHOOL_BRANCHES = {
  clinic: {
    label: "Оборудовать лазарет",
    facility: "clinic",
    text: "Медики получили отдельную комнату. Теперь раненые добираются до утра.",
  },
  watch: {
    label: "Построить дозорную вышку",
    facility: "tower",
    text: "На площадке появился постоянный дозор. Теперь ночью лагерь видит опасность первым.",
  },
};
