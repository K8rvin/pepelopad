import { mkCanvas } from "../core/geo.js";

function polygon(g, points, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.closePath();
  g.fill();
}

function box(g, ox, oy, x, y, z, w, d, h, colors) {
  const p = (px, py, pz) => [
    ox + (px - py) * 24,
    oy + (px + py) * 12 - pz * 24,
  ];
  const a = p(x, y, z);
  const b = p(x + w, y, z);
  const c = p(x + w, y + d, z);
  const d0 = p(x, y + d, z);
  const at = p(x, y, z + h);
  const bt = p(x + w, y, z + h);
  const ct = p(x + w, y + d, z + h);
  const dt = p(x, y + d, z + h);
  polygon(g, [d0, c, ct, dt], colors.left);
  polygon(g, [b, c, ct, bt], colors.right);
  polygon(g, [at, bt, ct, dt], colors.top);
  return { a, b, c, d: d0, at, bt, ct, dt };
}

function ellipse(g, x, y, rx, ry, color) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function chairModel() {
  const c = mkCanvas(128, 128);
  const g = c.getContext("2d");
  const colors = { left: "#4b3829", right: "#3e2f24", top: "#6a503b" };
  box(g, 64, 76, -0.55, -0.45, 0.48, 1.1, 0.9, 0.12, colors);
  box(g, 64, 76, -0.55, -0.45, 0.55, 1.1, 0.12, 0.85, colors);
  for (const [x, y] of [
    [-0.48, -0.38],
    [0.36, -0.38],
    [-0.48, 0.25],
    [0.36, 0.25],
  ])
    box(g, 64, 76, x, y, 0, 0.12, 0.12, 0.52, colors);
  return c;
}

function lampModel(table) {
  const c = mkCanvas(112, table ? 112 : 176);
  const g = c.getContext("2d");
  const baseY = table ? 96 : 160;
  const shadeTop = table ? 30 : 22;
  const shadeBottom = shadeTop + (table ? 32 : 42);
  const poleTop = shadeBottom - 4;
  ellipse(g, 56, baseY, table ? 15 : 22, table ? 6 : 9, "#45443f");
  ellipse(g, 56, baseY - 3, table ? 12 : 18, table ? 4 : 6, "#69665c");
  g.strokeStyle = "#5b5a54";
  g.lineWidth = table ? 4 : 5;
  g.beginPath();
  g.moveTo(56, baseY - 5);
  g.lineTo(56, poleTop);
  g.stroke();
  polygon(
    g,
    [
      [44, shadeTop],
      [68, shadeTop],
      [84, shadeBottom],
      [28, shadeBottom],
    ],
    "#9a917c",
  );
  ellipse(g, 56, shadeBottom, 28, 7, "#746e60");
  ellipse(g, 56, shadeTop, 12, 4, "#b0a58e");
  return c;
}

function laundryModel(dryer) {
  const c = mkCanvas(144, 144);
  const g = c.getContext("2d");
  const body = box(g, 72, 76, -0.65, -0.55, 0, 1.3, 1.1, 1.35, {
    left: dryer ? "#747773" : "#8b8e89",
    right: dryer ? "#60635f" : "#747872",
    top: dryer ? "#a0a39d" : "#b5b8b1",
  });
  const cx = (body.d[0] + body.c[0]) / 2;
  const cy = (body.d[1] + body.c[1]) / 2 - 19;
  ellipse(g, cx + 3, cy, 15, 18, "#383d3e");
  ellipse(g, cx + 3, cy - 2, 10, 12, dryer ? "#596163" : "#697376");
  g.strokeStyle = "#4a4d49";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(body.dt[0] + 6, body.dt[1] + 8);
  g.lineTo(body.ct[0] - 6, body.ct[1] + 8);
  g.stroke();
  return c;
}

export function createFurnitureModel(kind) {
  if (kind === "chair") return chairModel();
  if (kind === "floor_lamp") return lampModel(false);
  if (kind === "table_lamp") return lampModel(true);
  if (kind === "washer") return laundryModel(false);
  if (kind === "dryer") return laundryModel(true);
  return null;
}
