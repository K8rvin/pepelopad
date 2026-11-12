import { describe, expect, it } from "vitest";
import {
  districtDefinition,
  districtGuardCount,
  rollDistrictLoot,
} from "../src/systems/districts.js";

describe("районы города", () => {
  it("изменяет численность охраны по опасности", () => {
    expect(districtGuardCount(3, 0.6, "industrial")).toBeGreaterThan(
      districtGuardCount(3, 0.6, "suburb"),
    );
    expect(districtGuardCount(0, 0, "home")).toBe(1);
  });

  it("выдаёт характерную добычу детерминированно", () => {
    expect(rollDistrictLoot("industrial", () => 0)).toEqual({
      id: "scrap",
      n: 2,
    });
    expect(rollDistrictLoot("industrial", () => 0.99)).toBeNull();
    const rolls = [0.31, 0.05];
    expect(rollDistrictLoot("industrial", () => rolls.shift())).toEqual({
      id: "parts",
      n: 1,
    });
  });

  it("использует безопасное описание для неизвестного района", () => {
    expect(districtDefinition("missing").name).toBe("Жилой район");
  });
});
