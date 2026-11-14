import { BUILDING_LAYOUTS } from "../data/buildingLayouts.js";

const DEFAULTS = {
  pixelsPerMeter: 16,
  straightTurn: Math.PI / 15,
  maxTurnMismatchRatio: 0.2,
  maxEdgeDifference: 0.025,
  maxEdgeRms: 0.015,
  maxAreaRatio: 1.35,
  maxScaleRatio: 1.2,
  maxPerimeterRatio: 1.25,
};

function cleanPoints(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const cleaned = [];
  for (const point of points) {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    )
      return null;
    const previous = cleaned.at(-1);
    if (previous && previous[0] === point[0] && previous[1] === point[1])
      continue;
    cleaned.push([point[0], point[1]]);
  }
  if (
    cleaned.length > 1 &&
    cleaned[0][0] === cleaned.at(-1)[0] &&
    cleaned[0][1] === cleaned.at(-1)[1]
  )
    cleaned.pop();
  return cleaned.length >= 3 ? cleaned : null;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return (
    point[0] >= Math.min(a[0], b[0]) - 1e-9 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-9 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-9
  );
}

function segmentsIntersect(a, b, c, d) {
  const first = orientation(a, b, c),
    second = orientation(a, b, d),
    third = orientation(c, d, a),
    fourth = orientation(c, d, b);
  if (
    ((first > 1e-9 && second < -1e-9) || (first < -1e-9 && second > 1e-9)) &&
    ((third > 1e-9 && fourth < -1e-9) || (third < -1e-9 && fourth > 1e-9))
  )
    return true;
  return (
    (Math.abs(first) <= 1e-9 && onSegment(a, b, c)) ||
    (Math.abs(second) <= 1e-9 && onSegment(a, b, d)) ||
    (Math.abs(third) <= 1e-9 && onSegment(c, d, a)) ||
    (Math.abs(fourth) <= 1e-9 && onSegment(c, d, b))
  );
}

function simplePolygon(points) {
  for (let first = 0; first < points.length; first++) {
    const next = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second++) {
      const secondNext = (second + 1) % points.length;
      if (
        first === second ||
        next === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0)
      )
        continue;
      if (
        segmentsIntersect(
          points[first],
          points[next],
          points[second],
          points[secondNext],
        )
      )
        return false;
    }
  }
  return true;
}

export function buildingShapeFingerprint(points, options = {}) {
  const cleaned = cleanPoints(points);
  if (!cleaned) return null;
  const pixelsPerMeter = options.pixelsPerMeter ?? DEFAULTS.pixelsPerMeter;
  if (!(pixelsPerMeter > 0) || !Number.isFinite(pixelsPerMeter)) return null;
  const meters = cleaned.map(([x, y]) => [
      x / pixelsPerMeter,
      y / pixelsPerMeter,
    ]),
    count = meters.length;
  if (!simplePolygon(meters)) return null;
  let signedArea = 0,
    perimeter = 0;
  const edges = [];
  for (let index = 0; index < count; index++) {
    const a = meters[index],
      b = meters[(index + 1) % count],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(length > 1e-7)) return null;
    signedArea += a[0] * b[1] - b[0] * a[1];
    edges.push(length);
    perimeter += length;
  }
  signedArea /= 2;
  const area = Math.abs(signedArea);
  if (!(area > 1e-7) || !(perimeter > 0)) return null;
  const turns = meters.map((point, index) => {
    const previous = meters[(index + count - 1) % count],
      next = meters[(index + 1) % count],
      incomingX = point[0] - previous[0],
      incomingY = point[1] - previous[1],
      outgoingX = next[0] - point[0],
      outgoingY = next[1] - point[1];
    return Math.atan2(
      incomingX * outgoingY - incomingY * outgoingX,
      incomingX * outgoingX + incomingY * outgoingY,
    );
  });
  return {
    points: meters,
    area,
    signedArea,
    perimeter,
    edges,
    normalizedEdges: edges
      .map((length) => length / perimeter)
      .sort((a, b) => a - b),
    turns,
    normalizedTurns: turns.map((turn) => turn / (Math.PI * 2)),
    winding: Math.sign(signedArea),
  };
}

function turnCategory(turn, straightTurn) {
  return Math.abs(turn) <= straightTurn ? 0 : Math.sign(turn);
}

function alignedTurns(reference, candidate, config) {
  const count = reference.turns.length;
  let best = null;
  for (const direction of [1, -1])
    for (let offset = 0; offset < count; offset++) {
      const targetIndices = [],
        referenceCategories = reference.turns.map((turn) =>
          turnCategory(turn, config.straightTurn),
        );
      let mismatches = 0,
        squaredError = 0;
      for (let index = 0; index < count; index++) {
        const targetIndex =
          (offset + direction * index + count * count) % count;
        targetIndices.push(targetIndex);
        if (
          referenceCategories[index] !==
          direction *
            turnCategory(candidate.turns[targetIndex], config.straightTurn)
        )
          mismatches++;
        const difference = Math.abs(
          reference.turns[index] - direction * candidate.turns[targetIndex],
        );
        squaredError += Math.min(difference, Math.PI) ** 2;
      }
      const result = {
        direction,
        offset,
        targetIndices,
        mismatches,
        turnRms: Math.sqrt(squaredError / count),
      };
      if (
        !best ||
        result.mismatches < best.mismatches ||
        (result.mismatches === best.mismatches && result.turnRms < best.turnRms)
      )
        best = result;
    }
  return best;
}

function center(points) {
  return points.reduce(
    (sum, point) => [
      sum[0] + point[0] / points.length,
      sum[1] + point[1] / points.length,
    ],
    [0, 0],
  );
}

function makeTransform(reference, candidate, alignment, scale) {
  const referenceCenter = center(reference.points),
    candidateCenter = center(candidate.points);
  let real = 0,
    imaginary = 0;
  for (let index = 0; index < reference.points.length; index++) {
    const source = reference.points[index],
      target = candidate.points[alignment.targetIndices[index]],
      sourceX = source[0] - referenceCenter[0],
      sourceY = source[1] - referenceCenter[1],
      targetX = target[0] - candidateCenter[0],
      targetY = target[1] - candidateCenter[1];
    real += sourceX * targetX + sourceY * targetY;
    imaginary += sourceX * targetY - sourceY * targetX;
  }
  const rotation = Math.atan2(imaginary, real),
    cos = Math.cos(rotation),
    sin = Math.sin(rotation);
  return {
    scale,
    rotation,
    translateX:
      candidateCenter[0] -
      scale * (cos * referenceCenter[0] - sin * referenceCenter[1]),
    translateY:
      candidateCenter[1] -
      scale * (sin * referenceCenter[0] + cos * referenceCenter[1]),
  };
}

export function transformShapePoint(point, transform) {
  const cos = Math.cos(transform.rotation) * transform.scale,
    sin = Math.sin(transform.rotation) * transform.scale;
  return [
    cos * point[0] - sin * point[1] + transform.translateX,
    sin * point[0] + cos * point[1] + transform.translateY,
  ];
}

export function transformShape(points, transform) {
  return points.map((point) => transformShapePoint(point, transform));
}

export function matchShapeFingerprints(reference, candidate, options = {}) {
  if (!reference || !candidate) return null;
  const config = { ...DEFAULTS, ...options },
    count = reference.edges.length;
  if (count !== candidate.edges.length || count < 3) return null;
  const areaRatio = candidate.area / reference.area,
    scale = Math.sqrt(areaRatio),
    perimeterRatio = candidate.perimeter / reference.perimeter;
  if (
    areaRatio > config.maxAreaRatio ||
    areaRatio < 1 / config.maxAreaRatio ||
    scale > config.maxScaleRatio ||
    scale < 1 / config.maxScaleRatio ||
    perimeterRatio > config.maxPerimeterRatio ||
    perimeterRatio < 1 / config.maxPerimeterRatio
  )
    return null;
  let maxEdgeDifference = 0,
    squaredEdgeDifference = 0;
  for (let index = 0; index < count; index++) {
    const difference = Math.abs(
      reference.normalizedEdges[index] - candidate.normalizedEdges[index],
    );
    maxEdgeDifference = Math.max(maxEdgeDifference, difference);
    squaredEdgeDifference += difference * difference;
  }
  const edgeRms = Math.sqrt(squaredEdgeDifference / count);
  if (
    maxEdgeDifference > config.maxEdgeDifference ||
    edgeRms > config.maxEdgeRms
  )
    return null;
  const alignment = alignedTurns(reference, candidate, config),
    maxTurnMismatches = Math.max(
      1,
      Math.floor(count * config.maxTurnMismatchRatio),
    );
  if (!alignment || alignment.mismatches > maxTurnMismatches) return null;
  return {
    areaRatio,
    scale,
    perimeterRatio,
    maxEdgeDifference,
    edgeRms,
    turnMismatches: alignment.mismatches,
    turnRms: alignment.turnRms,
    winding: alignment.direction,
    transform: makeTransform(reference, candidate, alignment, scale),
  };
}

function templateEntries(layouts) {
  if (Array.isArray(layouts))
    return layouts.map((template) => [template.sourceWayId, template]);
  return Object.entries(layouts || {}).map(([wayId, template]) => [
    template.sourceWayId ?? Number(wayId),
    template,
  ]);
}

export function apartmentFloorCount(building) {
  const levels = Number(building?.tags?.["building:levels"] || 1);
  return Number.isFinite(levels) && levels >= 1 ? Math.floor(levels) : 0;
}

export function matchBuildingLayout(
  building,
  layouts = BUILDING_LAYOUTS,
  options = {},
) {
  if (
    !building ||
    (building.type !== "apartments" && building.tags?.building !== "apartments")
  )
    return null;
  const levels = apartmentFloorCount(building);
  if (!levels) return null;
  const fingerprint = buildingShapeFingerprint(building.points, options);
  if (!fingerprint) return null;
  for (const [sourceWayId, template] of templateEntries(layouts)) {
    if (!template?.floors?.ground || levels < (template.minLevels || 1))
      continue;
    if (Number(building.wayId) === Number(sourceWayId))
      return {
        template,
        layout: template,
        sourceWayId: Number(sourceWayId),
        source: true,
        fingerprint,
      };
    if (!template.footprint?.points) continue;
    const reference = buildingShapeFingerprint(template.footprint.points, {
        pixelsPerMeter: template.footprint.pixelsPerMeter || 1,
      }),
      match = matchShapeFingerprints(reference, fingerprint, options);
    if (match)
      return {
        template,
        layout: template,
        sourceWayId: Number(sourceWayId),
        source: false,
        fingerprint,
        referenceFingerprint: reference,
        ...match,
      };
  }
  return null;
}
