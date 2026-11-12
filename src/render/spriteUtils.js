export function cnv(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function spr(w, h, fn) {
  const c = cnv(w, h),
    g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  fn(g);
  return c;
}

export function R(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

export function spk(g, b, n, cs, r) {
  R(g, 0, 0, 16, 16, b);
  for (let i = 0; i < n; i++)
    R(
      g,
      Math.floor(r() * 16),
      Math.floor(r() * 16),
      1,
      1,
      cs[Math.floor(r() * cs.length)],
    );
}

export function blob(g, x, y, rows, a, b) {
  for (let i = 0; i < rows.length; i++)
    R(
      g,
      x - rows[i] / 2,
      y - rows.length / 2 + i,
      rows[i],
      1,
      i < rows.length / 3 ? b : a,
    );
}
