export function resolveLoadMode(data, mainQuestCount) {
  if (data.dead) return "dead";
  if (!data.Q?.endless && data.Q?.main >= mainQuestCount) return "ending";
  return "play";
}
