// Движение и простейшее поведение: WASD от экрана (в изометрии экранная ось =
// диагональ мира), зомби бродят и идут к игроку вблизи. Коллизии через solidGrid.
// Случайность поведения — seeded RNG (не глобальный Math.random).
import { clamp, mulberry32 } from "../core/rng.js";
import { solidRectAt } from "../world/cityGen.js";

let rng = mulberry32(1);
export function initActors(seed) {
  rng = mulberry32(seed);
}

export function moveActor(city, a, dx, dy) {
  if (!solidRectAt(city, a.x + dx, a.y, a.r)) a.x += dx;
  if (!solidRectAt(city, a.x, a.y + dy, a.r)) a.y += dy;
  a.x = clamp(a.x, 1, city.SIZE - 1);
  a.y = clamp(a.y, 1, city.SIZE - 1);
}

export function updatePlayer(city, player, keys, dt) {
  const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const iy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  if (ix || iy) {
    const sp = (keys.ShiftLeft ? 5.4 : 3.2) * dt;
    const wx = ix + iy,
      wy = iy - ix;
    const n = Math.hypot(wx, wy);
    moveActor(city, player, (wx / n) * sp, (wy / n) * sp);
    player.animT += dt * 7;
    player.pose = Math.floor(player.animT) % 2;
  }
}

export function updateZombies(city, zombies, player, dt, speedK = 1) {
  for (const z of zombies) {
    // дальние зомби спят (не видны на экране)
    if (Math.abs(z.x - player.x) + Math.abs(z.y - player.y) > 80) continue;
    z.retarget -= dt;
    const dp = Math.hypot(player.x - z.x, player.y - z.y);
    if (dp < 6) {
      z.tx = player.x;
      z.ty = player.y;
    } else if (z.retarget <= 0) {
      z.retarget = 2 + rng() * 4;
      z.tx = clamp(z.x + (rng() - 0.5) * 24, 2, city.SIZE - 2);
      z.ty = clamp(z.y + (rng() - 0.5) * 24, 2, city.SIZE - 2);
    }
    const dx = z.tx - z.x,
      dy = z.ty - z.y,
      d = Math.hypot(dx, dy);
    if (d > 0.3) {
      moveActor(
        city,
        z,
        (dx / d) * 0.85 * speedK * dt,
        (dy / d) * 0.85 * speedK * dt,
      );
      z.animT += dt * 4 * speedK;
      z.pose = Math.floor(z.animT) % 2;
    }
  }
}
