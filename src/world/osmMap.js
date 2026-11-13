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

export function osmWayWidth(way) {
  const category = wayCategory(way.tags);
  if (category === "railway") return 32;
  if (category !== "road") return 16;
  if (["footway", "path", "steps", "pedestrian"].includes(way.tags.highway))
    return 24;
  if (way.tags.highway === "service") return 48;
  const lanes = Math.max(1, Number.parseInt(way.tags.lanes, 10) || 2);
  return lanes * 48;
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
    if (wayCategory(way.tags) === "land") continue;
    const bounds = boundsOfWays([way]);
    for (
      let cx = Math.floor(bounds.minX / chunkSize);
      cx <= Math.floor(bounds.maxX / chunkSize);
      cx++
    )
      for (
        let cy = Math.floor(bounds.minY / chunkSize);
        cy <= Math.floor(bounds.maxY / chunkSize);
        cy++
      ) {
        const key = `${cx},${cy}`;
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
    nodeById: new Map(data.nodes.map((node) => [node.id, node])),
    wayById: new Map(data.ways.map((way) => [way.id, way])),
    relationById: new Map(
      data.relations.map((relation) => [relation.id, relation]),
    ),
    boundsByWay: new Map(data.ways.map((way) => [way.id, boundsOfWays([way])])),
    chunks,
    chunkSize,
  };
}

export async function loadOsmWorld(url = "/assets/maps/volgograd-center.json") {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OSM map: ${response.status}`);
  return createOsmWorld(await response.json());
}
