// Иконки предметов: отобранные PNG + процедурный fallback для остальных ID.
import { mkCanvas } from "../core/geo.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";

export const ICON_FILES = {
  wood: "assets/gen/icon_wood.png",
  scrap: "assets/gen/icon_scrap.png",
  cloth: "assets/gen/icon_cloth.png",
  can: "assets/gen/icon_can.png",
  meds: "assets/gen/icon_meds.png",
  arrow: "assets/gen/icon_arrow.png",
  fuel: "assets/gen/icon_fuel.png",
  part: "assets/gen/icon_part.png",
  torch: "assets/gen/icon_torch.png",
};

const C = {
  outline: "#1a1712",
  woodDark: "#5a4228",
  wood: "#8a6a42",
  woodLight: "#b08e5e",
  metalDark: "#4a4e52",
  metal: "#8a9096",
  metalLight: "#c2c8ce",
  cloth: "#7a8a9a",
  clothLight: "#a8b8c6",
  clothDark: "#566270",
  red: "#a83a2a",
  redLight: "#c85a3a",
  label: "#b8b0a0",
  white: "#e8e4d8",
  flame: "#ff9a3c",
  flameHot: "#ffd27a",
  steel: "#9aa4ae",
};

function painter() {
  const cv = mkCanvas(32, 32);
  const g = cv.getContext("2d");
  const px = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x * 2, y * 2, w * 2, h * 2);
  };
  return { cv, px };
}

const DRAW = {
  wood({ px }) {
    px(2, 6, 11, 5, C.outline);
    px(3, 7, 9, 3, C.wood);
    px(3, 7, 9, 1, C.woodLight);
    px(3, 9, 9, 1, C.woodDark);
    px(5, 8, 1, 1, C.woodDark);
    px(8, 8, 1, 1, C.woodDark);
    // торец
    px(11, 6, 3, 5, C.outline);
    px(12, 7, 2, 3, C.woodLight);
    px(12, 8, 1, 1, C.woodDark);
  },
  scrap({ px }) {
    // шестерня: зубья + тело + отверстие
    px(7, 2, 2, 12, C.metalDark);
    px(2, 7, 12, 2, C.metalDark);
    px(3, 3, 2, 2, C.metalDark);
    px(11, 3, 2, 2, C.metalDark);
    px(3, 11, 2, 2, C.metalDark);
    px(11, 11, 2, 2, C.metalDark);
    px(4, 4, 8, 8, C.metal);
    px(5, 3, 6, 10, C.metal);
    px(3, 5, 10, 6, C.metal);
    px(5, 5, 3, 2, C.metalLight);
    px(6, 6, 4, 4, C.metalDark);
    px(7, 7, 2, 2, C.outline);
  },
  cloth({ px }) {
    px(2, 9, 12, 4, C.outline);
    px(3, 10, 10, 2, C.cloth);
    px(3, 10, 10, 1, C.clothLight);
    px(3, 6, 10, 4, C.outline);
    px(4, 7, 8, 2, C.cloth);
    px(4, 7, 8, 1, C.clothLight);
    px(5, 3, 7, 4, C.outline);
    px(6, 4, 5, 2, C.clothDark);
    px(6, 4, 5, 1, C.cloth);
    px(9, 5, 1, 1, C.clothLight);
  },
  can({ px }) {
    px(4, 3, 8, 11, C.outline);
    px(5, 4, 6, 9, C.metal);
    px(5, 4, 2, 9, C.metalLight);
    px(9, 4, 2, 9, C.metalDark);
    // крышка
    px(5, 3, 6, 2, C.metalLight);
    px(6, 3, 4, 1, C.white);
    // этикетка
    px(5, 7, 6, 3, C.red);
    px(5, 7, 6, 1, C.redLight);
    px(6, 8, 4, 1, C.label);
    px(5, 12, 6, 1, C.metalDark);
  },
  meds({ px }) {
    // рулон бинта
    px(3, 5, 9, 8, C.outline);
    px(4, 6, 7, 6, C.white);
    px(4, 6, 7, 1, "#f4f0e6");
    px(4, 11, 7, 1, "#c8c4b8");
    px(6, 7, 3, 4, "#d8d4c8");
    px(7, 8, 1, 2, C.red);
    px(6, 9, 3, 1, C.red);
    // свободный конец
    px(11, 9, 3, 2, C.outline);
    px(12, 10, 2, 1, C.white);
    px(12, 11, 1, 2, C.white);
  },
  arrow({ px }) {
    // древко по диагонали
    for (let i = 0; i < 8; i++) px(4 + i, 12 - i, 2, 1, C.woodDark);
    for (let i = 0; i < 8; i++) px(4 + i, 11 - i, 1, 1, C.wood);
    // наконечник
    px(11, 2, 3, 3, C.steel);
    px(12, 1, 2, 2, C.metalLight);
    px(13, 2, 1, 1, C.white);
    px(10, 4, 2, 1, C.metalDark);
    // оперение
    px(2, 11, 3, 2, C.red);
    px(3, 13, 2, 2, C.redLight);
    px(2, 13, 1, 1, C.red);
  },
  fuel({ px }) {
    px(3, 4, 9, 10, C.outline);
    px(4, 5, 7, 8, C.red);
    px(4, 5, 2, 8, C.redLight);
    px(9, 5, 2, 8, "#7a2a1e");
    // ручка и горловина
    px(5, 2, 4, 2, C.outline);
    px(6, 3, 2, 1, C.red);
    px(10, 2, 2, 3, C.outline);
    px(11, 3, 1, 1, C.metal);
    // рифление
    px(6, 7, 3, 1, "#7a2a1e");
    px(6, 9, 3, 1, "#7a2a1e");
    px(5, 12, 6, 1, "#7a2a1e");
  },
  part({ px }) {
    // болт: шестигранная головка + резьба
    px(3, 2, 6, 5, C.outline);
    px(4, 3, 4, 3, C.metal);
    px(4, 3, 4, 1, C.metalLight);
    px(5, 4, 2, 1, C.metalDark);
    px(6, 6, 3, 8, C.outline);
    px(7, 7, 1, 6, C.metal);
    px(6, 8, 3, 1, C.metalDark);
    px(6, 10, 3, 1, C.metalDark);
    px(6, 12, 3, 1, C.metalDark);
    px(7, 7, 1, 1, C.metalLight);
  },
  molotov({ px }) {
    // бутылка с топливом, тряпка и маленький фитиль
    px(6, 5, 5, 10, C.outline);
    px(7, 7, 3, 7, "#52634b");
    px(7, 10, 3, 4, "#8a6a32");
    px(7, 7, 1, 6, "#91a071");
    px(7, 3, 3, 3, C.outline);
    px(8, 2, 2, 2, C.metalDark);
    px(9, 2, 4, 2, C.clothLight);
    px(11, 3, 2, 2, C.cloth);
    px(12, 1, 2, 2, C.flame);
    px(13, 0, 1, 2, C.flameHot);
    px(10, 12, 2, 2, "#3c4937");
  },
  torch({ px }) {
    // рукоять
    for (let i = 0; i < 6; i++) px(5 + i, 13 - i, 2, 2, C.woodDark);
    for (let i = 0; i < 6; i++) px(5 + i, 13 - i, 1, 1, C.wood);
    // обмотка
    px(8, 7, 3, 2, C.clothDark);
    // пламя
    px(8, 2, 4, 5, C.flame);
    px(9, 1, 2, 2, C.flame);
    px(9, 3, 2, 3, C.flameHot);
    px(10, 4, 1, 2, C.white);
    px(7, 4, 1, 2, C.flame);
    px(12, 3, 1, 2, C.flame);
  },
  bat({ px }) {
    // бита по диагонали: толстая колба сверху, тонкая рукоять снизу
    px(9, 1, 5, 5, C.outline);
    px(10, 2, 3, 3, C.wood);
    px(10, 2, 3, 1, C.woodLight);
    px(11, 4, 2, 1, C.woodDark);
    for (let i = 0; i < 7; i++) px(8 - i, 6 + i, 2, 2, C.outline);
    for (let i = 0; i < 7; i++) px(8 - i, 6 + i, 1, 1, C.wood);
    px(2, 12, 2, 2, C.clothDark); // обмотка рукояти
  },
  antibiotics({ px }) {
    px(3, 6, 10, 5, C.outline);
    px(4, 7, 4, 3, C.white);
    px(8, 7, 4, 3, C.red);
    px(8, 6, 1, 5, C.outline);
  },
  insulin({ px }) {
    px(4, 2, 4, 9, C.outline);
    px(5, 3, 2, 5, C.clothLight);
    px(6, 11, 6, 1, C.steel);
    px(11, 11, 1, 3, C.metalLight);
    px(3, 4, 1, 4, C.metalDark);
  },
  battery({ px }) {
    px(4, 4, 8, 10, C.outline);
    px(5, 5, 6, 8, "#59634b");
    px(6, 2, 2, 2, C.metal);
    px(9, 2, 2, 2, C.metal);
    px(6, 8, 5, 1, C.white);
    px(8, 6, 1, 5, C.white);
  },
  meal({ px }) {
    px(2, 6, 12, 5, C.outline);
    px(3, 6, 10, 3, C.metal);
    px(4, 6, 8, 2, "#b86f3c");
    px(4, 3, 1, 3, C.white);
    px(8, 2, 1, 4, C.white);
    px(11, 3, 1, 3, C.white);
    px(3, 11, 10, 2, C.metalDark);
  },
  medkit({ px }) {
    px(2, 5, 12, 9, C.outline);
    px(3, 6, 10, 7, C.white);
    px(5, 3, 6, 3, C.outline);
    px(6, 4, 4, 2, C.metal);
    px(6, 7, 4, 5, C.red);
    px(7, 8, 2, 3, C.white);
    px(5, 9, 6, 2, C.white);
  },
  knife({ px }) {
    // клинок сверху-справа, рукоять снизу-слева
    px(10, 1, 4, 4, C.outline);
    px(11, 2, 2, 2, C.steel);
    px(12, 2, 1, 1, C.metalLight);
    for (let i = 0; i < 5; i++) px(9 - i, 5 + i, 2, 2, C.outline);
    for (let i = 0; i < 5; i++) px(9 - i, 5 + i, 1, 1, C.steel);
    px(8, 6, 2, 1, C.metalDark); // гарда
    for (let i = 0; i < 4; i++) px(5 - i, 9 + i, 2, 2, C.outline);
    for (let i = 0; i < 4; i++) px(5 - i, 9 + i, 1, 1, C.woodDark);
    px(2, 12, 2, 2, C.wood);
  },
};

let cache = null;

export function itemIcons() {
  if (cache) return cache;
  cache = {};
  for (const [id, draw] of Object.entries(DRAW)) {
    const { cv, px } = painter();
    draw({ px });
    cache[id] = cv.toDataURL();
  }
  return cache;
}

// HTML иконки для панелей (img вместо эмодзи-span)
export function iconHtml(id, size = 20) {
  const src = ICON_FILES[id] ? BASE + ICON_FILES[id] : itemIcons()[id];
  if (!src) return "";
  return `<img class="ic" src="${src}" width="${size}" height="${size}" alt="" draggable="false">`;
}
