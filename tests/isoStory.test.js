import { beforeEach, describe, expect, it } from "vitest";
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
import { createSkills } from "../src/iso/systems/skills.js";
import { createLoot } from "../src/iso/systems/loot.js";
import { createBase } from "../src/iso/systems/base.js";
import { createStats } from "../src/iso/systems/stats.js";
import { createSiege } from "../src/iso/systems/siege.js";
import {
  saveGame,
  loadGameData,
  applySave,
} from "../src/iso/persistence/save.js";
import { createCampaignRuntime } from "../src/iso/systems/campaignRuntime.js";

function mockStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

function state() {
  const city = createCity(11, 9);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const camps = createCamps(city);
  const story = createStory();
  const survivors = createSurvivors(city);
  return {
    city,
    player: { x: 180, y: 350, level: 0 },
    combat: createCombat(),
    survival: createSurvival(),
    inv: createInventory(24),
    loot: createLoot(city),
    quests: createQuests(),
    skills: createSkills(),
    camps,
    base: createBase(),
    story,
    stats: createStats(),
    interactions,
    survivors,
    siege: createSiege(),
    npcs: createNpcs(city, 76, camps, survivors, story),
  };
}

describe("сохранение кампании v6", () => {
  beforeEach(() => mockStorage());

  it("сохраняет этап, улики, дом, объекты, выжившего и контрольную точку осады", () => {
    const saved = state();
    saved.quests.states = { m15: "active" };
    saved.quests.stages.m15 = 3;
    saved.quests.done = ["m01", "m02"];
    saved.story.flags.generator_repaired = true;
    saved.story.clues = ["mark_radio", "admission_list"];
    saved.story.home.unlocked = true;
    addItem(saved.inv, "battery", 1);
    addItem({ slots: saved.story.home.storage, size: 8 }, "wood", 3);
    const door = saved.interactions.objects.find((o) => o.id === "gas_door");
    door.done = door.unlocked = true;
    const nina = saved.survivors.find((s) => s.id === "nina");
    nina.state = "following";
    nina.hp = 47;
    saved.siege.active = true;
    saved.siege.wave = 2;
    saved.siege.phase = "combat";
    saveGame(saved);

    const fresh = state();
    applySave(loadGameData(), fresh);
    expect(fresh.quests.stages.m15).toBe(3);
    expect(fresh.story.clues).toEqual(["mark_radio", "admission_list"]);
    expect(fresh.story.home.unlocked).toBe(true);
    expect(
      fresh.story.home.storage.some((s) => s?.id === "wood" && s.n === 3),
    ).toBe(true);
    expect(
      fresh.interactions.objects.find((o) => o.id === "gas_door").unlocked,
    ).toBe(true);
    expect(fresh.survivors.find((s) => s.id === "nina").state).toBe(
      "following",
    );
    expect(fresh.survivors.find((s) => s.id === "nina").hp).toBe(47);
    const campaign = createCampaignRuntime(fresh, {});
    expect(fresh.siege.active).toBe(true);
    expect(fresh.siege.gate).toBeTruthy();
    expect(
      fresh.city.zombies.some(
        (z) => !z.dead && z.questGroup === "motel_siege_2",
      ),
    ).toBe(true);
    expect(campaign.siege).toBe(fresh.siege);
  });

  it("мигрирует v5 с имуществом и старой базой, но запускает новый сюжет", () => {
    const old = state();
    addItem(old.inv, "can", 7);
    old.base.founded = true;
    old.base.residents = 2;
    old.camps[0].trust = 42;
    old.city.cars[0].fuel = 17;
    const data = saveGame(old);
    data.cars.pop();
    data.v = 5;
    data.quests = { i: 4, prog: {}, done: ["m1", "m2"] };
    data.story = { i: 3, flags: { hope: true } };
    localStorage.removeItem("pepelopad_city_v6");
    localStorage.setItem("pepelopad_city_v5", JSON.stringify(data));
    const migrated = loadGameData();
    expect(migrated.v).toBe(6);
    expect(migrated.quests).toBeNull();
    const fresh = state();
    applySave(migrated, fresh);
    expect(fresh.inv.slots.some((s) => s?.id === "can" && s.n === 7)).toBe(
      true,
    );
    expect(fresh.base.residents).toBe(2);
    expect(fresh.camps[0].trust).toBe(42);
    expect(fresh.city.cars[0].fuel).toBe(17);
    expect(fresh.city.cars.at(-1).storyId).toBe("story_van");
    expect(fresh.quests.states.m01).toBe("active");
    expect(fresh.story.flags.hope).toBeUndefined();
  });
});
