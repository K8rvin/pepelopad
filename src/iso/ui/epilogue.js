const ENDINGS = {
  open: {
    title: "Открытые ворота",
    text: "Мотель делится запасами и комнатами. Старые споры не исчезают, но теперь за ними можно разговаривать без закрытой двери.",
  },
  closed: {
    title: "Сохранённый порядок",
    text: "Мотель остаётся обеспеченным и осторожным. Школа живёт отдельно. Некоторые имена так и остаются только на бумаге.",
  },
  council: {
    title: "Решение людей",
    text: "Обе общины получают документы и спорят о будущем. Впервые результат не записан заранее одним дежурным.",
  },
};

export function showEpilogueScreen({
  root,
  ending,
  story,
  survivors,
  onClose,
}) {
  const base = ENDINGS[ending] || ENDINGS.council;
  const rescued = survivors.filter((s) => s.state === "rescued");
  const dead = survivors.filter((s) => s.state === "dead");
  const cards = [
    story.markRelation >= 2
      ? "Дэн и Марк не стали прежними. Они сделали что-то более трудное: остались разговаривать."
      : story.markRelation < 0
        ? "Марк не согласился с Дэном. Их последняя встреча закончилась без прощения, но и без новой лжи."
        : "Марк остался при своём решении. Между ним и Дэном появилась осторожная, неудобная возможность начать заново.",
    story.flags.doses_both
      ? "Лена и школьный пациент получили лекарство. Ирина записала не выбор, а две сохранённые жизни."
      : story.flags.doses_settled
        ? "Ирина не стала оценивать выбор лекарства. Она поставила рядом с именем дату — человек был жив и после него."
        : "Лена продолжает учиться открывать дверь, хотя по-прежнему вздрагивает от стука.",
    story.flags.oleg_memory
      ? "Олег поставил фотографию жены у костра. Иногда он рассказывает ей о дне."
      : "Олег не говорит о жене без необходимости. Но сумка больше не лежит в тёмной подсобке.",
    rescued.length
      ? `Спасённые: ${rescued.map((s) => s.name).join(", ")}. Теперь у них есть работа, место и завтрашний день.`
      : "Не все имена из списка удалось вернуть в живой мотель.",
    dead.length
      ? `Погибшие после попытки спасения: ${dead.map((s) => s.name).join(", ")}. Их записи сохранены.`
      : "",
    story.flags.council_united
      ? "Общее собрание закончилось общим расписанием дежурств. Это не мир навсегда, но уже не две отдельные версии истории."
      : story.flags.council_split
        ? "Собрание разошлось без единого решения. Зато никто не смог уничтожить копии и снова оставить людей без прошлого."
        : "",
  ].filter(Boolean);
  root.innerHTML = `<div class="epilogue-panel"><div class="load-title">${base.title}</div><p>${base.text}</p>${cards.map((text) => `<div class="epilogue-card">${text}</div>`).join("")}<button id="epilogueContinue">Продолжить жить в районе</button></div>`;
  root.style.display = "flex";
  root.querySelector("#epilogueContinue").addEventListener("click", () => {
    root.style.display = "none";
    root.innerHTML = "";
    onClose?.();
  });
}
