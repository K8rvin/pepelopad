import { describe, expect, it } from "vitest";
import { createCity } from "../src/iso/world/cityGen.js";
import {
  createSurvivors,
  toggleSurvivor,
  updateSurvivors,
} from "../src/iso/systems/survivors.js";
import { createCamps } from "../src/iso/systems/camps.js";
import { createCombat, updateCombat } from "../src/iso/systems/combat.js";
import { initCombat } from "../src/iso/systems/combat.js";
import { spawnZombie } from "../src/iso/systems/actors.js";

describe("сопровождение выживших", () => {
  it("следует, ждёт и остаётся на месте при посадке в машину", () => {
    const city = createCity(11, 9);
    const camps = createCamps(city);
    const survivors = createSurvivors(city);
    const nina = survivors.find((s) => s.id === "nina");
    const player = { x: 118, y: 118, level: 0 };
    Object.assign(nina, { x: 121, y: 118, state: "following", hidden: false });
    updateSurvivors(survivors, city, player, camps, 0.5);
    expect(nina.x).toBeLessThan(121);
    toggleSurvivor(nina);
    const x = nina.x;
    updateSurvivors(survivors, city, player, camps, 0.5);
    expect(nina.x).toBe(x);
    toggleSurvivor(nina);
    const events = updateSurvivors(survivors, city, player, camps, 0.05, true);
    expect(nina.state).toBe("waiting");
    expect(events[0].type).toBe("leftBehind");
  });

  it("зомби могут убить обычного спутника, но критическая Нина не блокирует кампанию", () => {
    const city = createCity(11, 9);
    for (const z of city.zombies) z.dead = true;
    const survivors = createSurvivors(city);
    const tolya = survivors.find((s) => s.id === "tolya");
    Object.assign(tolya, {
      x: 118,
      y: 118,
      state: "following",
      hidden: false,
      hp: 5,
    });
    const player = { x: 130, y: 130, level: 0, hp: 100 };
    const zombie = spawnZombie(city, 118.2, 118, "walker");
    const combat = createCombat();
    initCombat(11);
    let dead = null;
    combat.onSurvivorDead = (s) => (dead = s);
    updateCombat(
      combat,
      city,
      player,
      { x: 0, y: 0 },
      0.1,
      0,
      true,
      null,
      survivors,
    );
    updateCombat(
      combat,
      city,
      player,
      { x: 0, y: 0 },
      0.5,
      0.1,
      true,
      null,
      survivors,
    );
    expect(tolya.state).toBe("dead");
    expect(dead).toBe(tolya);

    const nina = survivors.find((s) => s.id === "nina");
    Object.assign(nina, {
      x: 118,
      y: 118,
      state: "following",
      hidden: false,
      hp: 5,
    });
    tolya.state = "waiting";
    tolya.hidden = true;
    zombie.dead = false;
    zombie.hp = 70;
    zombie.x = 118.2;
    zombie.y = 118;
    zombie.attackCd = 0;
    zombie.winding = false;
    updateCombat(
      combat,
      city,
      player,
      { x: 0, y: 0 },
      0.1,
      0,
      true,
      null,
      survivors,
    );
    updateCombat(
      combat,
      city,
      player,
      { x: 0, y: 0 },
      0.5,
      0.1,
      true,
      null,
      survivors,
    );
    expect(nina.hp).toBe(1);
    expect(nina.state).toBe("following");
  });
});
