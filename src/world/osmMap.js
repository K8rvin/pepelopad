export function wayCategory(tags) {
  if (tags.building) return "building";
  if (tags.highway) return "road";
  if (tags.railway) return "railway";
  if (tags.waterway || tags.natural === "water") return "water";
  if (
    tags.leisure === "park" ||
    tags.landuse === "forest" ||
    tags.landuse === "grass"
  )
    return "vegetation";
  if (tags.amenity || tags.shop) return "poi";
  return "land";
}

export function boundsOfWays(ways) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const way of ways)
    for (const [x, y] of way.points) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  return bounds;
}

export function createOsmWorld(data, chunkSize = 256) {
  if (!data?.metadata || !Array.isArray(data.ways))
    throw new Error("Invalid OSM world data");
  const chunks = new Map();
  for (const way of data.ways) {
    const category = wayCategory(way.tags);
    for (const [x, y] of way.points) {
      const cx = Math.floor(x / chunkSize),
        cy = Math.floor(y / chunkSize),
        key = `${cx},${cy}`;
      if (!chunks.has(key)) chunks.set(key, { cx, cy, ways: new Set() });
      chunks.get(key).ways.add(way.id);
    }
  }
  return {
    metadata: data.metadata,
    nodes: data.nodes,
    ways: data.ways,
    relations: data.relations,
    bounds: boundsOfWays(data.ways),
    chunks,
    chunkSize,
  };
}

export async function loadOsmWorld(url = "/assets/maps/volgograd-center.json") {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OSM map: ${response.status}`);
  return createOsmWorld(await response.json());
}
