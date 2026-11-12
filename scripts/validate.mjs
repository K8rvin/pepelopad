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
  MAIN,
  assertValidGameData,
} from "../src/data/index.js";

assertValidGameData({
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
  MAIN,
});
console.log(
  `Game data: OK (${Object.keys(ITEMS).length} items, ${RECIPES.length} recipes, ${MAIN.length} main quests)`,
);
