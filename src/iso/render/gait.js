// Варианты походки актёра (лаборатория выбора, клавиша G).
// Контракт: ctx уже свёрнут к точке ступней и отражён по прицелу/курсу;
// функция рисует спрайт (ноги в (0,0)) и возвращает bob торса для факела.
// u — пиксельная единица (zoom*scale), ph — фаза шага от дистанции, mv — идёт,
// alts — {side, front, back: {img,w,h}|null, dir} наборы кадров шага по
// направлениям; отсутствующий набор → деградация в B («пружинка»).

function idle(ctx, img, w, h) {
  ctx.drawImage(img, -w / 2, -h, w, h);
  return 0;
}

// A. «Бумажная кукла»: половины ног скользят в противофазе с подъёмом стопы
function doll(ctx, img, w, h, u, ph, mv) {
  if (!mv) return idle(ctx, img, w, h);
  const swing = Math.sin(ph);
  const bob = -Math.abs(Math.cos(ph)) * 1.6 * u;
  const legH = h * 0.42;
  const stepX = 2.4 * u;
  const lift = 1.8 * u;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -legH, w / 2 + 1, legH + 2);
  ctx.clip();
  ctx.translate(swing * stepX, -Math.max(0, swing) * lift);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -legH, w / 2 + 1, legH + 2);
  ctx.clip();
  ctx.translate(-swing * stepX, -Math.max(0, -swing) * lift);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -h - 4 * u, w + 2, h - legH + 3 * u);
  ctx.clip();
  ctx.translate(0, bob);
  ctx.rotate(0.03 + swing * 0.012);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return bob;
}

// B. «Пружинка»: цельный спрайт, bob на середине цикла + squash/stretch и
// лёгкий наклон; без разрезов — чистый силуэт, читается как бодрый шаг
function bob(ctx, img, w, h, u, ph, mv) {
  if (!mv) return idle(ctx, img, w, h);
  const b = -Math.abs(Math.cos(ph)) * 2.4 * u;
  const squash = 1 + Math.sin(ph * 2) * 0.025;
  ctx.save();
  ctx.translate(0, b);
  ctx.scale(1, squash);
  ctx.rotate(0.035 + Math.sin(ph) * 0.02);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return b;
}

// D. «Маятник от бедра»: половины ног вращаются вокруг таза в противофазе —
// ступни описывают дугу (естественный вынос), без скольжения по земле
function hiprot(ctx, img, w, h, u, ph, mv) {
  if (!mv) return idle(ctx, img, w, h);
  const swing = Math.sin(ph);
  const bob = -Math.abs(Math.cos(ph)) * 1.6 * u;
  const legH = h * 0.42;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(side < 0 ? -w / 2 - 1 : 0, -legH, w / 2 + 1, legH + 2);
    ctx.clip();
    ctx.translate(0, -legH);
    ctx.rotate(side * swing * 0.16);
    ctx.translate(0, legH);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -h - 4 * u, w + 2, h - legH + 3 * u);
  ctx.clip();
  ctx.translate(0, bob);
  ctx.rotate(0.03 + swing * 0.012);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return bob;
}

// E. «Колено»: половина ноги укорачивается от таза и приподнимается на пике
// swing (псевдо-сгиб колена) + малый вынос; шагающий, чуть «переступающий» вид
function knee(ctx, img, w, h, u, ph, mv) {
  if (!mv) return idle(ctx, img, w, h);
  const swing = Math.sin(ph);
  const bob = -Math.abs(Math.cos(ph)) * 1.8 * u;
  const legH = h * 0.42;
  for (const side of [-1, 1]) {
    const s = side * swing;
    const lift = Math.max(0, s) * 2.2 * u;
    const squash = 1 - Math.max(0, s) * 0.14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(side < 0 ? -w / 2 - 1 : 0, -legH, w / 2 + 1, legH + 2);
    ctx.clip();
    ctx.translate(s * 1.6 * u, -lift);
    ctx.translate(0, -legH);
    ctx.scale(1, squash);
    ctx.translate(0, legH);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -h - 4 * u, w + 2, h - legH + 3 * u);
  ctx.clip();
  ctx.translate(0, bob);
  ctx.rotate(0.03 + swing * 0.012);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return bob;
}

// кроссфейд двух поз: на границах полупериода текущая поза плавно сменяет
// предыдущую (окно 18%), внутри полупериода — чистая поза; без «пинг-понга»
function crossPose(ph, drawCur, drawPrev) {
  const f = (ph / Math.PI) % 1;
  const e = 0.18;
  const wCur = f < e ? f / e : f > 1 - e ? (1 - f) / e : 1;
  drawPrev(1 - wCur);
  drawCur(wCur);
}

// цикл «шаг+зеркало»: кадр шага и его зеркало (противоположная нога) по
// полупериодам с кроссфейдом; ракурс не меняется внутри цикла
function strideCycle(ctx, alt, ph, u) {
  const b = -Math.abs(Math.cos(ph)) * 1.6 * u;
  ctx.save();
  ctx.translate(0, b);
  ctx.rotate(0.03);
  const pose = Math.floor(ph / Math.PI) % 2;
  const draw = (mirror) => (alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(alt.img, -alt.w / 2, -alt.h, alt.w, alt.h);
    ctx.restore();
  };
  crossPose(ph, draw(pose === 1), draw(pose === 0));
  ctx.restore();
  return b;
}

// F. «Шаг+зеркало»: профильный цикл без нарезки
function frames(ctx, img, w, h, u, ph, mv, alts) {
  const alt = alts?.side;
  if (!alt) return bob(ctx, img, w, h, u, ph, mv);
  if (!mv) return idle(ctx, img, w, h);
  return strideCycle(ctx, alt, ph, u);
}

// G. «Стойка↔шаг» по направлениям: горизонталь — стойка (базовый ассет) ↔
// профильный шаг с кроссфейдом; вертикаль — цикл «шаг+зеркало» фронт/спина
// кадра (стойка там ломала бы ракурс: лицо при ходе от камеры). Вертикальный
// ход без своего ассета деградирует в B («пружинка»), а не в кривой профиль.
function standstep(ctx, img, w, h, u, ph, mv, alts) {
  const dir = alts?.dir || "right";
  const vertical = dir === "up" || dir === "down";
  const alt = vertical ? (dir === "up" ? alts?.back : alts?.front) : alts?.side;
  if (!alt) return bob(ctx, img, w, h, u, ph, mv);
  if (!mv) return idle(ctx, img, w, h);
  if (vertical) return strideCycle(ctx, alt, ph, u);
  const b = -Math.abs(Math.cos(ph)) * 1.6 * u;
  ctx.save();
  ctx.translate(0, b);
  ctx.rotate(0.03);
  const pose = Math.floor(ph / Math.PI) % 2;
  const stand = (alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  };
  const stride = (alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(alt.img, -alt.w / 2, -alt.h, alt.w, alt.h);
    ctx.restore();
  };
  crossPose(ph, pose === 1 ? stride : stand, pose === 1 ? stand : stride);
  ctx.restore();
  return b;
}

// Вариант C («маятник таза», shear) удалён 21.11.2026 по verdict пользователя
// как самый слабый; буквы остальных сохранены для сквозной нумерации в плане
export const GAITS = { doll, bob, hiprot, knee, frames, standstep };
export const GAIT_LIST = [
  { key: "doll", name: "A · кукла", desc: "ноги скользят в противофазе" },
  { key: "bob", name: "B · пружинка", desc: "цельный спрайт, bob+squash" },
  { key: "hiprot", name: "D · от бедра", desc: "ноги вращаются вокруг таза" },
  { key: "knee", name: "E · колено", desc: "псевдо-сгиб колена на пике" },
  {
    key: "frames",
    name: "F · шаг+зеркало",
    desc: "GPT-кадр шага и его зеркало",
  },
  {
    key: "standstep",
    name: "G · стойка↔шаг",
    desc: "шаг по направлениям, кроссфейд",
  },
];
