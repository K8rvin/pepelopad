export function darknessForTime(tod, mode = "play") {
  if (mode === "menu") return 0.3;
  if (mode === "home") return 0.18;
  if (tod >= 21 || tod < 4) return 0.78;
  if (tod >= 19) return ((tod - 19) / 2) * 0.78;
  if (tod < 6) return ((6 - tod) / 2) * 0.78;
  return 0;
}

export function nextSiegeDayFor(day, tod) {
  let candidate = tod < 20 ? day : day + 1;
  candidate = Math.max(6, candidate);
  while ((candidate - 6) % 4 !== 0) candidate++;
  return candidate;
}

export function advanceClock({ day, tod }, dt, timeSpeed) {
  let nextTod = tod + dt * (24 / 460) * timeSpeed;
  let nextDay = day;
  let dawn = false;
  if (nextTod >= 24) {
    nextTod -= 24;
    nextDay++;
    dawn = true;
  }
  return { day: nextDay, tod: nextTod, dawn };
}
