// Крафт: проверка и выполнение рецептов. Состояние — инвентарь игрока.
import { countItem, removeItem, addItem } from "./inventory.js";

export function canCraft(inv, recipe) {
  return Object.entries(recipe.inputs).every(
    ([id, n]) => countItem(inv, id) >= n,
  );
}

// возвращает true, если создано. bonusChance — шанс бонусного выхода (+1 ед.)
// от навыка крафта; roll — seeded RNG вызывающей стороны (не Math.random).
export function craft(inv, recipe, bonusChance = 0, roll = null) {
  if (!canCraft(inv, recipe)) return false;
  for (const [id, n] of Object.entries(recipe.inputs)) removeItem(inv, id, n);
  let n = recipe.out.n;
  if (bonusChance > 0 && roll && roll() < bonusChance) n++;
  return addItem(inv, recipe.out.id, n) === 0;
}
