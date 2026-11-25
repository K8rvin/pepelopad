export function isSimulationPaused({
  paused = false,
  menuOpen = false,
  dialogueOpen = false,
  tutorialModal = false,
}) {
  return paused || menuOpen || dialogueOpen || tutorialModal;
}

export function isTutorialCraft(quests) {
  return quests.states.m00 === "active" && (quests.stages.m00 || 0) === 2;
}

export function createGameplayReporter({ onStart, onStop }) {
  let current = null;
  return function report(paused) {
    if (current === paused) return;
    current = paused;
    paused ? onStop() : onStart();
  };
}
