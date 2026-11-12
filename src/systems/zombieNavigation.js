export function steerAroundObstacles(body, mx, my, isBlocked) {
  const length = Math.hypot(mx, my);
  if (!length) return { mx: 0, my: 0, side: body.side || 1 };
  const dx = mx / length,
    dy = my / length,
    side = body.side || 1,
    lookAhead = body.r + 10,
    clear = (x, y) => {
      const hit = isBlocked(x, y);
      return !hit || hit.kind === "struct";
    };
  if (clear(body.x + dx * lookAhead, body.y + dy * lookAhead))
    return { mx: dx, my: dy, side };

  const angle = Math.atan2(dy, dx);
  for (const offset of [
    (side * Math.PI) / 4,
    (-side * Math.PI) / 4,
    (side * Math.PI) / 2,
    (-side * Math.PI) / 2,
    Math.PI,
  ]) {
    const x = Math.cos(angle + offset),
      y = Math.sin(angle + offset);
    if (clear(body.x + x * lookAhead, body.y + y * lookAhead))
      return { mx: x, my: y, side: Math.sign(offset) || side };
  }
  return { mx: 0, my: 0, side };
}

export function shouldSkipZombieUpdate(zombie, playerDistance) {
  return Boolean(zombie.nest && !zombie.siege && playerDistance > 40 * 16);
}

export function shouldUnloadZombie(zombie, playerDistance) {
  if (zombie.siege) return false;
  const range = (zombie.nest ? 80 : 52) * 16;
  return playerDistance > range;
}
