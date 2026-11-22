// Оружие (данные отдельно от механик). Лук — дальнее (натяжение ЛКМ),
// ближние — удар по клику ЛКМ дугой перед игроком. Кулаки — без предмета.
// dmg — базовый урон, range — м, cd — с, noise — радиус шума м, knock — отброс м.
export const WEAPONS = {
  bow: { id: "bow", name: "Лук", kind: "ranged", icon: "🏹" },
  bat: {
    id: "bat",
    name: "Бита",
    kind: "melee",
    icon: "🏏",
    dmg: 26,
    range: 1.8,
    cd: 0.55,
    noise: 7,
    knock: 0.5,
  },
  knife: {
    id: "knife",
    name: "Нож",
    kind: "melee",
    icon: "🔪",
    dmg: 16,
    range: 1.4,
    cd: 0.32,
    noise: 3,
    knock: 0.2,
  },
};

export const FISTS = {
  id: "fists",
  name: "Кулаки",
  kind: "melee",
  icon: "✊",
  dmg: 7,
  range: 1.2,
  cd: 0.5,
  noise: 2,
  knock: 0.15,
};

export function weaponDef(id) {
  return WEAPONS[id] || FISTS;
}

// ближнее оружие, которым можно владеть через предмет инвентаря
export const MELEE_ITEMS = ["bat", "knife"];
