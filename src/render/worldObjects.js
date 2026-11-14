import { clamp } from "../core/math.js";
import { CELL } from "../core/constants.js";

export function renderWorldObjects({
  ctx,
  visChunks,
  SMAP,
  S,
  SC,
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
          ctx.drawImage(
            image,
            Math.round(s.x),
            Math.round(s.y),
            16 * SC,
            16 * SC,
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
            ctx.strokeRect(s.x + 2, s.y + 2, 16 * SC - 4, 16 * SC - 4);
          }
          if (searching && searching.o === container) {
            ctx.fillStyle = "#12150d";
            ctx.fillRect(s.x, s.y - 10, 16 * SC, 6);
            ctx.fillStyle = "#a6e83c";
            ctx.fillRect(
              s.x + 1,
              s.y - 9,
              (16 * SC - 2) * clamp(searching.t / searching.dur, 0, 1),
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
          ctx.drawImage(
            S.heart,
            s.x - width / 2,
            s.y - width / 2,
            width,
            width,
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
    if (
      wx < cam.x - W / 2 / SC - 48 ||
      wx > cam.x + W / 2 / SC + 48 ||
      wy < cam.y - H / 2 / SC - 48 ||
      wy > cam.y + H / 2 / SC + 48
    )
      continue;
    entities.push({
      y: wy + 16,
      f: () => {
        const p = w2s(wx, wy);
        const image =
          structure.t === "fire"
            ? S.fire[Math.floor(now * 6) % 2]
            : structure.t === "gate"
              ? structure.open
                ? S.gate_open
                : S.gate
              : S[structure.t];
        if (image)
          ctx.drawImage(
            image,
            Math.round(p.x),
            Math.round(p.y),
            16 * SC,
            16 * SC,
          );
        if (structure.t === "turret") {
          ctx.save();
          ctx.translate(p.x + 8 * SC, p.y + 7 * SC);
          ctx.rotate(structure.ang || 0);
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
          ctx.fillRect(p.x, p.y, 16 * SC, 16 * SC);
        }
        if (structure.hp < structure.max) {
          ctx.fillStyle = "#12150d";
          ctx.fillRect(p.x, p.y - 4, 16 * SC, 4);
          ctx.fillStyle =
            structure.hp / structure.max > 0.4 ? "#c96a35" : "#e04338";
          ctx.fillRect(
            p.x + 1,
            p.y - 3,
            (16 * SC - 2) * clamp(structure.hp / structure.max, 0, 1),
            2,
          );
        }
      },
    });
  }

  return entities;
}
