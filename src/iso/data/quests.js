export const MAIN_QUESTS = [
  {
    id: "m00",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Проверка Олега",
    desc: "Из-за двери заправки доносится голос Олега. Он впустит тебя только после того, как ты найдёшь снаряжение и покажешь, что умеешь с ним обращаться.",
    next: "m01",
    target: { site: "gas" },
    stages: [
      {
        desc: "Подойди к старой заправке.",
        goals: [{ type: "visit", target: "gas", label: "Старая заправка" }],
        target: { site: "gas" },
      },
      {
        desc: "Обыщи во дворе три ящика, отмеченные маркерами.",
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
        desc: "Нажми C, открой крафт и сделай стрелы, нож и аптечку.",
        goals: [
          { type: "craft", target: "arrows", label: "Стрелы" },
          { type: "craft", target: "knife", label: "Нож" },
          { type: "craft", target: "medkit", label: "Аптечка" },
        ],
        target: { site: "gas" },
      },
      {
        desc: "Переговори с Олегом через закрытую дверь.",
        goals: [{ type: "talk", target: "oleg", label: "Правила боя" }],
        target: { npc: "oleg" },
      },
      {
        desc: "Сначала попади в мишень из лука, потом подойди и ударь её ножом.",
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
    name: "Голос на заправке",
    desc: "По адресу Марка никого не оказалось. Зато на старой заправке кто-то заперт в подсобке и стучит в дверь.",
    next: "m02",
    target: { site: "gas" },
    reward: [["arrow", 6]],
    stages: [
      {
        desc: "Вернись к старой заправке.",
        goals: [{ type: "visit", target: "gas", label: "Старая заправка" }],
        target: { site: "gas" },
      },
      {
        desc: "Разбери завал и выпусти человека из подсобки.",
        goals: [
          { type: "interact", target: "gas_door", label: "Разобрать завал" },
        ],
        target: { object: "gas_door" },
      },
      {
        desc: "На шум пришли заражённые. Не дай им добраться до Олега.",
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
        desc: "Поговори с вызволенным Олегом.",
        goals: [{ type: "talk", target: "oleg", label: "Олег" }],
        target: { npc: "oleg" },
      },
      {
        desc: "Найди батарею, вставь её в старую рацию и настрой связь.",
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
    name: "Дорога к мотелю",
    desc: "Нина согласна показать дорогу к мотелю. В её сумке лекарства, которые там нужны раненым.",
    next: "m03",
    target: { npc: "nina" },
    stages: [
      {
        desc: "Поговори с Ниной возле заправки.",
        goals: [{ type: "talk", target: "nina", label: "Нина" }],
        target: { npc: "nina" },
      },
      {
        desc: "Проводи Нину до мотеля. Клавиша G велит ей идти следом или ждать на месте.",
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
        desc: "Вместе с Ниной пройди проверку у ворот.",
        goals: [{ type: "talk", target: "gromov", label: "Громов" }],
        target: { npc: "gromov" },
      },
    ],
  },
  {
    id: "m03",
    kind: "main",
    chapter: "I. Возвращение",
    name: "Ключ от номера",
    desc: "Громов готов оставить тебя в мотеле, если ты поможешь укрепить двор и снова запустить генератор.",
    next: "m04",
    target: { npc: "victor" },
    effects: { home: true },
    stages: [
      {
        desc: "Принеси Виктору материалы и передай их ему в разговоре.",
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
        desc: "Укрепи проём, который выходит во внутренний двор.",
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
        desc: "Найди деталь и литр бензина. В кладовой припрятан аварийный запас.",
        goals: [
          { type: "collect", id: "part", n: 1, label: "Деталь" },
          { type: "collect", id: "fuel", n: 1, label: "Бензин" },
        ],
        target: { object: "motel_emergency_cache" },
      },
      {
        desc: "Поставь деталь, залей бензин и почини генератор.",
        goals: [
          { type: "repair", target: "motel_generator", label: "Генератор" },
        ],
        target: { object: "motel_generator" },
      },
      {
        desc: "Зайди к Ирине за осмотром и ключом от своего номера.",
        goals: [{ type: "talk", target: "irina", label: "Ирина" }],
        target: { npc: "irina" },
      },
    ],
  },
  {
    id: "m04",
    kind: "main",
    chapter: "II. Дом",
    name: "За одним столом",
    desc: "В мотеле решают не только, как закрыть ворота. Нине нужна еда на общий ужин, Ирине — перевязка для раненых.",
    next: "m05",
    reward: [["meal", 2]],
    stages: [
      {
        desc: "Найди и отдай Нине три банки еды.",
        goals: [
          { type: "deliver", id: "can", n: 3, npc: "nina", label: "Тушёнка" },
        ],
        target: { npc: "nina" },
      },
      {
        desc: "Передай Ирине два бинта для лазарета.",
        goals: [
          { type: "deliver", id: "meds", n: 2, npc: "irina", label: "Бинты" },
        ],
        target: { npc: "irina" },
      },
      {
        desc: "Познакомься с Леной и поговори с Виктором.",
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
    desc: "В ресепшене сохранилась папка с записями первых дней. Среди фамилий встречается Марк.",
    next: "m06",
    stages: [
      {
        desc: "Найди и просмотри папку в ресепшене.",
        goals: [
          { type: "interact", target: "motel_list", label: "Список допуска" },
        ],
        target: { object: "motel_list" },
      },
      {
        desc: "Расспроси Громова и Ирину, кто составлял этот список и как он менялся.",
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
    name: "Девятый номер",
    desc: "Людям отказывали из-за нехватки мест, но девятый номер всё это время стоял запертым и пустым.",
    next: "m07",
    stages: [
      {
        desc: "Спроси Нину, почему закрыт девятый номер.",
        goals: [{ type: "talk", target: "nina", label: "Ключ или вскрытие" }],
        target: { npc: "nina" },
      },
      {
        desc: "Получи ключ или вскрой дверь девятого номера.",
        goals: [{ type: "interact", target: "motel_room9", label: "Дверь №9" }],
        target: { object: "motel_room9" },
      },
      {
        desc: "Осмотри комнату и сравни увиденное с регистрационной книгой.",
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
        desc: "Потребуй у Виктора объяснений насчёт свободных мест.",
        goals: [{ type: "talk", target: "victor", label: "Виктор" }],
        target: { npc: "victor" },
      },
    ],
  },
  {
    id: "m07",
    kind: "main",
    chapter: "III. Имена",
    name: "Недостающая смена",
    desc: "В участке и больнице вели свои журналы. По ним можно восстановить то, что исчезло из записей мотеля.",
    next: "m08",
    stages: [
      {
        desc: "Забери журнал дежурств в участке и медицинскую карту в больнице.",
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
        desc: "Принеси обе находки Ирине и сверь записи.",
        goals: [{ type: "talk", target: "irina", label: "Сопоставить записи" }],
        target: { npc: "irina" },
      },
    ],
  },
  {
    id: "m08",
    kind: "main",
    chapter: "III. Имена",
    name: "Люди за фамилиями",
    desc: "Артём и Софья из списка могли остаться в живых. Разыщи их и помоги добраться до поселения.",
    next: "m09",
    stages: [
      {
        desc: "Открой складскую комнату супермаркета и выпусти Артёма.",
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
        desc: "Проводи Артёма в любое открытое поселение. Если он погибнет, отыщи его записку.",
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
        desc: "Открой заклинившую дверь дома у больницы и выпусти Софью.",
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
        desc: "Доведи Софью до безопасного поселения. Если не удастся, найди оставленные ею записи.",
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
        desc: "Расскажи Нине, что стало с Артёмом и Софьей.",
        goals: [{ type: "talk", target: "nina", label: "Вернуться к Нине" }],
        target: { npc: "nina" },
      },
    ],
  },
  {
    id: "m09",
    kind: "main",
    chapter: "III. Имена",
    name: "Дорога к школе",
    desc: "Спасённые говорят про школьный лагерь. Вера собрала там людей, которым не нашлось места за воротами мотеля.",
    next: "m10",
    stages: [
      {
        desc: "Найди дорогу к школьному лагерю.",
        goals: [{ type: "visit", target: "school", label: "Школа" }],
        target: { site: "school" },
      },
      {
        desc: "Расспроси Веру о списке и о том, куда ушёл Марк.",
        goals: [{ type: "talk", target: "vera", label: "Вера" }],
        target: { npc: "vera" },
      },
    ],
  },
  {
    id: "m10",
    kind: "main",
    chapter: "IV. Другая сторона",
    name: "По обе стороны ворот",
    desc: "В школе тоже вели список отказов. Записи не дают простого ответа, кто был прав, а кто виноват.",
    next: "m11",
    stages: [
      {
        desc: "Прочитай школьный журнал приёма.",
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
        desc: "Поговори с Павлом: его не пустили ни в мотель, ни в школу.",
        goals: [{ type: "talk", target: "pavel", label: "Павел" }],
        target: { npc: "pavel" },
      },
      {
        desc: "Вернись к Вере и выслушай её объяснение.",
        goals: [{ type: "talk", target: "vera", label: "Ответ Веры" }],
        target: { npc: "vera" },
      },
    ],
  },
  {
    id: "m11",
    kind: "main",
    chapter: "IV. Другая сторона",
    name: "Разные копии",
    desc: "Школьный черновик не совпадает с бумагами мотеля. Личные записи Нины могут показать, где начались правки.",
    next: "m12",
    stages: [
      {
        desc: "Отыщи в школе копию списка первой смены.",
        goals: [
          { type: "interact", target: "school_copy", label: "Копия списка" },
        ],
        target: { object: "school_copy" },
      },
      {
        desc: "Попроси у Нины её записи, затем сопоставь обе версии документа.",
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
        desc: "Расспроси Виктора о поздних правках и о грузе, который Марк повёз в мастерскую.",
        goals: [{ type: "talk", target: "victor", label: "След Марка" }],
        target: { npc: "victor" },
      },
    ],
  },
  {
    id: "m12",
    kind: "main",
    chapter: "V. Марк",
    name: "Мастерская Марка",
    desc: "Марк жив и удерживает автомастерскую. Дорога туда завалена, а рядом слишком много заражённых.",
    next: "m13",
    effects: { flag: "route_cleared" },
    stages: [
      {
        desc: "Доберись до автомастерской.",
        goals: [{ type: "visit", target: "workshop", label: "Автомастерская" }],
        target: { site: "workshop" },
      },
      {
        desc: "Верни пропавший груз и почини фургон. На ремонт нужна одна деталь.",
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
        desc: "Уничтожь заражённых, которые перекрыли подход к мастерской.",
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
    desc: "После долгой разлуки Марк не спешит ни извиняться, ни возвращаться. Сначала мастерскую надо отбить у заражённых.",
    next: "m14",
    stages: [
      {
        desc: "Найди Марка и поговори с ним.",
        goals: [{ type: "talk", target: "mark", label: "Встреча" }],
        target: { npc: "mark" },
      },
      {
        desc: "Отбей атаку заражённых на мастерскую.",
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
        desc: "Когда двор будет безопасен, закончи разговор с Марком.",
        goals: [{ type: "talk", target: "mark", label: "Старый спор" }],
        target: { npc: "mark" },
      },
    ],
  },
  {
    id: "m14",
    kind: "main",
    chapter: "V. Марк",
    name: "Без слова «временно»",
    desc: "Марк отдал тебе свою копию. Недостающая часть документов лежит в служебном хранилище мотеля.",
    next: "m15",
    stages: [
      {
        desc: "Открой служебное хранилище мотеля.",
        goals: [
          { type: "interact", target: "motel_storage", label: "Хранилище" },
        ],
        target: { object: "motel_storage" },
      },
      {
        desc: "Покажи собранные документы Громову, Виктору и Ирине.",
        goals: [
          { type: "talk", target: "gromov", label: "Громов" },
          { type: "talk", target: "victor", label: "Виктор" },
          { type: "talk", target: "irina", label: "Ирина" },
        ],
        target: { npc: "gromov" },
      },
      {
        desc: "Сложи находки вместе и восстанови первоначальный список.",
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
    desc: "Правду должны услышать в мотеле и в школе. Но до общего разговора нужно пережить стаю, которая уже идёт к воротам.",
    next: "m16",
    stages: [
      {
        desc: "Настрой мотельную рацию и вызови школу.",
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
        desc: "Подготовь ворота к осаде и обсуди с Громовым, как встретить стаю.",
        goals: [
          { type: "build", target: "motel_gate", label: "Подготовить ворота" },
          { type: "talk", target: "gromov", label: "План обороны" },
        ],
        target: { object: "motel_gate" },
      },
      {
        desc: "Когда будешь готов, начни оборону у рации.",
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
        desc: "Продержись три волны. В перерывах можно лечиться и чинить ворота.",
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
    name: "Как жить дальше",
    desc: "Восстановленный список увидели все. Теперь жителям предстоит решить, что делать с воротами и друг с другом.",
    stages: [
      {
        desc: "Позови жителей к восстановленному списку.",
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
        desc: "Поговори с Громовым и выбери будущее мотеля.",
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
    desc: "Виктор просит шесть досок и два лома, чтобы укрепить ворота мотеля.",
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
    name: "Чистая полка",
    desc: "Ирине нужны два отдельных бинта, чтобы в лазарете оставался запас для раненых.",
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
    desc: "Принеси Нине три банки тушёнки: она соберёт жителей за одним столом и отложит часть еды про запас.",
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
    desc: "Толя не может выбраться из прачечной супермаркета. Открой дверь и проводи его в любое открытое поселение.",
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
    name: "Школьная аптечка",
    desc: "Собери для Веры два бинта, антибиотик и инсулин.",
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
    name: "Её сумка",
    desc: "В подсобке заправки осталась сумка жены Олега. Среди лекарств лежит дорогая ему фотография.",
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
    desc: "Антибиотик нужен Лене и больному в школе. Можно отдать единственную дозу или вернуться в больницу и поискать вторую.",
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
    desc: "Почини фургон Марка, загрузи припасы и отгони его в мотель или школу.",
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
    name: "Стук после темноты",
    desc: "Ночью к воротам мотеля стучится незнакомец. Впусти и защити его или проводи до школы.",
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
    desc: "Саныч сохранил копию приказа Громова. Найди её в архиве участка и реши, кому её показать.",
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
    desc: "По ночам Рая слышит вой Матки из больничного двора. Убей её, чтобы Рая снова открыла медицинский склад.",
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
    desc: "Найди фотографию, игрушку, шарф и письмо людей из списка. Нина расскажет, кому они принадлежали.",
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
