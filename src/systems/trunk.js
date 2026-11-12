import { addItemToSlots } from "./inventory.js";

export function moveStackToTrunk(trunk, slots, index, limit = 12) {
  if (!slots[index] || trunk.length >= limit) return false;
  trunk.push(slots[index]);
  slots[index] = null;
  return true;
}

export function takeStackFromTrunk(trunk, index, slots, item) {
  const stack = trunk[index];
  if (!stack) return { added: 0, left: 0 };
  const result = addItemToSlots(slots, item, stack.id, stack.n);
  trunk.splice(index, 1);
  return result;
}
