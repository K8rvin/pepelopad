export const MAIN_QUESTS = [
  {
    id: "m00",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Первые правила",
    desc: "Олег отзывается из подсобки заправки. Прежде чем открывать дверь, собери снаряжение и проверь руку.",
    next: "m01",
    target: { site: "gas" },
    stages: [
      {
        desc: "Доберись до заправки.",
        goals: [{ type: "visit", target: "gas", label: "Старая заправка" }],
        target: { site: "gas" },
      },
      {
        desc: "Обыск три помеченных ящика.",
        goals: [
          {
            type: "search",
            target: "gas_training_wood",
            label: "Столярный ящик",
          },
          {
            type: "search",
            target: "gas_training_blade",
            label: "Ящик с металлом",
          },
          {
            type: "search",
            target: "gas_training_medical",
            label: "Медицинский ящик",
          },
        ],
        target: { site: "gas" },
      },
      {
        desc: "Открой C и создай стрелы, нож и аптечку.",
        goals: [
          { type: "craft", target: "arrows", label: "Стрелы" },
          { type: "craft", target: "knife", label: "Нож" },
          { type: "craft", target: "medkit", label: "Аптечка" },
        ],
        target: { site: "gas" },
      },
      {
        desc: "Поговори с Олегом через дверь.",
        goals: [{ type: "talk", target: "oleg", label: "Правила боя" }],
        target: { npc: "oleg" },
      },
      {
        desc: "Попади по мишени из лука, затем ударь её ножом.",
        goals: [
          { type: "practice", target: "bow", label: "Попадание из лука" },
          { type: "practice", target: "knife", label: "Удар ножом" },
        ],
        target: { object: "gas_practice_target" },
      },
    ],
  },
  {
    id: "m01",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Стук на заправке",
    desc: "Адрес Марка пуст. На старой заправке кто-то стучит по закрытой двери.",
    next: "m02",
    target: { site: "gas" },
    reward: [["arrow", 6]],
    stages: [
      {
        desc: "Доберись до старой заправки.",
        goals: [{ type: "visit", target: "gas", label: "Старая заправка" }],
        target: { site: "gas" },
      },
      {
        desc: "Освободи человека из подсобки.",
        goals: [
          { type: "interact", target: "gas_door", label: "Разобрать завал" },
        ],
        target: { object: "gas_door" },
      },
      {
        desc: "Шум привлёк заражённых. Защити Олега.",
        goals: [
          {
            type: "kill",
            group: "gas_rescue",
            n: 3,
            label: "Зомби у заправки",
          },
        ],
        target: { site: "gas" },
      },
      {
        desc: "Поговори с Олегом.",
        goals: [{ type: "talk", target: "oleg", label: "Олег" }],
        target: { npc: "oleg" },
      },
      {
        desc: "Найди батарею и настрой старую рацию.",
        goals: [
          { type: "collect", id: "battery", n: 1, label: "Батарея" },
          { type: "interact", target: "gas_radio", label: "Настроить рацию" },
        ],
        target: { object: "gas_radio" },
      },
    ],
  },
  {
    id: "m02",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Женщина с лекарствами",
    desc: "Нина знает дорогу к мотелю. В её сумке — лекарства для раненых.",
    next: "m03",
    target: { npc: "nina" },
    stages: [
      {
        desc: "Поговори с Ниной у заправки.",
        goals: [{ type: "talk", target: "nina", label: "Нина" }],
        target: { npc: "nina" },
      },
      {
        desc: "Сопроводи Нину к мотелю. G — следовать или ждать.",
        goals: [
          {
            type: "rescue",
            target: "nina",
            camp: "motel",
            label: "Довести Нину до мотеля",
          },
        ],
        target: { site: "motel" },
      },
      {
        desc: "Пройди проверку у ворот.",
        goals: [{ type: "talk", target: "gromov", label: "Громов" }],
        target: { npc: "gromov" },
      },
    ],
  },
  {
    id: "m03",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Право на ночлег",
    desc: "Громов разрешил остаться, если ты поможешь с укреплениями и светом.",
    next: "m04",
    target: { npc: "victor" },
    effects: { home: true },
    stages: [
      {
        desc: "Передай Виктору материалы через диалог.",
        goals: [
          { type: "deliver", id: "wood", n: 4, npc: "victor", label: "Дерево" },
          {
            type: "deliver",
            id: "scrap",
            n: 4,
            npc: "victor",
            label: "Металлолом",
          },
        ],
        target: { npc: "victor" },
      },
      {
        desc: "Укрепи проём у внутреннего двора.",
        goals: [
          {
            type: "interact",
            target: "motel_barricade",
            label: "Укрепить проём",
          },
        ],
        target: { object: "motel_barricade" },
      },
      {
        desc: "Добудь деталь и литр бензина. В кладовой есть аварийный тайник.",
        goals: [
          { type: "collect", id: "part", n: 1, label: "Деталь" },
          { type: "collect", id: "fuel", n: 1, label: "Бензин" },
        ],
        target: { object: "motel_emergency_cache" },
      },
      {
        desc: "Почини генератор.",
        goals: [
          { type: "repair", target: "motel_generator", label: "Генератор" },
        ],
        target: { object: "motel_generator" },
      },
      {
        desc: "Покажись Ирине и получи ключ от номера.",
        goals: [{ type: "talk", target: "irina", label: "Ирина" }],
        target: { npc: "irina" },
      },
    ],
  },
  {
    id: "m04",
    kind: "main",
    chapter: "II. Дом",
    name: "Общий стол",
    desc: "Мотель живёт не только стенами. Помоги кухне и лазарету.",
    next: "m05",
    reward: [["meal", 2]],
    stages: [
      {
        desc: "Передай Нине три банки еды.",
        goals: [
          { type: "deliver", id: "can", n: 3, npc: "nina", label: "Тушёнка" },
        ],
        target: { npc: "nina" },
      },
      {
        desc: "Передай Ирине два бинта.",
        goals: [
          { type: "deliver", id: "meds", n: 2, npc: "irina", label: "Бинты" },
        ],
        target: { npc: "irina" },
      },
      {
        desc: "Познакомься с Леной и Виктором.",
        goals: [
          { type: "talk", target: "lena", label: "Лена" },
          { type: "talk", target: "victor", label: "Виктор" },
        ],
        target: { npc: "lena" },
      },
    ],
  },
  {
    id: "m05",
    kind: "main",
    chapter: "II. Дом",
    name: "Список допуска",
    desc: "В ресепшене осталась папка первых дней. Марк был среди этих записей.",
    next: "m06",
    stages: [
      {
        desc: "Осмотри папку в ресепшене.",
        goals: [
          { type: "interact", target: "motel_list", label: "Список допуска" },
        ],
        target: { object: "motel_list" },
      },
      {
        desc: "Спроси Громова и Ирину о списке.",
        goals: [
          { type: "talk", target: "gromov", label: "Версия охраны" },
          { type: "talk", target: "irina", label: "Версия медиков" },
        ],
        target: { npc: "gromov" },
      },
    ],
  },
  {
    id: "m06",
    kind: "main",
    chapter: "II. Дом",
    name: "Номер девять",
    desc: "В списке слишком много отказов для дома, где до сих пор заперта пустая комната.",
    next: "m07",
    stages: [
      {
        desc: "Поговори с Ниной о закрытом номере.",
        goals: [{ type: "talk", target: "nina", label: "Ключ или вскрытие" }],
        target: { npc: "nina" },
      },
      {
        desc: "Открой номер девять.",
        goals: [{ type: "interact", target: "motel_room9", label: "Дверь №9" }],
        target: { object: "motel_room9" },
      },
      {
        desc: "Сопоставь комнату с регистрационной книгой.",
        goals: [
          {
            type: "interact",
            target: "motel_registry",
            label: "Регистрационная книга",
          },
        ],
        target: { object: "motel_registry" },
      },
      {
        desc: "Поговори с Виктором о свободных местах.",
        goals: [{ type: "talk", target: "victor", label: "Виктор" }],
        target: { npc: "victor" },
      },
    ],
  },
  {
    id: "m07",
    kind: "main",
    chapter: "III. Имена",
    name: "Вырванная смена",
    desc: "Полиция и больница вели собственные записи. Они помогут восстановить первые дни.",
    next: "m08",
    stages: [
      {
        desc: "Найди журнал в участке и медицинскую карту в больнице.",
        goals: [
          { type: "interact", target: "police_log", label: "Журнал дежурств" },
          {
            type: "interact",
            target: "hospital_card",
            label: "Карта сортировки",
          },
        ],
        target: { object: "police_log" },
      },
      {
        desc: "Покажи находки Ирине.",
        goals: [{ type: "talk", target: "irina", label: "Сопоставить записи" }],
        target: { npc: "irina" },
      },
    ],
  },
  {
    id: "m08",
    kind: "main",
    chapter: "III. Имена",
    name: "Живые имена",
    desc: "Артём и Софья из списка могли выжить. Найди их и выведи в безопасное место.",
    next: "m09",
    stages: [
      {
        desc: "Освободи Артёма из складской комнаты супермаркета.",
        goals: [
          {
            type: "interact",
            target: "market_store_room",
            label: "Дверь склада",
          },
        ],
        target: { object: "market_store_room" },
      },
      {
        desc: "Выведи Артёма в любое открытое поселение. Если он погибнет, найди его записку.",
        goals: [
          {
            type: "rescue",
            target: "artem",
            label: "Спасти Артёма",
            alt: { type: "interact", target: "artem_note" },
          },
        ],
        target: { npc: "artem" },
      },
      {
        desc: "Освободи Софью из дома у больницы.",
        goals: [
          {
            type: "interact",
            target: "house_sofya_door",
            label: "Заклинившая дверь",
          },
        ],
        target: { object: "house_sofya_door" },
      },
      {
        desc: "Выведи Софью в безопасное поселение или найди её записи.",
        goals: [
          {
            type: "rescue",
            target: "sofya",
            label: "Спасти Софью",
            alt: { type: "interact", target: "sofya_note" },
          },
        ],
        target: { npc: "sofya" },
      },
      {
        desc: "Расскажи Нине, кого удалось найти.",
        goals: [{ type: "talk", target: "nina", label: "Вернуться к Нине" }],
        target: { npc: "nina" },
      },
    ],
  },
  {
    id: "m09",
    kind: "main",
    chapter: "III. Имена",
    name: "След к школе",
    desc: "Спасённые называют одно место: школа, где Вера собрала тех, кого не впустили.",
    next: "m10",
    stages: [
      {
        desc: "Доберись до школьного лагеря.",
        goals: [{ type: "visit", target: "school", label: "Школа" }],
        target: { site: "school" },
      },
      {
        desc: "Поговори с Верой о списке и Марке.",
        goals: [{ type: "talk", target: "vera", label: "Вера" }],
        target: { npc: "vera" },
      },
    ],
  },
  {
    id: "m10",
    kind: "main",
    chapter: "IV. Другая сторона",
    name: "Те, кого не пустили сюда",
    desc: "У школы тоже есть список отказов. В нём нет удобной чёрно-белой истории.",
    next: "m11",
    stages: [
      {
        desc: "Осмотри школьный журнал приёма.",
        goals: [
          {
            type: "interact",
            target: "school_refusals",
            label: "Журнал школы",
          },
        ],
        target: { object: "school_refusals" },
      },
      {
        desc: "Поговори с Павлом, которому отказали обе общины.",
        goals: [{ type: "talk", target: "pavel", label: "Павел" }],
        target: { npc: "pavel" },
      },
      {
        desc: "Вернись к Вере.",
        goals: [{ type: "talk", target: "vera", label: "Ответ Веры" }],
        target: { npc: "vera" },
      },
    ],
  },
  {
    id: "m11",
    kind: "main",
    chapter: "IV. Другая сторона",
    name: "Копия первой смены",
    desc: "Черновик школы и записи мотеля расходятся. Нужны личные пометки Нины.",
    next: "m12",
    stages: [
      {
        desc: "Найди копию первой смены в школе.",
        goals: [
          { type: "interact", target: "school_copy", label: "Копия списка" },
        ],
        target: { object: "school_copy" },
      },
      {
        desc: "Попроси у Нины её записи и сопоставь документы.",
        goals: [
          { type: "talk", target: "nina", label: "Записи Нины" },
          {
            type: "interact",
            target: "motel_compare",
            label: "Сопоставить версии",
          },
        ],
        target: { npc: "nina" },
      },
      {
        desc: "Спроси Виктора о поздних правках и мастерской.",
        goals: [{ type: "talk", target: "victor", label: "След Марка" }],
        target: { npc: "victor" },
      },
    ],
  },
  {
    id: "m12",
    kind: "main",
    chapter: "V. Марк",
    name: "Прерванный маршрут",
    desc: "Марк жив и держится в автомастерской. Дорога к нему завалена и небезопасна.",
    next: "m13",
    effects: { flag: "route_cleared" },
    stages: [
      {
        desc: "Доберись до автомастерской.",
        goals: [{ type: "visit", target: "workshop", label: "Автомастерская" }],
        target: { site: "workshop" },
      },
      {
        desc: "Верни груз и почини фургон. Нужна одна деталь.",
        goals: [
          {
            type: "interact",
            target: "workshop_crate",
            label: "Пропавший груз",
          },
          { type: "repair", target: "workshop_van", label: "Фургон" },
        ],
        target: { object: "workshop_crate" },
      },
      {
        desc: "Расчисть подход к мастерской.",
        goals: [
          {
            type: "kill",
            group: "workshop_route",
            n: 4,
            label: "Зомби на маршруте",
          },
        ],
        target: { site: "workshop" },
      },
    ],
  },
  {
    id: "m13",
    kind: "main",
    chapter: "V. Марк",
    name: "Старый спор",
    desc: "Марк не просит прощения и не спешит возвращаться. Сначала ему нужна помощь.",
    next: "m14",
    stages: [
      {
        desc: "Поговори с Марком.",
        goals: [{ type: "talk", target: "mark", label: "Встреча" }],
        target: { npc: "mark" },
      },
      {
        desc: "Отбей атаку на мастерскую.",
        goals: [
          {
            type: "kill",
            group: "mark_attack",
            n: 5,
            label: "Атака на мастерскую",
          },
        ],
        target: { site: "workshop" },
      },
      {
        desc: "Закончи разговор с Марком.",
        goals: [{ type: "talk", target: "mark", label: "Старый спор" }],
        target: { npc: "mark" },
      },
    ],
  },
  {
    id: "m14",
    kind: "main",
    chapter: "V. Марк",
    name: "Первоначальная версия",
    desc: "У Марка есть копия. Последняя часть осталась в служебном хранилище мотеля.",
    next: "m15",
    stages: [
      {
        desc: "Открой служебное хранилище.",
        goals: [
          { type: "interact", target: "motel_storage", label: "Хранилище" },
        ],
        target: { object: "motel_storage" },
      },
      {
        desc: "Предъяви находки Громову, Виктору и Ирине.",
        goals: [
          { type: "talk", target: "gromov", label: "Громов" },
          { type: "talk", target: "victor", label: "Виктор" },
          { type: "talk", target: "irina", label: "Ирина" },
        ],
        target: { npc: "gromov" },
      },
      {
        desc: "Восстанови первоначальный список.",
        goals: [
          {
            type: "interact",
            target: "motel_original",
            label: "Собрать первоначальный список",
          },
        ],
        target: { object: "motel_original" },
      },
    ],
  },
  {
    id: "m15",
    kind: "main",
    chapter: "VI. Последний список",
    name: "Ночь перед решением",
    desc: "Обе общины должны услышать правду. Но сначала нужно пережить приближающуюся стаю.",
    next: "m16",
    stages: [
      {
        desc: "Настрой рацию мотеля и свяжись со школой.",
        goals: [
          {
            type: "interact",
            target: "motel_final_radio",
            label: "Рация мотеля",
          },
        ],
        target: { object: "motel_final_radio" },
      },
      {
        desc: "Подготовь ворота и обсуди оборону с Громовым.",
        goals: [
          { type: "build", target: "motel_gate", label: "Подготовить ворота" },
          { type: "talk", target: "gromov", label: "План обороны" },
        ],
        target: { object: "motel_gate" },
      },
      {
        desc: "Начни оборону у рации, когда будешь готов.",
        goals: [
          {
            type: "interact",
            target: "motel_siege_start",
            label: "Начать осаду",
          },
        ],
        target: { object: "motel_siege_start" },
      },
      {
        desc: "Переживи три волны. Между ними можно лечиться и ремонтировать ворота.",
        goals: [
          { type: "defend", target: "motel_siege", label: "Оборона мотеля" },
        ],
        target: { site: "motel" },
      },
    ],
  },
  {
    id: "m16",
    kind: "main",
    chapter: "VI. Последний список",
    name: "Последний список",
    desc: "Теперь все знают достаточно. Осталось решить, как жить дальше.",
    stages: [
      {
        desc: "Собери жителей у восстановленного списка.",
        goals: [
          {
            type: "interact",
            target: "motel_final_list",
            label: "Общее собрание",
          },
        ],
        target: { object: "motel_final_list" },
      },
      {
        desc: "Поговори с Громовым и прими решение.",
        goals: [{ type: "ending", target: "any", label: "Выбор будущего" }],
        target: { npc: "gromov" },
      },
    ],
  },
];

export const SIDE_QUESTS = [
  {
    id: "s_boards",
    kind: "side",
    group: "survivors",
    name: "Доски для ворот",
    desc: "Виктор укрепит ворота мотеля.",
    unlock: { main: "m03" },
    giver: "victor",
    effects: { project: "gate", trust: { camp: "motel", n: 8 } },
    stages: [
      {
        goals: [
          { type: "deliver", id: "wood", n: 6, npc: "victor", label: "Дерево" },
          {
            type: "deliver",
            id: "scrap",
            n: 2,
            npc: "victor",
            label: "Металлолом",
          },
        ],
      },
    ],
  },
  {
    id: "s_irina",
    kind: "side",
    group: "survivors",
    name: "Полка Ирины",
    desc: "Два бинта для постоянного лазарета.",
    unlock: { main: "m03" },
    giver: "irina",
    effects: { project: "infirmary", trust: { camp: "motel", n: 8 } },
    stages: [
      {
        goals: [
          { type: "deliver", id: "meds", n: 2, npc: "irina", label: "Бинты" },
        ],
      },
    ],
  },
  {
    id: "s_dinner",
    kind: "side",
    group: "survivors",
    name: "Ужин для всех",
    desc: "Нина приготовит общий ужин и оставит запас.",
    unlock: { main: "m03" },
    giver: "nina",
    reward: [["meal", 2]],
    effects: { project: "kitchen", trust: { camp: "motel", n: 8 } },
    stages: [
      {
        goals: [
          { type: "deliver", id: "can", n: 3, npc: "nina", label: "Тушёнка" },
        ],
      },
    ],
  },
  {
    id: "s_tolya",
    kind: "side",
    group: "survivors",
    name: "Человек в прачечной",
    desc: "Толя заперт в прачечной супермаркета. Выведи его в поселение.",
    unlock: { main: "m04" },
    giver: "victor",
    stages: [
      {
        goals: [
          {
            type: "interact",
            target: "market_laundry",
            label: "Освободить Толю",
          },
        ],
      },
      { goals: [{ type: "rescue", target: "tolya", label: "Спасти Толю" }] },
    ],
  },
  {
    id: "s_school_meds",
    kind: "side",
    group: "survivors",
    name: "Аптечка для школы",
    desc: "Вере нужны бинты, антибиотик и инсулин.",
    unlock: { main: "m04" },
    giver: "vera",
    effects: {
      stock: {
        camp: "school",
        items: [
          ["meds", 2],
          ["antibiotics", 1],
          ["insulin", 1],
        ],
      },
      trust: { camp: "school", n: 12 },
    },
    stages: [
      {
        goals: [
          { type: "deliver", id: "meds", n: 2, npc: "vera", label: "Бинты" },
          {
            type: "deliver",
            id: "antibiotics",
            n: 1,
            npc: "vera",
            label: "Антибиотик",
          },
          {
            type: "deliver",
            id: "insulin",
            n: 1,
            npc: "vera",
            label: "Инсулин",
          },
        ],
      },
    ],
  },
  {
    id: "s_oleg_bag",
    kind: "side",
    group: "survivors",
    name: "Сумка Олега",
    desc: "На заправке осталась сумка его жены.",
    unlock: { main: "m02" },
    giver: "oleg",
    stages: [
      {
        goals: [{ type: "interact", target: "gas_bag", label: "Найти сумку" }],
      },
      { goals: [{ type: "talk", target: "oleg", label: "Вернуться к Олегу" }] },
    ],
  },
  {
    id: "s_two_doses",
    kind: "side",
    group: "survivors",
    name: "Две дозы",
    desc: "Лена и школьный пациент нуждаются в антибиотиках. Можно остановиться после одного решения или найти вторую дозу.",
    unlock: { main: "m04" },
    giver: "irina",
    stages: [
      {
        goals: [
          {
            type: "collect",
            id: "antibiotics",
            n: 1,
            label: "Найти антибиотик",
          },
        ],
        target: { object: "hospital_antibiotic_a" },
      },
      {
        goals: [
          {
            type: "deliver",
            id: "antibiotics",
            n: 1,
            npcs: ["lena", "vera"],
            label: "Передать одну дозу",
          },
        ],
      },
      {
        goals: [
          {
            type: "choice",
            target: "dose_decision",
            label: "Решить, искать ли вторую дозу",
          },
        ],
      },
    ],
  },
  {
    id: "s_last_ride",
    kind: "side",
    group: "survivors",
    name: "Последний рейс",
    desc: "Почини фургон, загрузи припасы и пригони его в мотель или школу.",
    unlock: { main: "m12" },
    giver: "mark",
    effects: { flag: "supply_route_ready" },
    stages: [
      {
        goals: [
          { type: "repair", target: "workshop_van", label: "Починить фургон" },
        ],
      },
      {
        goals: [
          {
            type: "load",
            target: "workshop_van_load",
            items: { can: 4, meds: 2 },
            label: "Загрузить 4 еды и 2 бинта",
          },
        ],
      },
      {
        goals: [
          {
            type: "deliverVehicle",
            target: "story_van",
            label: "Доставить фургон в поселение",
          },
        ],
      },
    ],
  },
  {
    id: "s_night_guest",
    kind: "side",
    group: "survivors",
    name: "Ночной приём",
    desc: "У ворот мотеля стучится незнакомец. Открой и защити его либо проводи к школе.",
    unlock: { main: "m05" },
    giver: "gromov",
    stages: [
      {
        goals: [
          {
            type: "interact",
            target: "motel_night_gate",
            label: "Ответить на стук ночью",
          },
        ],
      },
      {
        goals: [
          { type: "rescue", target: "night_guest", label: "Спасти незнакомца" },
        ],
      },
    ],
  },
  {
    id: "s_shift",
    kind: "side",
    group: "survivors",
    name: "Чужая смена",
    desc: "Саныч хранит копию приказа Громова.",
    unlock: { main: "m06" },
    giver: "sanych",
    stages: [
      {
        goals: [
          { type: "interact", target: "police_order", label: "Копия приказа" },
        ],
      },
      { goals: [{ type: "talk", target: "sanych", label: "Саныч" }] },
      {
        goals: [
          {
            type: "talk",
            target: "gromov",
            label: "Решить, что делать с приказом",
          },
        ],
      },
    ],
  },
  {
    id: "s_hospital",
    kind: "side",
    group: "survivors",
    name: "Тихая больница",
    desc: "Рая слышит ночной зов Матки. Убей её и верни медицинский склад.",
    unlock: { main: "m04" },
    giver: "raya",
    effects: {
      stock: {
        camp: "school",
        items: [
          ["meds", 4],
          ["antibiotics", 1],
        ],
      },
    },
    stages: [
      { goals: [{ type: "kill", zombieType: "boss", n: 1, label: "Матка" }] },
      {
        goals: [
          {
            type: "interact",
            target: "hospital_supply",
            label: "Медицинский склад",
          },
        ],
      },
    ],
  },
  {
    id: "s_names",
    kind: "side",
    group: "survivors",
    name: "Имена без пометок",
    desc: "Найди четыре личные вещи людей из списка и расскажи Нине их истории.",
    unlock: { main: "m05" },
    giver: "nina",
    stages: [
      {
        goals: [
          { type: "interact", target: "keepsake_photo", label: "Фотография" },
          { type: "interact", target: "keepsake_toy", label: "Игрушка" },
          { type: "interact", target: "keepsake_scarf", label: "Шарф" },
          { type: "interact", target: "keepsake_letter", label: "Письмо" },
        ],
      },
      { goals: [{ type: "talk", target: "nina", label: "Рассказать Нине" }] },
    ],
  },
];

export const QUESTS = MAIN_QUESTS;
export const ALL_QUESTS = [...MAIN_QUESTS, ...SIDE_QUESTS];
