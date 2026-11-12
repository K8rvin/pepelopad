import { describe, expect, it } from "vitest";
import { createShotProjectiles, getReloadTime } from "../src/systems/combat.js";
import { WEAPONS } from "../src/data/weapons.js";

describe("бой", () => {
  it("уменьшает время перезарядки от навыков", () => {
    const weapon = WEAPONS.bow;
    expect(getReloadTime(weapon, { reload: 0, archer: 0 })).toBe(weapon.rl);
    expect(getReloadTime(weapon, { reload: 1, archer: 1 })).toBeCloseTo(
      weapon.rl * 0.94 * 0.94,
    );
  });

  it("создаёт стрелу с типом arrow", () => {
    const [projectile] = createShotProjectiles({
      x: 0,
      y: 0,
      aim: 0,
      weaponId: "bow",
      damageMultiplier: 1,
      random: () => 0.5,
    });
    expect(projectile.type).toBe("arrow");
    expect(projectile.from).toBe("p");
    expect(projectile.vx).toBe(WEAPONS.bow.spd);
  });

  it("создаёт шесть картечин дробовика", () => {
    const projectiles = createShotProjectiles({
      x: 0,
      y: 0,
      aim: 0,
      weaponId: "shotgun",
      damageMultiplier: 2,
      random: () => 0.5,
    });
    expect(projectiles).toHaveLength(6);
    expect(projectiles[0].dmg).toBe(WEAPONS.shotgun.dmg * 2);
    expect(projectiles[0].type).toBe("shotgun");
  });
});
