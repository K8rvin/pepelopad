import { describe, it, expect } from "vitest";
import {
  createCombat,
  initCombat,
  meleeAttack,
} from "../src/iso/systems/combat.js";
import { weaponDef, WEAPONS, FISTS } from "../src/iso/data/weapons.js";
import { createSkills, gainXp, modifiers } from "../src/iso/systems/skills.js";

function city(zombies) {
  return { zombies };
}
const z = (x, y, hp = 70) => ({
  x,
  y,
  hp,
  dead: false,
  type: "walker",
  level: 0,
});

describe("оружие: данные", () => {
  it("weaponDef: известные и кулаки по умолчанию", () => {
    expect(weaponDef("bat").kind).toBe("melee");
    expect(weaponDef("bow").kind).toBe("ranged");
    expect(weaponDef("unknown")).toEqual(FISTS);
    expect(WEAPONS.bat.dmg).toBeGreaterThan(WEAPONS.knife.dmg);
  });
});

describe("ближний удар", () => {
  it("бьёт зомби впереди в радиусе, кулдаун блокирует повтор", () => {
    initCombat(1);
    const C = createCombat();
    const c = city([z(1.5, 0)]);
    const hits = meleeAttack(
      C,
      { x: 0, y: 0, level: 0 },
      { x: 2, y: 0 },
      c,
      WEAPONS.bat,
    );
    expect(hits).toBe(1);
    expect(c.zombies[0].hp).toBe(70 - WEAPONS.bat.dmg);
    expect(C.meleeCd).toBeGreaterThan(0);
    expect(C.swingT).toBeGreaterThan(0);
    // повтор сразу — кулдаун
    expect(
      meleeAttack(C, { x: 0, y: 0, level: 0 }, { x: 2, y: 0 }, c, WEAPONS.bat),
    ).toBe(0);
  });
  it("добивает слабого зомби и вызывает onKill('melee')", () => {
    const C = createCombat();
    let src = null;
    C.onKill = (s) => (src = s);
    const c = city([{ ...z(1.2, 0, 10), type: "runner", face: -1 }]);
    meleeAttack(C, { x: 0, y: 0, level: 0 }, { x: 2, y: 0 }, c, WEAPONS.bat);
    expect(c.zombies[0].dead).toBe(true);
    expect(C.kills).toBe(1);
    expect(src).toBe("melee");
    expect(C.corpses[0]).toMatchObject({
      type: "runner",
      face: -1,
      scale: 0.92,
    });
  });
  it("не бьёт позади (дуга)", () => {
    const C = createCombat();
    const c = city([z(-1.5, 0)]);
    const hits = meleeAttack(
      C,
      { x: 0, y: 0, level: 0 },
      { x: 2, y: 0 },
      c,
      WEAPONS.bat,
    );
    expect(hits).toBe(0);
  });
  it("шум привлекает зомби в радиусе weapon.noise", () => {
    const C = createCombat();
    const near = z(5, 0);
    const c = city([near]);
    meleeAttack(C, { x: 0, y: 0, level: 0 }, { x: 2, y: 0 }, c, WEAPONS.bat);
    expect(near.alertT).toBeGreaterThan(0);
  });
  it("урон растёт с навыком ближнего боя", () => {
    const S = createSkills();
    const m0 = modifiers(S);
    gainXp(S, "melee", 1000);
    const m1 = modifiers(S);
    expect(m1.meleeDmgK).toBeGreaterThan(m0.meleeDmgK);
  });
});
