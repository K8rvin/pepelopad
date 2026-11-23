import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createLoot,
  openContainer,
  containerItems,
  takeAll,
} from "../src/iso/systems/loot.js";
import {
  createInventory,
  addItem,
  countItem,
  removeItem,
} from "../src/iso/systems/inventory.js";
import { craft } from "../src/iso/systems/craft.js";
import { RECIPES } from "../src/iso/data/recipes.js";
import { createQuests, qEvent } from "../src/iso/systems/quests.js";
import { ALL_QUESTS } from "../src/iso/data/quests.js";
import {
  createCombat,
  initCombat,
  releaseBow,
  meleeAttack,
  updateCombat,
} from "../src/iso/systems/combat.js";
import { WEAPONS } from "../src/iso/data/weapons.js";
import { createSurvival, useConsumable } from "../src/iso/systems/survival.js";
import {
  isSimulationPaused,
  isTutorialCraft,
} from "../src/iso/systems/pause.js";

describe("материалы и рецепты обучения", () => {
  it("три ящика АЗС дают фиксированные ресурсы для стрел, ножа и аптечки", () => {
    const city = createCity(11, 9);
    const loot = createLoot(city);
    const inv = createInventory(24);
    for (const id of [
      "gas_training_wood",
      "gas_training_blade",
      "gas_training_medical",
    ]) {
      const container = loot.containers.find((c) => c.id === id);
      expect(container.src.protected).toBe(true);
      expect(containerItems(container).length).toBeGreaterThan(0);
      openContainer(loot, container);
      takeAll(loot, container, (item, n) => addItem(inv, item, n));
    }
    for (const id of ["arrows", "knife", "medkit"])
      expect(
        craft(
          inv,
          RECIPES.find((r) => r.id === id),
        ),
        id,
      ).toBe(true);
    expect(countItem(inv, "arrow")).toBe(6);
    expect(countItem(inv, "knife")).toBe(1);
    expect(countItem(inv, "medkit")).toBe(1);
  });

  it("аптечка лечит 60 HP и снимает инфекцию", () => {
    const inv = createInventory(4);
    addItem(inv, "medkit", 1);
    const combat = createCombat();
    combat.playerHp = 40;
    const player = { infected: true };
    const message = useConsumable(
      createSurvival(),
      combat,
      inv,
      "medkit",
      (id, n) => removeItem(inv, id, n),
      player,
    );
    expect(combat.playerHp).toBe(100);
    expect(player.infected).toBe(false);
    expect(message).toContain("60");
  });
});

describe("миссия m00 и пауза", () => {
  it("проходит поиск, крафт, разговор и практику перед m01", () => {
    const quests = createQuests();
    qEvent(quests, ALL_QUESTS, "visit", { target: "gas" });
    expect(quests.stages.m00).toBe(1);
    for (const id of [
      "gas_training_wood",
      "gas_training_blade",
      "gas_training_medical",
    ])
      qEvent(quests, ALL_QUESTS, "search", { target: id });
    expect(quests.stages.m00).toBe(2);
    expect(isTutorialCraft(quests)).toBe(true);
    for (const id of ["arrows", "knife", "medkit"])
      qEvent(quests, ALL_QUESTS, "craft", { target: id });
    expect(quests.stages.m00).toBe(3);
    qEvent(quests, ALL_QUESTS, "talk", { target: "oleg" });
    expect(quests.stages.m00).toBe(4);
    qEvent(quests, ALL_QUESTS, "practice", { target: "bow" });
    expect(quests.done).not.toContain("m00");
    qEvent(quests, ALL_QUESTS, "practice", { target: "knife" });
    expect(quests.done).toContain("m00");
    expect(quests.states.m01).toBe("active");
    expect(isTutorialCraft(quests)).toBe(false);
  });

  it("диалог останавливает симуляцию, но не отменяет ручную паузу", () => {
    expect(isSimulationPaused({ dialogueOpen: true })).toBe(true);
    expect(isSimulationPaused({ dialogueOpen: false, paused: true })).toBe(
      true,
    );
    expect(isSimulationPaused({ tutorialModal: true })).toBe(true);
    expect(isSimulationPaused({})).toBe(false);
  });

  it("старый сейв продолжает текущий квест без принудительного m00", () => {
    const old = createQuests();
    old.states = { m03: "active" };
    const restored = createQuests(old);
    expect(restored.states.m00).toBeUndefined();
    expect(restored.states.m03).toBe("active");
  });
});

describe("учебная мишень", () => {
  it("засчитывает реальное попадание стрелы и удар ножа, но не промах", () => {
    const city = createCity(11, 9);
    for (const z of city.zombies) z.dead = true;
    const target = city.trainingTargets[0];
    const player = {
      x: target.x - 4,
      y: target.y,
      r: 0.35,
      level: 0,
      weapon: "bow",
    };
    const inv = createInventory(8);
    addItem(inv, "arrow", 3);
    const combat = createCombat();
    initCombat(11);
    const hits = [];
    combat.onPractice = (weapon) => hits.push(weapon);

    combat.bowDrawing = true;
    combat.bowCharge = 1;
    releaseBow(combat, player, { x: target.x, y: target.y + 12 }, inv, city);
    for (let i = 0; i < 15; i++)
      updateCombat(
        combat,
        city,
        player,
        { x: 0, y: 0 },
        0.05,
        i,
        false,
        null,
        [],
      );
    expect(hits).toEqual([]);

    combat.bowDrawing = true;
    combat.bowCharge = 1;
    releaseBow(combat, player, { x: target.x, y: target.y }, inv, city);
    for (let i = 0; i < 20; i++)
      updateCombat(
        combat,
        city,
        player,
        { x: 0, y: 0 },
        0.05,
        i,
        false,
        null,
        [],
      );
    expect(hits).toEqual(["bow"]);

    player.x = target.x - 1;
    player.y = target.y;
    meleeAttack(
      combat,
      player,
      { x: target.x, y: target.y },
      city,
      WEAPONS.knife,
    );
    expect(hits).toEqual(["bow", "knife"]);
  });
});
