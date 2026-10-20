/** N0526: Hathor temple stelae, low walls and approximate rock-chapel entrances. */
import earcut from 'earcut';
export const serabitCandidateId = 'N0526';
function prism(f, role, p, lo, hi, bottom = true) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    if (bottom)
      f(
        role,
        ix.slice(i, i + 3).map((k) => low[k]),
        [0, -1, 0],
      );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
const box = (f, role, x, y, z, w, h, d, bottom = true) =>
  prism(f, role, rect(x, z, w, d), y, y + h, bottom);
function slab(f, p, detail, fallen = false) {
  const [x, z] = p.center,
    c = Math.cos(p.heading),
    s = Math.sin(p.heading),
    Y = p.floorY,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + c * u - s * v, Y + y, z + s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    w = p.width / 2,
    d = p.depth / 2,
    h = p.height;
  if (fallen) {
    const q = {
      outline: [
        [-w, -d],
        [w * 0.85, -d],
        [w, d * 0.7],
        [w * 0.75, d],
        [-w, d * 0.9],
      ],
      holes: [],
    };
    prism(
      (role, ps, n) =>
        G(
          role,
          ps.map(([u, y, v]) => [
            u,
            y + (y > 0.1 ? (p.lean ? (v + d) * 0.22 : 0.04 * Math.sin(u * 3 + v * 2)) : 0),
            v,
          ]),
          n,
        ),
      'fallen',
      q,
      p.foundationBase - Y,
      h,
    );
    return;
  }
  const count = [2, 4, 6, 9][detail],
    profile =
      p.kind === 'rounded'
        ? [
            [-w, 0],
            [w, 0],
            ...Array.from({ length: count + 1 }, (_, i) => {
              const a = (i * Math.PI) / count;
              return [w * Math.cos(a), h - w + w * Math.sin(a)];
            }),
          ]
        : [
            [-w, 0],
            [w, 0],
            [w, h * 0.91],
            [w * 0.25, h],
            [-w * 0.22, h * 0.87],
            [-w, h * 0.92],
          ],
    ix = earcut(profile.flat()),
    front = profile.map(([u, y]) => [u, y, d]),
    back = profile.map(([u, y]) => [u, y, -d]);
  for (let i = 0; i < ix.length; i += 3) {
    G(
      'stela',
      ix.slice(i, i + 3).map((k) => front[k]),
      [0, 0, 1],
    );
    G(
      'stela',
      ix.slice(i, i + 3).map((k) => back[k]),
      [0, 0, -1],
    );
  }
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length,
      a = profile[i],
      b = profile[j];
    G('stela', [front[i], front[j], back[j], back[i]], [b[1] - a[1], a[0] - b[0], 0]);
  }
  // A buried stone foot keeps each independent upright seated on coarse retained grade.
  box(
    G,
    'stela',
    0,
    p.foundationBase - Y,
    0,
    p.width * 1.05,
    Y - p.foundationBase + 0.06,
    p.depth * 1.12,
  );
}
function chapel(f, p, detail) {
  const [x, z] = p.center,
    Y = p.floorY,
    w = p.width,
    d = p.depth,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + u, Y + y, z + v]),
        n,
      );
  box(G, 'rock', 0, p.foundationBase - Y, 0, d, Y - p.foundationBase + 0.16, w);
  box(G, 'rock', -d / 2 + 0.45, 0.16, 0, 0.9, 2.55, w);
  for (const side of [-1, 1]) {
    const v = side * (w / 2 - 0.45),
      q = {
        outline: [
          [-d / 2 - 0.12, v - 0.48],
          [d / 2 - 0.3, v - 0.48],
          [d / 2 + 0.16, v - 0.12],
          [d / 2 - 0.2, v + 0.44],
          [-d / 2 + 0.18, v + 0.55],
        ],
        holes: [],
      };
    prism(
      (role, ps, n) =>
        G(
          role,
          ps.map(([u, y, v]) => [u, y + (y > 2 ? 0.22 * Math.sin(u * 1.3 + v) : 0), v]),
          n,
        ),
      'rock',
      q,
      0.16,
      2.58,
    );
  }
  for (const side of [-1, 1])
    box(G, 'rock', d / 2 - 0.45, 0.16, side * (w / 4 + 0.4), 0.9, 2.15, w / 2 - 0.8);
  box(G, 'rock', d / 2 - 0.4, 2.31, 0, 1.1, 0.48, w + 0.25);
  if (detail >= 1) {
    const cap = {
      outline: [
        [-d / 2 - 0.18, -w / 2],
        [-d / 2 + 0.5, -w / 2 - 0.25],
        [d / 2 - 0.4, -w / 2 - 0.1],
        [d / 2 + 0.2, -w / 2 + 0.5],
        [d / 2 + 0.1, w / 2 - 0.3],
        [d / 2 - 0.65, w / 2 + 0.15],
        [-d / 2 + 0.3, w / 2 + 0.2],
        [-d / 2 - 0.2, w / 2 - 0.4],
      ],
      holes: [],
    };
    prism(
      (role, ps, n) =>
        G(
          role,
          ps.map(([u, y, v]) => [u, y + (y > 2.8 ? 0.4 * Math.sin(u * 1.5 + v * 1.2) : 0), v]),
          n,
        ),
      'rock',
      cap,
      2.65,
      3.25,
    );
  } else box(G, 'rock', 0, 2.55, 0, d + 0.25, 0.65, w + 0.25);
}
function strip(f, part, detail) {
  const [a, b] = [part.from, part.to],
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    nx = (b[1] - a[1]) / length,
    nz = -(b[0] - a[0]) / length,
    count = Math.max(1, Math.ceil(length / [18, 10, 6, 4][detail]));
  for (let i = 0; i < count; i++) {
    const t = i / count,
      T = (i + 1) / count,
      at = (t, side) => [
        a[0] + (b[0] - a[0]) * t + nx * side,
        a[1] + (b[1] - a[1]) * t + nz * side,
      ],
      q = { outline: [at(t, -0.45), at(T, -0.45), at(T, 0.45), at(t, 0.45)], holes: [] };
    prism(f, 'wall', q, -0.55, part.height * (0.92 + 0.08 * Math.cos(i * 2)), false);
  }
}
export function buildSerabitRuins(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    ground = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, y + sampleTerrain(c * u - s * v, s * u + c * v), v]),
        n,
      );
  for (let i = 0; i < r.boundary.length; i++)
    strip(
      ground,
      { from: r.boundary[i], to: r.boundary[(i + 1) % r.boundary.length], height: 1.15 },
      detail,
    );
  for (const p of r.walls) strip(ground, p, detail);
  for (const p of r.chapels) chapel(f, p, detail);
  for (let i = 0; i < r.stelae.length; i++)
    if (detail > 0 || i % 3 === 0 || r.stelae[i].hero) slab(f, r.stelae[i], detail);
  for (let i = 0; i < r.fallen.length; i++)
    if (detail > 0 || i % 7 === 0) slab(f, r.fallen[i], detail, true);
}
