import { describe, expect, it } from "vitest";
import {
  advanceClock,
  darknessForTime,
  nextSiegeDayFor,
} from "../src/systems/time.js";

describe("время", () => {
  it("вычисляет темноту и режимы", () => {
    expect(darknessForTime(12)).toBe(0);
    expect(darknessForTime(22)).toBe(0.78);
    expect(darknessForTime(12, "menu")).toBe(0.3);
    expect(darknessForTime(12, "home")).toBe(0.18);
    expect(darknessForTime(20)).toBeCloseTo(0.39);
  });

  it("планирует осады каждый четвёртый день с шестого", () => {
    expect(nextSiegeDayFor(1, 12)).toBe(6);
    expect(nextSiegeDayFor(6, 12)).toBe(6);
    expect(nextSiegeDayFor(6, 21)).toBe(10);
    expect(nextSiegeDayFor(7, 12)).toBe(10);
  });

  it("переводит часы через полночь", () => {
    const result = advanceClock({ day: 2, tod: 23.9 }, 10, 1);
    expect(result.day).toBe(3);
    expect(result.tod).toBeCloseTo(23.9 + (10 * 24) / 460 - 24);
    expect(result.dawn).toBe(true);
  });
});
