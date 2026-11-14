export function createStoryState() {
  return {
    version: 1,
    friendHelp: null,
    branches: {},
    visits: {},
    talks: {},
    rescue: { wayId: 112399694, status: "waiting" },
  };
}

export function normalizeStoryState(saved) {
  const state = createStoryState();
  if (!saved || typeof saved !== "object") return state;
  return {
    ...state,
    ...saved,
    version: 1,
    branches: { ...state.branches, ...(saved.branches || {}) },
    visits: { ...(saved.visits || {}) },
    talks: { ...(saved.talks || {}) },
    rescue: { ...state.rescue, ...(saved.rescue || {}) },
  };
}

export function recordStoryInteraction(story, target) {
  if (!target?.goal) return;
  const collection = target.event === "talk" ? story.talks : story.visits;
  collection[target.goal] = true;
  if (target.event === "rescue") story.rescue.status = "travelling";
}

export function receiveRescuedAtSchool(story, camp) {
  if (story.rescue.status !== "travelling") return false;
  story.rescue.status = "resident";
  camp.rescuedResidents = camp.rescuedResidents || [];
  if (!camp.rescuedResidents.includes("school_rescue"))
    camp.rescuedResidents.push("school_rescue");
  return true;
}

export function selectSchoolBranch(story, camp, branch) {
  if (camp.id !== "camp_school" || !["clinic", "watch"].includes(branch))
    return false;
  if (story.branches.school || camp.branch) return false;
  story.branches.school = branch;
  camp.branch = branch;
  const facility = branch === "watch" ? "tower" : "clinic";
  camp.proj[facility] = Math.max(1, camp.proj[facility] || 0);
  return true;
}

export function eventMatchesTarget(quest, target, type, data) {
  if (!target || target.event !== type || data.stage !== quest.id) return false;
  if (target.goal !== data.goal) return false;
  if (target.wayId != null && target.wayId !== data.wayId) return false;
  if (target.camp && target.camp !== data.camp) return false;
  return true;
}
