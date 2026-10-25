/** 'basilica_of_santa_croce': Santa Croce church, marble front, gabled aisles and independent mapped campanile. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);
export function buildSantaCroce(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    multi = (ps) => ps.map((p) => [p.outline, ...p.holes]),
    clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
  const cap = (role, p, y, n = [0, 1, 0]) => {
    const rings = [p.outline, ...p.holes],
      flat = rings.flat(),
      holes = [];
    let off = rings[0].length;
    for (const h of rings.slice(1)) {
      holes.push(off);
      off += h.length;
    }
    const ix = earcut(flat.flat(), holes);
    for (let i = 0; i < ix.length; i += 3)
      f(
        role,
        ix.slice(i, i + 3).map((k) => [flat[k][0], y, flat[k][1]]),
        n,
      );
  };
  const walls = new Map();
  for (let i = 0; i < r.bodyLayers.length; i++) {
    const band = r.bodyLayers[i],
      above = r.bodyLayers[i + 1]?.polygons ?? [],
      below = r.bodyLayers[i - 1]?.polygons ?? [];
    for (const p of band.polygons)
      prism(
        (_role, ps, n) => {
          if (Math.abs(n[1]) > 0.5) return;
          const key = JSON.stringify([ps[0][0], ps[0][2], ps[1][0], ps[1][2]]),
            spans = walls.get(key) ?? [],
            last = spans.at(-1);
          if (last && Math.abs(last.hi - Y - band.lo) < 1e-6) last.hi = Y + band.hi;
          else spans.push({ ps, n, lo: Y + band.lo, hi: Y + band.hi });
          walls.set(key, spans);
        },
        'wall',
        p,
        Y + band.lo,
        Y + band.hi,
        false,
      );
    for (const p of above.length
      ? pc.difference(multi(band.polygons), multi(above)).map(clean)
      : band.polygons)
      cap('roof', p, Y + band.hi);
    if (i)
      for (const p of pc.difference(multi(band.polygons), multi(below)).map(clean))
        cap('trim', p, Y + band.lo, [0, -1, 0]);
  }
  for (const spans of walls.values())
    for (const w of spans)
      f(
        (w.ps[0][2] + w.ps[1][2]) / 2 > -2.5 ? 'trim' : 'wall',
        [
          [w.ps[0][0], w.lo, w.ps[0][2]],
          [w.ps[1][0], w.lo, w.ps[1][2]],
          [w.ps[1][0], w.hi, w.ps[1][2]],
          [w.ps[0][0], w.hi, w.ps[0][2]],
        ],
        w.n,
      );
  for (const p of r.floors)
    prism(
      (role, ps, n) => f(ps.every((p) => p[2] > -2.5) ? 'trim' : role, ps, n),
      'wall',
      p,
      r.foundationY,
      Y,
    );
  const bounds = (p) => [
    Math.min(...p.outline.map((q) => q[0])),
    Math.min(...p.outline.map((q) => q[1])),
    Math.max(...p.outline.map((q) => q[0])),
    Math.max(...p.outline.map((q) => q[1])),
  ];
  const gable = (p, lo, hi, across = false) => {
    prism(f, 'wall', p, Y + 8, Y + lo, false);
    const [x0, z0, x1, z1] = bounds(p),
      xm = (x0 + x1) / 2,
      zm = (z0 + z1) / 2,
      A = [
        [x0, Y + lo, z0],
        [x1, Y + lo, z0],
        [x1, Y + lo, z1],
        [x0, Y + lo, z1],
      ];
    if (across) {
      const u = [x0, Y + hi, zm],
        v = [x1, Y + hi, zm];
      f('roof', [A[0], A[1], v, u], [0, 1, -1]);
      f('roof', [A[2], A[3], u, v], [0, 1, 1]);
      f('wall', [A[3], A[0], u], [-1, 0, 0]);
      f('wall', [A[1], A[2], v], [1, 0, 0]);
    } else {
      const u = [xm, Y + hi, z0],
        v = [xm, Y + hi, z1];
      f('roof', [A[3], A[0], u, v], [-1, 1, 0]);
      f('roof', [A[1], A[2], v, u], [1, 1, 0]);
      f('wall', [A[0], A[1], u], [0, 0, -1]);
      f('wall', [A[2], A[3], v], [0, 0, 1]);
    }
  };
  for (const p of r.nave) gable(p, 24, 30);
  for (const a of r.aisles) for (const p of a.polygons) gable(p, 10.5, 14, true);
  for (const p of r.transept) gable(p, 24, 30, true);
  for (const p of r.chapels) gable(p, 17, 21);
  for (const p of r.apse) {
    prism(f, 'wall', p, Y + 8, Y + 24, false);
    const [x0, z0, x1, z1] = bounds(p),
      c = [(x0 + x1) / 2, Y + 30, (z0 + z1) / 2];
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length];
      f(
        'roof',
        [[a[0], Y + 24, a[1]], [b[0], Y + 24, b[1]], c],
        [a[0] + b[0] - 2 * c[0], 1, a[1] + b[1] - 2 * c[2]],
      );
    }
  }
  const extrude = (role, poly, z0, z1) => {
    const rings = [poly.outline, ...poly.holes],
      flat = rings.flat(),
      holes = [];
    let off = rings[0].length;
    for (const h of rings.slice(1)) {
      holes.push(off);
      off += h.length;
    }
    const ix = earcut(flat.flat(), holes);
    for (const z of [z0, z1])
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => [flat[k][0], Y + flat[k][1], z]),
          [0, 0, z === z0 ? -1 : 1],
        );
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        f(
          role,
          [
            [a[0], Y + a[1], z0],
            [b[0], Y + b[1], z0],
            [b[0], Y + b[1], z1],
            [a[0], Y + a[1], z1],
          ],
          [b[1] - a[1], a[0] - b[0], 0],
        );
      }
  };
  const outer = [
      [-20.7, 0],
      [20.7, 0],
      [20.7, 17.4],
      [15.3, 21.7],
      [10.7, 17.4],
      [10.7, 30],
      [0.45, 38],
      [-9.7, 30],
      [-9.7, 17.4],
      [-15.3, 21.7],
      [-20.7, 17.4],
    ],
    holes = r.portals.map((p) => [
      [
        [p.x - p.w / 2, -0.1],
        [p.x + p.w / 2, -0.1],
        [p.x + p.w / 2, p.h],
        [p.x - p.w / 2, p.h],
      ],
    ]);
  for (const p of pc.difference([[outer]], ...holes)) extrude('trim', clean(p), 0, 2.2);

  for (const s of r.stairs) {
    if (!detail && s.i % 2) continue;
    const next = !detail ? r.stairs[s.i + 1] : s;
    prism(
      f,
      'trim',
      {
        outline: !detail
          ? [
              [-21, 2.65 + s.i * 0.6],
              [21, 2.65 + s.i * 0.6],
              [21, 3.25 + next.i * 0.6],
              [-21, 3.25 + next.i * 0.6],
            ]
          : s.outline,
        holes: [],
      },
      Math.min(s.base, next.base),
      s.top,
    );
  }
  const pointed = (x, y, z, w, h, role = 'trim') =>
    extrude(
      role,
      {
        outline: [
          [x - w / 2, y],
          [x + w / 2, y],
          [x, y + h],
        ],
        holes: [],
      },
      z - 0.3,
      z,
    );
  // Geometric pinnacles and original abstract terminal figures preserve the five-point silhouette.
  for (const [x, lo, hi] of [
    [-20, 17.4, 22.4],
    [-9.7, 30, 35],
    [0.45, 38, 42.5],
    [10.7, 30, 35],
    [20, 17.4, 22.4],
  ]) {
    if (!detail) {
      pointed(x, lo, 1.8, 0.85, hi - lo);
      continue;
    }
    B('trim', x, lo, 1.3, 0.85, (hi - lo) * 0.6, 0.85);
    pointed(x, lo + (hi - lo) * 0.6, 1.8, 0.75, (hi - lo) * 0.4);
  }
  // The actual separately mapped campanile stays on its own original footprint.
  for (const p of r.tower) {
    const [x0, z0, x1, z1] = bounds(p),
      x = (x0 + x1) / 2,
      z = (z0 + z1) / 2;
    prism(f, 'wall', p, r.foundationY, Y + 43);
    for (const dx of [x0 + 0.6, x1 - 0.6])
      for (const dz of [z0 + 0.6, z1 - 0.6]) B('wall', dx, 43, dz, 1.2, 14, 1.2);
    B('trim', x, 42.5, z, x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6);
    B('trim', x, 56.6, z, x1 - x0 + 0.7, 0.5, z1 - z0 + 0.7);
    const low = [
        [x0, Y + 57, z0],
        [x1, Y + 57, z0],
        [x1, Y + 57, z1],
        [x0, Y + 57, z1],
      ],
      top = [x, Y + 78, z];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'wall',
        [low[i], low[j], top],
        [low[i][0] + low[j][0] - 2 * x, 1, low[i][2] + low[j][2] - 2 * z],
      );
    }
    if (detail) {
      for (const dy of [12, 26, 39]) {
        B('trim', x, dy, z, x1 - x0 + 0.2, 0.22, z1 - z0 + 0.2);
      }

      for (const side of [-1, 1]) {
        for (const fixed of ['x', 'z']) {
          const point = ([u, y]) =>
              fixed === 'z'
                ? [x + u, Y + y, z + (side * (z1 - z0)) / 2]
                : [x + (side * (x1 - x0)) / 2, Y + y, z + u],
            half = (fixed === 'z' ? x1 - x0 : z1 - z0) / 2 - 1.2,
            n = fixed === 'z' ? [0, 0, side] : [side, 0, 0];
          for (const sign of [-1, 1])
            f('wall', [point([sign * half, 52]), point([0, 56]), point([sign * half, 56])], n);
        }
      }
      const n = detail === 3 ? 24 : 12,
        clock = Array.from({ length: n }, (_, i) => {
          const a = (i * Math.PI * 2) / n;
          return [x + Math.cos(a) * 1.1, Y + 37 + Math.sin(a) * 1.1, z1 + 0.025];
        });
      f('trim', clock, [0, 0, 1]);
      f(
        'green',
        [
          [x - 0.055, Y + 36.95, z1 + 0.04],
          [x + 0.055, Y + 36.95, z1 + 0.04],
          [x + 0.055, Y + 37.8, z1 + 0.04],
          [x - 0.055, Y + 37.8, z1 + 0.04],
        ],
        [0, 0, 1],
      );
      f(
        'green',
        [
          [x, Y + 36.95, z1 + 0.05],
          [x + 0.65, Y + 36.95, z1 + 0.05],
          [x + 0.65, Y + 37.05, z1 + 0.05],
          [x, Y + 37.05, z1 + 0.05],
        ],
        [0, 0, 1],
      );
      B('trim', x, 78, z, 0.16, 1.8, 0.16);
    }
  }
  if (!detail) return;
  const pane = (role, x, y, z, w, h, t = [1, 0], n = [0, 1]) =>
      f(
        role,
        [
          [x - (t[0] * w) / 2, Y + y, z - (t[1] * w) / 2],
          [x + (t[0] * w) / 2, Y + y, z + (t[1] * w) / 2],
          [x + (t[0] * w) / 2, Y + y + h, z + (t[1] * w) / 2],
          [x - (t[0] * w) / 2, Y + y + h, z - (t[1] * w) / 2],
        ],
        [n[0], 0, n[1]],
      ),
    line = (role, a, b, w, z) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        L = Math.hypot(dx, dy),
        u = [((-dy / L) * w) / 2, ((dx / L) * w) / 2];
      f(
        role,
        [
          [a[0] + u[0], Y + a[1] + u[1], z],
          [b[0] + u[0], Y + b[1] + u[1], z],
          [b[0] - u[0], Y + b[1] - u[1], z],
          [a[0] - u[0], Y + a[1] - u[1], z],
        ],
        [0, 0, 1],
      );
    };
  for (const p of r.portals) {
    pane('wood', p.x, 0.04, 0.35, p.w, p.h - 0.08);
    if (detail > 1) {
      pane('trim', p.x, -0.03, 0.5, p.w + 0.3, 0.14);
      pane('wood', p.x, 0.04, 0.4, 0.12, p.h - 0.08);
      for (const dx of [-p.w * 0.28, p.w * 0.28])
        for (const y of [1, 3]) pane('trim', p.x + dx, y, 0.42, 0.12, 0.12);
    }

    const w = p.w + 2.4,
      lo = p.h + 0.25,
      hi = p.h + (p.w > 3 ? 8.5 : 5.3);
    pointed(p.x, lo, 2.5, w, hi - lo, 'trim');
    for (const sign of [-1, 1]) line('green', [p.x + (sign * w) / 2, lo], [p.x, hi], 0.12, 2.84);
    const profile = [
        [-0.5, 0],
        [-0.47, 0.29],
        [-0.34, 0.61],
        [0, 1],
        [0.34, 0.61],
        [0.47, 0.29],
        [0.5, 0],
      ],
      height = p.w > 3 ? 4.8 : 3.3,
      width = p.w + 1.15,
      outline = profile.map(([u, v]) => [p.x + u * width, lo + v * height]);
    extrude('green', { outline, holes: [] }, 2.5, 2.6);
    for (let j = 0; j < profile.length - 1; j++) {
      const a = outline[j],
        b = outline[j + 1];
      line('trim', a, b, detail === 3 ? 0.22 : 0.3, 2.92);
    }
    if (detail > 1) {
      const inner = profile.map(([u, v]) => [
        p.x + u * (width - 0.6),
        lo + 0.1 + v * (height - 0.55),
      ]);
      for (let j = 0; j < inner.length - 1; j++) line('trim', inner[j], inner[j + 1], 0.13, 2.96);
    }
    pane('trim', p.x, p.h, 2.45, p.w + 1.1, 0.35);
  }

  // Existing dark green stone and pale marble graphs supply geometric inlay, never a private facade atlas.
  for (const x of [-20, -9.7, 10.7, 20]) pane('green', x, 0.5, 2.23, 0.18, 16.7);
  for (const y of [7.2, 12.4, 16.7]) pane('green', 0, y, 2.24, 40.1, 0.16);
  const breaks = [
    -20.05,
    ...r.portals.flatMap((p) => [p.x - p.w / 2 - 0.02, p.x + p.w / 2 + 0.02]),
    20.05,
  ];
  for (let i = 0; i < breaks.length - 1; i += 2)
    pane('green', (breaks[i] + breaks[i + 1]) / 2, 0.5, 2.24, breaks[i + 1] - breaks[i], 0.16);
  for (const [x, w] of [
    [-17.9, 2.5],
    [-12.8, 2.5],
    [-6.2, 3.4],
    [6.7, 3.4],
    [12.8, 2.5],
    [18, 2.5],
  ])
    for (const y of [8, 13]) {
      pane('green', x, y, 2.25, w, 3.1);
      pane('trim', x, y + 0.13, 2.28, w - 0.24, 2.84);
    }
  for (const x of [-9.7, 10.7]) pane('green', x, 17.5, 2.23, 0.18, 12.1);
  for (const y of [18.2, 22.2, 29.6]) pane('green', 0.5, y, 2.24, 19.7, 0.16);
  for (const [x, w] of [
    [-6.1, 4.1],
    [7.1, 4.1],
  ]) {
    pane('green', x, 23, 2.24, w, 5.6);
    pane('trim', x, 23.13, 2.27, w - 0.24, 5.34);
  }
  for (const x of [-6.1, 0.5, 7.1]) {
    pane('green', x, 18.6, 2.25, 5.4, 2.6);
    pane('trim', x, 18.74, 2.28, 5.12, 2.32);
  }
  const ring = (cx, cy, inner, outer, z, role) => {
    const n = [0, 16, 24, 40][detail];
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      f(
        role,
        [
          [cx + Math.cos(a) * inner, Y + cy + Math.sin(a) * inner, z],
          [cx + Math.cos(b) * inner, Y + cy + Math.sin(b) * inner, z],
          [cx + Math.cos(b) * outer, Y + cy + Math.sin(b) * outer, z],
          [cx + Math.cos(a) * outer, Y + cy + Math.sin(a) * outer, z],
        ],
        [0, 0, 1],
      );
    }
  };
  const circle = Array.from({ length: [0, 16, 24, 40][detail] }, (_, i) => {
    const a = (i * Math.PI * 2) / [0, 16, 24, 40][detail];
    return [0.5 + Math.cos(a) * 3.1, Y + 25.8 + Math.sin(a) * 3.1, 2.31];
  });
  f('glass', circle, [0, 0, 1]);
  ring(0.5, 25.8, 3.1, 3.9, 2.33, 'trim');
  ring(0.5, 25.8, 3.9, 4.05, 2.35, 'green');
  if (detail > 1)
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      line('trim', [0.5, 25.8], [0.5 + Math.cos(a) * 3.08, 25.8 + Math.sin(a) * 3.08], 0.07, 2.36);
    }
  for (const [x, y, w, h] of [
    [0.5, 30, 19, 7.4],
    [-15.3, 17.5, 9, 3.9],
    [15.3, 17.5, 9, 3.9],
  ]) {
    line('green', [x - w / 2, y], [x, y + h], 0.18, 2.3);
    line('green', [x, y + h], [x + w / 2, y], 0.18, 2.3);
  }
  if (detail > 1) {
    for (const sign of [-1, 1]) {
      const tri = Array.from({ length: 3 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3 + (sign < 0 ? Math.PI : 0);
        return [0.5 + Math.cos(a) * 1.8, 33.7 + Math.sin(a) * 1.8];
      });
      for (let i = 0; i < 3; i++) line('green', tri[i], tri[(i + 1) % 3], 0.18, 2.4);
    }
    for (let i = 0; i < 10; i++)
      B(i % 2 ? 'pink' : 'trim', -8 + i * 1.9, 17, 2.4, 0.65, 0.65, 0.18);
  }

  // Clerestory windows follow the actual slightly tapering nave edges, outside both wall faces.
  for (const p of r.nave) {
    const A = p.outline.reduce(
        (n, q, i) =>
          n +
          q[0] * p.outline[(i + 1) % p.outline.length][1] -
          q[1] * p.outline[(i + 1) % p.outline.length][0],
        0,
      ),
      sign = Math.sign(A);
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        d = b.map((v, k) => v - a[k]),
        L = Math.hypot(...d);
      if (L < 40) continue;
      const t = d.map((v) => v / L),
        n = [t[1] * sign, -t[0] * sign],
        count = Math.round(L / 13);
      for (let j = 0; j < count; j++) {
        const q = a.map((v, k) => v + (d[k] * (j + 0.5)) / count + n[k] * 0.05);
        if (q[1] < -88) continue;
        pane('glass', q[0], 18, q[1], 2.6, 4.4, t, n);
        if (detail > 1) pane('trim', q[0] + n[0] * 0.03, 18, q[1] + n[1] * 0.03, 0.12, 4.4, t, n);
      }
    }
  }
  if (detail > 1)
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) B('wall', side * 20.7, 8, -7 - i * 12.7, 1, 5.3, 1);
  if (detail === 3) {
    for (let i = 0; i < 20; i++) B('trim', -19.7 + i * 2.05, 17.0, 2.4, 0.22, 0.45, 0.4);
    for (let i = 0; i < 18; i++) B('trim', -8.7 + i * 1.08, 30, 2.4, 0.2, 0.45, 0.4);
  }
}
