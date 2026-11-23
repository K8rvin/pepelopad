import { createStoryObjects } from "../world/storyLocations.js";
import { addItem, countItem, removeItem } from "./inventory.js";
import { applyStoryEffects, conditionMatches } from "./story.js";
import { openTrunk } from "./vehicles.js";

function copyInventory(inv) {
  return { ...inv, slots: inv.slots.map((s) => (s ? { ...s } : null)) };
}

function fits(inv, items) {
  const copy = copyInventory(inv);
  return items.every(([id, n]) => addItem(copy, id, n) === 0);
}

export function createInteractions(city, saved = null) {
  const objects = createStoryObjects(city);
  for (const state of saved || []) {
    const object = objects.find((o) => o.id === state.id);
    if (!object) continue;
    object.done = !!state.done;
    object.unlocked = !!state.unlocked;
    object.uses = state.uses || 0;
  }
  return { objects, nearest: null };
}

export function objectAvailable(object, ctx) {
  if (object.done && !object.repeat) return false;
  return conditionMatches(object.when, ctx);
}

export function nearestInteraction(interactions, x, y, ctx, radius = 2.1) {
  let best = null;
  let bestDistance = radius;
  for (const object of interactions.objects) {
    if (!objectAvailable(object, ctx)) continue;
    const distance = Math.hypot(object.x - x, object.y - y);
    if (distance < bestDistance) {
      best = object;
      bestDistance = distance;
    }
  }
  return best;
}

export function performInteraction(interactions, object, ctx) {
  const output = { ok: false, events: [], questResults: [], commands: [] };
  if (!object || !objectAvailable(object, ctx)) return output;
  if (
    object.action === "toggleGenerator" &&
    !ctx.story.generatorOn &&
    ctx.story.generatorFuel <= 0 &&
    countItem(ctx.inv, "fuel") < 1
  ) {
    output.commands.push({ type: "missing", items: { fuel: 1 } });
    return output;
  }
  const cost = Object.entries(object.cost || {});
  if (!cost.every(([id, n]) => countItem(ctx.inv, id) >= n)) {
    output.commands.push({ type: "missing", items: object.cost });
    return output;
  }
  const grant = object.action === "loadVehicle" ? [] : object.items || [];
  if (grant.length && !fits(ctx.inv, grant)) {
    output.commands.push({ type: "full" });
    return output;
  }

  let vehicle = null;
  let trunk = null;
  if (object.repairVehicle || object.action === "loadVehicle") {
    vehicle = ctx.city.cars.find(
      (car) => car.storyId === (object.repairVehicle || "story_van"),
    );
    if (!vehicle) return output;
  }
  if (object.action === "loadVehicle") {
    openTrunk(vehicle);
    trunk = vehicle.trunk;
    const items = Object.entries(object.items || {});
    if (!items.every(([id, n]) => countItem(ctx.inv, id) >= n)) {
      output.commands.push({ type: "missing", items: object.items });
      return output;
    }
    if (!fits(trunk, items)) {
      output.commands.push({ type: "trunkFull" });
      return output;
    }
    for (const [id, n] of items) {
      removeItem(ctx.inv, id, n);
      addItem(trunk, id, n);
    }
    output.commands.push({ type: "vehicleLoaded", vehicle });
  }

  for (const [id, n] of cost) removeItem(ctx.inv, id, n);
  for (const [id, n] of grant) {
    addItem(ctx.inv, id, n);
    output.events.push({ type: "collect", data: { id, n } });
  }
  if (object.repairVehicle) {
    vehicle.wreck = false;
    vehicle.hp = 100;
    vehicle.fuel = Math.max(vehicle.fuel || 0, 6);
    vehicle.v = 0;
    output.commands.push({ type: "rebuildWorld" });
  }
  object.uses++;
  if (!object.repeat) object.done = true;
  if (object.unlock) object.unlocked = true;

  const effects = applyStoryEffects(
    ctx.story,
    { flag: object.flag, clue: object.clue, project: object.project },
    ctx,
  );
  output.questResults.push(...effects.questResults);
  output.commands.push(...effects.commands);
  if (object.noise)
    output.commands.push({ type: "noise", radius: object.noise });
  if (object.spawnGroup)
    output.commands.push({ type: "spawnGroup", id: object.spawnGroup });
  if (object.message)
    output.commands.push({ type: "message", text: object.message });

  if (object.action === "homeStorage")
    output.commands.push({ type: "homeStorage" });
  else if (object.action === "sleep") output.commands.push({ type: "sleep" });
  else if (object.action === "startSiege")
    output.commands.push({ type: "startSiege" });
  else if (object.action === "toggleGenerator") {
    if (!ctx.story.generatorOn && ctx.story.generatorFuel <= 0) {
      removeItem(ctx.inv, "fuel", 1);
      ctx.story.generatorFuel = 1;
    }
    ctx.story.generatorOn = !ctx.story.generatorOn;
    output.commands.push({ type: "generator", on: ctx.story.generatorOn });
  }

  const eventType = ["repair", "build", "loadVehicle"].includes(object.action)
    ? object.action === "loadVehicle"
      ? "load"
      : object.action
    : "interact";
  if (!["homeStorage", "sleep", "toggleGenerator"].includes(object.action))
    output.events.push({ type: eventType, data: { target: object.id } });
  output.ok = true;
  return output;
}
