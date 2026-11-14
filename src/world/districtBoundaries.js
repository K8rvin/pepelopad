import { pointInPolygon } from "./buildingGeometry.js";

function pointKey(point) {
  return `${point[0].toFixed(2)},${point[1].toFixed(2)}`;
}

export function stitchBoundaryRings(ways) {
  const remaining = ways.map((way) => [...way.points]),
    rings = [];
  while (remaining.length) {
    const ring = remaining.shift();
    let matched = true;
    while (matched && pointKey(ring[0]) !== pointKey(ring.at(-1))) {
      matched = false;
      for (let index = 0; index < remaining.length; index++) {
        const candidate = remaining[index],
          start = pointKey(candidate[0]),
          end = pointKey(candidate.at(-1)),
          ringEnd = pointKey(ring.at(-1));
        if (start !== ringEnd && end !== ringEnd) continue;
        ring.push(
          ...(start === ringEnd
            ? candidate.slice(1)
            : [...candidate].reverse().slice(1)),
        );
        remaining.splice(index, 1);
        matched = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

export function createDistrictBoundaries(world, projection) {
  const districts = [];
  for (const relation of world.relations) {
    if (
      relation.tags.boundary !== "administrative" ||
      relation.tags.admin_level !== "9" ||
      !relation.tags.name
    )
      continue;
    const ways = relation.members
      .filter((member) => member.type === "way" && member.role === "outer")
      .map((member) => world.wayById.get(member.ref))
      .filter(Boolean)
      .map((way) => ({
        id: way.id,
        points: way.points.map(([x, y]) => {
          const point = projection.worldToGame({ x, y });
          return [point.x, point.y];
        }),
      }));
    if (!ways.length) continue;
    const rings = stitchBoundaryRings(ways),
      points = rings.flat(),
      center = {
        x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
        y: points.reduce((sum, point) => sum + point[1], 0) / points.length,
      };
    districts.push({
      id: relation.id,
      name: relation.tags.name,
      ways,
      rings,
      center,
    });
  }
  return districts;
}

export function districtNameAt(districts, x, y) {
  return (
    districts.find((district) =>
      district.rings.some((ring) => pointInPolygon(x, y, ring)),
    )?.name || null
  );
}
