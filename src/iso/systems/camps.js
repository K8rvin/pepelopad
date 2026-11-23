// Лагеря выживших: владелец состояния (доверие, склад, поручения, постройки).
// Торговля-бартер, пожертвования, доставка поручений, ежедневное производство.
import { countItem, removeItem, addItem } from "./inventory.js";
import { poiBuilding } from "./quests.js";
import { PITCH } from "../world/cityGen.js";
import { SURVIVORS } from "../data/survivors.js";
import {
  CAMPS,
  DON_VALUES,
  TRUST_LEVELS,
  REQUEST_POOL,
} from "../data/camps.js";

export function createCamps(city) {
  const camps = CAMPS.map((def, i) => {
    let x, y;
    if (def.poi === "park") {
      x = PITCH + 11 + 45;
      y = PITCH + 11 + 18;
    } else {
      const b = poiBuilding(city, def.poi);
      x = b ? b.x + b.w / 2 : PITCH * (i + 2);
      y = b ? b.y + b.h + 8 : PITCH * (i + 2);
    }
    return {
      id: def.id,
      x,
      y,
      trust: 0,
      upgrades: [],
      stock: [],
      request: null,
      rescued: [],
      usedServiceDay: 0,
    };
  });
  newDay(camps, 1);
  return camps;
}

export function campDef(camp) {
  return CAMPS.find((c) => c.id === camp.id);
}

export function campNear(camps, x, y, r = 3.2) {
  for (const c of camps) if (Math.hypot(c.x - x, c.y - y) < r) return c;
  return null;
}

export function trustLevel(camp) {
  let lv = 0;
  for (let i = 0; i < TRUST_LEVELS.length; i++)
    if (camp.trust >= TRUST_LEVELS[i]) lv = i;
  return lv;
}

export function residents(camp) {
  return (
    (campDef(camp)?.baseResidents ?? 2) +
    trustLevel(camp) +
    (camp.rescued?.length || 0)
  );
}

export function canAfford(inv, cost) {
  return Object.entries(cost).every(([id, n]) => countItem(inv, id) >= n);
}

function pay(inv, cost) {
  for (const [id, n] of Object.entries(cost)) removeItem(inv, id, n);
}

// пожертвование ресурсов → доверие; возвращает начисленное доверие
export function donate(camp, inv, id, n = 1) {
  const val = DON_VALUES[id];
  if (!val) return 0;
  const take = Math.min(n, countItem(inv, id));
  if (!take) return 0;
  removeItem(inv, id, take);
  const gained = take * val;
  camp.trust += gained;
  return gained;
}

// покупка единицы товара со склада лагеря (бартер)
export function buy(camp, inv, idx) {
  const s = camp.stock[idx];
  if (!s || s.n <= 0) return false;
  if (trustLevel(camp) < (s.minTrust || 0)) return false;
  if (!canAfford(inv, s.cost || {})) return false;
  pay(inv, s.cost || {});
  if (addItem(inv, s.id, 1) > 0) return false; // инвентарь полон — не продаём
  s.n--;
  return true;
}

// доставка поручения: предметы → доверие + награда
export function deliver(camp, inv) {
  const req = camp.request;
  if (!req || countItem(inv, req.id) < req.n) return false;
  removeItem(inv, req.id, req.n);
  camp.trust += req.trust;
  for (const [id, n] of req.reward) addItem(inv, id, n);
  camp.request = null;
  return true;
}

// постройка улучшения лагеря
export function build(camp, inv, idx) {
  const def = campDef(camp);
  const up = def.upgrades[idx];
  if (!up || camp.upgrades.includes(up.id)) return false;
  if (!canAfford(inv, up.cost)) return false;
  pay(inv, up.cost);
  camp.upgrades.push(up.id);
  return true;
}

// услуга лазарета: раз в день, только с построенным лазаретом
export function service(camp, combat, day) {
  const def = campDef(camp);
  const up = def.upgrades.find((u) => u.service === "heal");
  if (!up || !camp.upgrades.includes(up.id)) return false;
  if (camp.usedServiceDay >= day) return false;
  if (combat.playerHp >= combat.playerMaxHp) return false;
  combat.playerHp = Math.min(combat.playerMaxHp, combat.playerHp + 30);
  camp.usedServiceDay = day;
  return true;
}

// новый день: склад обновляется (+бонус доверия +производство построек),
// поручение выбирается детерминированно по дню и лагерю
export function newDay(camps, day) {
  camps.forEach((camp, i) => {
    const def = campDef(camp);
    const lv = trustLevel(camp);
    camp.stock = def.stock.map((s) => ({ ...s, n: s.n + lv }));
    for (const uid of camp.upgrades) {
      const up = def.upgrades.find((u) => u.id === uid);
      if (up?.produce)
        camp.stock.push({
          id: up.produce.id,
          n: up.produce.n,
          cost: {},
          minTrust: 0,
          free: true,
        });
    }
    for (const id of camp.rescued || []) {
      const role = SURVIVORS.find((s) => s.id === id)?.role;
      const produced =
        role === "Мастерская" ? "part" : role === "Поиск" ? "scrap" : null;
      if (produced)
        camp.stock.push({
          id: produced,
          n: 1,
          cost: {},
          minTrust: 0,
          free: true,
        });
    }
    camp.request = { ...REQUEST_POOL[(day + i) % REQUEST_POOL.length] };
  });
}
