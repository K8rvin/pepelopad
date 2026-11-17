// Геометрия изометрии 2:1 и палитра «ПЕПЕЛОПАД»
// Мир — прямоугольный в метрах; iso — только проекция рендера.
export const TW = 64, // ширина ромба-тайла (px) = 1 м
  TH = 32,
  ZH = 32; // 1 м высоты = 32 px

// мировые метры → экранные px (без камеры)
export function w2s(wx, wy, wz = 0) {
  return { x: (wx - wy) * (TW / 2), y: (wx + wy) * (TH / 2) - wz * ZH };
}

// палитра (docs/visual-redesign-qwen.md)
export const PAL = {
  dark: "#10141a",
  night: "#222a34",
  asphalt: "#3b4148",
  concrete: "#5b6065",
  panel: "#7c786e",
  brick: "#9a9283",
  ash: "#c2beb2",
  grass: "#6a6944",
  bush: "#454f3b",
  rust: "#8a4a28",
  blood: "#6d2b25",
  warm: "#ffb45c",
  moon: "#6f86ad",
};

export function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ромб тайла в канвасе 68×36 (запас 2px против швов)
export const TILE_PAD = 2;
export const TILE_CX = 34,
  TILE_CY = 18;
export function diamondPath(g, grow = 1) {
  g.beginPath();
  g.moveTo(TILE_CX, TILE_CY - 16 - grow);
  g.lineTo(TILE_CX + 32 + grow, TILE_CY);
  g.lineTo(TILE_CX, TILE_CY + 16 + grow);
  g.lineTo(TILE_CX - 32 - grow, TILE_CY);
  g.closePath();
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)) | 0,
    g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)) | 0,
    b = Math.min(255, Math.max(0, (n & 255) * k)) | 0;
  return `rgb(${r},${g},${b})`;
}
