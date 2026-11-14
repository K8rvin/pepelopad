import { cnv, spr, R, blob } from "./spriteUtils.js";

function carSprite(type, col) {
  return spr(type === "truck" ? 32 : 28, 16, (g) => {
    const w = type === "truck" ? 32 : 28;
    R(g, 1, 14, w - 2, 2, "rgba(0,0,0,.35)");
    R(g, 1, 3, w - 2, 10, col);
    R(g, 1, 3, w - 2, 2, "#fff2");
    R(g, 5, 4, w - 12, 5, "#2b3a44");
    R(g, 6, 5, w - 14, 2, "#4a6274");
    R(g, 2, 12, 5, 3, "#111");
    R(g, w - 7, 12, 5, 3, "#111");
    R(g, w - 3, 5, 2, 3, "#ffe87a");
    R(g, 1, 5, 2, 3, "#e04338");
    if (type === "police") {
      R(g, 10, 2, 8, 2, "#7fb8d8");
      R(g, 14, 2, 4, 2, "#e04338");
    }
    if (type === "ambulance") {
      R(g, 12, 6, 4, 4, "#e04338");
      R(g, 13, 5, 2, 6, "#e04338");
    }
    if (type === "truck") {
      R(g, 20, 3, 10, 10, "#5d646b");
      R(g, 21, 4, 8, 8, "#4a5057");
    }
  });
}

function twoWheelSprite(type, col) {
  const w = type === "motorcycle" ? 20 : 18,
    h = type === "motorcycle" ? 8 : type === "bicycle" ? 6 : 7;
  return spr(w, h, (g) => {
    R(g, 1, h - 1, w - 2, 1, "rgba(0,0,0,.35)");
    if (type === "motorcycle") {
      R(g, 1, 2, 3, 4, "#111");
      R(g, 16, 2, 3, 4, "#111");
      R(g, 4, 3, 12, 3, col);
      R(g, 7, 2, 5, 1, "#33383d");
      R(g, 15, 1, 1, 6, "#8a8f84");
      R(g, 18, 3, 1, 2, "#ffe87a");
      R(g, 3, 3, 1, 2, "#e04338");
    } else if (type === "bicycle") {
      R(g, 1, 1, 3, 4, "#111");
      R(g, 14, 1, 3, 4, "#111");
      R(g, 4, 2, 10, 2, col);
      R(g, 7, 1, 4, 1, "#33383d");
      R(g, 8, 4, 3, 1, "#8a8f84");
      R(g, 14, 0, 1, 6, "#8a8f84");
    } else {
      R(g, 1, 2, 3, 3, "#111");
      R(g, 14, 2, 3, 3, "#111");
      R(g, 4, 4, 10, 2, col);
      R(g, 14, 1, 1, 4, "#8a8f84");
      R(g, 13, 0, 3, 1, "#33383d");
    }
  });
}

export function createStructureSprites(S) {
  S.car_sedan = carSprite("sedan", "#8a4520");
  S.car_blue = carSprite("sedan", "#3a5a7a");
  S.car_taxi = carSprite("sedan", "#b7a23c");
  S.car_police = carSprite("police", "#3a4a5a");
  S.car_ambulance = carSprite("ambulance", "#c8cdc2");
  S.car_truck = carSprite("truck", "#5d646b");
  S.car_motorcycle = twoWheelSprite("motorcycle", "#8a4520");
  S.car_bicycle = twoWheelSprite("bicycle", "#6f9c52");
  S.car_scooter = twoWheelSprite("scooter", "#4a7a8a");
  S.car_wreck = carSprite("sedan", "#3a3a32");
  S.barricade = spr(16, 16, (g) => {
    R(g, 1, 4, 14, 9, "#6b5638");
    R(g, 1, 4, 14, 2, "#7d6644");
    R(g, 2, 3, 2, 11, "#54432b");
    R(g, 12, 3, 2, 11, "#54432b");
  });
  S.fence = spr(16, 16, (g) => {
    for (let x = 1; x < 16; x += 4) {
      R(g, x, 2, 3, 12, "#6b5638");
      R(g, x, 2, 3, 2, "#8a7450");
    }
    R(g, 0, 6, 16, 2, "#54432b");
  });
  S.gate = spr(16, 16, (g) => {
    R(g, 0, 3, 16, 11, "#5c4a32");
    for (let x = 1; x < 16; x += 5) R(g, x, 5, 3, 9, "#6b5638");
    R(g, 7, 7, 2, 2, "#ffb23e");
  });
  S.gate_open = spr(16, 16, (g) => {
    R(g, 0, 3, 3, 11, "#5c4a32");
    R(g, 13, 3, 3, 11, "#5c4a32");
  });
  S.turret = spr(16, 16, (g) => {
    R(g, 3, 8, 10, 6, "#4a5057");
    R(g, 6, 4, 4, 4, "#6d747b");
    R(g, 7, 5, 2, 2, "#a6e83c");
  });
  S.generator = spr(16, 16, (g) => {
    R(g, 2, 5, 12, 9, "#8a4520");
    R(g, 4, 8, 4, 4, "#33383d");
    R(g, 10, 8, 3, 3, "#ffb23e");
    R(g, 11, 2, 2, 4, "#4a5057");
  });
  S.medstation = spr(16, 16, (g) => {
    R(g, 2, 4, 12, 10, "#b8bdb2");
    R(g, 6, 6, 4, 7, "#e04338");
    R(g, 4, 8, 8, 3, "#e04338");
  });
  S.bench = spr(16, 16, (g) => {
    R(g, 1, 6, 14, 4, "#7d6644");
    R(g, 2, 10, 2, 4, "#54432b");
    R(g, 12, 10, 2, 4, "#54432b");
    R(g, 3, 3, 3, 3, "#5d646b");
    R(g, 8, 4, 4, 2, "#8a4520");
  });
  S.fire = [
    spr(16, 16, (g) => {
      R(g, 2, 12, 12, 3, "#4a3524");
      blob(g, 8, 8, [2, 4, 6, 8, 6, 4], "#e06828", "#ffb23e");
      R(g, 7, 6, 2, 3, "#ffe87a");
    }),
    spr(16, 16, (g) => {
      R(g, 2, 12, 12, 3, "#4a3524");
      blob(g, 8, 8, [4, 2, 6, 8, 8, 4], "#e06828", "#ffb23e");
      R(g, 8, 5, 2, 4, "#ffe87a");
    }),
  ];
  S.radioTower = spr(16, 16, (g) => {
    R(g, 7, 1, 2, 14, "#5d646b");
    R(g, 3, 14, 10, 2, "#4a5057");
    R(g, 4, 4, 8, 1, "#7fb8d8");
    R(g, 5, 8, 6, 1, "#7fb8d8");
    R(g, 7, 0, 2, 2, "#e04338");
  });
  S.garage = spr(16, 16, (g) => {
    R(g, 1, 3, 14, 12, "#5d646b");
    R(g, 3, 5, 10, 10, "#33383d");
    R(g, 4, 6, 8, 1, "#6d747b");
    R(g, 4, 9, 8, 1, "#6d747b");
    R(g, 4, 12, 8, 1, "#6d747b");
  });
  S.watchtower = spr(16, 16, (g) => {
    R(g, 3, 2, 10, 3, "#6b5638");
    R(g, 4, 5, 2, 11, "#54432b");
    R(g, 10, 5, 2, 11, "#54432b");
    R(g, 2, 1, 12, 1, "#8a7450");
    R(g, 7, 0, 2, 2, "#ffb23e");
  });
  S.tent = spr(16, 16, (g) => {
    R(g, 1, 10, 14, 5, "#55603f");
    R(g, 3, 6, 10, 4, "#6e7a4e");
    R(g, 6, 10, 4, 5, "#2a3322");
  });
  const cont = (fn) =>
    spr(16, 16, (g) => {
      R(g, 1, 14, 14, 2, "rgba(0,0,0,.35)");
      fn(g);
    });
  S.cont_crate = cont((g) => {
    R(g, 1, 4, 14, 11, "#7d6644");
    R(g, 1, 4, 14, 2, "#8a7450");
    R(g, 7, 4, 2, 11, "#54432b");
  });
  S.cont_shelf = cont((g) => {
    R(g, 1, 1, 14, 14, "#5c4a32");
    R(g, 2, 2, 12, 3, "#3a2f20");
    R(g, 2, 7, 12, 3, "#3a2f20");
    R(g, 3, 3, 3, 2, "#8a8f7a");
    R(g, 8, 3, 4, 2, "#8a4520");
  });
  S.cont_fridge = cont((g) => {
    R(g, 2, 1, 12, 14, "#b8bdb2");
    R(g, 2, 6, 12, 1, "#8a8f84");
    R(g, 11, 3, 2, 2, "#5d646b");
  });
  S.cont_cabinet = cont((g) => {
    R(g, 1, 2, 14, 13, "#6b5638");
    R(g, 7, 4, 1, 11, "#54432b");
    R(g, 5, 8, 2, 1, "#c9a86a");
  });
  S.cont_medbox = cont((g) => {
    R(g, 1, 4, 14, 11, "#c8cdc2");
    R(g, 6, 6, 4, 7, "#e04338");
    R(g, 4, 8, 8, 3, "#e04338");
  });
  S.cont_locker = cont((g) => {
    R(g, 2, 1, 12, 14, "#5d646b");
    R(g, 7, 1, 1, 14, "#4a5057");
    R(g, 3, 4, 3, 1, "#33383d");
    R(g, 10, 4, 3, 1, "#33383d");
  });
  S.cont_gunrack = cont((g) => {
    R(g, 1, 1, 14, 14, "#3a352b");
    R(g, 3, 3, 2, 10, "#5d646b");
    R(g, 7, 3, 2, 10, "#6e3a1e");
    R(g, 11, 3, 2, 10, "#5d646b");
  });
  S.cont_market = cont((g) => {
    R(g, 1, 1, 14, 14, "#4a5a3a");
    R(g, 2, 2, 12, 3, "#2a3a22");
    R(g, 3, 3, 2, 2, "#ffb23e");
    R(g, 6, 3, 2, 2, "#e04338");
    R(g, 9, 3, 3, 2, "#7fb8d8");
  });
  S.cont_freezer = cont((g) => {
    R(g, 2, 2, 12, 13, "#7fb8d8");
    R(g, 2, 7, 12, 1, "#5a92b2");
    R(g, 4, 4, 8, 2, "#31485a");
  });
  S.cont_toolbox = cont((g) => {
    R(g, 1, 6, 14, 9, "#e06828");
    R(g, 1, 6, 14, 2, "#ff8a3e");
    R(g, 6, 3, 4, 3, "#5d646b");
  });
  S.cont_desk = cont((g) => {
    R(g, 1, 4, 14, 10, "#5c4a32");
    R(g, 2, 5, 12, 2, "#3a2f20");
    R(g, 3, 8, 4, 3, "#7d6644");
    R(g, 9, 8, 4, 3, "#7d6644");
  });
  S.cont_trash = cont((g) => {
    R(g, 2, 4, 12, 11, "#3a4030");
    R(g, 2, 4, 12, 2, "#565e48");
    R(g, 5, 2, 6, 2, "#4a5047");
  });
  S.cont_pump = cont((g) => {
    R(g, 3, 2, 10, 13, "#e04338");
    R(g, 4, 3, 8, 4, "#d9cba6");
    R(g, 5, 8, 6, 4, "#33383d");
    R(g, 12, 4, 2, 6, "#5d646b");
  });
  S.cont_garden = cont((g) => {
    R(g, 1, 6, 14, 9, "#4a3b2a");
    for (let x = 2; x < 15; x += 4) {
      R(g, x, 4, 2, 3, "#6f9c22");
      R(g, x + 1, 3, 1, 2, "#a6e83c");
    }
  });
  S.cont_cache = cont((g) => {
    R(g, 1, 4, 14, 11, "#8a6a2a");
    R(g, 7, 4, 2, 11, "#5c4a1a");
    R(g, 6, 7, 4, 4, "#ffb23e");
  });
  for (const k of [
    "crate",
    "shelf",
    "fridge",
    "cabinet",
    "medbox",
    "locker",
    "gunrack",
    "market",
    "freezer",
    "toolbox",
    "desk",
    "trash",
    "pump",
    "garden",
    "cache",
  ]) {
    const b = S["cont_" + k],
      c = cnv(16, 16),
      g = c.getContext("2d");
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(10,12,8,.55)";
    g.fillRect(0, 0, 16, 16);
    S["cont_" + k + "_open"] = c;
  }
  S.gun_pistol = spr(10, 6, (g) => {
    R(g, 0, 1, 9, 2, "#33383d");
    R(g, 1, 3, 3, 3, "#4a3524");
  });
  S.gun_revolver = spr(11, 6, (g) => {
    R(g, 0, 2, 10, 2, "#4a5057");
    R(g, 3, 1, 3, 4, "#6d747b");
    R(g, 1, 4, 3, 2, "#4a3524");
  });
  S.gun_shotgun = spr(14, 6, (g) => {
    R(g, 0, 1, 13, 2, "#3a3f44");
    R(g, 4, 3, 4, 2, "#6e3a1e");
  });
  S.gun_rifle = spr(16, 6, (g) => {
    R(g, 0, 2, 15, 2, "#2c3136");
    R(g, 5, 0, 4, 2, "#33383d");
    R(g, 0, 3, 4, 3, "#5c4a32");
  });
  S.h_bed = spr(64, 48, (g) => {
    R(g, 2, 46, 60, 2, "#0006");
    R(g, 2, 2, 60, 44, "#5c4a32");
    R(g, 4, 4, 56, 10, "#d9cba6");
    R(g, 4, 14, 56, 30, "#55603f");
    R(g, 4, 14, 56, 3, "#6e7a4e");
  });
  S.h_wardrobe = spr(32, 48, (g) => {
    R(g, 2, 46, 28, 2, "#0006");
    R(g, 2, 2, 28, 44, "#5c4a32");
    R(g, 15, 2, 2, 44, "#3a2f20");
    R(g, 4, 5, 10, 36, "#6b5638");
    R(g, 18, 5, 10, 36, "#6b5638");
    R(g, 12, 22, 2, 3, "#ffb23e");
    R(g, 18, 22, 2, 3, "#ffb23e");
  });
  S.h_sofa = spr(64, 32, (g) => {
    R(g, 2, 30, 60, 2, "#0006");
    R(g, 2, 4, 60, 26, "#4a5a6a");
    R(g, 6, 7, 24, 18, "#5d7a8e");
    R(g, 34, 7, 24, 18, "#5d7a8e");
  });
  S.h_table = spr(48, 32, (g) => {
    R(g, 2, 30, 44, 2, "#0006");
    R(g, 1, 3, 46, 8, "#7d6644");
    R(g, 3, 11, 3, 19, "#54432b");
    R(g, 42, 11, 3, 19, "#54432b");
    R(g, 8, 1, 10, 4, "#55603f");
    R(g, 28, 1, 8, 4, "#b8bdb2");
  });
  S.h_counter = spr(64, 16, (g) => {
    R(g, 1, 14, 62, 2, "#0006");
    R(g, 1, 2, 62, 12, "#7d6644");
    R(g, 2, 3, 60, 3, "#9c8460");
    R(g, 6, 6, 10, 6, "#5d646b");
    R(g, 30, 6, 8, 6, "#b8bdb2");
    R(g, 46, 4, 6, 6, "#3a352b");
    R(g, 48, 6, 2, 2, "#e04338");
  });
  S.h_lamp = spr(16, 32, (g) => {
    R(g, 7, 10, 2, 20, "#5d646b");
    R(g, 3, 28, 10, 2, "#4a5057");
    R(g, 2, 2, 12, 8, "#ffb23e");
    R(g, 3, 3, 10, 5, "#ffe87a");
  });
  S.h_door = spr(32, 16, (g) => {
    R(g, 1, 1, 30, 14, "#5c4a32");
    R(g, 3, 3, 26, 10, "#6b5638");
    R(g, 26, 7, 2, 2, "#ffb23e");
  });
}
