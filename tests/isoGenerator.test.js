import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import { createInventory, addItem } from "../src/iso/systems/inventory.js";
import { createQuests } from "../src/iso/systems/quests.js";
import { createStory } from "../src/iso/systems/story.js";
import { createCamps } from "../src/iso/systems/camps.js";
import { createSurvivors } from "../src/iso/systems/survivors.js";
import { createInteractions } from "../src/iso/systems/interactions.js";
import { createNpcs } from "../src/iso/systems/npcs.js";
import { createCombat } from "../src/iso/systems/combat.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createSiege } from "../src/iso/systems/siege.js";
import { createLoot } from "../src/iso/systems/loot.js";
import { createCampaignRuntime } from "../src/iso/systems/campaignRuntime.js";

function fixture() {
  const city = createCity(11, 9);
  const inv = createInventory(24);
  addItem(inv, "part", 1);
  addItem(inv, "fuel", 2);
  const quests = createQuests();
  for (const id of ["m00", "m01", "m02"]) {
    quests.states[id] = "completed";
    quests.done.push(id);
  }
  quests.states.m03 = "active";
  quests.stages.m03 = 3;
  const story = createStory();
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const campaign = createCampaignRuntime(
    {
      city,
      player: { x: 118, y: 118, level: 0 },
      inv,
      quests,
      story,
      camps,
      survivors,
      interactions,
      npcs,
      survival: createSurvival(),
      combat: createCombat(),
      siege: createSiege(),
      loot: createLoot(city),
    },
    {},
  );
  campaign.sync();
  return { city, inv, quests, story, camps, interactions, campaign };
}

describe("генератор мотеля", () => {
  it("ремонт по квесту включает генератор и даёт топливо", () => {
    const f = fixture();
    const gen = f.interactions.objects.find((o) => o.id === "motel_generator");
    const out = f.campaign.interact(gen);
    expect(out.ok).toBe(true);
    expect(f.story.generatorOn).toBe(true);
    expect(f.story.generatorFuel).toBeGreaterThanOrEqual(2);
    expect(f.story.flags.generator_repaired).toBe(true);
    expect(f.camps.find((c) => c.id === "motel").upgrades).toContain(
      "generator",
    );
    expect(f.quests.stages.m03).toBe(4);
  });
  it("выключатель глушит и запускает генератор после ремонта", () => {
    const f = fixture();
    const gen = f.interactions.objects.find((o) => o.id === "motel_generator");
    f.campaign.interact(gen);
    const toggle = f.interactions.objects.find(
      (o) => o.id === "motel_generator_toggle",
    );
    expect(f.campaign.interact(toggle).ok).toBe(true);
    expect(f.story.generatorOn).toBe(false);
    expect(f.campaign.interact(toggle).ok).toBe(true);
    expect(f.story.generatorOn).toBe(true);
  });
});
