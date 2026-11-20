// Личная история «Маша»: владелец состояния (beat-индекс, флаги выборов).
// Диалог с выборами рендерится в main (dlg.beat); последствия применяет applyChoice.
import { addItem } from "./inventory.js";
import { poiBuilding } from "./quests.js";
import { STORY, STORY_NPC_NAMES } from "../data/story.js";

export function createStory() {
  return { i: 0, flags: {} };
}

export function storyDone(s) {
  return s.i >= STORY.length;
}

export function currentBeat(s) {
  return storyDone(s) ? null : STORY[s.i];
}

// позиция NPC текущего бита
export function storyNpcPos(s, city, camps) {
  const b = currentBeat(s);
  if (!b) return null;
  if (b.npc === "oleg" || b.npc === "vera") {
    const c = camps.find(
      (k) => k.id === (b.npc === "oleg" ? "park" : "school"),
    );
    return c ? { x: c.x + 1, y: c.y + 1 } : null;
  }
  const hosp = poiBuilding(city, "Больница");
  if (!hosp) return null;
  if (b.npc === "raya")
    return { x: hosp.x + hosp.doorU, y: hosp.y + hosp.h + 1.5 };
  return { x: hosp.x + hosp.w / 2, y: hosp.y - 3 }; // masha во дворе
}

export function storyNear(s, city, camps, player, r = 2.6) {
  const p = storyNpcPos(s, city, camps);
  if (!p) return null;
  if (Math.hypot(p.x - player.x, p.y - player.y) > r) return null;
  return {
    beat: currentBeat(s),
    pos: p,
    name: STORY_NPC_NAMES[currentBeat(s).npc],
  };
}

// применить выбор: предметы/доверие/флаг/житель; продвинуть бит
export function applyChoice(s, idx, ctx) {
  const b = currentBeat(s);
  if (!b) return null;
  const ch = b.choices[idx];
  if (!ch) return null;
  const e = ch.effects || {};
  if (e.items) for (const [id, n] of e.items) addItem(ctx.inv, id, n);
  if (e.trust) {
    const c = ctx.camps.find((k) => k.id === e.trust.camp);
    if (c) c.trust += e.trust.n;
  }
  if (e.flag) s.flags[e.flag] = true;
  if (e.resident && ctx.base?.founded) ctx.base.residents++;
  s.i++;
  return ch;
}

export function storyHud(s) {
  const b = currentBeat(s);
  if (!b) return "◆ История завершена. Живи.";
  return `◆ ${b.title}: поговори с ${STORY_NPC_NAMES[b.npc]}`;
}
