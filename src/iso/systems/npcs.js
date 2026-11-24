import { CHARACTERS } from "../data/characters.js";
import { storyPoint } from "../world/storyLocations.js";
import { moveActor, faceDir } from "./actors.js";

function characterPosition(n, city, camps) {
  if (n.position.camp) {
    const camp = camps.find((c) => c.id === n.position.camp);
    if (camp) return { x: camp.x + 1, y: camp.y + 1 };
  }
  return storyPoint(city, n.position) || { x: 5, y: 5 };
}

export function createNpcs(
  city,
  PITCH,
  camps = [],
  survivors = [],
  story = null,
) {
  return CHARACTERS.map((n) => ({
    ...n,
    lines: [""],
    ...characterPosition(n, city, camps),
    hidden: false,
  }));
}

export function syncNpcs(
  npcs,
  city,
  camps,
  survivors,
  story,
  quests,
  survival = null,
) {
  for (const n of npcs) {
    n.hidden = false;
    if (n.id === "oleg") {
      const tutorial = quests.states.m00 === "active";
      if (!story.flags.oleg_free && !tutorial) n.hidden = true;
      if (tutorial)
        setNpcTarget(n, storyPoint(city, { site: "gas", x: 4, y: 5.2 }));
      else if (!quests.done.includes("m01"))
        setNpcTarget(n, storyPoint(city, { site: "gas", x: 4, y: 3 }));
      else {
        const camp = camps.find((c) => c.id === "park");
        if (camp) setNpcTarget(n, { x: camp.x + 1, y: camp.y + 1 });
      }
    }
    if (n.id === "nina") {
      const survivor = survivors.find((s) => s.id === "nina");
      n.hidden = survivor?.state !== "rescued";
      if (survivor?.state === "rescued")
        setNpcTarget(n, storyPoint(city, { site: "motel", x: 15, y: 3 }));
    }
    const phase = Math.floor((survival?.tod ?? 8) / 6);
    if (n.id === "nina" && !n.hidden && phase === 2)
      setNpcTarget(n, storyPoint(city, { site: "motel", x: 14, y: 18 }));
    if (n.id === "irina" && phase === 2)
      setNpcTarget(n, storyPoint(city, { site: "motel", x: 9, y: 18 }));
    if (n.id === "victor" && phase === 1)
      setNpcTarget(n, storyPoint(city, { site: "motel", x: 22, y: 18 }));
    if (n.id === "lena" && phase === 2 && story.flags.dose_lena)
      setNpcTarget(n, storyPoint(city, { site: "motel", x: 27, y: 18 }));
    if (n.id === "mark" && story.ending === "open" && story.markRelation > 0)
      setNpcTarget(n, storyPoint(city, { site: "motel", x: 19, y: 18 }));
    else if (n.id === "mark")
      setNpcTarget(n, storyPoint(city, { site: "workshop", x: 15, y: 8 }));
  }
}

// цель перехода вместо телепорта: NPC доходит пешком с анимацией шага
function setNpcTarget(n, pos) {
  if (!pos) return;
  if (n.tx === undefined) {
    n.x = pos.x;
    n.y = pos.y;
  }
  n.tx = pos.x;
  n.ty = pos.y;
}

export function updateNpcs(npcs, city, dt) {
  for (const n of npcs) {
    if (n.tx === undefined) {
      n.tx = n.x;
      n.ty = n.y;
    }
    // скрытый NPC стоит в цели; при появлении — снап, а не переход через карту
    if (n.hidden) {
      n.x = n.tx;
      n.y = n.ty;
      n.moving = false;
      n.snapNext = true;
      continue;
    }
    if (n.snapNext) {
      n.x = n.tx;
      n.y = n.ty;
      n.snapNext = false;
      n.moving = false;
      continue;
    }
    const dx = n.tx - n.x,
      dy = n.ty - n.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) {
      n.moving = false;
      continue;
    }
    const ox = n.x,
      oy = n.y;
    const step = Math.min(d, 1.6 * dt);
    moveActor(city, n, (dx / d) * step, (dy / d) * step);
    const moved = Math.hypot(n.x - ox, n.y - oy);
    n.moving = moved > 0.0001;
    if (n.moving) {
      n.walkPh = (n.walkPh || 0) + Math.min(moved, 0.1) * Math.PI;
      const f = faceDir((dx - dy) * 32, (dx + dy) * 16, n.face, n.dir);
      n.face = f.face;
      n.dir = f.dir;
    }
  }
}

export function npcNear(npcs, x, y, r = 2.2) {
  let best = null;
  let distance = r;
  for (const n of npcs) {
    if (n.hidden) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < distance) {
      best = n;
      distance = d;
    }
  }
  return best;
}

export function createDialog() {
  return { npc: null, line: 0 };
}

export function openDialog(D, npc) {
  D.npc = npc;
  D.line = 0;
}

export function advanceDialog(D) {
  if (!D.npc) return false;
  D.line++;
  if (D.line >= D.npc.lines.length) {
    D.npc = null;
    D.line = 0;
    return false;
  }
  return true;
}
