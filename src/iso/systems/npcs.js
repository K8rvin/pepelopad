// NPC: стоят на посту, диалог по E. Зомби их игнорируют, стрелы пролетают мимо.
import { NPCS } from "../data/npcs.js";

export function createNpcs(city, PITCH) {
  // караульный в центре парка (квартал 1,1), рядом со спавном
  const bx = PITCH + 11 + 31;
  return NPCS.map((n) => ({ ...n, x: bx + 2.5, y: bx - 4 }));
}

export function npcNear(npcs, x, y, r = 2.2) {
  for (const n of npcs) if (Math.hypot(n.x - x, n.y - y) < r) return n;
  return null;
}

export function createDialog() {
  return { npc: null, line: 0 };
}

export function openDialog(D, npc) {
  D.npc = npc;
  D.line = 0;
}

// true = диалог ещё идёт
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
