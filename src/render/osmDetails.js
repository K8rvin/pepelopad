import { h2 } from "../core/rng.js";
import { osmWayWidth } from "../world/osmMap.js";

function trace(ctx, points, w2s, close = false) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const point = w2s(x, y);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  if (close) ctx.closePath();
}

function bounds(points) {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    maxX: Math.max(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

export function paintGroundDetail({ ctx, cam, W, H, SC, w2s, seed }) {
  const cell = 32,
    left = Math.floor((cam.x - W / (2 * SC)) / cell) * cell,
    right = cam.x + W / (2 * SC),
    top = Math.floor((cam.y - H / (2 * SC)) / cell) * cell,
    bottom = cam.y + H / (2 * SC),
    colors = ["#303a29", "#26321f", "#35402d", "#2b3525"];
  for (let y = top; y <= bottom; y += cell)
    for (let x = left; x <= right; x += cell) {
      const value = h2(x / cell, y / cell, seed),
        point = w2s(x + 7, y + 11);
      ctx.fillStyle = colors[Math.floor(value * colors.length)];
      ctx.globalAlpha = 0.28;
      ctx.fillRect(point.x, point.y, Math.max(1, 7 * SC), Math.max(1, 4 * SC));
    }
  ctx.globalAlpha = 1;
}

export function paintRoadBorder({ ctx, way, SC, w2s }) {
  ctx.strokeStyle = "#68645b";
  ctx.lineWidth = (osmWayWidth(way) + 16) * SC;
  ctx.setLineDash([]);
  trace(ctx, way.points, w2s);
  ctx.stroke();
}

export function paintRoadMarkings({ ctx, way, SC, w2s }) {
  if (
    ["footway", "path", "steps", "pedestrian", "service"].includes(
      way.tags.highway,
    )
  )
    return;
  ctx.strokeStyle = "#c0aa4a66";
  ctx.lineWidth = Math.max(1, 2 * SC);
  ctx.setLineDash([24 * SC, 20 * SC]);
  trace(ctx, way.points, w2s);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function paintBuildingDetail({ ctx, way, SC, w2s }) {
  if (way.points.length < 3 || SC < 0.35) return;
  const box = bounds(way.points),
    cx = (box.minX + box.maxX) / 2,
    cy = (box.minY + box.maxY) / 2,
    roof = way.points.map(([x, y]) => [
      cx + (x - cx) * 0.94,
      cy + (y - cy) * 0.94,
    ]),
    roofColors = {
      grey: "#555a50",
      black: "#343a36",
      red: "#685047",
      brown: "#655748",
    };
  ctx.fillStyle = roofColors[way.tags["roof:colour"]] || "#4b5247";
  trace(ctx, roof, w2s, true);
  ctx.fill();
  ctx.save();
  trace(ctx, roof, w2s, true);
  ctx.clip();
  ctx.strokeStyle = "#a0a48d18";
  ctx.lineWidth = Math.max(1, SC);
  for (let y = box.minY; y <= box.maxY; y += 32) {
    const from = w2s(box.minX, y),
      to = w2s(box.maxX, y);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  const units = Math.min(
    12,
    Math.max(
      1,
      Math.floor(((box.maxX - box.minX) * (box.maxY - box.minY)) / 12000),
    ),
  );
  for (let index = 0; index < units; index++) {
    const x = box.minX + h2(way.id, index, 41) * (box.maxX - box.minX),
      y = box.minY + h2(way.id, index, 79) * (box.maxY - box.minY),
      point = w2s(x, y),
      width = (4 + h2(way.id, index, 97) * 8) * SC,
      height = (4 + h2(way.id, index, 113) * 6) * SC;
    ctx.fillStyle = index % 3 === 0 ? "#70786b" : "#343c36";
    ctx.fillRect(point.x - width / 2, point.y - height / 2, width, height);
    ctx.strokeStyle = "#171d18";
    ctx.lineWidth = Math.max(1, SC);
    ctx.strokeRect(point.x - width / 2, point.y - height / 2, width, height);
  }
  ctx.restore();
}

export function paintWaterDetail({ ctx, way, SC, w2s }) {
  if (way.points.length < 3) return;
  const box = bounds(way.points);
  ctx.save();
  trace(ctx, way.points, w2s, true);
  ctx.clip();
  ctx.strokeStyle = "#6b9cad35";
  ctx.lineWidth = Math.max(1, 2 * SC);
  for (let y = box.minY; y <= box.maxY; y += 64)
    for (let x = box.minX; x <= box.maxX; x += 96) {
      const from = w2s(x, y),
        middle = w2s(x + 12, y - 4),
        to = w2s(x + 24, y);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(middle.x, middle.y, to.x, to.y);
      ctx.stroke();
    }
  ctx.restore();
}

export function paintBuildingOpenings({ ctx, way, SC, w2s }) {
  for (const opening of way.openings || []) {
    const from = w2s(
        opening.x - opening.tx * opening.halfWidth,
        opening.y - opening.ty * opening.halfWidth,
      ),
      to = w2s(
        opening.x + opening.tx * opening.halfWidth,
        opening.y + opening.ty * opening.halfWidth,
      );
    ctx.strokeStyle = opening.kind === "door" ? "#ffb23e" : "#7fb8d8";
    ctx.lineWidth = Math.max(2, 4 * SC);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}
