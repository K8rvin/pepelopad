export function createEventBus() {
  const listeners = new Map();

  function on(event, listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(listener);
    return () => off(event, listener);
  }

  function off(event, listener) {
    const group = listeners.get(event);
    if (!group) return;
    group.delete(listener);
    if (!group.size) listeners.delete(event);
  }

  function emit(event, payload) {
    for (const name of [event, "*"]) {
      const group = listeners.get(name);
      if (!group) continue;
      for (const listener of [...group]) listener(payload, event);
    }
  }

  return { on, off, emit };
}
