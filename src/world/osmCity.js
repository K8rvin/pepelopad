import { CELL } from "../core/constants.js";
import { K } from "../core/math.js";
import { h2, mb32 } from "../core/rng.js";
import { POI } from "../data/world.js";
import { FLOOR_DEFINITIONS } from "../data/floors.js";
import {
  distanceToSegmentSquared,
  osmSolidAt,
  pointInPolygon,
} from "./osmCollision.js";
import { createOsmWorld, osmWayWidth, wayCategory } from "./osmMap.js";
import { centerOfPoints } from "./osmPois.js";
import {
  createBuildingAccess,
  distanceToBuildingWalls,
  findInteriorPoints,
} from "./buildingGeometry.js";
import { createRoadPopulation } from "./roadPopulation.js";

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

function buildingRecord(
  way,
  projection,
  bxOverride,
  byOverride,
  entranceByCoordinate = new Map(),
) {
  const gamePoints = way.points.map(([x, y]) => {
    const point = projection.worldToGame({ x, y });
    return [point.x, point.y];
  });
  const center = centerOfPoints(gamePoints),
    bounds = {
      minX: Math.min(...gamePoints.map((point) => point[0])),
      maxX: Math.max(...gamePoints.map((point) => point[0])),
      minY: Math.min(...gamePoints.map((point) => point[1])),
      maxY: Math.max(...gamePoints.map((point) => point[1])),
    },
    x = Math.floor(bounds.minX / 16),
    y = Math.floor(bounds.minY / 16),
    entrancePoints = way.points.flatMap(([x, y]) =>
      (entranceByCoordinate.get(`${x.toFixed(5)},${y.toFixed(5)}`) || []).map(
        (point) => projection.worldToGame(point),
      ),
    ),
    openings = createBuildingAccess(
      { ...way, points: gamePoints },
      entrancePoints,
    );
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
    points: gamePoints,
    bounds,
    openings,
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
    const type =
      definition.contTypes[Math.floor(random() * definition.contTypes.length)];
    for (let attempt = 0; attempt < 80; attempt++) {
      const px =
          building.bounds.minX +
          random() * (building.bounds.maxX - building.bounds.minX),
        py =
          building.bounds.minY +
          random() * (building.bounds.maxY - building.bounds.minY),
        x = Math.floor(px / 16),
        y = Math.floor(py / 16),
        centerX = x * 16 + 8,
        centerY = y * 16 + 8;
      if (!pointInPolygon(centerX, centerY, building.points)) continue;
      if (distanceToBuildingWalls(centerX, centerY, building.points) < 20)
        continue;
      if (
        block.containers.some(
          (container) => Math.hypot(container.x - x, container.y - y) < 1.5,
        )
      )
        continue;
      block.containers.push({
        x,
        y,
        type,
        wayId: building.wayId,
        floorId: "ground",
        id: `${building.id}:${index}`,
      });
      break;
    }
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
    roadPopulation = createRoadPopulation(gameWorld),
    buildings = new Map(),
    playableBuildings = new Map(),
    buildingsByBlock = new Map(),
    specialWayIds = new Set(),
    specials = new Map(),
    entranceByCoordinate = new Map();
  for (const node of world.nodes) {
    if (!node.tags.entrance && !node.tags.door) continue;
    const key = `${node.x.toFixed(5)},${node.y.toFixed(5)}`;
    if (!entranceByCoordinate.has(key)) entranceByCoordinate.set(key, []);
    entranceByCoordinate.get(key).push(node);
  }
  for (const way of world.ways) {
    if (!way.tags.building) continue;
    const building = buildingRecord(
      way,
      projection,
      undefined,
      undefined,
      entranceByCoordinate,
    );
    buildings.set(way.id, building);
    playableBuildings.set(way.id, building);
    gameWorld.wayById.get(way.id).openings = building.openings;
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
      const gameWay = gameWorld.wayById.get(building.wayId);
      gameWay.openings = building.openings;
      gameWay.tags = {
        ...gameWay.tags,
        building: gameWay.tags.building || "yes",
      };
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
      playableBuildings.set(building.wayId, building);
    }
    specials.set(key, { id: special, site, ...block, building });
  }
  function buildingAt(x, y) {
    const chunk = gameWorld.chunks.get(
      `${Math.floor(x / gameWorld.chunkSize)},${Math.floor(y / gameWorld.chunkSize)}`,
    );
    for (const id of chunk?.ways || []) {
      const way = gameWorld.wayById.get(id);
      if (!way.tags.building) continue;
      const box = gameWorld.boundsByWay.get(id);
      if (x < box.minX || x > box.maxX || y < box.minY || y > box.maxY)
        continue;
      if (pointInPolygon(x, y, way.points))
        return playableBuildings.get(id) || way;
    }
    return null;
  }
  function placeNameAt(x, y) {
    const building = buildingAt(x, y);
    if (building?.name) return building.name;
    if (building?.type && POI[building.type]) return POI[building.type].name;
    const chunk = gameWorld.chunks.get(
      `${Math.floor(x / gameWorld.chunkSize)},${Math.floor(y / gameWorld.chunkSize)}`,
    );
    let nearest = null,
      best = Infinity;
    for (const id of chunk?.ways || []) {
      const way = gameWorld.wayById.get(id);
      if (!way.tags.highway || !way.tags.name) continue;
      for (let index = 1; index < way.points.length; index++) {
        const a = way.points[index - 1],
          b = way.points[index],
          distance = distanceToSegmentSquared(x, y, a[0], a[1], b[0], b[1]);
        if (distance < best && distance <= (osmWayWidth(way) / 2 + 8) ** 2) {
          best = distance;
          nearest = way.tags.name;
        }
      }
    }
    return nearest;
  }
  function populationDensityAt(x, y) {
    const bx = Math.floor(x / projection.blockPixels),
      by = Math.floor(y / projection.blockPixels),
      ids = new Set();
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const building of buildingsByBlock.get(K(bx + dx, by + dy)) || [])
          ids.add(building.wayId);
    return Math.min(2.1, 0.9 + ids.size / 18);
  }
  function spawnPointsNear(x, y, radius) {
    return roadPopulation.spawnPointsNear(x, y, radius);
  }
  function stairsFor(building, floorId = "ground") {
    if (building.stairsByFloor?.[floorId])
      return building.stairsByFloor[floorId];
    const definitions = FLOOR_DEFINITIONS[building.type];
    if (!definitions) return [];
    const points = findInteriorPoints(building.points, 2);
    if (!points.length) return [];
    const targets =
      floorId === "upper" || floorId === "basement"
        ? ["ground"]
        : ["upper", "basement"].filter((floor) => definitions[floor]);
    const stairs = targets.map((target, index) => ({
      ...(points[index] || points[0]),
      target,
      label: definitions[target].name,
    }));
    building.stairsByFloor = { ...building.stairsByFloor, [floorId]: stairs };
    return stairs;
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
    for (const car of roadPopulation.carsForBlock(bx, by)) {
      if (
        block.cars.some(
          (existing) => Math.hypot(existing.x - car.x, existing.y - car.y) < 36,
        )
      )
        continue;
      block.cars.push(car);
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
    roadPopulation,
    buildingAt,
    placeNameAt,
    populationDensityAt,
    spawnPointsNear,
    stairsFor,
    planBlock,
    propSiteFree,
    vegetationAt,
  };
}
