import { K, dist, d2 } from "../core/math.js";
import { CELL } from "../core/constants.js";
import {
  createTerrainTiles,
  stampProps,
  stampBuilding,
  stampBase,
} from "./tiles.js";

export function createChunkManager(deps) {
  const {
    chunks,
    CMAP,
    OV,
    CAMPS,
    cnv,
    planBlock,
    ensureCars,
    initCamp,
    paintChunk,
    getSeed,
    getState,
    getPlayer,
    getStats,
    getZombies,
    gainXP,
    toast,
    spawnGuards,
    stampCityBuildings = true,
  } = deps;

  function genChunk(cx, cy) {
    const k = K(cx, cy);
    const t = createTerrainTiles(cx, cy, getSeed());
    const c = {
      cx,
      cy,
      k,
      t,
      containers: [],
      nest: null,
      camp: null,
      poi: null,
      name: null,
      canvas: cnv(256, 256),
      seen: false,
    };
    const bx0 = Math.floor((cx * 16 - 20) / CELL);
    const bx1 = Math.floor((cx * 16 + 36) / CELL);
    const by0 = Math.floor((cy * 16 - 20) / CELL);
    const by1 = Math.floor((cy * 16 + 36) / CELL);

    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const p = planBlock(bx, by);
        stampProps(t, c, p.props);
        if (stampCityBuildings)
          for (const b of p.buildings) stampBuilding(t, c, b);
        if (p.special === "base") stampBase(t, c);

        if (p.nest) {
          const nx = p.nest.x;
          const ny = p.nest.y;
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
              const gx = cx * 16 + x;
              const gy = cy * 16 + y;
              if (dist(gx * 16, gy * 16, nx, ny) < 78)
                t[x + y * 16] = OV.get("D" + p.k) ? 11 : 10;
            }
          }
          if (
            !OV.get("D" + p.k) &&
            Math.floor(nx / 256) === cx &&
            Math.floor(ny / 256) === cy
          ) {
            const max = p.nest.mega ? 1500 : [0, 280, 500, 780][p.nest.tier];
            c.nest = {
              cx,
              cy,
              x: nx,
              y: ny,
              tier: p.nest.tier,
              mega: p.nest.mega,
              hp: max,
              max,
              alive: true,
              act: false,
              sp: 0,
              flash: 0,
              k: p.k,
            };
          }
        }

        for (const o of p.containers) {
          const lx = o.x - cx * 16;
          const ly = o.y - cy * 16;
          if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16) {
            const obj = Object.assign({}, o, {
              lx,
              ly,
              looted: OV.get("L" + o.id) === true,
            });
            c.containers.push(obj);
            CMAP.set(K(o.x, o.y), obj);
          }
        }
        ensureCars(p);
        if (p.camp) {
          initCamp(p.camp);
          c.camp = CAMPS.get(p.camp.id);
          c.name = p.name;
          c.poi = "camp";
        }
        if (p.poi && !c.poi) {
          c.poi = p.poi;
          c.name = p.name;
        }
      }
    }

    const addBC = (type, gx, gy, id) => {
      const lx = gx - cx * 16;
      const ly = gy - cy * 16;
      if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16) {
        const o = {
          x: gx,
          y: gy,
          lx,
          ly,
          type,
          id,
          looted: OV.get("L" + id) === true,
        };
        c.containers.push(o);
        CMAP.set(K(gx, gy), o);
      }
    };
    addBC("cache", 18, 16, "base:cache");
    for (let i = 0; i < 4; i++)
      addBC(
        "garden",
        20 + (i % 2) * 2,
        20 + Math.floor(i / 2) * 2,
        "base:g" + i,
      );

    paintChunk(c);
    return c;
  }

  function getChunk(cx, cy) {
    const k = K(cx, cy);
    let c = chunks.get(k);
    if (c) return c;
    c = genChunk(cx, cy);
    chunks.set(k, c);
    for (const o of c.containers) CMAP.set(K(o.x, o.y), o);

    if (!c.seen && c.poi && c.poi !== "base" && getState() === "play") {
      c.seen = true;
      if (!OV.get("P" + k)) {
        OV.set("P" + k, true);
        getStats().pois++;
        gainXP(8);
        toast(
          "Обнаружено: " + (c.name || "место"),
          c.poi === "nest" ? "danger" : "info",
        );
        const p = planBlock(
          Math.floor((cx * 16) / CELL),
          Math.floor((cy * 16) / CELL),
        );
        if (p.buildings.length && getZombies().length < 55) spawnGuards(p);
      }
    }

    if (chunks.size > 90) {
      let far = null;
      let fd = -1;
      const player = getPlayer();
      for (const [kk, cc] of chunks) {
        const d = d2(
          cc.cx,
          cc.cy,
          Math.floor(player.x / 256),
          Math.floor(player.y / 256),
        );
        if (d > fd) {
          fd = d;
          far = kk;
        }
      }
      if (far && fd > 20) {
        const cc = chunks.get(far);
        for (const o of cc.containers) CMAP.delete(K(o.x, o.y));
        chunks.delete(far);
      }
    }

    return c;
  }

  return { genChunk, getChunk };
}
