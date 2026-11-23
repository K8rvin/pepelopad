function doorWall(walls, x1, y, x2, doors) {
  let at = x1;
  for (const door of [...doors].sort((a, b) => a - b)) {
    if (door - 0.7 > at) walls.push({ x1: at, y1: y, x2: door - 0.7, y2: y });
    at = door + 0.7;
  }
  if (at < x2) walls.push({ x1: at, y1: y, x2, y2: y });
}

export function storyInterior(b) {
  const walls = [];
  const rooms = [];
  const furniture = [];
  const containers = [];
  const w = Math.floor(b.w);
  const h = Math.floor(b.h);
  const corrA = 6;
  const corrB = 9;
  const cuts =
    b.locationId === "motel" ? [0, 6, 12, 18, 24, 30, w] : [0, 8, 16, 23, w];
  for (const x of cuts.slice(1, -1)) {
    walls.push({ x1: x, y1: 0, x2: x, y2: corrA });
    walls.push({ x1: x, y1: corrB, x2: x, y2: h });
  }
  const centers = cuts
    .slice(0, -1)
    .map((x, i) => Math.floor((x + cuts[i + 1]) / 2));
  doorWall(walls, 0, corrA, w, centers);
  doorWall(walls, 0, corrB, w, centers);
  for (let i = 0; i < centers.length; i++) {
    rooms.push({
      id: `north_${i}`,
      role: i === 2 ? "kitchen" : i === 1 ? "medical" : "storage",
      x1: cuts[i],
      y1: 0,
      x2: cuts[i + 1],
      y2: corrA,
    });
    rooms.push({
      id: `south_${i}`,
      role: i === 0 ? "bedroom" : "living",
      x1: cuts[i],
      y1: corrB,
      x2: cuts[i + 1],
      y2: h,
    });
  }
  const put = (kind, x, y, fw, fh, container = false) => {
    furniture.push({ kind, x, y, w: fw, h: fh });
    if (container)
      containers.push({
        id: `story_${b.locationId}_${kind}_${containers.length}`,
        kind,
        x: x + fw / 2,
        y: y + fh / 2,
      });
  };
  if (b.locationId === "motel") {
    put("shelf", 0.4, 0.3, 1.2, 0.5, true);
    put("bed", 6.6, 0.3, 1.6, 1.7);
    put("table", 13.4, 0.5, 1.5, 0.85);
    put("stove", 15.7, 0.3, 0.8, 0.7);
    put("crate", 19.2, 0.4, 0.8, 0.7, true);
    put("bed", 25.2, 0.3, 1.6, 1.7);
    put("shelf", 30.5, 0.3, 1.2, 0.5);
    put("bed", 1.7, 11.2, 1.7, 2);
    put("nightstand", 0.4, 11.2, 0.6, 0.55, true);
    put("sofa", 8, 11, 2, 0.85);
    put("table", 14, 12, 1.5, 0.85);
    put("crate", 20, 11, 0.8, 0.7);
  } else {
    put("crate", 1, 1, 0.8, 0.7, true);
    put("shelf", 9, 0.4, 1.2, 0.5, true);
    put("table", 17, 1, 1.5, 0.85);
    put("sofa", 24, 11, 2, 0.85);
    put("crate", 18, 12, 0.8, 0.7, true);
  }
  return {
    layout: "story",
    walls,
    rooms,
    furniture,
    containers,
    wide: true,
    corrA,
    corrB,
    doorU: b.doorU,
    stairs: null,
  };
}
