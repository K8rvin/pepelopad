import { CELL } from "../core/constants.js";
import { K } from "../core/math.js";
import { h2, mb32 } from "../core/rng.js";
import { POI } from "../data/world.js";
import {
  distanceToSegmentSquared,
  osmSolidAt,
  pointInPolygon,
} from "./osmCollision.js";
import { createOsmWorld, osmWayWidth, wayCategory } from "./osmMap.js";
import { centerOfPoints } from "./osmPois.js";

function buildingType(tags) {
  if (tags.amenity === "hospital" || tags.amenity === "clinic")
    return "hospital";
  if (tags.amenity === "police") return "police";
  if (tags.amenity === "school" || tags.building === "school") return "school";
  if (tags.amenity === "fire_station") return "firestation";
  if (tags.amenity === "fuel") return "gas";
  if (tags.shop === "supermarket" || tags.shop === "convenience")
    return "supermarket";
  if (tags.shop === "chemist") return "pharmacy";
  if (tags.shop === "weapons") return "gunstore";
  if (tags.building === "warehouse" || tags.building === "industrial")
    return "warehouse";
  if (tags.building === "apartments") return "apartments";
  if (tags.building === "retail" || tags.building === "commercial")
    return "office";
  if (tags.building === "house" || tags.building === "detached") return "house";
  return "house";
}

function buildingRecord(way, projection, bxOverride, byOverride) {
  const gamePoints = way.points.map(([x, y]) => {
    const point = projection.worldToGame({ x, y });
    return [point.x, point.y];
  });
  const transformed = { ...way, points: gamePoints },
    center = centerOfPoints(gamePoints),
    bounds = {
      minX: Math.min(...gamePoints.map((point) => point[0])),
      maxX: Math.max(...gamePoints.map((point) => point[0])),
      minY: Math.min(...gamePoints.map((point) => point[1])),
      maxY: Math.max(...gamePoints.map((point) => point[1])),
    },
    x = Math.floor(bounds.minX / 16),
    y = Math.floor(bounds.minY / 16);
  return {
    id: `osm:${way.id}`,
    wayId: way.id,
    type: buildingType(way.tags),
    x,
    y,
    w: Math.max(5, Math.ceil(bounds.maxX / 16) - x),
    h: Math.max(5, Math.ceil(bounds.maxY / 16) - y),
    bx: bxOverride ?? Math.floor(center.x / projection.blockPixels),
    by: byOverride ?? Math.floor(center.y / projection.blockPixels),
    name: way.tags.name || null,
    osmName: way.tags.name || null,
    tags: way.tags,
  };
}

function addContainers(block, building, random) {
  const definition = POI[building.type] || POI.house,
    count = Math.min(
      Math.max(1, building.w - 2),
      definition.contN[0] +
        Math.floor(random() * (definition.contN[1] - definition.contN[0] + 1)),
    );
  for (let index = 0; index < count; index++) {
    const x =
        building.x + 1 + Math.floor(random() * Math.max(1, building.w - 2)),
      type =
        definition.contTypes[
          Math.floor(random() * definition.contTypes.length)
        ];
    block.containers.push({
      x,
      y: building.y + building.h + 1,
      type,
      wayId: building.wayId,
      id: `${building.id}:${index}`,
    });
  }
}

export function createOsmCityModel(world, projection) {
  const gameWorld = createOsmWorld(
      {
        metadata: world.metadata,
        nodes: [],
        relations: [],
        ways: world.ways.map((way) => ({
          ...way,
          points: way.points.map(([x, y]) => {
            const point = projection.worldToGame({ x, y });
            return [point.x, point.y];
          }),
        })),
      },
      1024,
    ),
    buildings = new Map(),
    buildingsByBlock = new Map(),
    buildingsByDoor = new Map(),
    specialWayIds = new Set(),
    specials = new Map();
  for (const way of world.ways) {
    if (!way.tags.building) continue;
    const building = buildingRecord(way, projection);
    buildings.set(way.id, building);
    const key = K(building.bx, building.by);
    if (!buildingsByBlock.has(key)) buildingsByBlock.set(key, []);
    buildingsByBlock.get(key).push(building);
  }
  for (const [siteId, site] of Object.entries(projection.sites)) {
    const block = projection.blockForSite(siteId),
      key = K(block.bx, block.by),
      special = siteId === "mamayev" ? "quarry" : siteId;
    let building = null;
    if (site.ref.startsWith("way/")) {
      const way = world.wayById.get(Number(site.ref.split("/")[1]));
      building = buildings.get(way.id);
      if (
        !building &&
        [
          "supermarket",
          "hospital",
          "gas",
          "garage",
          "police",
          "warehouse",
        ].includes(siteId)
      )
        building = buildingRecord(way, projection);
    }
    if (
      !building &&
      [
        "supermarket",
        "gunstore",
        "hospital",
        "gas",
        "garage",
        "police",
        "warehouse",
      ].includes(siteId)
    ) {
      let bestDistance = 80 * 80;
      for (const candidate of buildings.values()) {
        const way = world.wayById.get(candidate.wayId),
          center = centerOfPoints(way.points),
          distance = (center.x - site.x) ** 2 + (center.y - site.y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          building = candidate;
        }
      }
    }
    if (building) {
      specialWayIds.add(building.wayId);
      const generic = buildingsByBlock.get(K(building.bx, building.by));
      if (generic)
        buildingsByBlock.set(
          K(building.bx, building.by),
          generic.filter((item) => item !== building),
        );
      building = {
        ...building,
        type: siteId,
        name: site.name,
        osmName: site.osmName,
        bx: block.bx,
        by: block.by,
      };
    }
    specials.set(key, { id: special, site, ...block, building });
  }
  const indexDoor = (building) => {
    const bx = Math.floor(
        ((building.x + Math.floor(building.w / 2) + 0.5) * 16) /
          projection.blockPixels,
      ),
      by = Math.floor(
        ((building.y + building.h + 0.5) * 16) / projection.blockPixels,
      ),
      key = K(bx, by);
    if (!buildingsByDoor.has(key)) buildingsByDoor.set(key, []);
    buildingsByDoor.get(key).push(building);
  };
  for (const building of buildings.values())
    if (!specialWayIds.has(building.wayId)) indexDoor(building);
  for (const special of specials.values())
    if (special.building) indexDoor(special.building);
  function buildingsNearDoor(bx, by) {
    const result = [];
    for (let y = by - 1; y <= by + 1; y++)
      for (let x = bx - 1; x <= bx + 1; x++)
        result.push(...(buildingsByDoor.get(K(x, y)) || []));
    return result;
  }
  function vegetationAt(x, y) {
    const chunk = gameWorld.chunks.get(
      `${Math.floor(x / gameWorld.chunkSize)},${Math.floor(y / gameWorld.chunkSize)}`,
    );
    if (!chunk) return false;
    for (const id of chunk.ways) {
      const way = gameWorld.wayById.get(id);
      if (
        wayCategory(way.tags) === "vegetation" &&
        pointInPolygon(x, y, way.points)
      )
        return true;
    }
    return false;
  }
  function propSiteFree(x, y) {
    if (!vegetationAt(x, y) || osmSolidAt(x, y, gameWorld, 4)) return false;
    const chunk = gameWorld.chunks.get(
      `${Math.floor(x / gameWorld.chunkSize)},${Math.floor(y / gameWorld.chunkSize)}`,
    );
    for (const id of chunk?.ways || []) {
      const way = gameWorld.wayById.get(id),
        category = wayCategory(way.tags);
      if (category !== "road" && category !== "railway") continue;
      for (let index = 1; index < way.points.length; index++) {
        const [ax, ay] = way.points[index - 1],
          [bx, by] = way.points[index];
        if (
          distanceToSegmentSquared(x, y, ax, ay, bx, by) <=
          (osmWayWidth(way) / 2 + 4) ** 2
        )
          return false;
      }
    }
    return true;
  }
  function planBlock(bx, by, seed, OV) {
    const key = K(bx, by),
      random = mb32((h2(bx, by, seed) * 1e9) | 0),
      special = specials.get(key),
      distance = Math.hypot(bx, by),
      district =
        distance > 100
          ? "outskirts"
          : distance > 55
            ? "suburb"
            : distance > 18
              ? "residential"
              : "civic",
      block = {
        bx,
        by,
        k: key,
        district,
        special: special?.id || null,
        buildings: [],
        containers: [],
        cars: [],
        carTiles: [],
        props: [],
        camp: null,
        nest: null,
        poi: null,
        name: null,
      };
    if (special?.building) block.buildings.push(special.building);
    else
      for (const building of buildingsByBlock.get(key) || [])
        block.buildings.push(building);
    for (const building of block.buildings) {
      addContainers(block, building, random);
      if (!block.name && building.name) {
        block.name = building.name;
        block.poi = building.type;
      }
    }
    if (special) {
      const { site } = special,
        point = projection.worldToGame(site);
      block.name = site.name;
      block.poi = special.id;
      if (special.id === "quarry") {
        block.nest = {
          x: point.x,
          y: point.y,
          tier: 3,
          mega: OV.get(`F${key}`)?.mega === true,
          id: key,
        };
        block.name = block.nest.mega ? "Логово Матки" : site.name;
      } else if (site.kind === "camp") {
        block.camp = {
          id: special.id,
          name: site.name,
          x: point.x,
          y: point.y,
          bx,
          by,
        };
      }
      if (["gas", "police", "hospital", "garage"].includes(special.id)) {
        const building = special.building;
        if (building)
          for (let index = 0; index < 3; index++)
            block.cars.push({
              id: `${building.id}:car${index}`,
              x: (building.x + 2 + index * 3) * 16 + 8,
              y: (building.y + building.h + 3) * 16 + 8,
              angle: 0,
              type:
                special.id === "police"
                  ? "police"
                  : special.id === "hospital"
                    ? "ambulance"
                    : index === 0
                      ? "blue"
                      : "sedan",
              locked: random() < 0.25,
              broken: index === 0,
              fuel: 35 + random() * 55,
              hp: 70 + random() * 30,
            });
      }
    } else if (
      district === "outskirts" &&
      random() < 0.012 &&
      !OV.get(`D${key}`)
    ) {
      block.nest = {
        x: (bx * CELL + 14) * 16,
        y: (by * CELL + 14) * 16,
        tier: 2,
        mega: false,
        id: key,
      };
      block.name = "Рассадник";
      block.poi = "nest";
    }
    if (special?.id !== "quarry") {
      for (let index = 0; index < 12; index++) {
        const x = (bx * CELL + 3 + Math.floor(random() * 22)) * 16 + 8,
          y = (by * CELL + 3 + Math.floor(random() * 22)) * 16 + 8;
        if (propSiteFree(x, y))
          block.props.push({
            type: random() < 0.8 ? "tree" : "rock",
            x: Math.floor(x / 16),
            y: Math.floor(y / 16),
          });
      }
    }
    return block;
  }
  return {
    gameWorld,
    projection,
    specials,
    buildings,
    buildingsNearDoor,
    planBlock,
    propSiteFree,
    vegetationAt,
  };
}
