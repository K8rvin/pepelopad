import { describe, expect, it } from "vitest";
import { createCity, solidRectAt } from "../src/iso/world/cityGen.js";
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
import { createCampaignRuntime } from "../src/iso/systems/campaignRuntime.js";

function finaleFixture(main = "m15") {
  const city = createCity(11, 9);
  const player = { x: 190, y: 350, level: 0 };
  const inv = createInventory(40);
  const quests = createQuests();
  quests.states = { [main]: "active" };
  quests.stages[main] = main === "m15" ? 2 : 1;
  const story = createStory();
  story.flags.generator_repaired = true;
  const camps = createCamps(city);
  const survivors = createSurvivors(city);
  const interactions = createInteractions(city);
  city.storyObjects = interactions.objects;
  const npcs = createNpcs(city, 76, camps, survivors, story);
  const survival = createSurvival();
  const combat = createCombat();
  const siege = createSiege();
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

function start(f) {
  const object = f.interactions.objects.find(
    (o) => o.id === "motel_siege_start",
  );
  expect(f.campaign.interact(object).ok).toBe(true);
}

function aliveWave(f, wave = 1) {
  return f.city.zombies.filter(
    (z) => !z.dead && z.questGroup === `motel_siege_${wave}`,
  );
}

describe("осада мотеля", () => {
  it("подготовка меняет число врагов и прочность ворот", () => {
    const plain = finaleFixture();
    start(plain);
    expect(aliveWave(plain)).toHaveLength(5);
    expect(plain.siege.gateMaxHp).toBe(100);

    const ready = finaleFixture();
    ready.story.generatorOn = true;
    ready.story.flags.route_cleared = true;
    ready.story.flags.supply_route_ready = true;
    ready.story.projects.push("gate", "siege_gate");
    ready.camps.find((c) => c.id === "school").trust = 50;
    ready.camps.find((c) => c.id === "motel").rescued.push("a", "b");
    start(ready);
    expect(aliveWave(ready)).toHaveLength(3);
    expect(ready.siege.gateMaxHp).toBe(230);
  });

  it("ворота имеют коллизию, ломаются от атак и выпускают волну во двор", () => {
    const f = finaleFixture();
    start(f);
    const gate = f.siege.gate;
    expect(solidRectAt(f.city, gate.x + 1, gate.y, 0.1)).toBe(true);
    const zombie = aliveWave(f)[0];
    zombie.x = gate.x + 1;
    zombie.y = gate.y;
    f.campaign.update(1.2, false);
    expect(f.siege.gateHp).toBeLessThan(f.siege.gateMaxHp);
    f.siege.gateHp = 1;
    f.campaign.update(1.2, false);
    expect(f.siege.gateHp).toBe(0);
    expect(solidRectAt(f.city, gate.x + 1, gate.y, 0.1)).toBe(false);
    expect(zombie.siege).toBe(false);
    expect(zombie.ty).toBe(gate.y - 8);
  });

  it("повтор волны после смерти не дублирует живых врагов", () => {
    const f = finaleFixture();
    start(f);
    const before = aliveWave(f).length;
    aliveWave(f)[0].dead = true;
    expect(f.campaign.retrySiegeWave()).toBe(true);
    expect(aliveWave(f)).toHaveLength(before);
    expect(f.siege.gateHp).toBe(f.siege.gateMaxHp);
  });
});

describe("три финала", () => {
  it("открытые ворота меняют жителей и положение Марка", () => {
    const f = finaleFixture("m16");
    f.story.markRelation = 2;
    f.campaign.talk("gromov");
    f.campaign.choose(f.campaign.dialogue.conversation.choices[0]);
    expect(f.story.ending).toBe("open");
    expect(f.story.flags.gates_open).toBe(true);
    expect(f.camps.find((c) => c.id === "motel").rescued).toContain(
      "school_delegate",
    );
    expect(f.npcs.find((n) => n.id === "mark").x).toBeGreaterThan(180);
  });

  it("закрытый мотель сохраняет порядок ценой отношений со школой", () => {
    const f = finaleFixture("m16");
    f.camps.find((c) => c.id === "school").trust = 50;
    f.campaign.talk("gromov");
    f.campaign.choose(f.campaign.dialogue.conversation.choices[1]);
    expect(f.story.flags.gates_closed).toBe(true);
    expect(f.camps.find((c) => c.id === "school").trust).toBe(40);
  });

  it("общее решение учитывает ранее накопленное доверие и улики", () => {
    const f = finaleFixture("m16");
    f.camps.find((c) => c.id === "school").trust = 40;
    f.camps.find((c) => c.id === "motel").trust = 30;
    f.story.clues = ["a", "b", "c", "d", "e", "f", "g", "h"];
    f.campaign.talk("gromov");
    f.campaign.choose(f.campaign.dialogue.conversation.choices[2]);
    expect(f.story.flags.council_united).toBe(true);

    const split = finaleFixture("m16");
    split.campaign.talk("gromov");
    split.campaign.choose(split.campaign.dialogue.conversation.choices[2]);
    expect(split.story.flags.council_split).toBe(true);
  });
});
