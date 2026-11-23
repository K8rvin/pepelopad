import { CHARACTERS } from "../data/characters.js";
import { storyPoint } from "../world/storyLocations.js";

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
        Object.assign(n, storyPoint(city, { site: "gas", x: 4, y: 5.2 }));
      else if (!quests.done.includes("m01"))
        Object.assign(n, storyPoint(city, { site: "gas", x: 4, y: 3 }));
      else {
        const camp = camps.find((c) => c.id === "park");
        if (camp) Object.assign(n, { x: camp.x + 1, y: camp.y + 1 });
      }
    }
    if (n.id === "nina") {
      const survivor = survivors.find((s) => s.id === "nina");
      n.hidden = survivor?.state !== "rescued";
      if (survivor?.state === "rescued")
        Object.assign(n, storyPoint(city, { site: "motel", x: 15, y: 3 }));
    }
    const phase = Math.floor((survival?.tod ?? 8) / 6);
    if (n.id === "nina" && !n.hidden && phase === 2)
      Object.assign(n, storyPoint(city, { site: "motel", x: 14, y: 18 }));
    if (n.id === "irina" && phase === 2)
      Object.assign(n, storyPoint(city, { site: "motel", x: 9, y: 18 }));
    if (n.id === "victor" && phase === 1)
      Object.assign(n, storyPoint(city, { site: "motel", x: 22, y: 18 }));
    if (n.id === "lena" && phase === 2 && story.flags.dose_lena)
      Object.assign(n, storyPoint(city, { site: "motel", x: 27, y: 18 }));
    if (n.id === "mark" && story.ending === "open" && story.markRelation > 0)
      Object.assign(n, storyPoint(city, { site: "motel", x: 19, y: 18 }));
    else if (n.id === "mark")
      Object.assign(n, storyPoint(city, { site: "workshop", x: 15, y: 8 }));
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
