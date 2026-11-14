import { BUILDING_LAYOUTS } from "../data/buildingLayouts.js";
import {
  distanceToBuildingWalls,
  pointInPolygon,
  projectToSegment,
} from "./buildingGeometry.js";

export const PIXELS_PER_METER = 16;

const SUPERMARKET = {
  shelfLength: 64,
  shelfDepth: 16,
  shelfEndGap: 8,
  aisleWidth: 40,
  wallClearance: 24,
  doorClearance: 40,
  stairClearance: 40,
};

const APARTMENT = {
  wallClearance: 12,
  internalWallClearance: 8,
  doorClearance: 36,
  stairClearance: 40,
  wallThickness: 8,
};

function emptyLayout(building, floorId = "ground", kind = "supermarket") {
  return {
    id: `${building?.id || `osm:${building?.wayId ?? "unknown"}`}:${floorId}:layout`,
    kind,
    wayId: building?.wayId ?? null,
    floorId,
    fixtures: [],
    containers: [],
    internalWalls: [],
    doors: [],
  };
}

function usablePoints(building) {
  if (!Array.isArray(building?.points) || building.points.length < 3)
    return null;
  const points = building.points.filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  return points.length >= 3 ? points : null;
}

function interiorFrame(points) {
  let longest = null;
  for (let index = 0; index < points.length; index++) {
    const a = points[index],
      b = points[(index + 1) % points.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > 0 && (!longest || length > longest.length))
      longest = { a, b, length };
  }
  if (!longest) return null;
  const tx = (longest.b[0] - longest.a[0]) / longest.length,
    ty = (longest.b[1] - longest.a[1]) / longest.length,
    nx = -ty,
    ny = tx,
    origin = longest.a,
    projected = points.map(([x, y]) => {
      const dx = x - origin[0],
        dy = y - origin[1];
      return [dx * tx + dy * ty, dx * nx + dy * ny];
    }),
    minU = Math.min(...projected.map((point) => point[0])),
    maxU = Math.max(...projected.map((point) => point[0])),
    minV = Math.min(...projected.map((point) => point[1])),
    maxV = Math.max(...projected.map((point) => point[1]));
  return {
    tx,
    ty,
    nx,
    ny,
    minU,
    maxU,
    minV,
    maxV,
    length: maxU - minU,
    width: maxV - minV,
    angle: Math.atan2(ty, tx),
    point(u, v) {
      return [origin[0] + tx * u + nx * v, origin[1] + ty * u + ny * v];
    },
    normalized(at) {
      return this.point(
        minU + at[0] * (maxU - minU),
        minV + at[1] * (maxV - minV),
      );
    },
    local(x, y) {
      const dx = x - origin[0],
        dy = y - origin[1];
      return [dx * tx + dy * ty, dx * nx + dy * ny];
    },
  };
}

function stairsFor(building, floorId, options) {
  if (Array.isArray(options.stairs)) return options.stairs;
  return (
    building.stairsByFloor?.[floorId] ||
    (floorId === "ground" && Array.isArray(building.stairs)
      ? building.stairs
      : [])
  );
}

function rectanglePoints(frame, u, v, w, h) {
  return [
    frame.point(u - w / 2, v - h / 2),
    frame.point(u + w / 2, v - h / 2),
    frame.point(u + w / 2, v + h / 2),
    frame.point(u - w / 2, v + h / 2),
  ];
}

function distanceToRectangle(frame, x, y, u, v, w, h) {
  const [localU, localV] = frame.local(x, y),
    du = Math.max(Math.abs(localU - u) - w / 2, 0),
    dv = Math.max(Math.abs(localV - v) - h / 2, 0);
  return Math.hypot(du, dv);
}

function rectangleIsClear({
  frame,
  points,
  building,
  floorId,
  options,
  u,
  v,
  w,
  h,
  wallClearance,
  doorClearance,
  stairClearance,
}) {
  const corners = rectanglePoints(frame, u, v, w, h);
  for (const [x, y] of corners) {
    if (!pointInPolygon(x, y, points)) return false;
    if (distanceToBuildingWalls(x, y, points) + 1e-7 < wallClearance)
      return false;
  }
  for (const opening of building.openings || []) {
    if (opening.kind && opening.kind !== "door") continue;
    const clearance = Math.max(
      doorClearance,
      (opening.halfWidth || 0) + PIXELS_PER_METER * 1.5,
    );
    if (
      distanceToRectangle(frame, opening.x, opening.y, u, v, w, h) + 1e-7 <
      clearance
    )
      return false;
  }
  for (const stair of stairsFor(building, floorId, options)) {
    if (
      distanceToRectangle(frame, stair.x, stair.y, u, v, w, h) + 1e-7 <
      stairClearance + (stair.radius || 0)
    )
      return false;
  }
  return true;
}

function tileCoordinates(x, y) {
  return {
    tileX: Math.floor(x / PIXELS_PER_METER),
    tileY: Math.floor(y / PIXELS_PER_METER),
  };
}

export function generateSupermarketInterior(building, options = {}) {
  const points = usablePoints(building);
  if (!points) return emptyLayout(building);
  const frame = interiorFrame(points);
  if (!frame) return emptyLayout(building);
  const config = { ...SUPERMARKET, ...options },
    fixtures = [],
    containers = [],
    populatedRows = new Set(),
    prefix = building.id || `osm:${building.wayId}`;
  for (let row = 0; ; row++) {
    const v =
      frame.minV +
      config.wallClearance +
      config.shelfDepth / 2 +
      row * (config.shelfDepth + config.aisleWidth);
    if (v + config.shelfDepth / 2 > frame.maxV - config.wallClearance + 1e-7)
      break;
    for (let column = 0; ; column++) {
      const u =
        frame.minU +
        config.wallClearance +
        config.shelfLength / 2 +
        column * (config.shelfLength + config.shelfEndGap);
      if (u + config.shelfLength / 2 > frame.maxU - config.wallClearance + 1e-7)
        break;
      if (
        !rectangleIsClear({
          frame,
          points,
          building,
          floorId: "ground",
          options,
          u,
          v,
          w: config.shelfLength,
          h: config.shelfDepth,
          wallClearance: config.wallClearance,
          doorClearance: config.doorClearance,
          stairClearance: config.stairClearance,
        })
      )
        continue;
      const [x, y] = frame.point(u, v),
        fixtureId = `${prefix}:ground:shelf:${row}:${column}`,
        containerId = `${fixtureId}:container`;
      fixtures.push({
        id: fixtureId,
        kind: "shelf",
        type: "shelf",
        lootTable: "market",
        wayId: building.wayId,
        floorId: "ground",
        x,
        y,
        w: config.shelfLength,
        h: config.shelfDepth,
        angle: frame.angle,
        points: rectanglePoints(
          frame,
          u,
          v,
          config.shelfLength,
          config.shelfDepth,
        ),
        row,
        column,
        containerId,
      });
      containers.push({
        id: containerId,
        fixtureId,
        type: "shelf",
        lootTable: "market",
        wayId: building.wayId,
        floorId: "ground",
        x,
        y,
        ...tileCoordinates(x, y),
        angle: frame.angle,
        row,
        column,
      });
      populatedRows.add(row);
    }
  }
  if (populatedRows.size < 2 || fixtures.length < 4)
    return emptyLayout(building);
  return {
    ...emptyLayout(building),
    fixtures,
    containers,
    aisleWidth: config.aisleWidth,
  };
}

function segmentClearOfOpenings(
  a,
  b,
  building,
  floorId,
  options,
  doorClearance,
  stairClearance,
) {
  for (const opening of building.openings || []) {
    if (opening.kind && opening.kind !== "door") continue;
    const projected = projectToSegment(
        opening.x,
        opening.y,
        a[0],
        a[1],
        b[0],
        b[1],
      ),
      clearance = Math.max(
        doorClearance,
        (opening.halfWidth || 0) + PIXELS_PER_METER,
      );
    if (projected.distanceSquared + 1e-7 < clearance * clearance) return false;
  }
  for (const stair of stairsFor(building, floorId, options)) {
    const projected = projectToSegment(
        stair.x,
        stair.y,
        a[0],
        a[1],
        b[0],
        b[1],
      ),
      clearance = stairClearance + (stair.radius || 0);
    if (projected.distanceSquared + 1e-7 < clearance * clearance) return false;
  }
  return true;
}

function wallFits({ a, b, points, building, floorId, options, config }) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    samples = Math.max(1, Math.ceil(length / 8));
  for (let index = 0; index <= samples; index++) {
    const t = index / samples,
      x = a[0] + (b[0] - a[0]) * t,
      y = a[1] + (b[1] - a[1]) * t;
    if (!pointInPolygon(x, y, points)) return false;
    if (
      distanceToBuildingWalls(x, y, points) + 1e-7 <
      config.internalWallClearance
    )
      return false;
  }
  return segmentClearOfOpenings(
    a,
    b,
    building,
    floorId,
    options,
    config.doorClearance,
    config.stairClearance,
  );
}

function makeWalls(definitions, context) {
  const internalWalls = [],
    doors = [];
  for (const definition of definitions) {
    const a = context.frame.normalized(definition.a),
      b = context.frame.normalized(definition.b),
      gaps = [...(definition.gaps || [])].sort(
        (left, right) => left.from - right.from,
      );
    let cursor = 0;
    for (let part = 0; part <= gaps.length; part++) {
      const gap = gaps[part],
        end = gap ? Math.max(cursor, Math.min(1, gap.from)) : 1,
        from = cursor,
        segmentA = [a[0] + (b[0] - a[0]) * from, a[1] + (b[1] - a[1]) * from],
        segmentB = [a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end];
      if (
        end > from &&
        wallFits({
          a: segmentA,
          b: segmentB,
          ...context,
        })
      )
        internalWalls.push({
          id: `${context.prefix}:${context.floorId}:wall:${definition.id}:${part}`,
          sourceId: definition.id,
          wayId: context.building.wayId,
          floorId: context.floorId,
          x1: segmentA[0],
          y1: segmentA[1],
          x2: segmentB[0],
          y2: segmentB[1],
          thickness: context.config.wallThickness,
        });
      if (gap) {
        const gapStart = Math.max(0, Math.min(1, gap.from)),
          gapEnd = Math.max(gapStart, Math.min(1, gap.to)),
          middle = (gapStart + gapEnd) / 2,
          [x, y] = [
            a[0] + (b[0] - a[0]) * middle,
            a[1] + (b[1] - a[1]) * middle,
          ];
        doors.push({
          id: `${context.prefix}:${context.floorId}:door:${definition.id}:${part}`,
          kind: "interior-door",
          wayId: context.building.wayId,
          floorId: context.floorId,
          x,
          y,
          width: Math.hypot(b[0] - a[0], b[1] - a[1]) * (gapEnd - gapStart),
          angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
        });
        cursor = gapEnd;
      }
    }
  }
  return {
    internalWalls,
    doors: doors.filter(
      (door) =>
        pointInPolygon(door.x, door.y, context.points) &&
        distanceToBuildingWalls(door.x, door.y, context.points) >=
          context.config.internalWallClearance,
    ),
  };
}

function clearOfInternalWalls(frame, u, v, w, h, walls, thickness = 0) {
  for (const wall of walls) {
    const samples = Math.max(
      1,
      Math.ceil(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / 8),
    );
    for (let index = 0; index <= samples; index++) {
      const t = index / samples,
        x = wall.x1 + (wall.x2 - wall.x1) * t,
        y = wall.y1 + (wall.y2 - wall.y1) * t;
      if (
        distanceToRectangle(frame, x, y, u, v, w, h) <
        (wall.thickness || 0) / 2 + thickness
      )
        return false;
    }
  }
  return true;
}

function apartmentFixture(definition, context) {
  const [x, y] = context.frame.normalized(definition.at),
    [u, v] = context.frame.local(x, y),
    rotated = Math.abs(definition.rotation || 0) % 180 === 90,
    w = rotated ? definition.h : definition.w,
    h = rotated ? definition.w : definition.h;
  if (
    !rectangleIsClear({
      ...context,
      u,
      v,
      w,
      h,
      wallClearance: context.config.wallClearance,
      doorClearance: context.config.doorClearance,
      stairClearance: context.config.stairClearance,
    }) ||
    !clearOfInternalWalls(context.frame, u, v, w, h, context.internalWalls, 2)
  )
    return null;
  return {
    id: `${context.prefix}:${context.floorId}:fixture:${definition.id}`,
    kind: "furniture",
    type: definition.type,
    wayId: context.building.wayId,
    floorId: context.floorId,
    x,
    y,
    w,
    h,
    angle: context.frame.angle + ((definition.rotation || 0) * Math.PI) / 180,
    points: rectanglePoints(context.frame, u, v, w, h),
  };
}

function apartmentContainer(definition, context) {
  const [x, y] = context.frame.normalized(definition.at),
    [u, v] = context.frame.local(x, y),
    size = PIXELS_PER_METER;
  if (
    !rectangleIsClear({
      ...context,
      u,
      v,
      w: size,
      h: size,
      wallClearance: context.config.wallClearance,
      doorClearance: context.config.doorClearance,
      stairClearance: context.config.stairClearance,
    }) ||
    !clearOfInternalWalls(
      context.frame,
      u,
      v,
      size,
      size,
      context.internalWalls,
      2,
    )
  )
    return null;
  return {
    id: `${context.prefix}:${context.floorId}:container:${definition.id}`,
    type: definition.type,
    lootTable: definition.lootTable || definition.type,
    wayId: context.building.wayId,
    floorId: context.floorId,
    x,
    y,
    ...tileCoordinates(x, y),
    angle: context.frame.angle,
  };
}

function createTemplateLayout(building, template, floorId, options) {
  const points = usablePoints(building),
    floor = template.floors[floorId];
  if (!points || !floor) return null;
  const frame = interiorFrame(points);
  if (!frame) return null;
  const config = { ...APARTMENT, ...options },
    prefix = building.id || `osm:${building.wayId}`,
    context = {
      frame,
      points,
      building,
      floorId,
      options,
      config,
      prefix,
    },
    { internalWalls, doors } = makeWalls(floor.walls || [], context),
    fixtureContext = { ...context, internalWalls },
    fixtures = (floor.furniture || [])
      .map((definition) => apartmentFixture(definition, fixtureContext))
      .filter(Boolean),
    containers = (floor.containers || [])
      .map((definition) => apartmentContainer(definition, fixtureContext))
      .filter(Boolean);
  return {
    ...emptyLayout(building, floorId, template.id),
    fixtures,
    containers,
    internalWalls,
    doors,
  };
}

export function getBuildingLayout(building, floorId = "ground", options = {}) {
  const template = BUILDING_LAYOUTS[building?.wayId];
  if (!template || !template.floors[floorId]) return null;
  if (
    floorId === "upper" &&
    Number(building.tags?.["building:levels"] || 1) <= 1
  )
    return null;
  return createTemplateLayout(building, template, floorId, options);
}

export function getBuildingLayouts(building, options = {}) {
  return ["ground", "upper"]
    .map((floorId) => getBuildingLayout(building, floorId, options))
    .filter(Boolean);
}

export function circleHitsInternalWalls(x, y, radius, walls = []) {
  for (const wall of walls) {
    const projected = projectToSegment(
        x,
        y,
        wall.x1,
        wall.y1,
        wall.x2,
        wall.y2,
      ),
      clearance = radius + (wall.thickness || 0) / 2;
    if (projected.distanceSquared <= clearance * clearance) return wall;
  }
  return null;
}
