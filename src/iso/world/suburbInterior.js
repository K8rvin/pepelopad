import { mulberry32 } from "../core/rng.js";
import { FURNITURE } from "../data/furniture.js";

const WALL_MARGIN = 0.2;
const DOOR_HALF = 0.7;

function wallSegments(x1, y1, x2, y2, gaps) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const result = [];
  let cursor = 0;
  for (const [pos, half] of [...gaps].sort((a, b) => a[0] - b[0])) {
    const start = Math.max(0, pos - half);
    const end = Math.min(len, pos + half);
    if (start > cursor)
      result.push({
        x1: x1 + ux * cursor,
        y1: y1 + uy * cursor,
        x2: x1 + ux * start,
        y2: y1 + uy * start,
      });
    cursor = Math.max(cursor, end);
  }
  if (cursor < len)
    result.push({ x1: x1 + ux * cursor, y1: y1 + uy * cursor, x2, y2 });
  return result;
}

function overlaps(a, b, padding = 0.08) {
  return !(
    a.x + a.w + padding <= b.x ||
    b.x + b.w + padding <= a.x ||
    a.y + a.h + padding <= b.y ||
    b.y + b.h + padding <= a.y
  );
}

function blocksDoor(furniture, door) {
  const paddingX = 0.55;
  const paddingY = 0.55;
  return (
    door.x > furniture.x - paddingX &&
    door.x < furniture.x + furniture.w + paddingX &&
    door.y > furniture.y - paddingY &&
    door.y < furniture.y + furniture.h + paddingY
  );
}

export function suburbInterior(b) {
  const w = Math.floor(b.w);
  const h = Math.floor(b.h);
  const r = mulberry32(b.id * 7919 + 131);
  const doorU = b.doorU ?? Math.round(w / 2);
  const hallW = 1.5;
  const hallX = Math.round(((w - hallW) / 2) * 2) / 2;
  const hallB = hallX + hallW;
  const publicDepth = Math.min(3.6, Math.max(3.1, h * 0.36));
  const publicY = h - publicDepth;
  const splitY = publicY * (0.49 + r() * 0.03);
  const hallCenter = hallX + hallW / 2;
  const walls = [];
  const rooms = [];
  const furniture = [];
  const containers = [];

  const rearLeft = {
    id: "rear_left",
    x1: 0,
    y1: 0,
    x2: hallX,
    y2: splitY,
    side: "left",
    doorX: hallX,
    doorY: splitY / 2,
  };
  const rearRight = {
    id: "rear_right",
    x1: hallB,
    y1: 0,
    x2: w,
    y2: splitY,
    side: "right",
    doorX: hallB,
    doorY: splitY / 2,
  };
  const frontLeft = {
    id: "front_left",
    x1: 0,
    y1: splitY,
    x2: hallX,
    y2: publicY,
    side: "left",
    doorX: hallX,
    doorY: (splitY + publicY) / 2,
  };
  const frontRight = {
    id: "front_right",
    x1: hallB,
    y1: splitY,
    x2: w,
    y2: publicY,
    side: "right",
    doorX: hallB,
    doorY: (splitY + publicY) / 2,
  };
  const masterLeft = hallX >= w - hallB;
  rearLeft.role = masterLeft ? "master" : "bathroom";
  rearRight.role = masterLeft ? "bathroom" : "master";
  frontLeft.role = masterLeft ? "bedroom" : "utility";
  frontRight.role = masterLeft ? "utility" : "bedroom";

  const livingLeft = doorU < hallCenter;
  const living = {
    id: "living",
    role: "living",
    x1: livingLeft ? 0 : hallB,
    y1: publicY,
    x2: livingLeft ? hallX : w,
    y2: h,
    side: livingLeft ? "left" : "right",
    doors: [
      { x: doorU, y: h },
      { x: hallCenter, y: publicY },
    ],
  };
  const kitchen = {
    id: "kitchen",
    role: "kitchen",
    x1: livingLeft ? hallB : 0,
    y1: publicY,
    x2: livingLeft ? w : hallX,
    y2: h,
    side: livingLeft ? "right" : "left",
    doors: [],
  };

  for (const room of [rearLeft, rearRight, frontLeft, frontRight]) {
    room.doors = [{ x: room.doorX, y: room.doorY }];
    rooms.push(room);
  }
  rooms.push(living, kitchen, {
    id: "hall",
    role: "hall",
    x1: hallX,
    y1: 0,
    x2: hallB,
    y2: publicY,
    doorX: hallCenter,
    doorY: publicY,
  });

  walls.push(
    { x1: 0, y1: splitY, x2: hallX, y2: splitY },
    { x1: hallB, y1: splitY, x2: w, y2: splitY },
    { x1: 0, y1: publicY, x2: hallX, y2: publicY },
    { x1: hallB, y1: publicY, x2: w, y2: publicY },
  );
  walls.push(
    ...wallSegments(hallX, 0, hallX, publicY, [
      [rearLeft.doorY, DOOR_HALF],
      [frontLeft.doorY, DOOR_HALF],
    ]),
    ...wallSegments(hallB, 0, hallB, publicY, [
      [rearRight.doorY, DOOR_HALF],
      [frontRight.doorY, DOOR_HALF],
    ]),
  );

  function put(room, kind, x, y, width, depth, container = false) {
    const def = FURNITURE[kind] || FURNITURE.table;
    const fw = width ?? def.w;
    const fd = depth ?? def.d;
    const item = { kind, x, y, w: fw, h: fd };
    if (
      x < room.x1 + WALL_MARGIN ||
      y < room.y1 + WALL_MARGIN ||
      x + fw > room.x2 - WALL_MARGIN ||
      y + fd > room.y2 - WALL_MARGIN
    )
      return false;
    if ((room.doors || []).some((door) => blocksDoor(item, door))) return false;
    if (furniture.some((other) => overlaps(item, other))) return false;
    furniture.push(item);
    if (container)
      containers.push({
        id: `int${b.id}_${room.id}_${kind}`,
        kind,
        x: x + fw / 2,
        y: y + fd / 2,
      });
    return true;
  }

  function putAny(room, kind, candidates, container = false) {
    for (const [x, y, w, d] of candidates)
      if (put(room, kind, x, y, w, d, container)) return true;
    return false;
  }

  // Ассеты мебели лицевые (смотрят на юго-восток, в камеру). Ставим их спиной
  // к ВЕРХНИМ стенам: северной (y1, справа-вверху) и западной (x1, слева-вверху).
  // Южная (y2) и восточная (x2) стены — с окнами; держим их свободными для входа.
  // у правых комнат западная стена — перегородка с дверью: мебель вдоль севера
  // начинаем с отступом от двери; у левых западная стена свободна (окон нет)
  const startX = (room) =>
    room.side === "left" ? room.x1 + 0.25 : room.x1 + 0.95;
  const westX = (room) => room.x1 + 0.25; // доп. spots только у левых комнат
  const northY = (room) => room.y1 + 0.22;

  // кухонный гарнитур вдоль северной стены от запада к востоку
  let cursor = startX(kitchen);
  for (const kind of ["fridge", "sink", "stove"]) {
    const def = FURNITURE[kind];
    put(kitchen, kind, cursor, northY(kitchen), def.w, def.d, kind !== "stove");
    cursor += def.w + 0.12;
  }
  const table = FURNITURE.table;
  const tableX = Math.max(
    kitchen.x1 + 0.3,
    Math.min(
      kitchen.x2 - table.w - 0.3,
      (kitchen.x1 + kitchen.x2 - table.w) / 2,
    ),
  );
  const tableY = kitchen.y1 + 1.35; // центр кухни, не у южного окна
  if (put(kitchen, "table", tableX, tableY)) {
    putAny(kitchen, "chair", [
      [tableX - 0.72, tableY + 0.15],
      [tableX + table.w + 0.17, tableY + 0.15],
    ]);
  }

  // гостиная: диван у северной стены, ТВ/шкаф/кресло — север/запад, не в углу
  put(living, "sofa", startX(living), northY(living));
  putAny(living, "tv", [
    [living.x1 + FURNITURE.sofa.w + 0.4, northY(living)],
    [westX(living), living.y1 + 1.3],
  ]);
  putAny(living, "bookcase", [
    [westX(living), living.y1 + 1.3],
    [living.x1 + FURNITURE.sofa.w + 0.4, northY(living)],
  ]);
  putAny(living, "armchair", [
    [living.x1 + 1.7, living.y1 + 1.2],
    [westX(living), living.y1 + 2.2],
  ]);
  putAny(living, "floor_lamp", [
    [living.x2 - FURNITURE.floor_lamp.w - 0.25, northY(living)],
    [westX(living), living.y1 + 3.0],
  ]);

  function furnishBedroom(room, master) {
    const bedW = 1.55;
    const bedD = Math.min(1.7, room.y2 - room.y1 - 0.42);
    const bedX = startX(room); // изголовье к северу, спинка к западу
    const bedY = room.y1 + 0.21;
    if (put(room, "bed", bedX, bedY, bedW, bedD)) {
      put(
        room,
        "nightstand",
        bedX + bedW + 0.08,
        bedY,
        FURNITURE.nightstand.w,
        FURNITURE.nightstand.d,
        true,
      );
    }
    putAny(
      room,
      "dresser",
      [
        [bedX + bedW + 0.7, northY(room)],
        [westX(room), room.y1 + 2.2],
      ],
      true,
    );
    if (master)
      putAny(
        room,
        "wardrobe",
        [
          [westX(room), room.y1 + 2.2],
          [bedX + bedW + 0.7, northY(room)],
        ],
        true,
      );
    else
      putAny(room, "bookcase", [
        [westX(room), room.y1 + 2.2],
        [bedX + bedW + 0.7, northY(room)],
      ]);
  }

  function furnishBathroom(room) {
    // всё вдоль северной стены с запада на восток: ванна → туалет → раковина,
    // фронтом на юг; подход к каждому свободен, дверь и окна не задеты
    const bx = startX(room);
    put(room, "bathtub", bx, northY(room));
    putAny(room, "toilet", [
      [bx + FURNITURE.bathtub.w + 0.25, northY(room)],
      [westX(room), room.y1 + 1.15],
    ]);
    putAny(room, "bathroom_sink", [
      [bx + FURNITURE.bathtub.w + 0.25 + FURNITURE.toilet.w + 0.2, northY(room)],
      [bx + FURNITURE.bathtub.w + 0.25, room.y1 + 0.95],
    ]);
  }

  function furnishUtility(room) {
    put(room, "washer", startX(room), northY(room));
    put(room, "dryer", startX(room) + 0.82, northY(room));
    putAny(
      room,
      "shelf",
      [
        [westX(room), room.y1 + 1.2],
        [room.x1 + 1.7, northY(room)],
      ],
      true,
    );
    putAny(
      room,
      "crate",
      [
        [room.x1 + 1.7, northY(room)],
        [westX(room), room.y1 + 2.1],
      ],
      true,
    );
  }

  for (const room of [rearLeft, rearRight, frontLeft, frontRight]) {
    if (room.role === "master") furnishBedroom(room, true);
    else if (room.role === "bedroom") furnishBedroom(room, false);
    else if (room.role === "bathroom") furnishBathroom(room);
    else furnishUtility(room);
  }

  return {
    layout: "suburb",
    walls,
    rooms,
    furniture,
    containers,
    wide: w >= h,
    corrA: publicY * 0.45,
    corrB: publicY * 0.55,
    doorU,
    stairs: null,
  };
}
