import { describe, expect, it } from "vitest";
import {
  createStoryState,
  normalizeStoryState,
  receiveRescuedAtSchool,
  recordStoryInteraction,
  selectSchoolBranch,
} from "../src/systems/story.js";

function school() {
  return {
    id: "camp_school",
    proj: { wall: 1, garden: 0, tower: 0, clinic: 0 },
    rescuedResidents: [],
  };
}

describe("сюжетное состояние", () => {
  it("сохраняет выбор друга и ветки при нормализации", () => {
    const story = normalizeStoryState({
      friendHelp: "supplies",
      branches: { school: "clinic" },
    });
    expect(story.friendHelp).toBe("supplies");
    expect(story.branches.school).toBe("clinic");
    expect(story.rescue.status).toBe("waiting");
  });

  it("отмечает спасённого в пути и затем жителем школы", () => {
    const story = createStoryState(),
      camp = school();
    recordStoryInteraction(story, { event: "rescue", goal: "school_rescue" });
    expect(story.rescue.status).toBe("travelling");
    expect(receiveRescuedAtSchool(story, camp)).toBe(true);
    expect(story.rescue.status).toBe("resident");
    expect(camp.rescuedResidents).toEqual(["school_rescue"]);
    expect(receiveRescuedAtSchool(story, camp)).toBe(false);
  });

  it("разрешает только одну школьную ветвь", () => {
    const story = createStoryState(),
      camp = school();
    expect(selectSchoolBranch(story, camp, "watch")).toBe(true);
    expect(camp.proj.tower).toBe(1);
    expect(selectSchoolBranch(story, camp, "clinic")).toBe(false);
    expect(camp.proj.clinic).toBe(0);
    expect(story.branches.school).toBe("watch");
  });
});
