import { DIALOGUES } from "../data/dialogues.js";
import { conditionMatches } from "./story.js";

export function createDialogue() {
  return { conversation: null, npc: null, line: 0 };
}

export function selectDialogue(npcId, ctx) {
  return (
    DIALOGUES.find(
      (d) =>
        d.npc === npcId &&
        conditionMatches(d.when, ctx) &&
        (!d.once || !ctx.story.seen[d.id]),
    ) || null
  );
}

export function openDialogue(D, conversation) {
  if (!conversation) return false;
  D.conversation = conversation;
  D.npc = conversation.npc;
  D.line = 0;
  return true;
}

export function advanceDialogue(D) {
  if (!D.conversation) return false;
  if (D.line < D.conversation.lines.length - 1) {
    D.line++;
    return true;
  }
  return false;
}

export function closeDialogue(D) {
  D.conversation = null;
  D.npc = null;
  D.line = 0;
}

export function dialogueChoices(D, ctx) {
  const c = D.conversation;
  if (!c || D.line < c.lines.length - 1) return [];
  return (c.choices || []).filter((choice) =>
    conditionMatches(choice.when, ctx),
  );
}
