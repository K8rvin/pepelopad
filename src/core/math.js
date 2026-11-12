export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = Math.random;
export const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
export const pick = (a) => a[Math.floor(rnd() * a.length)];
export const pickR = (r, a) => a[Math.floor(r() * a.length)];
export const mod = (a, n) => ((a % n) + n) % n;
export const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
export const d2 = (a, b, c, d) => {
  const x = c - a;
  const y = d - b;
  return x * x + y * y;
};
export const K = (x, y) => `${x},${y}`;
