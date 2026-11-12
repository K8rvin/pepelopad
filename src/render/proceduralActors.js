import { cnv, spr, R, blob } from "./spriteUtils.js";

function dude(o) {
  return spr(o.w || 12, o.h || 14, (g) => {
    if (o.dog) {
      R(g, 2, 3, 9, 4, o.fur);
      R(g, 10, 1, 4, 4, o.fur);
      R(g, 13, 2, 1, 1, "#e04338");
      R(g, 0, 2, 2, 1, o.fur);
      R(g, 3, 7, 1, 3, o.fur);
      R(g, 6, 7, 1, 3, o.fur);
      R(g, 9, 7, 1, 3, o.fur);
      return;
    }
    if (o.big === "bloat") {
      R(g, 2, 6, 12, 8, o.belly);
      R(g, 5, 1, 6, 5, o.skin);
      R(g, 6, 3, 1, 1, "#111");
      R(g, 9, 3, 1, 1, "#111");
      R(g, 4, 8, 2, 2, "#8aa868");
      R(g, 10, 10, 2, 2, "#8aa868");
      R(g, 4, 14, 3, 2, o.pants);
      R(g, 9, 14, 3, 2, o.pants);
      return;
    }
    if (o.big === "brute") {
      R(g, 1, 5, 16, 6, o.shoulder);
      R(g, 6, 0, 6, 5, o.skin);
      R(g, 7, 2, 1, 1, "#e04338");
      R(g, 10, 2, 1, 1, "#e04338");
      R(g, 0, 6, 3, 8, o.skin);
      R(g, 15, 6, 3, 8, o.skin);
      R(g, 4, 15, 3, 3, o.pants);
      R(g, 11, 15, 3, 3, o.pants);
      return;
    }
    R(g, 3, 11, 2, 3, o.pants);
    R(g, 7, 11, 2, 3, o.pants);
    R(g, 2, 6, 8, 6, o.shirt);
    R(g, 1, 7, 1, 4, o.skin);
    R(g, 10, 7, 1, 4, o.skin);
    R(g, 3, 1, 6, 6, o.skin);
    if (o.hood) {
      R(g, 2, 0, 8, 3, o.hood);
      R(g, 4, 3, 4, 3, o.face);
      R(g, 5, 4, 1, 1, "#111");
      R(g, 7, 4, 1, 1, "#111");
      R(g, 0, 7, 2, 4, "#6e5638");
    } else {
      R(g, 3, 0, 6, 2, o.hair || "#3a3a30");
      R(g, 4, 3, 1, 1, o.eye || "#111");
      R(g, 7, 3, 1, 1, o.eye || "#111");
    }
    if (o.mouth) R(g, 5, 4, 3, 3, o.mouth);
    if (o.blood) R(g, 5, 8, 2, 2, o.blood);
    if (o.helmet) {
      R(g, 2, 0, 8, 3, o.helmet);
      R(g, 3, 4, 6, 2, "#2a2f33");
      R(g, 1, 6, 10, 2, o.helmet);
    }
  });
}

export function createActorSprites(S) {
  S.player = dude({
    hood: "#c96a35",
    face: "#d9cba6",
    shirt: "#55603f",
    pants: "#33302a",
    skin: "#d9cba6",
  });
  S.survivor = dude({
    hood: "#7fb8d8",
    face: "#d9cba6",
    shirt: "#4a5a6a",
    pants: "#33302a",
    skin: "#d9cba6",
  });
  S.leader = dude({
    hood: "#ffb23e",
    face: "#d9cba6",
    shirt: "#55603f",
    pants: "#33302a",
    skin: "#d9cba6",
  });
  S.walker = dude({
    skin: "#7da05a",
    shirt: "#4a5238",
    pants: "#3a3a30",
    blood: "#7a2a22",
  });
  S.runner = dude({
    skin: "#9aa88f",
    shirt: "#5a6a72",
    pants: "#3a4248",
    blood: "#7a2a22",
  });
  S.dog = dude({ dog: true, fur: "#7a5c3a", w: 14, h: 10 });
  S.spitter = dude({ skin: "#a6e83c", shirt: "#5c7a1e", pants: "#3a4a1a" });
  S.bloater = dude({
    big: "bloat",
    skin: "#9fc07a",
    belly: "#c4d9a0",
    pants: "#4a5238",
    w: 16,
    h: 16,
  });
  S.screamer = dude({
    skin: "#8a8f7a",
    shirt: "#4a4238",
    pants: "#33302a",
    mouth: "#e04338",
  });
  S.brute = dude({
    big: "brute",
    skin: "#8a7f86",
    shoulder: "#6a6068",
    pants: "#443e46",
    w: 18,
    h: 18,
  });
  S.stalker = dude({
    skin: "#23282b",
    shirt: "#1a1f22",
    pants: "#15181a",
    eye: "#7fd8e8",
    hair: "#101416",
  });
  S.riot = dude({
    skin: "#6a7f5a",
    shirt: "#3a4a5a",
    pants: "#2a3340",
    helmet: "#5d646b",
  });
  S.howler = dude({
    skin: "#8a7f7a",
    shirt: "#6a2a3a",
    pants: "#3a2a30",
    mouth: "#ff6a5a",
  });
  for (const k of [
    "walker",
    "runner",
    "dog",
    "spitter",
    "bloater",
    "screamer",
    "brute",
    "stalker",
    "riot",
    "howler",
  ]) {
    const b = S[k],
      c = cnv(b.width, b.height),
      g = c.getContext("2d");
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(166,232,60,.22)";
    g.fillRect(0, 0, b.width, b.height);
    S[k + "_e"] = c;
  }
  S.heart = spr(26, 26, (g) => {
    blob(
      g,
      13,
      13,
      [8, 14, 18, 22, 24, 26, 26, 26, 26, 24, 24, 22, 18, 14, 8],
      "#5c7a1e",
      "#7a9c2a",
    );
    blob(g, 13, 13, [6, 10, 14, 16, 16, 16, 14, 10, 6], "#a6e83c", "#c8f06a");
    R(g, 10, 10, 6, 6, "#e8ff7a");
    R(g, 12, 11, 2, 4, "#33421a");
  });
  S.pod = spr(10, 10, (g) => {
    blob(g, 5, 5, [4, 6, 8, 8, 6, 4], "#5c7a1e", "#7a9c2a");
    R(g, 4, 3, 2, 2, "#a6e83c");
  });
  S.arrowP = spr(8, 3, (g) => {
    R(g, 0, 1, 6, 1, "#d9cba6");
    R(g, 6, 0, 2, 3, "#9aa0a8");
    R(g, 0, 0, 2, 1, "#e04338");
  });
  S.boltP = spr(7, 3, (g) => {
    R(g, 0, 1, 5, 1, "#8a9098");
    R(g, 5, 0, 2, 3, "#c8ccd2");
  });
  S.molotovP = spr(6, 8, (g) => {
    R(g, 2, 0, 2, 2, "#d9cba6");
    R(g, 1, 2, 4, 6, "#3a6a3a");
    R(g, 2, 4, 2, 3, "#ffb23e");
  });
}
