import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import { createQuests } from "../src/iso/systems/quests.js";
import { createStory } from "../src/iso/systems/story.js";
import { createCamps } from "../src/iso/systems/camps.js";
import { createSurvivors } from "../src/iso/systems/survivors.js";
import { createInteractions } from "../src/iso/systems/interactions.js";
import { createNpcs } from "../src/iso/systems/npcs.js";
import { createCombat } from "../src/iso/systems/combat.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createCampaignRuntime } from "../src/iso/systems/campaignRuntime.js";
import { MAIN_QUESTS } from "../src/iso/data/quests.js";

function fixture(mainDone = "m04") {
  const city = createCity(11, 9);
  const player = { x: 118, y: 118, level: 0 };
  const inv = createInventory(100);
  for (const id of ["wood", "scrap", "cloth", "can", "meds", "fuel", "part"])
    addItem(inv, id, 50);
  const quests = createQuests();
  const mainIndex = MAIN_QUESTS.findIndex((q) => q.id === mainDone);
  quests.done.push(...MAIN_QUESTS.slice(0, mainIndex + 1).map((q) => q.id));
  const story = createStory();
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const survival = createSurvival();
  const combat = createCombat();
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
    },
    {},
  );
  campaign.sync();
  return {
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
    campaign,
  };
}

function talk(f, id, choice = 0) {
  expect(f.campaign.talk(id), `диалог ${id}`).toBe(true);
  const conversation = f.campaign.dialogue.conversation;
  if (conversation?.choices?.length)
    f.campaign.choose(
      conversation.choices[Math.min(choice, conversation.choices.length - 1)],
    );
  else f.campaign.close(true);
}

function interact(f, id) {
  f.campaign.sync();
  const result = f.campaign.interact(
    f.interactions.objects.find((o) => o.id === id),
  );
  expect(result.ok, `объект ${id}`).toBe(true);
}

function rescue(f, id, campId = "park") {
  f.campaign.executeEffects({ follow: id });
  const survivor = f.survivors.find((s) => s.id === id);
  const camp = f.camps.find((c) => c.id === campId);
  survivor.x = camp.x;
  survivor.y = camp.y;
  f.player.x = camp.x;
  f.player.y = camp.y;
  f.campaign.update(0.05, false);
  expect(survivor.state).toBe("rescued");
}

describe("простые поручения и спасения", () => {
  it("материалы, лазарет и общий ужин дают проекты и однократные награды", () => {
    const f = fixture("m03");
    talk(f, "victor");
    talk(f, "victor");
    expect(f.quests.done).toContain("s_boards");
    expect(f.story.projects).toContain("gate");
    talk(f, "irina");
    talk(f, "irina");
    expect(f.quests.done).toContain("s_irina");
    expect(f.camps.find((c) => c.id === "motel").upgrades).toContain(
      "infirmary",
    );
    talk(f, "nina");
    talk(f, "nina");
    expect(f.quests.done).toContain("s_dinner");
    expect(countItem(f.inv, "meal")).toBe(2);
    const rewards = [...f.quests.rewarded];
    f.campaign.event("talk", { target: "nina" });
    expect(f.quests.rewarded).toEqual(rewards);
  });

  it("Толя освобождается и фактически попадает в список жителей", () => {
    const f = fixture();
    f.campaign.executeEffects({ startQuest: "s_tolya" });
    interact(f, "market_laundry");
    rescue(f, "tolya");
    expect(f.quests.done).toContain("s_tolya");
    expect(f.camps.find((c) => c.id === "park").rescued).toContain("tolya");
  });

  it("сумка Олега и аптечка школы имеют завершение и последствия", () => {
    const f = fixture();
    talk(f, "oleg");
    interact(f, "gas_bag");
    talk(f, "oleg");
    expect(f.quests.done).toContain("s_oleg_bag");
    expect(f.story.flags.oleg_memory).toBe(true);
    talk(f, "vera");
    interact(f, "hospital_school_cache");
    talk(f, "vera");
    expect(f.quests.done).toContain("s_school_meds");
    expect(
      f.camps
        .find((c) => c.id === "school")
        .stock.some((s) => s.id === "insulin"),
    ).toBe(true);
  });
});

describe("продвинутые побочные миссии", () => {
  it("две дозы можно реально выдать двум разным пациентам", () => {
    const f = fixture();
    f.campaign.executeEffects({ startQuest: "s_two_doses" });
    interact(f, "hospital_antibiotic_a");
    talk(f, "lena");
    talk(f, "lena", 0);
    interact(f, "hospital_antibiotic_b");
    talk(f, "vera");
    talk(f, "vera");
    expect(f.quests.done).toContain("s_two_doses");
    expect(f.story.flags.dose_lena).toBe(true);
    expect(f.story.flags.dose_vera).toBe(true);
    expect(f.story.flags.doses_both).toBe(true);
  });

  it("фургон требует ремонт, настоящий груз и доставку в лагерь", () => {
    const f = fixture("m12");
    talk(f, "mark");
    interact(f, "workshop_van");
    interact(f, "workshop_van_load");
    const van = f.city.cars.find((c) => c.storyId === "story_van");
    expect(van.wreck).toBe(false);
    expect(countItem(van.trunk, "can")).toBe(4);
    const camp = f.camps.find((c) => c.id === "school");
    van.x = camp.x;
    van.y = camp.y;
    f.campaign.update(0.05, van);
    expect(f.quests.done).toContain("s_last_ride");
    expect(countItem(van.trunk, "can")).toBe(0);
    expect(camp.stock.some((s) => s.id === "can" && s.free)).toBe(true);
  });

  it("ночной гость, приказ, Матка и личные вещи завершаются", () => {
    const f = fixture("m06");
    talk(f, "gromov");
    f.survival.tod = 22;
    interact(f, "motel_night_gate");
    rescue(f, "night_guest", "school");
    expect(f.quests.done).toContain("s_night_guest");
    talk(f, "sanych");
    interact(f, "police_order");
    talk(f, "sanych");
    talk(f, "gromov");
    expect(f.quests.done).toContain("s_shift");
    talk(f, "raya");
    f.campaign.event("kill", { zombieType: "boss" });
    interact(f, "hospital_supply");
    expect(f.quests.done).toContain("s_hospital");
    f.campaign.executeEffects({ startQuest: "s_names" });
    for (const id of [
      "keepsake_photo",
      "keepsake_toy",
      "keepsake_scarf",
      "keepsake_letter",
    ])
      interact(f, id);
    talk(f, "nina");
    expect(f.quests.done).toContain("s_names");
  });
});
