const COLORS = [
  "#d49a66",
  "#8fb8d8",
  "#c69bd9",
  "#a6c96c",
  "#d6c978",
  "#80c9ba",
];

export function renderDistrictBoundaries({ ctx, districts, W, H, SC, w2s }) {
  ctx.save();
  ctx.setLineDash([10 * SC, 8 * SC]);
  ctx.lineWidth = Math.max(1, 2 * SC);
  districts.forEach((district, index) => {
    ctx.strokeStyle = COLORS[index % COLORS.length];
    for (const way of district.ways) {
      ctx.beginPath();
      way.points.forEach(([x, y], pointIndex) => {
        const point = w2s(x, y);
        if (pointIndex === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
    const center = w2s(district.center.x, district.center.y);
    if (center.x >= 0 && center.x <= W && center.y >= 0 && center.y <= H) {
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(district.name, center.x, center.y);
    }
  });
  ctx.restore();
}
