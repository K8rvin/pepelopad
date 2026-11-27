import { FURNITURE } from "../data/furniture.js";

export function baseInterior(b) {
  const w = Math.floor(b.w);
  const h = Math.floor(b.h);
  const furniture = [];
  const put = (kind, x, y) => {
    const def = FURNITURE[kind];
    furniture.push({ kind, x, y, w: def.w, h: def.d });
  };

  put("base_bed", 0.35, 0.3);
  put("base_medical", 2.45, 0.3);
  put("base_storage", w - 2.05, 0.3);
  put("base_workbench", 0.35, h - 1.45);
  put("base_radio", w - 2.15, h - 1.35);

  return {
    layout: "base",
    walls: [],
    rooms: [
      { id: "sleep", role: "bedroom", x1: 0, y1: 0, x2: 2.2, y2: 2.4 },
      { id: "medical", role: "medical", x1: 2.2, y1: 0, x2: 5.1, y2: 2.4 },
      {
        id: "storage",
        role: "storage",
        x1: Math.max(5.1, w - 2.4),
        y1: 0,
        x2: w,
        y2: 2.4,
      },
      { id: "workshop", role: "workshop", x1: 0, y1: h - 2, x2: 2.9, y2: h },
      {
        id: "radio",
        role: "living",
        x1: Math.max(2.9, w - 2.5),
        y1: h - 2,
        x2: w,
        y2: h,
      },
    ],
    furniture,
    containers: [],
    wide: w >= h,
    corrA: h / 2 - 1,
    corrB: h / 2 + 1,
    doorU: b.doorU ?? Math.round(w / 2),
    stairs: null,
  };
}
