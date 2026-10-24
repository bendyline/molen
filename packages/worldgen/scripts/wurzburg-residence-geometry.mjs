/** 'wurzburg_residence': Würzburg Residence, four open courts, western colonnades and shaped slate roofs. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);
export function buildWurzburgResidence(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    multi = (ps) => ps.map((p) => [p.outline, ...p.holes]),
    clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
  const cap = (role, p, height, normal = [0, 1, 0]) => {
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
        ix
          .slice(i, i + 3)
          .map((k) => [
            flat[k][0],
            typeof height === 'function' ? height(flat[k]) : height,
            flat[k][1],
          ]),
        normal,
      );
  };
  if (!detail) {
    for (const p of r.floors) prism(f, 'wall', p, r.foundationY, Y + 18);
  } else {
    for (const p of r.floors) prism(f, 'trim', p, r.foundationY, Y);
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
          'wall',
          [
            [w.ps[0][0], w.lo, w.ps[0][2]],
            [w.ps[1][0], w.lo, w.ps[1][2]],
            [w.ps[1][0], w.hi, w.ps[1][2]],
            [w.ps[0][0], w.hi, w.ps[0][2]],
          ],
          w.n,
        );
  }
  // Piecewise-linear roof planes are clipped to the actual holed footprint before triangulation.
  for (const z of r.roofZones) {
    const [x0, z0, x1, z1] = z.bounds,
      across = z.axis === 'x' ? 1 : 0,
      lo = across ? z0 : x0,
      hi = across ? z1 : x1,
      mid = (lo + hi) / 2,
      h = (p) => Y + 18 + 6 * Math.max(0, 1 - Math.abs(p[across] - mid) / ((hi - lo) / 2)),
      parts = across
        ? [
            [
              [
                [-150, z0],
                [150, z0],
                [150, mid],
                [-150, mid],
              ],
            ],
            [
              [
                [-150, mid],
                [150, mid],
                [150, z1],
                [-150, z1],
              ],
            ],
          ]
        : [
            [
              [
                [x0, -150],
                [mid, -150],
                [mid, 150],
                [x0, 150],
              ],
            ],
            [
              [
                [mid, -150],
                [x1, -150],
                [x1, 150],
                [mid, 150],
              ],
            ],
          ];
    for (const mask of parts)
      for (const q of pc.intersection(multi(z.polygons), [mask]).map(clean)) {
        cap('roof', q, h);
        for (const ring of [q.outline, ...q.holes])
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length];
            f(
              'roof',
              [
                [a[0], Y + 18, a[1]],
                [b[0], Y + 18, b[1]],
                [b[0], h(b), b[1]],
                [a[0], h(a), a[1]],
              ],
              [b[1] - a[1], 0.1, a[0] - b[0]],
            );
          }
      }
  }
  const roofLoft = (polys, center, base, top) => {
    for (const p of polys) {
      const profile = detail
          ? [
              [base, 1],
              [base + (top - base) * 0.3, 0.94],
              [base + (top - base) * 0.7, 0.66],
              [top, 0.2],
            ]
          : [
              [base, 1],
              [top, 0.2],
            ],
        rings = profile.map(([y, s]) =>
          p.outline.map((q) => [
            center[0] + (q[0] - center[0]) * s,
            Y + y,
            center[1] + (q[1] - center[1]) * s,
          ]),
        );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < p.outline.length; i++) {
          const k = (i + 1) % p.outline.length,
            a = rings[j - 1][i],
            b = rings[j - 1][k];
          f(
            'roof',
            [a, b, rings[j][k], rings[j][i]],
            [(a[0] + b[0]) / 2 - center[0], 0.25, (a[2] + b[2]) / 2 - center[1]],
          );
        }
      cap('roof', { outline: rings.at(-1).map((p) => [p[0], p[2]]), holes: [] }, Y + top);
    }
  };
  for (const c of r.caps) roofLoft(c.polygons, c.center, 18, 29);
  for (const p of r.garden) prism(f, 'wall', p, Y + 18, Y + 22, false);
  roofLoft(r.garden, [0, -31], 22, 29.5);
  for (const group of r.westRisats) {
    for (const p of group) prism(f, 'wall', p, Y + 18, Y + 20, false);
    const qs = group.flatMap((p) => p.outline),
      c = [0, 1].map((k) => qs.reduce((s, p) => s + p[k] / qs.length, 0));
    roofLoft(group, c, 20, 26);
  }
  for (const s of r.steps) prism(f, 'trim', { outline: s.outline, holes: [] }, s.base, s.top);
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
    );
  const loftColumn = (x, z, lo, hi, radius = 0.34) => {
    const n = [0, 6, 8, 12][detail],
      rings = [
        [lo, radius],
        [hi, radius * 0.82],
      ].map(([y, rad]) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i * Math.PI * 2) / n;
          return [x + Math.cos(a) * rad, Y + y, z + Math.sin(a) * rad];
        }),
      );
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f(
        'trim',
        [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
        [rings[0][i][0] - x, 0, rings[0][i][2] - z],
      );
    }
    f('trim', rings[0], [0, -1, 0]);
    f('trim', rings[1], [0, 1, 0]);
    B('trim', x, lo, z, 0.9, 0.25, 0.9);
    B('trim', x, hi - 0.18, z, 0.9, 0.25, 0.9);
  };
  for (const x of [-8.2, -2.6, 2.6, 8.2]) loftColumn(x, 0.03, 0, 6.7);
  B('trim', 0, 6.7, -0.25, 17.6, 0.45, 1.3);
  B('trim', 0, 7.1, -0.15, 18.2, 0.3, 1.6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) loftColumn(side * 31.4, 16.5 + i * 4.6, 0, 7.1, 0.3);
    B('trim', side * 31.4, 7.1, 28, 1.05, 0.4, 27);
    for (const z of [18, 23, 28, 33, 38])
      pane('glass', side * 33.75, 1.1, z, 2, 3.9, [0, 1], [-side, 0]);
  }
  const arch = (role, x, bottom, z, w, spring, normal = 1) => {
    const n = detail === 3 ? 16 : 8,
      rad = w / 2,
      curve = Array.from({ length: n + 1 }, (_, i) => {
        const a = (i * Math.PI) / n;
        return [x + Math.cos(a) * rad, Y + spring + Math.sin(a) * rad, z];
      });
    f(role, [[x - rad, Y + bottom, z], [x + rad, Y + bottom, z], ...curve], [0, 0, normal]);
  };
  for (const p of r.portals) {
    const spring = p.height - p.width / 2,
      n = detail === 3 ? 16 : 8;
    arch('wood', p.x, 0.02, p.backZ, p.width, spring, p.normal);
    arch('glass', p.x, spring, p.backZ + p.normal * 0.025, p.width, spring, p.normal);
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (i * Math.PI) / n,
        b = Math.PI - ((i + 1) * Math.PI) / n,
        xa = p.x + (Math.cos(a) * p.width) / 2,
        xb = p.x + (Math.cos(b) * p.width) / 2,
        ya = spring + (Math.sin(a) * p.width) / 2,
        yb = spring + (Math.sin(b) * p.width) / 2;
      f(
        'trim',
        [
          [xa, Y + ya, p.z],
          [xb, Y + yb, p.z],
          [xb, Y + p.height, p.z],
          [xa, Y + p.height, p.z],
        ],
        [0, 0, p.normal],
      );
      f(
        'trim',
        [
          [xa, Y + ya, p.z],
          [xb, Y + yb, p.z],
          [xb, Y + yb, p.z - p.normal * 0.4],
          [xa, Y + ya, p.z - p.normal * 0.4],
        ],
        [0, -1, 0],
      );
    }
    if (detail > 1) {
      pane('wood', p.x, 0.02, p.backZ + p.normal * 0.04, 0.1, spring, [1, 0], [0, p.normal]);
      for (const dx of [-p.width * 0.27, p.width * 0.27])
        for (const y of [1.2, 3.1])
          pane('trim', p.x + dx, y, p.backZ + p.normal * 0.06, 0.1, 0.1, [1, 0], [0, p.normal]);
    }
  }
  for (const b of r.facade) {
    const [x, z] = b.center,
      t = b.tangent,
      n = b.normal,
      westCenter = Math.abs(z) < 0.6 && Math.abs(x) < 9,
      portico = Math.abs(Math.abs(x) - 31) < 0.8 && z > 15 && z < 41,
      door = r.portals.some((p) => Math.abs(x - p.x) < p.width / 2 + 1 && Math.abs(z - p.z) < 0.8),
      width = Math.min(b.courtyard ? 2 : 2.35, b.spacing * 0.46);
    for (const [y, h] of [
      [1.2, 3.7],
      [8.5, 5.2],
      [15.6, 1.45],
    ]) {
      if (westCenter || (y < 2 && (portico || door))) continue;
      if (detail > 1) pane('trim', x, y - 0.12, z, width + 0.28, h + 0.24, t, n);
      pane('glass', x + n[0] * 0.025, y, z + n[1] * 0.025, width, h, t, n);
      if (detail > 1) {
        pane('wood', x + n[0] * 0.05, y, z + n[1] * 0.05, 0.09, h, t, n);
        pane('wood', x + n[0] * 0.05, y + h * 0.5, z + n[1] * 0.05, width, 0.09, t, n);
      }
      if (detail === 3 && y === 8.5)
        pane('trim', x + n[0] * 0.08, y + h + 0.25, z + n[1] * 0.08, width + 0.8, 0.25, t, n);
    }
  }
  for (const x of [-5.25, 0, 5.25]) {
    arch('glass', x, 8.5, 0.06, 3.1, 12.6);
    for (const dx of [-1.75, 1.75]) B('trim', x + dx, 8.3, -0.03, 0.28, 6.5, 0.35);
  }

  const oval = (x, y, z, w, h, normal) => {
    const n = detail === 1 ? 6 : detail === 2 ? 12 : 18,
      ring = Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return [x + (Math.cos(a) * w) / 2, Y + y + (Math.sin(a) * h) / 2, z];
      });
    f('glass', ring, [0, 0, normal]);
    if (detail > 1)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n,
          a = (i * Math.PI * 2) / n,
          b = (j * Math.PI * 2) / n;
        f(
          'trim',
          [
            ring[i],
            ring[j],
            [
              x + Math.cos(b) * (w / 2 + 0.13),
              Y + y + Math.sin(b) * (h / 2 + 0.13),
              z + normal * 0.02,
            ],
            [
              x + Math.cos(a) * (w / 2 + 0.13),
              Y + y + Math.sin(a) * (h / 2 + 0.13),
              z + normal * 0.02,
            ],
          ],
          [0, 0, normal],
        );
      }
  };
  for (const x of [-5.25, 0, 5.25]) {
    oval(x, 16, 0.09, 1.65, 1.1, 1);
    oval(x, 19.3, -39.8, 1.9, 1.3, -1);
  }
  for (const x of [-8.2, -2.6, 2.6, 8.2]) {
    if (detail === 1) pane('trim', x, 7.5, 0.1, 0.48, 10.15);
    else {
      B('trim', x, 7.5, 0.03, 0.5, 10.2, 0.35);
      B('trim', x, 7.5, 0.03, 0.85, 0.28, 0.6);
      B('trim', x, 17.4, 0.03, 0.85, 0.28, 0.6);
    }
  }
  // Cornices follow every outer and inner edge; the courtyard-facing normals point into the real holes.
  for (const p of r.floors)
    for (const [ri, ring] of [p.outline, ...p.holes].entries()) {
      const sign =
        Math.sign(
          ring.reduce(
            (n, a, i) =>
              n + a[0] * ring[(i + 1) % ring.length][1] - a[1] * ring[(i + 1) % ring.length][0],
            0,
          ),
        ) * (ri ? -1 : 1);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          d = b.map((v, k) => v - a[k]),
          L = Math.hypot(...d);
        if (L < 1.3) continue;
        const t = d.map((v) => v / L),
          n = [t[1] * sign, -t[0] * sign],
          c = a.map((v, k) => (v + b[k]) / 2 + n[k] * 0.07);
        for (const [y, h] of detail === 1
          ? [[17.6, 0.45]]
          : [
              [6.9, 0.32],
              [14.4, 0.22],
              [17.6, 0.45],
            ])
          pane('trim', c[0], y, c[1], L, h, t, n);
      }
    }
  const pediment = (x, y, z, w, h, normal = 1) => {
    f(
      'trim',
      [
        [x - w / 2, Y + y, z],
        [x + w / 2, Y + y, z],
        [x, Y + y + h, z],
      ],
      [0, 0, normal],
    );
  };
  for (const x of [-54, 54]) pediment(x, 18.2, 56.7, 24, 4.2);
  pediment(0, 18.3, 0.25, 17, 4.4);
  pediment(0, 22.2, -40, 16, 4, -1);
  B('trim', 0, 18.15, -0.1, 46.5, 0.3, 0.65);
  B('trim', 0, 19.1, -0.1, 46.8, 0.22, 0.75);
  if (detail > 1)
    for (let i = 0; i < 42; i++) B('trim', -22.6 + (i * 45.2) / 41, 18.4, -0.1, 0.18, 0.7, 0.25);
  if (detail > 1) {
    for (const x of [-21, -15, -10, 10, 15, 21]) {
      B('trim', x, 19.3, -0.1, 0.5, 0.4, 0.5);
      B('trim', x, 19.7, -0.1, 0.3, 1.1, 0.3);
      B('trim', x, 20.8, -0.1, 0.36, 0.35, 0.36);
    }
    B('trim', 0, 22.6, -0.2, 1.2, 0.6, 1.2);
    B('trim', 0, 23.2, -0.2, 0.45, 1.3, 0.45);
  }
  // A small verdigris turret rises from the northern transverse roof ridge, without entering a court.
  B('copper', -53, 23.8, 10, 1.7, 3.7, 1.7);
  B('trim', -53, 23.5, 10, 2.2, 0.3, 2.2);
  const ring = Array.from({ length: detail === 3 ? 12 : 8 }, (_, i) => {
    const a = (i * Math.PI * 2) / (detail === 3 ? 12 : 8);
    return [-53 + Math.cos(a) * 1.35, Y + 27.5, 10 + Math.sin(a) * 1.35];
  });
  for (let i = 0; i < ring.length; i++)
    f(
      'copper',
      [ring[i], ring[(i + 1) % ring.length], [-53, Y + 31.5, 10]],
      [ring[i][0] + 53, 1, ring[i][2] - 10],
    );
  if (detail > 1) {
    const dormer = (x, z, front, base) => {
      B('roof', x, base, z, 1.35, 1.4, 1.2);
      pane('glass', x, base + 0.2, z + front * 0.62, 0.8, 0.9, [1, 0], [0, front]);
      pediment(x, base + 1.4, z + front * 0.65, 1.65, 0.7, front);
    };
    for (let i = 0; i < 21; i++) {
      if (detail === 2 && i % 2) continue;
      dormer(-77 + i * 7.7, -32, -1, 21.2);
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        if (detail === 2 && i % 2) continue;
        dormer(side * (33 + i * 7.1), 53.5, 1, 20.1);
      }
  }
}
