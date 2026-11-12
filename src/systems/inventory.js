export function countItemInSlots(slots, id) {
  let count = 0;
  for (const slot of slots) if (slot?.id === id) count += slot.n;
  return count;
}

export function addItemToSlots(slots, item, id, count) {
  if (!item || count <= 0) return { added: 0, left: Math.max(0, count) };
  let left = count;

  for (const slot of slots) {
    if (slot?.id === id && slot.n < item.st) {
      const take = Math.min(item.st - slot.n, left);
      slot.n += take;
      left -= take;
      if (!left) break;
    }
  }

  while (left > 0) {
    const index = slots.indexOf(null);
    if (index < 0) break;
    const take = Math.min(item.st, left);
    slots[index] = { id, n: take };
    left -= take;
  }

  return { added: count - left, left };
}

export function removeItemFromSlots(slots, id, count) {
  let left = count;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot?.id !== id) continue;
    const take = Math.min(slot.n, left);
    slot.n -= take;
    left -= take;
    if (slot.n <= 0) slots[i] = null;
    if (!left) break;
  }
  return count - left;
}
