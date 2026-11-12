import { CELL } from "../core/constants.js";
import { K } from "../core/math.js";

const QUARRY = { bx: 5, by: -4, key: "5,-4" };

export function createQuarryNest(ox, oy, mega) {
  return {
    x: (ox + 14) * 16,
    y: (oy + 14) * 16,
    tier: 3,
    mega,
    id: "quarry",
  };
}

export function prepareMegaQuest(OV, PLAN, chunks, CMAP) {
  OV.delete("D" + QUARRY.key);
  OV.set("F" + QUARRY.key, { tier: 3, mega: true });
  PLAN.delete(QUARRY.key);

  for (const [key, chunk] of [...chunks]) {
    const bx0 = Math.floor((chunk.cx * 16 - 20) / CELL);
    const bx1 = Math.floor((chunk.cx * 16 + 36) / CELL);
    const by0 = Math.floor((chunk.cy * 16 - 20) / CELL);
    const by1 = Math.floor((chunk.cy * 16 + 36) / CELL);
    if (
      QUARRY.bx < bx0 ||
      QUARRY.bx > bx1 ||
      QUARRY.by < by0 ||
      QUARRY.by > by1
    )
      continue;
    for (const container of chunk.containers)
      CMAP.delete(K(container.x, container.y));
    chunks.delete(key);
  }

  return { bx: QUARRY.bx, by: QUARRY.by, label: "Логово Матки" };
}
