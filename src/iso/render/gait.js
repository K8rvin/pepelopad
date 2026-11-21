// Варианты процедурной походки актёра (лаборатория выбора, клавиша G).
// Контракт: ctx уже свёрнут к точке ступней и отражён по прицелу; функция
// рисует спрайт (ноги в (0,0)) и возвращает bob торса для привязки факела.
// u — пиксельная единица (zoom*scale), ph — фаза шага от дистанции, mv — идёт.
// Ассетные кадры ходьбы (очередь C 21.5) станут отдельным вариантом поверх.

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

// C. «Тазовый маятник»: блок ног shear-ом (ступни на месте, таз качается),
// торс контр-качанием; мягкий шаркающий шаг без швов и подъёмов
function shear(ctx, img, w, h, u, ph, mv) {
  if (!mv) return idle(ctx, img, w, h);
  const swing = Math.sin(ph);
  const bob = -Math.abs(Math.cos(ph)) * 1.4 * u;
  const legH = h * 0.42;
  const sh = swing * 0.16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -legH, w + 2, legH + 2);
  ctx.clip();
  ctx.transform(1, 0, -sh, 1, 0, 0);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 - 1, -h - 4 * u, w + 2, h - legH + 3 * u);
  ctx.clip();
  // торс следует за тазом (сдв верха ног = sh*legH), иначе шов рвётся
  ctx.translate(sh * legH, bob);
  ctx.rotate(0.03 - swing * 0.015);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return bob;
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

export const GAITS = { doll, bob, shear, hiprot, knee };
export const GAIT_LIST = [
  { key: "doll", name: "A · кукла", desc: "ноги скользят в противофазе" },
  { key: "bob", name: "B · пружинка", desc: "цельный спрайт, bob+squash" },
  { key: "shear", name: "C · маятник таза", desc: "shear ног, шаркающий шаг" },
  { key: "hiprot", name: "D · от бедра", desc: "ноги вращаются вокруг таза" },
  { key: "knee", name: "E · колено", desc: "псевдо-сгиб колена на пике" },
];
