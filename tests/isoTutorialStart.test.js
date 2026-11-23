import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import { createInventory } from "../src/iso/systems/inventory.js";
import {
  createQuests,
  questTarget,
  qEvent,
} from "../src/iso/systems/quests.js";
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
import { selectDialogue } from "../src/iso/systems/dialogue.js";
import { ALL_QUESTS } from "../src/iso/data/quests.js";

function fixture() {
  const city = createCity(11, 9);
  const inv = createInventory(24);
  const quests = createQuests(); // m00 active, этап 0
  const story = createStory();
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const survival = createSurvival();
  const combat = createCombat();
  const siege = createSiege();
  const loot = createLoot(city);
  const player = { x: 118, y: 118, level: 0 };
  const campaign = createCampaignRuntime(
    {
      city,
      player,
      inv,
      quests,
      story,
      camps,
      survivors,
      interactions,
      npcs,
      survival,
      combat,
      siege,
      loot,
    },
    {},
  );
  return { city, quests, story, loot, campaign, player };
}

describe("старт обучения: маркеры и диалоги", () => {
  it("этап обыска ведёт маркер к конкретному ящику, а не к зданию", () => {
    const f = fixture();
    f.quests.stages.m00 = 1;
    const target = questTarget(f.quests, ALL_QUESTS);
    expect(target).toEqual({
      container: "gas_training_wood",
      name: "Столярный ящик",
    });
    const resolved = f.campaign.target();
    const crate = f.loot.containers.find((c) => c.id === "gas_training_wood");
    expect(resolved).toBeTruthy();
    expect(resolved.x + 0.5).toBeCloseTo(crate.x, 5);
    expect(resolved.y + 0.5).toBeCloseTo(crate.y, 5);
    expect(resolved.poi).toBe("Столярный ящик");
  });
  it("после обыска всех ящиков маркер возвращается к сайту (крафт)", () => {
    const f = fixture();
    f.quests.stages.m00 = 1;
    for (const id of [
      "gas_training_wood",
      "gas_training_blade",
      "gas_training_medical",
    ])
      qEvent(f.quests, ALL_QUESTS, "search", { target: id });
    expect(f.quests.stages.m00).toBe(2);
    expect(questTarget(f.quests, ALL_QUESTS)).toEqual({ site: "gas" });
  });
  it("вступление — монолог gg на этапе 0, одноразовый", () => {
    const f = fixture();
    const ctx = { quests: f.quests, story: f.story, questDefs: ALL_QUESTS };
    const intro = selectDialogue("gg", ctx);
    expect(intro?.id).toBe("intro");
    expect(intro.lines.length).toBeGreaterThanOrEqual(3);
    f.story.seen.intro = true;
    expect(selectDialogue("gg", ctx)).toBeNull();
  });
  it("Олег у заваленной двери подсказывает этапы 0–2, не парковый default", () => {
    const f = fixture();
    const ctx = { quests: f.quests, story: f.story, questDefs: ALL_QUESTS };
    for (const stage of [0, 1, 2]) {
      f.quests.stages.m00 = stage;
      expect(selectDialogue("oleg", ctx)?.id).toBe("oleg_tutorial_door");
    }
    f.quests.stages.m00 = 3;
    expect(selectDialogue("oleg", ctx)?.id).toBe("oleg_tutorial");
  });
});
