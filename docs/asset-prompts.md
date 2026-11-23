# Промты генерации ассетов «МЁРТВЫЙ РАЙОН»

Файл — единая очередь промтов для пользователя (GPT-генерация). Готовые PNG/WebP
кладите в `tmp/` проекта; агент интегрирует скриптами из `scripts/`
(вырезка фона, обрезка по контенту, ресайз, метаданные в `assets-src/generated/`).

## Общая преамбула (подставлять в начало каждого промта)

> Isometric dimetric 2:1 game prop, same camera angle as the reference image
> (world axes project 32×16 px per meter). Painterly, worn post-apocalyptic
> suburban style, muted desaturated palette, overcast soft daylight from
> upper-left, matching the reference prop's lighting and brushwork. Single
> object centered on a fully transparent RGBA background, base/feet line at
> the bottom of the canvas, no ground plane, no cast shadow (only subtle
> contact occlusion at the base), no text, logos or watermarks. Canvas
> ~512×512, object fills ~80% of it. Reference for style:
> `public/assets/gen/bench.png`.

## Очередь: ожидает генерации

### generator — дизель-генератор мотеля

> *Same preamble.* A portable diesel power generator ≈ 1.2 m wide × 0.7 m deep
> × 0.8 m high: faded orange-red fuel tank on top, blackened steel frame and
> recoil starter handle on the side, small control panel with two sockets and
> a knife switch, rubber feet, exhaust pipe with heat shield, fuel cap and a
> coiled black cable lying at the base. Worn paint, rust streaks, oil stains.
> Long axis along world X (screen down-right).

Интеграция: `SPRTEX.generator`, рисуется в `drawStoryObject` (kind generator),
ширина 64 px при zoom 1. До ассета — процедурный оранжевый бокс с «!».

### fire_0 / fire_1 / fire_2 — кадры костра лагеря

Три кадра одного костра для лёгкой покадровой анимации (цикл ~6 кадров/с).
Одинаковые ракурс, масштаб, брёвна и камни; меняется только форма пламени и
искр. Генерировать одним запросом «three frames side by side» НЕ нужно —
три отдельных изображения с одинаковой композицией.

> *Same preamble.* A small campfire ≈ 0.9 m diameter: three crossed charred
> logs on a ring of grey stones, thin smoke wisp. Frame 0 of 3: low broad
> flame leaning left, two embers rising. Keep logs, stones and camera
> identical across frames.

> *Same preamble.* The same campfire, frame 1 of 3: tall narrow flame tongue
> center, one ember higher, same logs and stones and camera.

> *Same preamble.* The same campfire, frame 2 of 3: medium flame split into
> two tongues leaning right, three embers, same logs and stones and camera.

Интеграция: `SPRTEX.fire_0..2`, цикл в `drawFire` (ширина 40 px при zoom 1);
до ассетов — процедурное пламя с мерцанием.

## Уже интегрировано (справочно)

- `tent_olive`, `tent_tan` — палатки лагерей и жильё базы (`drawTent`);
- `crate_wood` — ящики лагерей, уличные лут-ящики, склад базы (`drawCrate`);
- `barricade` — кольцо баррикад базы (зеркало по касательной);
- `barricade_gate` — ворота осады (зеркало, ось X);
- `runner_walk`, `runner_attack` — нормализованы по высоте контента к стойке
  (`scripts/normalize_runner_frames.mjs`), канвас расширен под выпад.

Промты палаток/ящика/баррикад выданы в чате 23.11.2026 и закрыты; дублировать
их здесь не нужно — исходники и метаданные лежат в `assets-src/generated/`.