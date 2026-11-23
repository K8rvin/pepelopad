import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import { createInventory } from "../src/iso/systems/inventory.js";
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
  const quests = createQuests();
  const story = createStory();
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const banners = [];
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
    { banner: (q, kind, desc) => banners.push({ id: q.id, kind, desc }) },
  );
  return { quests, campaign, banners };
}

describe("квестовые баннеры", () => {
  it("новая цель этапа — баннер stage с описанием", () => {
    const f = fixture();
    f.campaign.event("visit", { target: "gas" });
    expect(f.banners).toContainEqual({
      id: "m00",
      kind: "stage",
      desc: expect.any(String),
    });
  });
  it("завершение — баннер completed и баннер new для следующей миссии", () => {
    const f = fixture();
    f.campaign.executeEffects({ completeQuest: "m00" });
    expect(
      f.banners.some((b) => b.id === "m00" && b.kind === "completed"),
    ).toBe(true);
    expect(f.banners.some((b) => b.id === "m01" && b.kind === "new")).toBe(
      true,
    );
  });
  it("принятая побочка через startQuest — баннер new", () => {
    const f = fixture();
    f.quests.done.push("m00", "m01");
    f.quests.states.m00 = "completed";
    f.quests.states.m01 = "completed";
    f.campaign.sync();
    f.campaign.executeEffects({ startQuest: "s_oleg_bag" });
    expect(
      f.banners.some((b) => b.id === "s_oleg_bag" && b.kind === "new"),
    ).toBe(true);
  });
});
