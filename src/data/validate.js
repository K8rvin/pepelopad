export function validateGameData({
  ITEMS,
  WEAPONS,
  HOT,
  RECIPES,
  SKILLS = [],
  ZT = {},
  POI = {},
  LOOT = {},
  BUILDS = {},
  PROJ = {},
  VEHICLES = {},
  CAMP_UPGRADES = {},
  DISTRICTS = {},
  MAIN = [],
}) {
  const errors = [];
  const checkItem = (id, owner) => {
    if (!Object.hasOwn(ITEMS, id))
      errors.push(`${owner}: unknown item "${id}"`);
  };
  const checkCost = (cost, owner) => {
    for (const id of Object.keys(cost)) checkItem(id, owner);
  };
  const checkBlueprint = (id, owner) => {
    const blueprintId = `bp_${id}`;
    checkItem(blueprintId, owner);
    if (ITEMS[blueprintId]?.bp !== id)
      errors.push(`${owner}: blueprint mismatch "${blueprintId}"`);
  };
  const checkUniqueIds = (entries, owner) => {
    const ids = new Set();
    for (const entry of entries) {
      if (ids.has(entry.id))
        errors.push(`${owner}: duplicate id "${entry.id}"`);
      ids.add(entry.id);
    }
  };

  for (const [id, item] of Object.entries(ITEMS)) {
    if (!item.n || !item.t)
      errors.push(`ITEMS.${id}: name and type are required`);
    if (!Number.isInteger(item.st) || item.st < 1)
      errors.push(`ITEMS.${id}: invalid stack size`);
    if (
      item.bp &&
      !Object.hasOwn(WEAPONS, item.bp) &&
      !["turret", "radio", "garage"].includes(item.bp)
    ) {
      errors.push(`ITEMS.${id}: unknown blueprint target "${item.bp}"`);
    }
  }

  for (const [id, weapon] of Object.entries(WEAPONS))
    checkItem(weapon.ammo, `WEAPONS.${id}`);
  for (const id of HOT)
    if (!Object.hasOwn(WEAPONS, id)) errors.push(`HOT: unknown weapon "${id}"`);

  checkUniqueIds(RECIPES, "RECIPES");
  for (const recipe of RECIPES) {
    const owner = `RECIPES.${recipe.id}`;
    checkItem(recipe.out, owner);
    checkCost(recipe.cost, owner);
    if (recipe.bp) checkBlueprint(recipe.bp, owner);
  }

  checkUniqueIds(SKILLS, "SKILLS");
  for (const skill of SKILLS) {
    if (!Number.isInteger(skill.max) || skill.max < 1)
      errors.push(`SKILLS.${skill.id}: invalid max rank`);
  }

  for (const [id, enemy] of Object.entries(ZT)) {
    if (!enemy.n || !enemy.spr)
      errors.push(`ZT.${id}: name and sprite are required`);
  }

  for (const [id, loot] of Object.entries(LOOT)) {
    for (const entry of loot) checkItem(entry[0], `LOOT.${id}`);
  }
  for (const [id, poi] of Object.entries(POI)) {
    for (const type of poi.contTypes) {
      if (!Object.hasOwn(LOOT, type))
        errors.push(`POI.${id}: unknown loot table "${type}"`);
    }
  }

  for (const [id, build] of Object.entries(BUILDS)) {
    checkCost(build.cost, `BUILDS.${id}`);
    if (build.bp) checkBlueprint(build.bp, `BUILDS.${id}`);
  }
  for (const [id, project] of Object.entries(PROJ)) {
    checkCost(project.cost, `PROJ.${id}`);
    if (project.bp) checkBlueprint(project.bp, `PROJ.${id}`);
  }
  for (const [id, upgrade] of Object.entries(CAMP_UPGRADES))
    checkCost(upgrade.cost, `CAMP_UPGRADES.${id}`);
  for (const [id, district] of Object.entries(DISTRICTS)) {
    if (
      !district.name ||
      !Number.isFinite(district.danger) ||
      district.danger <= 0
    )
      errors.push(`DISTRICTS.${id}: invalid name or danger`);
    for (const enemy of district.enemies || [])
      if (!Object.hasOwn(ZT, enemy))
        errors.push(`DISTRICTS.${id}: unknown enemy "${enemy}"`);
    for (const [item] of district.loot || [])
      checkItem(item, `DISTRICTS.${id}.loot`);
  }
  for (const [id, vehicle] of Object.entries(VEHICLES)) {
    for (const field of [
      "maxHp",
      "maxFuel",
      "acceleration",
      "maxSpeed",
      "reverseSpeed",
      "handling",
      "fuelUse",
      "trunkSlots",
    ])
      if (!Number.isFinite(vehicle[field]) || vehicle[field] <= 0)
        errors.push(`VEHICLES.${id}: invalid ${field}`);
    if (!vehicle.name) errors.push(`VEHICLES.${id}: name is required`);
  }

  checkUniqueIds(MAIN, "MAIN");
  const specialGoals = new Set([
    "nest",
    "mega",
    "siege",
    "kills",
    "drive",
    "car_repair",
    "camp_talk",
    "donate",
    "deliver",
    "rescue",
    "sample",
  ]);
  for (const quest of MAIN) {
    for (const [goal] of quest.goals) {
      const special =
        specialGoals.has(goal) ||
        goal.startsWith("craft_") ||
        goal.startsWith("project_");
      if (!Object.hasOwn(ITEMS, goal) && !special)
        errors.push(`MAIN.${quest.id}: unknown goal "${goal}"`);
    }
    for (const [id] of quest.grant || [])
      checkItem(id, `MAIN.${quest.id}.grant`);
    for (const [id] of quest.reward?.items || [])
      checkItem(id, `MAIN.${quest.id}.reward`);
  }

  return errors;
}

export function assertValidGameData(data) {
  const errors = validateGameData(data);
  if (errors.length)
    throw new Error(`Invalid game data:\n${errors.join("\n")}`);
}
