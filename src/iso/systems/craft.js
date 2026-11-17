// Крафт: проверка и выполнение рецептов. Состояние — инвентарь игрока.
import { countItem, removeItem, addItem } from "./inventory.js";

export function canCraft(inv, recipe) {
  return Object.entries(recipe.inputs).every(
    ([id, n]) => countItem(inv, id) >= n,
  );
}

// возвращает true, если создано
export function craft(inv, recipe) {
  if (!canCraft(inv, recipe)) return false;
  for (const [id, n] of Object.entries(recipe.inputs)) removeItem(inv, id, n);
  return addItem(inv, recipe.out.id, recipe.out.n) === 0;
}
