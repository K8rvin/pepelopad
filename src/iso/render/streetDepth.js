function intersects(a, b) {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

export function reconcileStreetDepths(entries) {
  const parent = entries.map((_, index) => index);
  const find = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++)
      if (intersects(entries[i].bounds, entries[j].bounds)) union(i, j);

  const depths = new Map();
  entries.forEach((entry, index) => {
    const root = find(index);
    depths.set(root, Math.max(depths.get(root) ?? -Infinity, entry.depth));
  });
  return entries.map((entry, index) => ({
    ...entry,
    depth: depths.get(find(index)),
  }));
}
