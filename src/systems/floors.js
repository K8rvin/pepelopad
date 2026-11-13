import { FLOOR_DEFINITIONS, FLOOR_LINKS } from "../data/floors.js";

export function floorDefinition(buildingId, floorId) {
  const floor = FLOOR_DEFINITIONS[buildingId]?.[floorId];
  if (!floor) throw new Error(`Unknown floor: ${buildingId}/${floorId}`);
  return floor;
}

export function floorLink(buildingId, from, to) {
  return (
    FLOOR_LINKS.find(
      (link) =>
        link.buildingId === buildingId && link.from === from && link.to === to,
    ) || null
  );
}

export function changeFloor(location, targetFloor) {
  const link = floorLink(location.buildingId, location.floorId, targetFloor);
  if (!link)
    throw new Error(`No floor link: ${location.buildingId}/${targetFloor}`);
  floorDefinition(location.buildingId, targetFloor);
  return { ...location, floorId: targetFloor };
}
