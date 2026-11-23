export const DIALOGUES = [
  {
    id: "intro",
    npc: "gg",
    title: "Дэн",
    when: { main: "m00", stage: 0 },
    once: true,
    lines: [
      "Дэн: «Три года — и район не узнать. Пепел на дорогах, окна пустые. Марк, ты где-то здесь?»",
      "Дэн: «У старой заправки кто-то стучит изнутри. Живой. Значит, не всё потеряно.»",
      "Дэн: «Он не откроет, пока не убедится, что я не заражён. Снаряжение — в ящиках у колонок, во дворе.»",
      "Дэн: «WASD — идти, E — обыскать и говорить, маркер ведёт к цели. Начнём.»",
    ],
    choices: [{ text: "К заправке.", effects: {} }],
  },
  {
    id: "oleg_tutorial_door",
    npc: "oleg",
    title: "Олег",
    when: {
      any: [
        { main: "m00", stage: 0 },
        { main: "m00", stage: 1 },
        { main: "m00", stage: 2 },
      ],
    },
    lines: [
      "Олег: «Дверь завалена изнутри, не дёргай. Ящики во дворе, у колонок — там дерево, металл и бинты.»",
      "Олег: «Собери снаряжение, сделай стрелы и нож — потом поговорим. И руку проверь на мишени, прежде чем я открою.»",
    ],
  },
  {
    id: "oleg_tutorial",
    npc: "oleg",
    title: "Олег",
    when: { main: "m00", stage: 3 },
    lines: [
      "Олег: «Стрелы готовы? Хорошо. Лук не рви: зажми левую кнопку, дай дуге наполниться, отпусти. Мимо стены — мимо цели, тут всё честно.»",
      "Олег: «Нож возьми третьей клавишей. Подойди вплотную и бей слева. Не маши издалека — воздух мёртвых не держит.»",
      "Олег: «На дворе мишень. Сначала стрела, потом нож. Я подожду за дверью. Жить надоедает, но умирать ещё больше.»",
    ],
  },
  {
    id: "oleg_gas",
    npc: "oleg",
    title: "Олег",
    when: { main: "m01", stage: 3 },
    lines: [
      "Олег: «Я слышал, как она ходит снаружи. Не та уже походка. Понимаешь? Не та.»",
      "Олег: «Я Олег. Пришёл за женой, а заперся сам. Смешно, если рот не полон страха.»",
      "Олег: «В рации слышал Марка. Твоего Марка. Он говорил про мотель на старой трассе.»",
    ],
    choices: [
      {
        text: "Перевязать его рану. (−1 бинт)",
        when: { flag: "oleg_free", items: { meds: 1 } },
        effects: {
          takeItems: { meds: 1 },
          flag: "oleg_bandaged",
          trust: { camp: "park", n: 8 },
        },
      },
      {
        text: "«Идти можешь? Тогда не отставай от живых.»",
        effects: { flag: "oleg_hard" },
      },
    ],
  },
  {
    id: "oleg_bag_offer",
    npc: "oleg",
    title: "Олег",
    when: { sideAvailable: "s_oleg_bag" },
    lines: [
      "Олег: «В подсобке осталась её сумка. Лекарства тебе пригодятся. А фотография… если найдёшь, не выбрасывай.»",
    ],
    choices: [
      { text: "Я верну сумку.", effects: { startQuest: "s_oleg_bag" } },
    ],
  },
  {
    id: "oleg_bag_return",
    npc: "oleg",
    title: "Олег",
    when: { side: "s_oleg_bag", stage: 1 },
    critical: true,
    lines: [
      "Олег: «Ты нашёл. Я думал, захочу лекарства, а рука к фотографии тянется.»",
    ],
    choices: [
      {
        text: "Вернуть фотографию и лекарства.",
        effects: { flag: "oleg_memory", trust: { camp: "park", n: 10 } },
      },
      {
        text: "Оставить лекарства, фотографию отдать.",
        effects: {
          flag: "oleg_practical",
          items: [["meds", 2]],
          trust: { camp: "park", n: 3 },
        },
      },
    ],
  },
  {
    id: "oleg_default",
    npc: "oleg",
    title: "Олег, парковый лагерь",
    lines: [
      "Олег: «Я теперь стучу дважды, прежде чем открыть. Привычка. Зато ты по голосу отвечаешь, а не по зубам.»",
    ],
    choices: [
      {
        text: "Покажи склад и поручения парка.",
        effects: { openCamp: "park" },
      },
    ],
  },

  {
    id: "nina_road",
    npc: "nina",
    title: "Нина",
    when: { main: "m02", stage: 0 },
    lines: [
      "Нина: «Не помогай сумке. Помоги мне. Она тяжёлая, а я ещё тяжёлых разговоров не выношу.»",
      "Нина: «В мотеле не любят незнакомцев. Особенно с вопросами. Ты ведь с вопросами, да?»",
    ],
    choices: [
      {
        text: "«Пойдём. Если устанешь — скажи, подождём.»",
        effects: { follow: "nina", flag: "nina_kind" },
      },
    ],
    critical: true,
  },
  {
    id: "nina_m03_dinner",
    npc: "nina",
    title: "Нина",
    when: { main: "m04", stage: 0 },
    lines: [
      "Нина: «Три банки — и я сделаю вид, что у нас нормальный ужин. Людям нужен такой вид.»",
    ],
    choices: [
      {
        text: "Отдать еду для общего стола.",
        effects: { deliverQuest: "m04", npc: "nina" },
      },
    ],
  },
  {
    id: "nina_room9",
    npc: "nina",
    title: "Нина",
    when: { main: "m06", stage: 0 },
    lines: [
      "Нина: «Девятка не проклята. Просто Виктор любил складывать там ящики, а Громов — закрывать разговоры.»",
      "Нина: «Ключ у меня. Можешь взять его. Можешь ломать дверь, но весь мотель услышит.»",
    ],
    choices: [
      { text: "Попросить ключ.", effects: { flag: "room9_key" } },
      { text: "Вскрыть дверь самому.", effects: { flag: "room9_force" } },
    ],
    critical: true,
  },
  {
    id: "nina_m08",
    npc: "nina",
    title: "Нина",
    when: { main: "m08", stage: 4 },
    lines: [
      "Нина: «Артём любил кориандр, а Софья всегда путала чашки. В списке этого нет. Поэтому список и страшный — слишком короткий.»",
      "Нина: «Школа? Да, они ушли туда. Вера обещала не повторять наших решений. Обещания такие удобные, пока не стучатся новые люди.»",
    ],
  },
  {
    id: "nina_m11",
    npc: "nina",
    title: "Нина",
    when: { main: "m11", stage: 1 },
    lines: [
      "Нина: «Я записывала не решения. Кто плакал, кто вернулся, кого обещали позвать позже. Для бумажной работы я не годилась. Для памяти — очень.»",
    ],
    choices: [
      {
        text: "Взять её записи для сопоставления.",
        effects: { flag: "nina_notes", clue: "name_letter" },
      },
    ],
    critical: true,
  },
  {
    id: "nina_dinner_offer",
    npc: "nina",
    title: "Нина",
    when: { sideAvailable: "s_dinner" },
    lines: [
      "Нина: «Принеси три банки, и вечером у нас будет не пайка, а ужин. Разница — в том, кто сидит рядом.»",
    ],
    choices: [{ text: "Принесу еду.", effects: { startQuest: "s_dinner" } }],
  },
  {
    id: "nina_dinner_deliver",
    npc: "nina",
    title: "Нина",
    when: { side: "s_dinner", stage: 0 },
    lines: ["Нина: «Давай сюда. Сегодня никто не ест один в номере.»"],
    choices: [
      {
        text: "Отдать 3 тушёнки.",
        effects: { deliverQuest: "s_dinner", npc: "nina" },
      },
    ],
  },
  {
    id: "nina_names_offer",
    npc: "nina",
    title: "Нина",
    when: { sideAvailable: "s_names" },
    lines: [
      "Нина: «Если найдёшь вещи из списка, не оставляй их валяться. Я расскажу, кому они принадлежали.»",
    ],
    choices: [{ text: "Я буду смотреть.", effects: { startQuest: "s_names" } }],
  },
  {
    id: "nina_names_done",
    npc: "nina",
    title: "Нина",
    when: { side: "s_names", stage: 1 },
    lines: [
      "Нина: «Вот теперь это не четыре строки. Теперь это четыре человека. Спасибо. Мне больно, но спасибо.»",
    ],
  },
  {
    id: "nina_default",
    npc: "nina",
    title: "Нина, кухня мотеля",
    lines: [
      "Нина: «Если кастрюля пуста, я всё равно помешиваю. Чтобы слышно было жизнь, а не только ветер.»",
    ],
  },

  {
    id: "gromov_entry",
    npc: "gromov",
    title: "Громов",
    when: { main: "m02", stage: 2 },
    lines: [
      "Громов: «Стой у света. Укусы есть? Не спеши с ответом, я всё равно проверю.»",
      "Громов: «Марк был здесь. Ушёл. Добровольно — это если тебе важна формулировка. Остальное после работы.»",
    ],
    choices: [
      {
        text: "«Я пришёл помочь, не судить.»",
        effects: { flag: "gromov_calm", trust: { camp: "motel", n: 8 } },
      },
      {
        text: "«Мне нужны ответы, а не разрешение.»",
        effects: { flag: "gromov_tense", trust: { camp: "motel", n: 2 } },
      },
    ],
    critical: true,
  },
  {
    id: "gromov_list",
    npc: "gromov",
    title: "Громов",
    when: { main: "m05", stage: 1 },
    lines: [
      "Громов: «Да, я закрыл ворота. После того, как один изнутри вцепился в горло дежурного.»",
      "Громов: «Ты не видел очередь. Я видел. Но комнаты… комнаты спроси у Виктора. Я отвечал не за койки, а за живых.»",
    ],
  },
  {
    id: "gromov_m14",
    npc: "gromov",
    title: "Громов",
    when: { main: "m14", stage: 1 },
    lines: [
      "Громов: «Я убрал “временно”. Иначе каждый день начинался бы заново: кого вернуть, кого проверить, кого впустить.»",
      "Громов: «Это была не правда. Это был порядок. Тогда я ещё верил, что между ними есть разница поменьше.»",
    ],
  },
  {
    id: "gromov_siege_plan",
    npc: "gromov",
    title: "Громов",
    when: { main: "m15", stage: 1 },
    lines: [
      "Громов: «Грузовик ведёт за собой больницу. Люди спорят у списка вместо постов. Красиво придумал конец света, да?»",
      "Громов: «Генератор даст свет и рацию. И шум. Решай, что нам важнее.»",
    ],
    choices: [
      {
        text: "Оставить генератор включённым.",
        effects: { generatorOn: true, flag: "siege_lit" },
      },
      {
        text: "Заглушить генератор перед атакой.",
        effects: { generatorOn: false, flag: "siege_quiet" },
      },
    ],
  },
  {
    id: "gromov_final",
    npc: "gromov",
    title: "Последний список",
    when: { main: "m16", stage: 1 },
    critical: true,
    lines: [
      "Громов: «Больше никто не сможет сказать, что это была просто одна необходимая мера.»",
      "Марк: «И никто не сможет сказать, что мы все были чудовищами. Что теперь, Дэн?»",
      "Нина: «Только не решай так, будто нас здесь нет.»",
    ],
    choices: [
      {
        text: "Открыть ворота и попробовать жить вместе.",
        effects: { ending: "open" },
      },
      {
        text: "Сохранить мотель закрытым и порядок прежним.",
        effects: { ending: "closed" },
      },
      {
        text: "Передать документы и решение обеим общинам.",
        effects: { ending: "council" },
      },
    ],
  },
  {
    id: "gromov_night_offer",
    npc: "gromov",
    title: "Громов",
    when: { sideAvailable: "s_night_guest" },
    lines: [
      "Громов: «После темноты кто-то стучит. Можешь взять дежурство на себя. Только тогда и отвечать будешь ты.»",
    ],
    choices: [
      { text: "Я проверю стук.", effects: { startQuest: "s_night_guest" } },
    ],
  },
  {
    id: "gromov_shift",
    npc: "gromov",
    title: "Громов",
    when: { side: "s_shift", stage: 2 },
    lines: [
      "Громов: «Копия Саныча. Значит, он всё-таки оставил себе доказательство, а мне — выбор, когда за него отвечать.»",
    ],
    choices: [
      {
        text: "Показать приказ всем.",
        effects: { flag: "order_public", trust: { camp: "motel", n: -5 } },
      },
      {
        text: "Сначала оставить это между нами.",
        effects: { flag: "order_private", trust: { camp: "motel", n: 5 } },
      },
      {
        text: "Оставить копию в архиве улик.",
        effects: { flag: "order_archived" },
      },
    ],
    critical: true,
  },
  {
    id: "gromov_default",
    npc: "gromov",
    title: "Громов, охрана мотеля",
    lines: [
      "Громов: «Я не прошу полюбить правила. Я прошу пережить их. Хотя в последнее время сам уже не знаю, что звучит хуже.»",
    ],
    choices: [
      { text: "Перейти к делам мотеля.", effects: { openCamp: "motel" } },
    ],
  },

  {
    id: "victor_m03",
    npc: "victor",
    title: "Виктор",
    when: { main: "m03", stage: 0 },
    lines: [
      "Виктор: «Четыре дерева, четыре лома. Не проси меня сделать из воздуха забор. Из воздуха у нас только обещания.»",
    ],
    choices: [
      {
        text: "Передать материалы.",
        effects: { deliverQuest: "m03", npc: "victor" },
      },
    ],
  },
  {
    id: "victor_m04",
    npc: "victor",
    title: "Виктор",
    when: { main: "m04", stage: 2 },
    lines: [
      "Виктор: «Ты теперь свой. Не в смысле семья. В смысле, знаю, кому кричать, когда генератор чихает.»",
    ],
  },
  {
    id: "victor_rooms",
    npc: "victor",
    title: "Виктор",
    when: { main: "m06", stage: 3 },
    lines: [
      "Виктор: «Да, девятка была свободна. Там стояли мои ящики. Людям я говорил “нет мест”, потому что не хотел решать, чьи вещи выбросить.»",
      "Виктор: «Удобно? Удобно. Страшно было не это. Страшно, что потом я начал верить в собственную формулировку.»",
    ],
  },
  {
    id: "victor_m11",
    npc: "victor",
    title: "Виктор",
    when: { main: "m11", stage: 2 },
    lines: [
      "Виктор: «Марк возил груз в мастерскую за школой. После нашего последнего разговора он перестал ждать разрешения.»",
      "Виктор: «Я правил список. Не потому что люди были плохие. Потому что бумага с чистыми причинами легче ложится в папку.»",
    ],
  },
  {
    id: "victor_m14",
    npc: "victor",
    title: "Виктор",
    when: { main: "m14", stage: 1 },
    lines: [
      "Виктор: «Склады были полнее, чем я говорил. Я боялся, что если всё отдать сразу, завтра мы начнём есть друг друга. Не буквально. Хотя кто знает.»",
    ],
  },
  {
    id: "victor_boards_offer",
    npc: "victor",
    title: "Виктор",
    when: { sideAvailable: "s_boards" },
    lines: [
      "Виктор: «Шесть досок и два лома. Ворота должны держать не на моём авторитете.»",
    ],
    choices: [
      { text: "Соберу материалы.", effects: { startQuest: "s_boards" } },
    ],
  },
  {
    id: "victor_boards_deliver",
    npc: "victor",
    title: "Виктор",
    when: { side: "s_boards", stage: 0 },
    lines: ["Виктор: «Ну? Руки не пустые или опять принёс вопросы?»"],
    choices: [
      {
        text: "Отдать материалы для ворот.",
        effects: { deliverQuest: "s_boards", npc: "victor" },
      },
    ],
  },
  {
    id: "victor_tolya_offer",
    npc: "victor",
    title: "Виктор",
    when: { sideAvailable: "s_tolya" },
    lines: [
      "Виктор: «Толя остался в прачечной магазина. Он зануда, но умеет чинить. Мне зануды в хозяйстве полезны.»",
    ],
    choices: [{ text: "Я его выведу.", effects: { startQuest: "s_tolya" } }],
  },
  {
    id: "victor_default",
    npc: "victor",
    title: "Виктор, снабжение",
    lines: [
      "Виктор: «Не называй это барахлом. Барахло — то, что не пригодилось вовремя. У нас всё пригодится.»",
    ],
    choices: [
      {
        text: "Покажи склад и проекты мотеля.",
        effects: { openCamp: "motel" },
      },
    ],
  },

  {
    id: "irina_home",
    npc: "irina",
    title: "Ирина",
    when: { main: "m03", stage: 4 },
    lines: [
      "Ирина: «Укуса нет. Лихорадки нет. Ты можешь остаться. Не обещаю, что здесь безопасно. Обещаю, что скажу, если станет хуже.»",
      "Ирина: «Третий номер снизу — твой. Закрой дверь. Иногда человеку нужно именно это, а не ещё один подвиг.»",
    ],
  },
  {
    id: "irina_m04",
    npc: "irina",
    title: "Ирина",
    when: { main: "m04", stage: 1 },
    lines: [
      "Ирина: «Два бинта. Один — для раны, второй — чтобы следующий раненый не услышал “подожди до утра”.»",
    ],
    choices: [
      {
        text: "Передать бинты.",
        effects: { deliverQuest: "m04", npc: "irina" },
      },
    ],
  },
  {
    id: "irina_list",
    npc: "irina",
    title: "Ирина",
    when: { main: "m05", stage: 1 },
    lines: [
      "Ирина: «Я решала, кого можно осмотреть, а кого нельзя. Потом устала и начала называть это медицинскими критериями.»",
      "Ирина: «Были настоящие заражённые. Были просто кашель, грязь и страх. Не все мои решения можно отличить задним числом.»",
    ],
  },
  {
    id: "irina_m07",
    npc: "irina",
    title: "Ирина",
    when: { main: "m07", stage: 1 },
    lines: [
      "Ирина: «Да, эта карта моя. Видишь второй осмотр? В итоговом списке его нет. Я позволила себе не заметить, когда он исчез.»",
    ],
  },
  {
    id: "irina_m14",
    npc: "irina",
    title: "Ирина",
    when: { main: "m14", stage: 1 },
    lines: [
      "Ирина: «Я не переписывала список. Я просто молчала. В лазарете молчание тоже бывает действием, Дэн.»",
    ],
  },
  {
    id: "irina_offer",
    npc: "irina",
    title: "Ирина",
    when: { sideAvailable: "s_irina" },
    lines: [
      "Ирина: «Принеси два бинта отдельно для лазарета. Тогда я перестану выбирать между тобой и остальными по утрам.»",
    ],
    choices: [{ text: "Я найду бинты.", effects: { startQuest: "s_irina" } }],
  },
  {
    id: "irina_deliver",
    npc: "irina",
    title: "Ирина",
    when: { side: "s_irina", stage: 0 },
    lines: [
      "Ирина: «Клади на чистую полку. Грязная у меня для инструментов и оправданий.»",
    ],
    choices: [
      {
        text: "Отдать два бинта.",
        effects: { deliverQuest: "s_irina", npc: "irina" },
      },
    ],
  },
  {
    id: "irina_doses_offer",
    npc: "irina",
    title: "Ирина",
    when: { sideAvailable: "s_two_doses" },
    lines: [
      "Ирина: «Лене нужен антибиотик. В школе тоже есть пациент. В больнице может быть одна доза, может две — если полезешь дальше.»",
      "Ирина: «Я не скажу, кому отдать. Я слишком часто говорила это другим.»",
    ],
    choices: [
      { text: "Я поищу лекарство.", effects: { startQuest: "s_two_doses" } },
    ],
  },
  {
    id: "irina_default",
    npc: "irina",
    title: "Ирина, лазарет",
    lines: ["Ирина: «Не геройствуй с температурой. Она не впечатляется.»"],
    choices: [
      { text: "Открыть услуги лазарета.", effects: { openCamp: "motel" } },
    ],
  },

  {
    id: "lena_intro",
    npc: "lena",
    title: "Лена",
    when: { main: "m04", stage: 2 },
    lines: [
      "Лена: «Рука не укушена. Все спрашивают первым делом. Потом уже имя.»",
      "Лена: «Меня Виктор впустил через служебный вход. Поэтому я и молчу, когда вспоминают тех, кто стоял у главных ворот.»",
    ],
  },
  {
    id: "lena_dose",
    npc: "lena",
    title: "Лена",
    when: { side: "s_two_doses", stage: 1, notFlag: "dose_lena" },
    lines: [
      "Лена: «Если отдашь лекарство мне, я не скажу, что ты выбрал правильно. Я просто постараюсь выжить.»",
    ],
    choices: [
      {
        text: "Отдать антибиотик Лене.",
        effects: { deliverQuest: "s_two_doses", npc: "lena" },
      },
    ],
  },
  {
    id: "lena_dose_first_decision",
    npc: "lena",
    title: "Лена",
    when: { side: "s_two_doses", stage: 2, notFlag: "second_dose" },
    critical: true,
    lines: [
      "Лена: «В школе тоже ждут. Не превращай меня в причину, по которой ты должен вернуться. Реши сам.»",
    ],
    choices: [
      {
        text: "Найти вторую дозу.",
        effects: {
          flag: "second_dose",
          gotoStage: { id: "s_two_doses", stage: 0 },
        },
      },
      {
        text: "Завершить на этом решении.",
        effects: { choice: "dose_decision", flag: "doses_settled" },
      },
    ],
  },
  {
    id: "lena_dose_second_decision",
    npc: "lena",
    title: "Лена",
    when: { side: "s_two_doses", stage: 2, flag: "second_dose" },
    critical: true,
    lines: [
      "Лена: «Значит, две дозы. Не делай из этого урок. Просто сегодня хватило на двоих.»",
    ],
    choices: [
      {
        text: "Записать обе истории.",
        effects: { choice: "dose_decision", flag: "doses_both" },
      },
    ],
  },
  {
    id: "lena_default",
    npc: "lena",
    title: "Лена",
    lines: [
      "Лена: «Я учусь отвечать на стук. Пока получается плохо, зато открываю.»",
    ],
  },

  {
    id: "vera_school",
    npc: "vera",
    title: "Вера",
    when: { main: "m09", stage: 1 },
    lines: [
      "Вера: «Я знаю, кто ты. Мотель пишет о людях лучше, чем говорит с ними.»",
      "Вера: «Марк жив. Был здесь, потом ушёл в мастерскую. Он помогал нам. И да, мы тоже закрывали дверь. Не стану делать из тебя ещё одного человека, которому приятно нас ненавидеть.»",
    ],
    choices: [
      {
        text: "Оставить школе бинт.",
        when: { items: { meds: 1 } },
        effects: {
          takeItems: { meds: 1 },
          trust: { camp: "school", n: 10 },
          flag: "school_helped",
        },
      },
      {
        text: "«Я пришёл слушать, не обвинять.»",
        effects: { trust: { camp: "school", n: 4 }, flag: "school_listened" },
      },
    ],
    critical: true,
  },
  {
    id: "vera_m10",
    npc: "vera",
    title: "Вера",
    when: { main: "m10", stage: 2 },
    lines: [
      "Вера: «Павла мы не пустили после второго случая заражения. Он выжил. Это не делает моё решение добрым. Только показывает, что я не могу спрятаться за его смертью.»",
    ],
  },
  {
    id: "vera_meds_offer",
    npc: "vera",
    title: "Вера",
    when: { sideAvailable: "s_school_meds", sideNotActive: "s_two_doses" },
    lines: [
      "Вера: «Два бинта, антибиотик и инсулин. Дети не перестают болеть из-за конца света. Они вообще очень невежливы в этом смысле.»",
    ],
    choices: [
      { text: "Я принесу аптечку.", effects: { startQuest: "s_school_meds" } },
    ],
  },
  {
    id: "vera_meds_deliver",
    npc: "vera",
    title: "Вера",
    when: { side: "s_school_meds", stage: 0, sideNotActive: "s_two_doses" },
    lines: [
      "Вера: «Сюда. Названия я перепишу, чтобы никто не выпил инсулин от испуга.»",
    ],
    choices: [
      {
        text: "Передать содержимое аптечки.",
        effects: { deliverQuest: "s_school_meds", npc: "vera" },
      },
    ],
  },
  {
    id: "vera_dose",
    npc: "vera",
    title: "Вера",
    when: { side: "s_two_doses", stage: 1, notFlag: "dose_vera" },
    lines: [
      "Вера: «Если это единственная доза, не объясняй ребёнку мораль. Просто скажи, где она осталась.»",
    ],
    choices: [
      {
        text: "Отдать антибиотик школе.",
        effects: { deliverQuest: "s_two_doses", npc: "vera" },
      },
    ],
  },
  {
    id: "vera_dose_first_decision",
    npc: "vera",
    title: "Вера",
    when: { side: "s_two_doses", stage: 2, notFlag: "second_dose" },
    critical: true,
    lines: [
      "Вера: «Ты можешь остановиться. Или найти вторую. Только не делай вид, что время само всё решило.»",
    ],
    choices: [
      {
        text: "Вернуться за второй дозой.",
        effects: {
          flag: "second_dose",
          gotoStage: { id: "s_two_doses", stage: 0 },
        },
      },
      {
        text: "Завершить на этом решении.",
        effects: { choice: "dose_decision", flag: "doses_settled" },
      },
    ],
  },
  {
    id: "vera_dose_second_decision",
    npc: "vera",
    title: "Вера",
    when: { side: "s_two_doses", stage: 2, flag: "second_dose" },
    critical: true,
    lines: [
      "Вера: «Обе дозы нашлись. Сегодня я запишу не количество, а то, что ты вернулся.»",
    ],
    choices: [
      {
        text: "Завершить миссию.",
        effects: { choice: "dose_decision", flag: "doses_both" },
      },
    ],
  },
  {
    id: "vera_default",
    npc: "vera",
    title: "Вера, школьная община",
    lines: [
      "Вера: «У нас уроки не начались заново. Но по вечерам я читаю вслух. Чтобы дети слышали обычные предложения.»",
    ],
    choices: [
      { text: "Показать школьные дела.", effects: { openCamp: "school" } },
    ],
  },

  {
    id: "sanych_offer",
    npc: "sanych",
    title: "Саныч",
    when: { sideAvailable: "s_shift" },
    lines: [
      "Саныч: «Громов мой бывший начальник и бывший хороший человек. Обе вещи иногда одновременно. Есть копия его приказа. Хочешь — найди в архиве.»",
    ],
    choices: [
      { text: "Я посмотрю архив.", effects: { startQuest: "s_shift" } },
    ],
  },
  {
    id: "sanych_copy",
    npc: "sanych",
    title: "Саныч",
    when: { side: "s_shift", stage: 1 },
    lines: [
      "Саныч: «Я тогда сказал ему: временные решения нельзя стирать. Он ответил, что люди не возвращаются. А они возвращались. Мы просто уже не открывали.»",
    ],
  },
  {
    id: "sanych_default",
    npc: "sanych",
    title: "Саныч, полицейский лагерь",
    lines: [
      "Саныч: «У нас порядок простой: не стрелять по своим, не называть страх законом. Второе сложнее.»",
    ],
    choices: [
      { text: "Показать дела участка.", effects: { openCamp: "police" } },
    ],
  },

  {
    id: "raya_offer",
    npc: "raya",
    title: "Рая",
    when: { sideAvailable: "s_hospital" },
    lines: [
      "Рая: «По ночам во дворе зовёт Матка. Не голосом — всем зданием. Если убьёшь её, я открою медицинский склад.»",
    ],
    choices: [{ text: "Я попробую.", effects: { startQuest: "s_hospital" } }],
  },
  {
    id: "raya_default",
    npc: "raya",
    title: "Рая, больница",
    lines: [
      "Рая: «Не трогай холодильник без списка. Лекарство тоже может быть чьей-то последней надеждой.»",
    ],
  },

  {
    id: "mark_met",
    npc: "mark",
    title: "Марк",
    when: { main: "m13", stage: 0 },
    critical: true,
    lines: [
      "Марк: «Ты всё-таки пришёл. Не за списком. За мной. Поэтому и список нашёлся.»",
      "Марк: «Поговорим после. Слышишь двор? Они идут на шум фургона.»",
    ],
    choices: [
      {
        text: "«Сначала живые. Потом старые счёты.»",
        effects: { flag: "mark_met", spawnGroup: "mark_attack" },
      },
    ],
  },
  {
    id: "mark_talk",
    npc: "mark",
    title: "Марк",
    when: { main: "m13", stage: 2 },
    critical: true,
    lines: [
      "Марк: «Я открыл ворота для семьи. Внутрь вошли не только они. Человек погиб. Я помог ему? Да. Я отвечал за последствия? Нет.»",
      "Дэн: «Я уехал, когда ты просил помочь. Ты решал за двоих. Я оставил тебя одного. Оба мы умеем называть это принципами.»",
      "Марк: «Вот копия первой смены. Не используй её, чтобы снова уйти от разговора.»",
    ],
    choices: [
      {
        text: "Признать свой уход и извиниться.",
        effects: { mark: 2, flag: "mark_reconciled", clue: "mark_copy" },
      },
      {
        text: "Сказать, что он снова решил за других.",
        effects: { mark: -1, flag: "mark_blamed", clue: "mark_copy" },
      },
      {
        text: "Выслушать без оправданий и обвинений.",
        effects: { mark: 1, flag: "mark_listened", clue: "mark_copy" },
      },
    ],
  },
  {
    id: "mark_ride_offer",
    npc: "mark",
    title: "Марк",
    when: { sideAvailable: "s_last_ride", mainNot: "m13" },
    lines: [
      "Марк: «Фургон может сделать один настоящий рейс. Почини, загрузи еду и бинты. Кому повезёшь — выбирай дорогу, не мою биографию.»",
    ],
    choices: [
      { text: "Я сделаю этот рейс.", effects: { startQuest: "s_last_ride" } },
    ],
  },
  {
    id: "mark_default",
    npc: "mark",
    title: "Марк",
    lines: [
      "Марк: «Не знаю, станем ли мы прежними друзьями. Может, станем людьми, которые больше не уходят молча.»",
    ],
  },

  {
    id: "pavel_story",
    npc: "pavel",
    title: "Павел",
    when: { main: "m10", stage: 1 },
    lines: [
      "Павел: «Мотель сказал: заражён. Школа сказала: нет воды. Обе были правы немного. Спать мне от этого было не теплее.»",
      "Павел: «Я теперь здесь. Иногда сам смотрю на новых и думаю: а вдруг опять? Вот это самое страшное — я понимаю обе стороны.»",
    ],
  },
  {
    id: "pavel_default",
    npc: "pavel",
    title: "Павел",
    lines: [
      "Павел: «Я не свидетель обвинения. Я просто человек, который остался.»",
    ],
  },
];
