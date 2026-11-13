import { ROAD_LINE_WIDTH } from "../core/constants.js";

export function drawVerticalRoadLine(g, centerX, y, color) {
  g.fillStyle = color;
  g.fillRect(centerX - ROAD_LINE_WIDTH / 2, y, ROAD_LINE_WIDTH, 16);
}

export function drawHorizontalRoadLine(g, x, centerY, color) {
  g.fillStyle = color;
  g.fillRect(x, centerY - ROAD_LINE_WIDTH / 2, 16, ROAD_LINE_WIDTH);
}
