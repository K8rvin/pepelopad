import { railVehicleParts } from "../world/railPopulation.js";

export function renderRailVehicles({ ctx, vehicles, S, SC, cam, W, H, w2s }) {
  for (const vehicle of vehicles) {
    for (const part of railVehicleParts(vehicle)) {
      if (
        Math.abs(part.x - cam.x) > W / (2 * SC) + 40 ||
        Math.abs(part.y - cam.y) > H / (2 * SC) + 40
      )
        continue;
      const image = S[part.kind === "carriage" ? "train_carriage" : part.kind];
      if (!image) continue;
      const point = w2s(part.x, part.y),
        width = part.kind === "train" ? 32 : 28,
        height = 16;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(part.angle);
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
