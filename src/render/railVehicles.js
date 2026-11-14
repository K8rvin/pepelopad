import { railVehicleParts } from "../world/railPopulation.js";

export function renderRailVehicles({
  ctx,
  vehicles,
  S,
  SC,
  rotation = 0,
  cam,
  W,
  H,
  w2s,
}) {
  const visibleRadius = Math.hypot(W, H) / (2 * SC) + 40;
  for (const vehicle of vehicles) {
    for (const part of railVehicleParts(vehicle)) {
      if (Math.hypot(part.x - cam.x, part.y - cam.y) > visibleRadius) continue;
      const image = S[part.kind === "carriage" ? "train_carriage" : part.kind];
      if (!image) continue;
      const point = w2s(part.x, part.y),
        width = part.kind === "train" ? 32 : 28,
        height = 16;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(part.angle + rotation);
      ctx.drawImage(
        image,
        (-width * SC) / 2,
        (-height * SC) / 2,
        width * SC,
        height * SC,
      );
      ctx.restore();
    }
  }
}
