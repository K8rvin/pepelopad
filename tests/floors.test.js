import { describe, expect, it } from "vitest";
import {
  changeFloor,
  floorDefinition,
  floorLink,
} from "../src/systems/floors.js";

describe("этажи зданий", () => {
  it("возвращает описание этажа и разрешённую связь", () => {
    expect(floorDefinition("hospital", "upper").name).toBe("Второй этаж");
    expect(floorLink("hospital", "ground", "upper").type).toBe("stairs");
  });

  it("переходит между этажами без изменения координат и здания", () => {
    const location = {
      buildingId: "hospital",
      floorId: "ground",
      x: 20,
      y: 30,
    };
    expect(changeFloor(location, "upper")).toEqual({
      buildingId: "hospital",
      floorId: "upper",
      x: 20,
      y: 30,
    });
    expect(location.floorId).toBe("ground");
  });

  it("запрещает несуществующие этажи и переходы", () => {
    expect(() => floorDefinition("hospital", "roof")).toThrow("Unknown floor");
    expect(() =>
      changeFloor({ buildingId: "gunstore", floorId: "upper" }, "ground"),
    ).toThrow();
  });
});
