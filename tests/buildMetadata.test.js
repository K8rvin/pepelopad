import { describe, expect, it } from "vitest";
import { formatLocalBuildDate } from "../vite.config.js";

describe("метаданные сборки", () => {
  it("использует локальную календарную дату, а не UTC", () => {
    const afterMidnight = new Date(2026, 10, 14, 0, 30);
    expect(formatLocalBuildDate(afterMidnight)).toBe("2026-11-14");
    expect(formatLocalBuildDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
