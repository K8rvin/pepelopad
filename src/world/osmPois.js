import { VOLGOGRAD_QUEST_TARGETS, VOLGOGRAD_SITES } from "../data/volgograd.js";
import { boundsOfWays } from "./osmMap.js";

export function centerOfPoints(points) {
  if (!points.length) throw new Error("OSM object has no geometry");
  const bounds = boundsOfWays([{ points }]);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function resolveOsmReference(world, reference) {
  const [kind, rawId] = reference.split("/"),
    id = Number(rawId);
  if (kind === "node") {
    const node = (
      world.nodeById || new Map(world.nodes.map((item) => [item.id, item]))
    ).get(id);
    if (!node) throw new Error(`Missing OSM reference: ${reference}`);
    return { ...node, kind, name: node.tags.name || reference };
  }
  if (kind === "way") {
    const way = world.wayById.get(id);
    if (!way) throw new Error(`Missing OSM reference: ${reference}`);
    return {
      ...way,
      kind,
      ...centerOfPoints(way.points),
      name: way.tags.name || reference,
    };
  }
  if (kind === "relation") {
    const relation = (
      world.relationById ||
      new Map(world.relations.map((item) => [item.id, item]))
    ).get(id);
    if (!relation) throw new Error(`Missing OSM reference: ${reference}`);
    const points = relation.members
      .filter((member) => member.type === "way" && member.role !== "inner")
      .flatMap((member) => world.wayById.get(member.ref)?.points || []);
    return {
      ...relation,
      kind,
      ...centerOfPoints(points),
      name: relation.tags.name || reference,
    };
  }
  throw new Error(`Unsupported OSM reference: ${reference}`);
}

export function resolveVolgogradSites(world) {
  return Object.fromEntries(
    Object.entries(VOLGOGRAD_SITES).map(([id, site]) => {
      const object = resolveOsmReference(world, site.ref);
      return [id, { ...site, id, x: object.x, y: object.y, ref: site.ref }];
    }),
  );
}

export function createOsmGameProjection(
  world,
  { pixelsPerMeter = 16, blockMeters = 28 } = {},
) {
  const sites = resolveVolgogradSites(world),
    origin = sites.origin,
    blockPixels = blockMeters * pixelsPerMeter,
    originPixels = blockPixels / 2,
    worldToGame = (point) => ({
      x: (point.x - origin.x) * pixelsPerMeter + originPixels,
      y: (point.y - origin.y) * pixelsPerMeter + originPixels,
    }),
    gameToWorld = (point) => ({
      x: (point.x - originPixels) / pixelsPerMeter + origin.x,
      y: (point.y - originPixels) / pixelsPerMeter + origin.y,
    });
  return {
    sites,
    pixelsPerMeter,
    blockMeters,
    blockPixels,
    worldToGame,
    gameToWorld,
    blockForSite(siteId) {
      const point = worldToGame(sites[siteId]);
      return {
        bx: Math.floor(point.x / blockPixels),
        by: Math.floor(point.y / blockPixels),
      };
    },
    campaignTargets() {
      return Object.fromEntries(
        Object.entries(VOLGOGRAD_QUEST_TARGETS).map(([questId, siteIds]) => [
          questId,
          siteIds.map((siteId) => {
            const site = sites[siteId],
              block = this.blockForSite(siteId),
              point = worldToGame(site);
            return {
              ...block,
              x: point.x,
              y: point.y,
              label: site.name,
              osmName: site.osmName,
              siteId,
            };
          }),
        ]),
      );
    },
  };
}
