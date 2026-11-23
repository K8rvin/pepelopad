import { STORY_SITES, SITE_POIS } from "../data/storySites.js";
import { STORY_OBJECTS } from "../data/storyObjects.js";

export function addStoryLocations(city, PITCH) {
  city.storyLocks = [];
  for (const [id, def] of Object.entries(STORY_SITES)) {
    const [bk, bl] = def.block;
    if (bk >= city.nb || bl >= city.nb) continue;
    const x = bk * PITCH + 11 + def.offset[0];
    const y = bl * PITCH + 11 + def.offset[1];
    const building = {
      id: city.buildings.length,
      locationId: id,
      x,
      y,
      w: def.w,
      h: def.h,
      floors: 1,
      style: "brick",
      doorU: Math.round(def.w / 2),
      poi: def.poi,
    };
    city.buildings.push(building);
    for (let yy = Math.floor(y); yy < y + def.h + 12; yy++)
      for (let xx = Math.floor(x - 2); xx < x + def.w + 2; xx++)
        if (xx >= 0 && yy >= 0 && xx < city.SIZE && yy < city.SIZE)
          city.ground[yy * city.SIZE + xx] = 2;
    const clear = (p, margin = 2) =>
      p.x > x - margin &&
      p.x < x + def.w + margin &&
      p.y > y - margin &&
      p.y < y + def.h + 12;
    city.trees = city.trees.filter((t) => !clear(t));
    for (const key of ["containers", "barrels", "benches", "tires"])
      for (const prop of city[key]) if (clear(prop)) prop.dead = true;
  }
  for (const def of STORY_OBJECTS) {
    if (!def.unlock) continue;
    const b = storyBuildingForObject(city, def);
    if (!b) continue;
    const isExterior = ["gas_door", "house_sofya_door"].includes(def.id);
    if (isExterior) {
      const doorU = b.doorU ?? Math.round(b.w / 2);
      city.storyLocks.push({
        id: def.unlock,
        buildingId: b.id,
        x1: doorU - 0.65,
        y1: b.h,
        x2: doorU + 0.65,
        y2: b.h,
      });
    } else if (def.site === "motel") {
      city.storyLocks.push({
        id: def.unlock,
        buildingId: b.id,
        x1: def.x - 0.65,
        y1: def.y,
        x2: def.x + 0.65,
        y2: def.y,
      });
    }
  }
}

export function addStoryVehicle(city) {
  const workshop = storySite(city, "workshop");
  if (!workshop) return;
  city.cars.push({
    storyId: "story_van",
    x: workshop.x + 6,
    y: workshop.y + 20,
    axis: "x",
    color: "#68634d",
    kind: "van",
    wreck: true,
  });
}

export function storyBuilding(city, id) {
  return city.buildings.find((b) => b.locationId === id) || null;
}

export function storySite(city, id) {
  const fixed = storyBuilding(city, id);
  if (fixed) return fixed;
  const poi = SITE_POIS[id];
  if (poi) return city.buildings.find((b) => b.poi === poi) || null;
  if (id === "sofya_house") {
    const hospital = storySite(city, "hospital");
    if (!hospital) return null;
    return (
      city.buildings
        .filter(
          (b) =>
            !b.poi &&
            ["house", "brick"].includes(b.style) &&
            b.x + b.w / 2 < hospital.x &&
            Math.hypot(b.x - hospital.x, b.y - hospital.y) < 180,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - hospital.x, a.y - hospital.y) -
            Math.hypot(b.x - hospital.x, b.y - hospital.y),
        )[0] || null
    );
  }
  return null;
}

function storyBuildingForObject(city, def) {
  return storySite(city, def.site);
}

export function storyPoint(city, ref) {
  if (!ref) return null;
  if (ref.x !== undefined && ref.site === undefined) return { ...ref };
  const site = storySite(city, ref.site);
  if (!site) return null;
  return {
    x: site.x + (ref.x ?? site.w / 2),
    y: site.y + (ref.y ?? site.h / 2),
    buildingId: site.id,
  };
}

export function createStoryObjects(city) {
  return STORY_OBJECTS.flatMap((def) => {
    const p = storyPoint(city, def);
    if (!p) return [];
    if (def.id === "house_sofya_door") {
      const site = storySite(city, def.site);
      p.x = site.x + (site.doorU ?? Math.round(site.w / 2));
      p.y = site.y + site.h + 0.6;
    }
    return [
      {
        ...def,
        x: p.x,
        y: p.y,
        buildingId: p.buildingId,
        done: false,
        unlocked: false,
        uses: 0,
      },
    ];
  });
}

export function storySiteContains(city, id, x, y, radius = 12) {
  const s = storySite(city, id);
  if (!s) return false;
  if (id === "motel" || id === "workshop")
    return (
      x >= s.x - 5 && x <= s.x + s.w + 5 && y >= s.y - 5 && y <= s.y + s.h + 24
    );
  return (
    Math.hypot(x - (s.x + s.w / 2), y - (s.y + s.h / 2)) <
    Math.max(s.w, s.h) / 2 + radius
  );
}
