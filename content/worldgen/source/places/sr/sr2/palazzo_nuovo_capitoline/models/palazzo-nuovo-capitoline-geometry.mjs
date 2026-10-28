/** Palazzo Nuovo: mapped museum front, rear range and open Marforio court. */
import { createRequire } from 'node:module';
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
);
const pc = require('polygon-clipping');
const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;

export function buildNuovo(face, detail, r) {
  const Y = r.floorY;
  let facade = false;
  const P = ([x, y, z]) => {
    x *= facade ? r.facadeScale : 1;
    return [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  };
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const cap = (role, p, height, down = false) => {
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
        [0, down ? -1 : 1, 0],
      );
  };
  const extrude = (role, polygon, front, back) => {
    const ix = earcut(polygon.flat());
    for (const z of [front, back])
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => [polygon[k][0], Y + polygon[k][1], z]),
          [0, 0, z === front ? 1 : -1],
        );
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      f(
        role,
        [
          [a[0], Y + a[1], front],
          [b[0], Y + b[1], front],
          [b[0], Y + b[1], back],
          [a[0], Y + a[1], back],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
      );
    }
  };
  const roof = (polygons, y, rise, role = 'roof') => {
    for (const p of polygons) {
      const xs = p.outline.map((p) => p[0]),
        zs = p.outline.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs);
      const axis = x1 - x0 > z1 - z0 ? 1 : 0,
        lo = axis ? z0 : x0,
        hi = axis ? z1 : x1,
        mid = (lo + hi) / 2;
      const h = (q) => y + rise * Math.max(0, 1 - Math.abs(q[axis] - mid) / ((hi - lo) / 2));
      for (const [a, b] of [
        [lo, mid],
        [mid, hi],
      ]) {
        const clip = axis
          ? [
              [-300, a],
              [300, a],
              [300, b],
              [-300, b],
            ]
          : [
              [a, -300],
              [b, -300],
              [b, 300],
              [a, 300],
            ];
        for (const q of pc.intersection([[p.outline, ...p.holes]], [[clip]]))
          cap(
            role,
            { outline: q[0].slice(0, -1), holes: q.slice(1).map((h) => h.slice(0, -1)) },
            h,
          );
      }
    }
  };

  // The original mapped courtyard is never filled by a roof, foundation or ground mask.
  for (const p of r.main) prism(f, 'trim', p, r.foundationY, Y);
  for (const band of r.bodyLayers)
    for (const p of band.polygons) {
      prism(
        (role, ps, n) => {
          if (Math.abs(n[1]) < 0.5) f(role, ps, n);
        },
        'wall',
        p,
        band.lo,
        band.hi,
        false,
      );
      cap('trim', p, band.lo, true);
      cap('roof', p, band.hi);
    }
  roof(r.main, Y + 17, 2.1);
  for (const part of r.parts) {
    for (const p of part.polygons)
      prism(f, 'wall', p, part.foundationY, part.floorY + part.wallHeight);
    roof(
      part.polygons,
      part.floorY + part.wallHeight,
      part.roofRise,
      part.id === 35185558001176 ? 'glass' : 'roof',
    );
  }
  for (const s of r.steps)
    for (const p of [s.outline]) prism(f, 'trim', { outline: p, holes: [] }, s.base, s.top);

  // Palazzo Nuovo repeats the facing palace order at its own mapped facade width.
  facade = true;
  // Eight giant pilasters, seven physically open bays and a continuous closed soffit.
  const pitch = 7.48,
    bays = Array.from({ length: 7 }, (_, i) => (i - 3) * pitch);
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * pitch;
    B('trim', x, 0, -0.12, 1.32, 16.9, 0.72);
    B('trim', x, 0, 0.02, 1.8, 0.65, 1.02);
    B('trim', x, 0.65, -0.04, 1.54, 0.42, 0.86);
    B('trim', x, 16.35, 0.04, 1.85, 0.65, 0.98);
    if (detail >= 2) B('trim', x, 15.65, 0.06, 1.64, 0.5, 0.94);
  }
  for (const [y, h, w] of [
    [6.8, 0.4, 55.1],
    [16.9, 0.55, 56.1],
    [17.45, 0.42, 56.8],
  ])
    B('trim', 0, y, -0.95, w, h, 2.5);
  if (!detail) return;
  // Rear portico doors remain visibly recessed by 3.7m; no façade card closes the openings.
  for (const x of bays) {
    if (x !== 0) B('wood', x, 0, -3.78, 2.1, 4.2, 0.14);
    else for (const sign of [-1, 1]) B('wood', sign * 1.32, 0, -4.25, 0.12, 4.2, 0.9);
    B('trim', x, 4.25, -3.63, 2.65, 0.28, 0.35);
    extrude(
      'trim',
      [
        [x - 1.5, 4.6],
        [x, 5.45],
        [x + 1.5, 4.6],
      ],
      -3.52,
      -3.9,
    );
    for (const dx of [-2.25, 2.25]) {
      const sides = detail === 0 ? 4 : detail === 1 ? 6 : 10,
        cx = x + dx,
        z = -0.75;
      B('trim', cx, 0, z, 0.82, 0.44, 0.82);
      const radius = 0.27;
      for (let k = 0; k < sides; k++) {
        const a = (2 * Math.PI * k) / sides,
          b = (2 * Math.PI * (k + 1)) / sides;
        f(
          'trim',
          [
            [cx + radius * Math.cos(a), Y + 0.44, z + radius * Math.sin(a)],
            [cx + radius * Math.cos(b), Y + 0.44, z + radius * Math.sin(b)],
            [cx + radius * 0.91 * Math.cos(b), Y + 6.05, z + radius * 0.91 * Math.sin(b)],
            [cx + radius * 0.91 * Math.cos(a), Y + 6.05, z + radius * 0.91 * Math.sin(a)],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
      B('trim', cx, 6.05, z, 0.85, 0.35, 0.76);
      B('trim', cx, 6.4, z, 0.97, 0.4, 0.92);
    }
  }
  for (const x of bays) {
    B('trim', x, 8.5, 0.12, 3.15, 6, 0.34);
    B('glass', x, 8.78, 0.31, 2.55, 5.35, 0.06);
    B('trim', x, 8.48, 0.3, 3.65, 0.24, 0.72);
    if (detail >= 3) {
      B('wood', x, 8.8, 0.36, 0.09, 5.28, 0.07);
      for (const y of [10.5, 12.4]) B('wood', x, y, 0.36, 2.55, 0.08, 0.07);
    }
    if (x === 0)
      extrude(
        'trim',
        [
          [x - 2.3, 14.5],
          [x, 16],
          [x + 2.3, 14.5],
          [x + 2.3, 14.8],
          [x, 16.35],
          [x - 2.3, 14.8],
        ],
        0.55,
        -0.1,
      );
    else {
      const n = detail === 1 ? 4 : 8;
      for (let j = 0; j < n; j++) {
        const a = (Math.PI * j) / n,
          b = (Math.PI * (j + 1)) / n;
        extrude(
          'trim',
          [
            [x + 2 * Math.cos(a), 14.4 + 1.2 * Math.sin(a)],
            [x + 2 * Math.cos(b), 14.4 + 1.2 * Math.sin(b)],
            [x + 2.28 * Math.cos(b), 14.4 + 1.5 * Math.sin(b)],
            [x + 2.28 * Math.cos(a), 14.4 + 1.5 * Math.sin(a)],
          ],
          0.55,
          -0.1,
        );
      }
    }
  }
  // Open roof balustrade: coarse district posts, more repeats only nearby.
  B('trim', 0, 17.9, -0.35, 56.2, 0.28, 0.8);
  B('trim', 0, 19.05, -0.35, 56.2, 0.28, 0.8);
  const count = detail === 1 ? 24 : detail === 2 ? 36 : 48;
  for (let i = 0; i <= count; i++)
    B('trim', -27.6 + (55.2 * i) / count, 18.18, -0.35, 0.25, 0.87, 0.3);
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * pitch;
    B('trim', x, 19.3, -0.35, 0.9, 0.28, 0.8);
    B('trim', x, 19.58, -0.35, 0.4, 1.1, 0.4);
    B('trim', x, 20.68, -0.35, 0.36, 0.4, 0.36);
  }
  facade = false;
  // Regular exterior rhythm for hidden ranges is explicitly approximate.
  if (detail >= 2)
    for (const part of [{ polygons: r.main, floorY: Y, wallHeight: 17 }, ...r.parts])
      for (const p of part.polygons)
        for (const ring of [p.outline, ...p.holes])
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length],
              dx = b[0] - a[0],
              dz = b[1] - a[1],
              length = Math.hypot(dx, dz),
              count = Math.floor(length / 5.8);
            if (length < 7 || Math.max(Math.abs(a[1]), Math.abs(b[1])) < 0.5) continue;
            const sign = Math.sign(
              ring.reduce((s, a, i) => {
                const b = ring[(i + 1) % ring.length];
                return s + a[0] * b[1] - a[1] * b[0];
              }, 0),
            );
            const n = [(dz / length) * sign, 0, (-dx / length) * sign],
              u = [dx / length, 0, dz / length];
            for (let j = 0; j < count; j++)
              for (const yy of [4, 10.5].filter((height) => height + 1.3 < part.wallHeight)) {
                const t = (j + 0.5) / count,
                  c = [a[0] + t * dx + n[0] * 0.04, part.floorY + yy, a[1] + t * dz + n[2] * 0.04],
                  w = 1.6,
                  h = 2.6;
                f(
                  'glass',
                  [
                    [-w / 2, -h / 2],
                    [w / 2, -h / 2],
                    [w / 2, h / 2],
                    [-w / 2, h / 2],
                  ].map(([x, y]) => [c[0] + u[0] * x, c[1] + y, c[2] + u[2] * x]),
                  n,
                );
              }
          }
}
