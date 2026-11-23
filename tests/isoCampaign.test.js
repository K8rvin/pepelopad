import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createInventory,
  addItem,
  countItem,
} from "../src/iso/systems/inventory.js";
import {
  claimPendingRewards,
  claimQuestReward,
  createQuests,
  mainQuest,
} from "../src/iso/systems/quests.js";
import { createStory } from "../src/iso/systems/story.js";
import { createCamps } from "../src/iso/systems/camps.js";
import { createSurvivors } from "../src/iso/systems/survivors.js";
import { createInteractions } from "../src/iso/systems/interactions.js";
import { createNpcs } from "../src/iso/systems/npcs.js";
import { createCombat } from "../src/iso/systems/combat.js";
import { createSurvival } from "../src/iso/systems/survival.js";
import { createSiege } from "../src/iso/systems/siege.js";
import { createCampaignRuntime } from "../src/iso/systems/campaignRuntime.js";
import { ALL_QUESTS } from "../src/iso/data/quests.js";
import { STORY_OBJECTS } from "../src/iso/data/storyObjects.js";
import { DIALOGUES } from "../src/iso/data/dialogues.js";
import { CHARACTERS } from "../src/iso/data/characters.js";
import { ITEMS } from "../src/iso/data/items.js";

function fixture() {
  const city = createCity(11, 9);
  const inv = createInventory(100);
  for (const id of [
    "wood",
    "scrap",
    "cloth",
    "can",
    "meds",
    "fuel",
    "part",
    "arrow",
  ])
    addItem(inv, id, 50);
  const quests = createQuests();
  quests.states = { m01: "active" };
  quests.done.push("m00");
  const story = createStory();
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const survival = createSurvival();
  const combat = createCombat();
  const siege = createSiege();
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
    },
    {},
  );
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
    siege,
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
  const object = f.interactions.objects.find((o) => o.id === id);
  const result = f.campaign.interact(object);
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

function finishSiege(f) {
  for (let wave = 1; wave <= 3; wave++) {
    for (const z of f.city.zombies)
      if (z.questGroup === `motel_siege_${wave}`) z.dead = true;
    f.campaign.update(0.05, false);
    if (wave < 3) f.campaign.update(21, false);
  }
}

describe("данные кампании", () => {
  it("все ссылки на предметы, объекты, NPC и диалоги существуют", () => {
    const ids = new Set(ALL_QUESTS.map((q) => q.id));
    expect(ids.size).toBe(ALL_QUESTS.length);
    const objects = new Set(STORY_OBJECTS.map((o) => o.id));
    const npcs = new Set(CHARACTERS.map((n) => n.id));
    for (const quest of ALL_QUESTS) {
      if (quest.next) expect(ids.has(quest.next)).toBe(true);
      for (const [id] of quest.reward || []) expect(ITEMS[id]).toBeTruthy();
      for (const stage of quest.stages)
        for (const goal of stage.goals) {
          if (goal.id) expect(ITEMS[goal.id]).toBeTruthy();
          if (["interact", "repair", "build", "load"].includes(goal.type))
            expect(objects.has(goal.target), `${quest.id}:${goal.target}`).toBe(
              true,
            );
          if (goal.type === "talk") expect(npcs.has(goal.target)).toBe(true);
        }
    }
    for (const dialogue of DIALOGUES) {
      expect(npcs.has(dialogue.npc), dialogue.id).toBe(true);
      for (const choice of dialogue.choices || []) {
        if (choice.effects?.startQuest)
          expect(ids.has(choice.effects.startQuest)).toBe(true);
        if (choice.effects?.deliverQuest)
          expect(ids.has(choice.effects.deliverQuest)).toBe(true);
      }
    }
  });
});

describe("сквозная кампания", () => {
  it("проходит обучение и всю кампанию, осаду и открытый финал", () => {
    const f = fixture();
    f.campaign.event("visit", { target: "gas" });
    interact(f, "gas_door");
    for (let i = 0; i < 3; i++)
      f.campaign.event("kill", { group: "gas_rescue" });
    talk(f, "oleg");
    interact(f, "gas_battery");
    interact(f, "gas_radio");
    expect(f.quests.done).toContain("m01");

    talk(f, "nina");
    rescue(f, "nina", "motel");
    talk(f, "gromov");
    expect(f.quests.done).toContain("m02");

    talk(f, "victor");
    interact(f, "motel_barricade");
    interact(f, "motel_emergency_cache");
    interact(f, "motel_generator");
    talk(f, "irina");
    expect(f.story.home.unlocked).toBe(true);

    talk(f, "nina");
    talk(f, "irina");
    talk(f, "lena");
    talk(f, "victor");
    interact(f, "motel_list");
    talk(f, "gromov");
    talk(f, "irina");
    talk(f, "nina");
    interact(f, "motel_room9");
    interact(f, "motel_registry");
    talk(f, "victor");
    interact(f, "police_log");
    interact(f, "hospital_card");
    talk(f, "irina");

    interact(f, "market_store_room");
    rescue(f, "artem");
    interact(f, "house_sofya_door");
    rescue(f, "sofya");
    talk(f, "nina");
    f.campaign.event("visit", { target: "school" });
    talk(f, "vera", 1);
    interact(f, "school_refusals");
    talk(f, "pavel");
    talk(f, "vera");
    interact(f, "school_copy");
    talk(f, "nina");
    interact(f, "motel_compare");
    talk(f, "victor");

    f.campaign.event("visit", { target: "workshop" });
    interact(f, "workshop_crate");
    interact(f, "workshop_van");
    for (let i = 0; i < 4; i++)
      f.campaign.event("kill", { group: "workshop_route" });
    talk(f, "mark");
    for (let i = 0; i < 5; i++)
      f.campaign.event("kill", { group: "mark_attack" });
    talk(f, "mark");
    expect(f.story.clues).toContain("mark_copy");

    interact(f, "motel_storage");
    talk(f, "gromov");
    talk(f, "victor");
    talk(f, "irina");
    interact(f, "motel_original");
    interact(f, "motel_final_radio");
    interact(f, "motel_gate");
    talk(f, "gromov");
    interact(f, "motel_siege_start");
    expect(f.siege.active).toBe(true);
    finishSiege(f);
    expect(f.quests.states.m16).toBe("active");
    interact(f, "motel_final_list");
    talk(f, "gromov", 0);
    expect(f.story.ending).toBe("open");
    expect(f.quests.done).toHaveLength(17);
    expect(mainQuest(f.quests, ALL_QUESTS)).toBeNull();
    expect(f.story.flags.gates_open).toBe(true);
  });

  it("гибель свидетеля открывает документальную альтернативу без тупика", () => {
    const f = fixture();
    f.quests.states = { m08: "active" };
    f.quests.stages.m08 = 0;
    f.campaign.sync();
    interact(f, "market_store_room");
    const artem = f.survivors.find((s) => s.id === "artem");
    artem.state = "dead";
    interact(f, "artem_note");
    expect(f.quests.stages.m08).toBe(2);
    expect(f.story.clues).toContain("artem_note");
  });

  it("награда не исчезает при полном рюкзаке и не выдаётся повторно", () => {
    const f = fixture();
    f.inv.slots = [{ id: "arrow", n: 40 }];
    f.inv.size = 1;
    const quest = ALL_QUESTS.find((q) => q.id === "m01");
    const first = claimQuestReward(f.quests, quest, f.inv);
    expect(first.pending).toEqual([["arrow", 6]]);
    expect(claimQuestReward(f.quests, quest, f.inv).pending).toEqual([]);
    f.inv.slots[0] = null;
    claimPendingRewards(f.quests, f.inv);
    expect(countItem(f.inv, "arrow")).toBe(6);
    expect(f.quests.pendingRewards).toEqual([]);
  });
});
