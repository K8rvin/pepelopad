// База игрока с выжившими: владелец состояния (постройки, жители, склад, рейды).
// Основание на открытом газоне; жители приходят сами при наличии места и еды;
// постройки дают защиту/места/слоты/ежедневное производство; ночью — рейд.
import { countItem, removeItem, addItem } from "./inventory.js";
import { canAfford } from "./camps.js";
import { tileAt } from "../world/cityGen.js";
import { T_GRASS } from "../render/tiles.js";
import { spawnZombie } from "./actors.js";
import {
  BASE_STRUCTURES,
  BASE_START_SLOTS,
  BASE_START_CAPACITY,
} from "../data/base.js";

export function createBase() {
  return {
    founded: false,
    x: 0,
    y: 0,
    structures: [],
    residents: 0,
    storage: {
      slots: new Array(BASE_START_SLOTS).fill(null),
      size: BASE_START_SLOTS,
    },
    raidDay: 0,
  };
}

export function baseCapacity(b) {
  return (
    BASE_START_CAPACITY +
    b.structures.filter((id) => id === "housing").length * 2
  );
}

export function baseDefense(b) {
  return b.structures.filter((id) => id === "barricade").length * 2;
}

export function canFound(b, city, player) {
  if (b.founded) return false;
  if (tileAt(city, player.x, player.y) !== T_GRASS) return false;
  return !city.buildings.some(
    (bl) =>
      player.x > bl.x - 1 &&
      player.x < bl.x + bl.w + 1 &&
      player.y > bl.y - 1 &&
      player.y < bl.y + bl.h + 1,
  );
}

export function foundBase(b, city, player) {
  if (!canFound(b, city, player)) return false;
  b.founded = true;
  b.x = player.x;
  b.y = player.y;
  return true;
}

function pay(inv, cost) {
  for (const [id, n] of Object.entries(cost)) removeItem(inv, id, n);
}

export function buildStructure(b, inv, idx) {
  const s = BASE_STRUCTURES[idx];
  if (!s || !canAfford(inv, s.cost)) return false;
  pay(inv, s.cost);
  b.structures.push(s.id);
  if (s.slots) {
    while (b.storage.slots.length < b.storage.size + s.slots)
      b.storage.slots.push(null);
    b.storage.size += s.slots;
  }
  return true;
}

// новый день: житель приходит при месте и еде; постройки и жители производят
export function baseNewDay(b, day) {
  if (!b.founded) return;
  const cap = baseCapacity(b);
  if (b.residents < cap) {
    const fi = b.storage.slots.findIndex((s) => s && s.id === "can");
    if (fi >= 0) {
      const s = b.storage.slots[fi];
      s.n--;
      if (!s.n) b.storage.slots[fi] = null;
      b.residents++;
    }
  }
  for (const id of b.structures) {
    const s = BASE_STRUCTURES.find((k) => k.id === id);
    if (s?.produce) addItem(b.storage, s.produce.id, s.produce.n);
  }
  if (b.residents > 0) {
    addItem(b.storage, "scrap", b.residents);
    addItem(b.storage, "wood", b.residents);
  }
}

// ночной рейд на базу: тем меньше, чем выше защита и чем больше жителей
export function baseRaid(b, city, day) {
  if (!b.founded || b.raidDay >= day) return 0;
  b.raidDay = day;
  const count = Math.max(
    0,
    3 + Math.floor(day / 2) - baseDefense(b) - b.residents,
  );
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    spawnZombie(
      city,
      b.x + Math.cos(a) * 14,
      b.y + Math.sin(a) * 14,
      day >= 3 && i === 0 ? "brute" : "walker",
    );
  }
  return count;
}

export function baseStructDef(id) {
  return BASE_STRUCTURES.find((s) => s.id === id);
}

export { countItem };
