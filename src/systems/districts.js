import { DISTRICTS } from "../data/districts.js";

export function districtDefinition(id) {
  return DISTRICTS[id] || DISTRICTS.residential;
}

export function districtGuardCount(baseGuard, threat, district) {
  return Math.max(
    1,
    Math.round(
      baseGuard * (0.4 + threat) * districtDefinition(district).danger,
    ),
  );
}

export function rollDistrictLoot(district, random = Math.random) {
  for (const [id, chance, n] of districtDefinition(district).loot)
    if (random() < chance) return { id, n };
  return null;
}
