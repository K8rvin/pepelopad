import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/iso/data/characters.js";
import { SURVIVORS } from "../src/iso/data/survivors.js";
import {
  MELEE_ITEMS,
  NPC_WEAPONS,
  WEAPONS,
  npcWeaponDef,
} from "../src/iso/data/weapons.js";
import { ZTYPES } from "../src/iso/data/zombies.js";
import { createCombat, updateCombat } from "../src/iso/systems/combat.js";
import { spawnZombie, updateZombies } from "../src/iso/systems/actors.js";
import { updateDefense } from "../src/iso/systems/defense.js";
import { updateNpcs } from "../src/iso/systems/npcs.js";

function fixture() {
  const city = {
    SIZE: 100,
    zombies: [],
    buildings: [],
    buildingGrid: new Map(),
    solidGrid: new Map(),
    trainingTargets: [],
  };
  const combat = createCombat();
  return { city, combat };
}

function actor(id, x, y, weapon = "axe") {
  return {
    id,
    name: id,
    x: x + 10,
    y: y + 10,
    r: 0.3,
    level: 0,
    hidden: false,
    weapon,
    face: 1,
    dir: "right",
    moving: false,
    walkPh: 0,
  };
}

function spawn(city, x, y, type) {
  return spawnZombie(city, x + 10, y + 10, type);
}

function step(f, npcs, survivors = [], seconds = 0.1) {
  updateDefense({
    city: f.city,
    npcs,
    survivors,
    combat: f.combat,
    dt: seconds,
  });
}

describe("данные обороны NPC", () => {
  it("все боевые ссылки валидны, Лена без оружия, арсенал игрока не изменился", () => {
    for (const character of [...CHARACTERS, ...SURVIVORS]) {
      if (character.id === "lena") expect(character.weapon).toBeNull();
      else expect(npcWeaponDef(character.weapon), character.id).toBeTruthy();
    }
    expect(MELEE_ITEMS).toEqual(["bat", "knife"]);
    expect(NPC_WEAPONS.knife.dmg).toBeLessThan(WEAPONS.knife.dmg);
  });
});

describe("оборонительный AI", () => {
  it("не атакует вне радиуса, через стену или на другом этаже", () => {
    const f = fixture();
    const n = actor("gromov", 5, 5, "baton");
    const far = spawn(f.city, 26, 5);
    step(f, [n]);
    expect(n.defending).toBe(false);

    const b = { x: 10, y: 10, w: 10, h: 10, floors: 1 };
    f.city.buildings.push(b);
    f.city.buildingGrid.set("0,0", [b]);
    far.x = 20.5;
    far.y = 15;
    step(f, [n]);
    expect(n.defending).toBe(false);

    f.city.buildingGrid.delete("0,0");
    n.y = 19.5;
    far.y = 19.5;
    far.level = 1;
    step(f, [n]);
    expect(n.defending).toBe(false);
    expect(far.hp).toBe(ZTYPES.walker.hp);
  });

  it("не симулирует бой вне активной области игрока", () => {
    const f = fixture();
    const n = actor("gromov", 0, 0, "baton");
    const z = spawn(f.city, 1, 0);
    updateDefense({
      city: f.city,
      player: { x: 90, y: 90 },
      npcs: [n],
      combat: f.combat,
      dt: 0.1,
    });
    expect(n.defending).toBe(false);
    expect(z.hp).toBe(ZTYPES.walker.hp);
  });

  it("выбирает ближайшую цель, бьёт один раз за кулдаун и вызывает onKill npc", () => {
    const f = fixture();
    const n = actor("mark", 0, 0);
    const near = spawn(f.city, 1, 0);
    const other = spawn(f.city, 2, 0);
    let source = null;
    f.combat.onKill = (kind) => (source = kind);
    step(f, [n]);
    expect(n.defenseTarget).toBe(near);
    expect(near.hp).toBe(ZTYPES.walker.hp - NPC_WEAPONS.axe.dmg);
    expect(other.hp).toBe(ZTYPES.walker.hp);
    expect(n.meleeCd).toBeGreaterThan(1);
    const hp = near.hp;
    step(f, [n]);
    expect(near.hp).toBe(hp);
    step(f, [n], [], 1);
    expect(near.hp).toBe(hp - NPC_WEAPONS.axe.dmg);

    near.hp = 1;
    step(f, [n], [], 1);
    step(f, [n], [], 0.2);
    expect(near.dead).toBe(true);
    expect(source).toBe("npc");
    expect(n.swingWeapon).toBe("axe");
    expect(near.alertT).toBeGreaterThan(0);
  });

  it("сближается через moveActor и возвращается к прежнему маршруту", () => {
    const f = fixture();
    const n = actor("oleg", 0, 0, "crowbar");
    n.tx = 15;
    n.ty = 10;
    const z = spawn(f.city, 4, 0);
    step(f, [n], [], 0.5);
    expect(n.x).toBeGreaterThan(10);
    expect(n.moving).toBe(true);
    expect(n.tx).toBe(15);
    expect(z.hp).toBe(ZTYPES.walker.hp);

    for (let i = 0; i < 60 && !z.dead; i++) step(f, [n], [], 0.2);
    expect(z.dead).toBe(true);
    step(f, [n]);
    updateNpcs([n], f.city, 0.1);
    const x = n.x;
    updateNpcs([n], f.city, 0.1);
    expect(n.x).toBeGreaterThan(x);
  });

  it("не атакует во время диалога и не даёт Лене оружия", () => {
    const f = fixture();
    const n = actor("gromov", 0, 0, "baton");
    const lena = actor("lena", 0, 1, null);
    const z = spawn(f.city, 1, 0);
    updateDefense({
      city: f.city,
      npcs: [n, lena],
      combat: f.combat,
      dt: 0.1,
      dialogueNpc: "gromov",
    });
    expect(n.defending).toBe(false);
    expect(lena.defending).toBe(false);
    expect(z.hp).toBe(ZTYPES.walker.hp);
  });

  it("спутник обороняется, а rescued с видимым NPC-двойником не бьёт дважды", () => {
    const f = fixture();
    const ninaNpc = actor("nina", 0, 0, "knife");
    const ninaSurvivor = {
      ...actor("nina", 0, 0, "knife"),
      state: "rescued",
      hp: 80,
      maxHp: 80,
    };
    const z = spawn(f.city, 1, 0);
    step(f, [ninaNpc], [ninaSurvivor]);
    expect(z.hp).toBe(ZTYPES.walker.hp - NPC_WEAPONS.knife.dmg);

    ninaNpc.hidden = true;
    ninaSurvivor.state = "following";
    step(f, [ninaNpc], [ninaSurvivor], 1);
    expect(z.hp).toBe(ZTYPES.walker.hp - NPC_WEAPONS.knife.dmg * 2);
    expect(ninaSurvivor.hp).toBe(80);
    expect(ninaSurvivor.state).toBe("following");
  });
});

describe("агрессия зомби и баланс", () => {
  it("зомби выбирает NPC и ранит его без новой HP или смерти", () => {
    const f = fixture();
    const n = actor("gromov", 0, 0, "baton");
    const z = spawn(f.city, 0.2, 0);
    const player = { x: 10, y: 10, level: 0 };
    updateZombies(f.city, f.city.zombies, player, 0.1, 1, false, [], [n]);
    expect(z.tx).toBe(n.x);
    expect(z.ty).toBe(n.y);
    updateCombat(
      f.combat,
      f.city,
      player,
      { x: 0, y: 0 },
      0.1,
      0,
      true,
      null,
      [],
      [n],
    );
    expect(z.attackTarget).toBe("npc:gromov");
    updateCombat(
      f.combat,
      f.city,
      player,
      { x: 0, y: 0 },
      0.5,
      0,
      true,
      null,
      [],
      [n],
    );
    expect(n.hurtT).toBeGreaterThan(0);
    expect(n.hp).toBeUndefined();
    expect(n.hidden).toBe(false);
  });

  it("один защитник не зачищает группу мгновенно и не убивает Матку за 30 секунд", () => {
    const f = fixture();
    const n = actor("mark", 0, 0);
    const wave = Array.from({ length: 5 }, (_, i) => spawn(f.city, i + 1, 0));
    for (let i = 0; i < 50; i++) step(f, [n]);
    expect(wave.filter((z) => !z.dead).length).toBeGreaterThanOrEqual(4);

    for (const z of wave) z.dead = true;
    const boss = spawn(f.city, 1, 0, "boss");
    for (let i = 0; i < 300; i++) step(f, [n]);
    expect(boss.dead).toBe(false);
    expect(boss.hp).toBeGreaterThan(ZTYPES.boss.hp * 0.5);
  });
});
