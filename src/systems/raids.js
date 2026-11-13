import { RAIDS } from "../data/raids.js";

export function raidDefinition(id) {
  return RAIDS[id] || null;
}

export function activeRaidId(sideQuests) {
  return sideQuests.find((quest) => quest.raid)?.raid || null;
}

export function raidDistrictRules(raidId, district) {
  return raidDefinition(raidId)?.rules[district] || null;
}
