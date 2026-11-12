import { describe, expect, it } from "vitest";
import {
  addItemToSlots,
  countItemInSlots,
  removeItemFromSlots,
} from "../src/systems/inventory.js";

const item = { st: 10 };

describe("инвентарь", () => {
  it("сначала пополняет существующие стеки", () => {
    const slots = [{ id: "wood", n: 8 }, null];
    expect(addItemToSlots(slots, item, "wood", 5)).toEqual({
      added: 5,
      left: 0,
    });
    expect(slots).toEqual([
      { id: "wood", n: 10 },
      { id: "wood", n: 3 },
    ]);
  });

  it("возвращает остаток при переполнении без изменения слотов", () => {
    const slots = [{ id: "wood", n: 10 }];
    expect(addItemToSlots(slots, item, "wood", 7)).toEqual({
      added: 0,
      left: 7,
    });
    expect(addItemToSlots(slots, item, "wood", 7)).toEqual({
      added: 0,
      left: 7,
    });
    expect(slots).toEqual([{ id: "wood", n: 10 }]);
  });

  it("возвращает фактически добавленное количество", () => {
    const slots = [{ id: "wood", n: 9 }, null];
    expect(addItemToSlots(slots, item, "wood", 15)).toEqual({
      added: 11,
      left: 4,
    });
    expect(countItemInSlots(slots, "wood")).toBe(20);
  });

  it("удаляет предметы из нескольких стеков и очищает слоты", () => {
    const slots = [{ id: "wood", n: 4 }, { id: "wood", n: 6 }, null];
    expect(removeItemFromSlots(slots, "wood", 7)).toBe(7);
    expect(slots).toEqual([null, { id: "wood", n: 3 }, null]);
    expect(removeItemFromSlots(slots, "wood", 5)).toBe(3);
  });
});
