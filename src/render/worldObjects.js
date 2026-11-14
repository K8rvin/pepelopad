import { clamp } from "../core/math.js";
import { CELL } from "../core/constants.js";
import { drawOrientedImage } from "./orientation.js";

export function renderWorldObjects({
  ctx,
  visChunks,
  SMAP,
  S,
  SC,
  rotation = 0,
  now,
  w2s,
  mainQuest,
  searching,
  isContainerActive,
  bench,
  cam,
  W,
  H,
}) {
  const entities = [];
  const visibleRadius = Math.hypot(W, H) / (2 * SC) + 48;

  for (const chunk of visChunks) {
    for (const container of chunk.containers) {
      if (!isContainerActive(container)) continue;
      entities.push({
        y: container.y * 16 + 16,
        f: () => {
          const image =
            S["cont_" + container.type + (container.looted ? "_open" : "")] ||
            S.cont_crate;
          const s = w2s(container.x * 16, container.y * 16);
          const size = 16 * SC;
          const center = rotation
            ? w2s(container.x * 16 + 8, container.y * 16 + 8)
            : { x: s.x + size / 2, y: s.y + size / 2 };
          drawOrientedImage(
            ctx,
            image,
            rotation ? center.x - size / 2 : Math.round(s.x),
            rotation ? center.y - size / 2 : Math.round(s.y),
            size,
            size,
            rotation,
          );
          const quest = mainQuest();
          if (
            quest &&
            !container.looted &&
            quest.targets?.some((target) =>
              target.wayId != null
                ? target.wayId === container.wayId
                : Math.floor(container.x / CELL) === target.bx &&
                  Math.floor(container.y / CELL) === target.by,
            )
          ) {
            ctx.strokeStyle =
              "rgba(255,178,62," + (0.5 + Math.sin(now * 5) * 0.3) + ")";
            ctx.lineWidth = 2;
            if (rotation) {
              ctx.save();
              ctx.translate(center.x, center.y);
              ctx.rotate(rotation);
              ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);
              ctx.restore();
            } else {
              ctx.strokeRect(s.x + 2, s.y + 2, size - 4, size - 4);
            }
          }
          if (searching && searching.o === container) {
            ctx.fillStyle = "#12150d";
            ctx.fillRect(s.x, s.y - 10, size, 6);
            ctx.fillStyle = "#a6e83c";
            ctx.fillRect(
              s.x + 1,
              s.y - 9,
              (size - 2) * clamp(searching.t / searching.dur, 0, 1),
              4,
            );
          }
        },
      });
    }

    if (chunk.nest?.alive) {
      const nest = chunk.nest;
      entities.push({
        y: nest.y + 14,
        f: () => {
          const pulse = 1 + Math.sin(now * 2.4) * 0.06;
          const s = w2s(nest.x, nest.y);
          const width = 26 * SC * pulse;
          drawOrientedImage(
            ctx,
            S.heart,
            s.x - width / 2,
            s.y - width / 2,
            width,
            width,
            rotation,
          );
          if (nest.flash > 0) {
            ctx.fillStyle = "rgba(255,255,255," + nest.flash * 4 + ")";
            ctx.fillRect(s.x - width / 2, s.y - width / 2, width, width);
          }
          if (nest.hp < nest.max) {
            ctx.fillStyle = "#12150d";
            ctx.fillRect(s.x - 30, s.y - width / 2 - 12, 60, 7);
            ctx.fillStyle = "#a6e83c";
            ctx.fillRect(
              s.x - 29,
              s.y - width / 2 - 11,
              58 * clamp(nest.hp / nest.max, 0, 1),
              5,
            );
          }
        },
      });
    }
  }

  for (const structure of SMAP.values()) {
    const wx = structure.x * 16;
    const wy = structure.y * 16;
    if (Math.hypot(wx - cam.x, wy - cam.y) > visibleRadius) continue;
    entities.push({
      y: wy + 16,
      f: () => {
        const p = w2s(wx, wy);
        const size = 16 * SC;
        const center = rotation
          ? w2s(wx + 8, wy + 8)
          : { x: p.x + size / 2, y: p.y + size / 2 };
        const image =
          structure.t === "fire"
            ? S.fire[Math.floor(now * 6) % 2]
            : structure.t === "gate"
              ? structure.open
                ? S.gate_open
                : S.gate
              : S[structure.t];
        if (image)
          drawOrientedImage(
            ctx,
            image,
            rotation ? center.x - size / 2 : Math.round(p.x),
            rotation ? center.y - size / 2 : Math.round(p.y),
            size,
            size,
            rotation,
          );
        if (structure.t === "turret") {
          const barrel = rotation
            ? w2s(wx + 8, wy + 7)
            : { x: p.x + 8 * SC, y: p.y + 7 * SC };
          ctx.save();
          ctx.translate(barrel.x, barrel.y);
          ctx.rotate((structure.ang || 0) + rotation);
          ctx.fillStyle = structure.off ? "#3a3f44" : "#6d747b";
          ctx.fillRect(0, -2 * SC, 9 * SC, 4 * SC);
          ctx.restore();
        }
        if (structure.t === "bench") {
          ctx.fillStyle = "#ffb23e";
          for (let i = 0; i < bench; i++)
            ctx.fillRect(p.x + 4 + i * 8, p.y - 6, 5, 5);
        }
        if (structure.flash > 0) {
          ctx.fillStyle = "rgba(255,255,255," + structure.flash * 3 + ")";
          ctx.fillRect(p.x, p.y, size, size);
        }
        if (structure.hp < structure.max) {
          ctx.fillStyle = "#12150d";
          ctx.fillRect(p.x, p.y - 4, size, 4);
          ctx.fillStyle =
            structure.hp / structure.max > 0.4 ? "#c96a35" : "#e04338";
          ctx.fillRect(
            p.x + 1,
            p.y - 3,
            (size - 2) * clamp(structure.hp / structure.max, 0, 1),
            2,
          );
        }
      },
    });
  }

  return entities;
}
