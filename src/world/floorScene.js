import { floorDefinition, floorLink } from "../systems/floors.js";

const FURNITURE = {
  hospital: ["medstation", "bench", "h_bed"],
  gunstore: ["gun_rifle", "bench", "h_wardrobe"],
  apartments: ["h_bed", "h_sofa", "h_wardrobe"],
};

export function createFloorScene(buildingId, floorId) {
  const definition = floorDefinition(buildingId, floorId),
    w = 22,
    h = 14,
    t = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      t[x + y * w] = x === 0 || x === w - 1 || y === 0 || y === h - 1 ? 6 : 4;
  const furniture = FURNITURE[buildingId] || FURNITURE.apartments,
    furn = [
      { id: "left", spr: furniture[0], x: 2, y: 2, w: 4, h: 3 },
      { id: "work", spr: furniture[1], x: 14, y: 2, w: 4, h: 2 },
      { id: "right", spr: furniture[2], x: 17, y: 8, w: 2, h: 3 },
    ];
  for (const item of furn)
    for (let y = item.y; y < item.y + item.h; y++)
      for (let x = item.x; x < item.x + item.w; x++) t[x + y * w] = 7;
  const containers = [
    { x: 5, y: 5, type: buildingId === "gunstore" ? "gunrack" : "shelf" },
    { x: 12, y: 7, type: buildingId === "hospital" ? "medbox" : "cabinet" },
    { x: 8, y: 10, type: buildingId === "gunstore" ? "locker" : "crate" },
  ].map((container, index) => ({
    ...container,
    id: `floor:${buildingId}:${floorId}:${index}`,
    looted: false,
  }));
  const stairs = [];
  if (floorId !== "ground")
    stairs.push({ target: "ground", x: 10.5 * 16, y: 12.5 * 16 });
  if (floorId !== "upper")
    stairs.push({ target: "upper", x: 4.5 * 16, y: 5.5 * 16 });
  if (floorId !== "basement")
    stairs.push({ target: "basement", x: 18.5 * 16, y: 5.5 * 16 });
  if (floorId === "ground")
    stairs.push({ target: "outdoor", x: 10.5 * 16, y: 12.5 * 16 });
  return {
    buildingId,
    floorId,
    name: definition.name,
    w,
    h,
    t,
    furn,
    containers,
    stairs: stairs.filter(
      (stair) =>
        stair.target === "outdoor" ||
        floorLink(buildingId, floorId, stair.target),
    ),
    spawn: { x: 10.5 * 16, y: 11.5 * 16 },
  };
}

export function floorTileAt(scene, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= scene.w || ty >= scene.h) return 6;
  return scene.t[tx + ty * scene.w];
}

export function floorContainers(scene) {
  const map = new Map();
  for (const container of scene.containers)
    map.set(`${container.x},${container.y}`, container);
  return map;
}
