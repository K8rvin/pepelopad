import { describe, expect, it } from "vitest";
import {
  ITEMS,
  WEAPONS,
  HOT,
  RECIPES,
  SKILLS,
  ZT,
  POI,
  LOOT,
  BUILDS,
  PROJ,
  VEHICLES,
  CAMP_UPGRADES,
  DISTRICTS,
  RAIDS,
  MAIN,
  validateGameData,
} from "../src/data/index.js";

const data = {
  ITEMS,
  WEAPONS,
  HOT,
  RECIPES,
  SKILLS,
  ZT,
  POI,
  LOOT,
  BUILDS,
  PROJ,
  VEHICLES,
  CAMP_UPGRADES,
  DISTRICTS,
  RAIDS,
  MAIN,
};

describe("игровые данные", () => {
  it("содержит только существующие ссылки", () => {
    expect(validateGameData(data)).toEqual([]);
  });

  it("находит отсутствующие результаты, ресурсы и боеприпасы", () => {
    const broken = {
      ITEMS: { arrow: { n: "Стрелы", t: "Боеприпас", st: 99 } },
      WEAPONS: { bow: { ammo: "missing_ammo" } },
      HOT: ["missing_weapon"],
      RECIPES: [
        { id: "broken", out: "missing_out", cost: { missing_cost: 1 } },
      ],
    };
    const errors = validateGameData(broken);
    expect(errors).toContain('WEAPONS.bow: unknown item "missing_ammo"');
    expect(errors).toContain('HOT: unknown weapon "missing_weapon"');
    expect(errors).toContain('RECIPES.broken: unknown item "missing_out"');
    expect(errors).toContain('RECIPES.broken: unknown item "missing_cost"');
  });

  it("находит дубликаты рецептов", () => {
    const recipe = RECIPES[0];
    expect(validateGameData({ ...data, RECIPES: [recipe, recipe] })).toContain(
      'RECIPES: duplicate id "arrow"',
    );
  });

  it("проверяет таблицы лута и сюжетные награды", () => {
    const brokenLoot = { ...LOOT, shelf: [["missing_loot", 1, 1, 1]] };
    const brokenMain = [
      { ...MAIN[0], reward: { items: [["missing_reward", 1]] } },
    ];
    const errors = validateGameData({
      ...data,
      LOOT: brokenLoot,
      MAIN: brokenMain,
    });
    expect(errors).toContain('LOOT.shelf: unknown item "missing_loot"');
    expect(errors).toContain('MAIN.m1.reward: unknown item "missing_reward"');
  });

  it("содержит рюкзак как валидное улучшение", () => {
    expect(ITEMS.backpack.t).toBe("Улучшение");
    expect(RECIPES.find((recipe) => recipe.id === "backpack").upgrade).toBe(
      true,
    );
  });
});
