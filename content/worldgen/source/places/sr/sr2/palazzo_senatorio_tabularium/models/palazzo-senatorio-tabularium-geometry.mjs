/** Mapped palace, double stair, open belfry and Forum-side Tabularium recesses. */
import { createRequire } from 'node:module';
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

const req = createRequire(
    new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
  ),
  earcut = req('earcut').default;
const pc = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
)('polygon-clipping');

export function buildSenatorio(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
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
  const extrude = (
    role,
    polygon,
    front,
    back,
    center = [0, 0, 0],
    u = [1, 0, 0],
    n = [0, 0, 1],
  ) => {
    const Q = ([x, y], depth) => [
        center[0] + u[0] * x + n[0] * depth,
        Y + center[1] + y,
        center[2] + u[2] * x + n[2] * depth,
      ],
      ix = earcut(polygon.flat());
    for (const d of [front, back])
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => Q(polygon[k], d)),
          n.map((v) => v * (d === front ? 1 : -1)),
        );
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        nn = [u[0] * (b[1] - a[1]), a[0] - b[0], u[2] * (b[1] - a[1])];
      f(role, [Q(a, front), Q(b, front), Q(b, back), Q(a, back)], nn);
    }
  };
  const roof = (p, y, rise) => {
    const axis = 1,
      lo = Math.min(...p.outline.map((p) => p[axis])),
      hi = Math.max(...p.outline.map((p) => p[axis])),
      mid = (lo + hi) / 2,
      h = (q) => y + rise * Math.max(0, 1 - Math.abs(q[axis] - mid) / ((hi - lo) / 2));
    for (const [a, b] of [
      [lo, mid],
      [mid, hi],
    ])
      for (const q of pc.intersection(
        [[p.outline, ...p.holes]],
        [
          [
            [
              [-200, a],
              [200, a],
              [200, b],
              [-200, b],
            ],
          ],
        ],
      ))
        cap(
          'roof',
          { outline: q[0].slice(0, -1), holes: q.slice(1).map((h) => h.slice(0, -1)) },
          h,
        );
  };
  const spandrel = (
    role,
    x,
    _base,
    spring,
    radius,
    top,
    front,
    back,
    center = [0, 0, 0],
    u = [1, 0, 0],
    n = [0, 0, 1],
  ) => {
    const count = detail === 0 ? 3 : detail === 1 ? 5 : 10,
      poly = [
        [-radius, top],
        [radius, top],
        [radius, spring],
      ];
    for (let i = 1; i <= count; i++) {
      const a = (Math.PI * i) / count;
      poly.push([radius * Math.cos(a), spring + radius * Math.sin(a)]);
    }
    extrude(role, poly, front, back, [center[0] + u[0] * x, center[1], center[2] + u[2] * x], u, n);
  };
  const bodyLayers = detail
    ? r.bodyLayers
    : [...r.bodyLayers.slice(0, 2), { role: 'wall', lo: Y + 4, hi: Y + 21, polygons: r.main }];
  for (const band of bodyLayers)
    for (const p of band.polygons) prism(f, band.role, p, band.lo, band.hi);
  const frontOutline = r.main[0].outline;
  for (const [i, j] of detail
    ? [
        [0, 14],
        [14, 13],
        [13, 12],
        [12, 11],
        [11, 10],
      ]
    : [
        [0, 14],
        [13, 12],
        [11, 10],
      ]) {
    const a = frontOutline[i],
      b = frontOutline[j];
    f(
      'trim',
      [
        [a[0], r.foundationY, a[1] + 0.025],
        [b[0], r.foundationY, b[1] + 0.025],
        [b[0], Y + 7, b[1] + 0.025],
        [a[0], Y + 7, a[1] + 0.025],
      ],
      [0, 0, 1],
    );
  }
  for (const p of r.main) roof(p, Y + 21, 2);
  // Physical basement pockets retain deep, open arches instead of dark facade cards.
  for (const a of r.rearArches)
    spandrel(
      'base',
      0,
      a.base,
      a.spring,
      a.radius,
      4,
      0,
      -0.8,
      [a.x, 0, a.z],
      [1, 0, 0],
      [0, 0, -1],
    );
  for (const part of r.parts) {
    const height = part.id === 35184495906293 ? 25 : 24;
    for (const p of part.polygons) {
      prism(f, 'brick', p, r.foundationY, Y + height);
      cap('trim', p, Y + height);
      if (detail)
        for (let i = 0; i < p.outline.length; i++) {
          const a = p.outline[i],
            b = p.outline[(i + 1) % p.outline.length],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]),
            count = Math.max(2, Math.floor(length / 2));
          for (let j = 0; j < count; j++) {
            const t = (j + 0.5) / count;
            B('brick', a[0] + (b[0] - a[0]) * t, height, a[1] + (b[1] - a[1]) * t, 0.8, 0.9, 0.8);
          }
        }
    }
  }
  // Closed, supported stairs rise inward to the central portal landing.
  prism(f, 'trim', { outline: r.landing.outline, holes: [] }, r.landing.base, r.landing.top);
  if (detail) {
    B('trim', 0, 7.85, 6.15, 7, 0.2, 0.3);
    for (const x of [-3, -1, 1, 3]) B('trim', x, 7, 6.15, 0.22, 0.85, 0.3);
  }
  for (const s of r.stairs) {
    const count = [3, 12, 24, 28][detail],
      run = s.outerX - s.innerX;
    for (let i = 0; i < count; i++) {
      const x = s.sign * (s.outerX - (run * (i + 0.5)) / count),
        top = s.lowY + ((s.highY - s.lowY) * (i + 1)) / count;
      box(f, 'trim', x, s.base, s.z, run / count + 0.002, top - s.base, s.width);
    }
    if (detail) {
      for (const z of [s.z - s.width / 2 + 0.15, s.z + s.width / 2 - 0.15]) {
        const x0 = s.sign * s.outerX,
          x1 = s.sign * s.innerX,
          rail = [
            [x0, 0.82],
            [x1, 7.82],
            [x1, 8],
            [x0, 1],
          ];
        extrude('trim', rail, z + 0.16, z - 0.16);
        const count = detail === 1 ? 8 : 16;
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          B('trim', x0 + (x1 - x0) * t, 7 * t, z, 0.2, 0.9, 0.22);
        }
      }
    }
  }
  const frontZ = (x) => (x < -20.25 ? 2.35 : x > 20.25 ? 3.17 : 0);
  // Eight giant-order strips and a seven-bay upper/lower rhythm.
  if (detail)
    for (const x of [-31.2, -21, -12.15, -4.05, 4.05, 12.15, 20.25, 27.3]) {
      const z = frontZ(x);
      B('trim', x, 7, z + 0.08, 1.2, 13.8, 0.55);
      B('trim', x, 20, z + 0.15, 1.7, 0.65, 0.8);
      B('trim', x, 7, z + 0.15, 1.55, 0.45, 0.8);
    }
  for (const [x0, x1, z] of [
    [-32.5, -20.25, 2.35],
    [-20.25, 20.25, 0],
    [20.25, 28.1, 3.17],
  ])
    for (const [y, h, depth] of [
      [7, 0.35, 0.65],
      [20.9, 0.55, 1.1],
      [21.45, 0.4, 1.7],
    ].filter(([height]) => detail || height > 20))
      B('trim', (x0 + x1) / 2, y, z - 0.2, x1 - x0 + 0.4, h, depth);
  const window = (x, y, z, w, h, u = [1, 0, 0], n = [0, 0, 1], full = detail >= 3) => {
    const Q = (a, b, d) => [x + u[0] * a + n[0] * d, Y + y + b, z + u[2] * a + n[2] * d],
      quad = (role, w, h, d) =>
        f(
          role,
          [Q(-w / 2, -h / 2, d), Q(w / 2, -h / 2, d), Q(w / 2, h / 2, d), Q(-w / 2, h / 2, d)],
          n,
        );
    quad('trim', w + 0.35, h + 0.35, 0.04);
    quad('glass', w, h, 0.06);
    if (full) {
      extrude(
        'wood',
        [
          [-0.04, -h / 2],
          [0.04, -h / 2],
          [0.04, h / 2],
          [-0.04, h / 2],
        ],
        0.09,
        0.065,
        [x, y, z],
        u,
        n,
      );
      for (const yy of [-h / 6, h / 6])
        extrude(
          'wood',
          [
            [-w / 2, yy - 0.035],
            [w / 2, yy - 0.035],
            [w / 2, yy + 0.035],
            [-w / 2, yy + 0.035],
          ],
          0.09,
          0.065,
          [x, y, z],
          u,
          n,
        );
    }
  };
  if (detail) {
    for (const x of [-26, -16.2, -8.1, 0, 8.1, 16.2, 24.2]) {
      const z = frontZ(x);
      window(x, 18.6, z + 0.08, 2.1, 1.6);
      if (x !== 0) window(x, 10.1, z + 0.08, 2.05, 4.7);
      else {
        B('wood', 0, 7.1, -1.92, 2.95, 4.3, 0.12);
        spandrel('trim', 0, 7, 11.1, 1.6, 12.8, 0.45, 0.1);
      }
      const triangle = Math.round(Math.abs(x) / 8.1) % 2 === 0;
      if (triangle)
        extrude(
          'trim',
          [
            [x - 1.65, 12.65],
            [x, 13.5],
            [x + 1.65, 12.65],
            [x + 1.65, 12.95],
            [x, 13.83],
            [x - 1.65, 12.95],
          ],
          z + 0.55,
          z + 0.1,
        );
      else
        for (let j = 0, n = detail === 1 ? 4 : 8; j < n; j++) {
          const a = (Math.PI * j) / n,
            b = (Math.PI * (j + 1)) / n;
          extrude(
            'trim',
            [
              [x + 1.5 * Math.cos(a), 12.7 + 0.7 * Math.sin(a)],
              [x + 1.5 * Math.cos(b), 12.7 + 0.7 * Math.sin(b)],
              [x + 1.8 * Math.cos(b), 12.7 + 1 * Math.sin(b)],
              [x + 1.8 * Math.cos(a), 12.7 + 1 * Math.sin(a)],
            ],
            z + 0.55,
            z + 0.1,
          );
        }
      if (detail >= 2 && Math.abs(x) < 17 && x !== 0) {
        B('trim', x, 14.4, z + 0.1, 1.4, 1.6, 0.18);
        B('trim', x, 15.85, z + 0.1, 0.6, 0.3, 0.24);
      }
    }
    // Balustrades stay physically open; their repetition increases only nearby.
    for (const [x0, x1, z] of [
      [-32.5, -20.25, 2.1],
      [-20.25, 20.25, -0.2],
      [20.25, 28.1, 2.9],
    ]) {
      B('trim', (x0 + x1) / 2, 22, z, x1 - x0, 0.25, 0.7);
      B('trim', (x0 + x1) / 2, 23.15, z, x1 - x0, 0.25, 0.7);
      const n = Math.ceil((x1 - x0) / (detail === 1 ? 2.2 : 1.1));
      for (let i = 0; i <= n; i++) B('trim', x0 + ((x1 - x0) * i) / n, 22.25, z, 0.22, 0.9, 0.26);
    }
    for (const x of [-31.2, -21, -12.15, -4.05, 4.05, 12.15, 20.25, 27.3]) {
      const z = frontZ(x) - 0.2;
      B('trim', x, 23.4, z, 0.7, 0.3, 0.7);
      B('trim', x, 23.7, z, 0.32, 0.9, 0.3);
      B('trim', x, 24.6, z, 0.3, 0.3, 0.3);
    }
  }
  // Central tower: actual open bell stages, with a closed roof and a clock on the piazza face.
  const ps = r.tower.outline,
    cx = ps.reduce((s, p) => s + p[0] / ps.length, 0),
    cz = ps.reduce((s, p) => s + p[1] / ps.length, 0),
    w = 9.2,
    d = 7.2;
  B('brick', cx, 21, cz, w, 2, d);
  if (detail)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) B('trim', cx + (sx * w) / 2, 23, cz + (sz * d) / 2, 0.3, 19, 0.3);
  const towerSide = (center, u, n, width, base, top) => {
    const radius = detail === 0 ? 1.4 : 1.5,
      spring = base + 5.3;
    const jamb = (width - 2 * radius) / 2;
    for (const sign of [-1, 1])
      extrude(
        'brick',
        [
          [-jamb / 2, base],
          [jamb / 2, base],
          [jamb / 2, top],
          [-jamb / 2, top],
        ],
        0.32,
        -0.32,
        [
          center[0] + u[0] * sign * (width / 2 - jamb / 2),
          0,
          center[2] + u[2] * sign * (width / 2 - jamb / 2),
        ],
        u,
        n,
      );
    spandrel('brick', 0, base, spring, radius, top, 0.32, -0.32, center, u, n);
  };
  for (const [base, top] of [
    [23, 32.2],
    [34, 42],
  ])
    for (const [center, u, n, width] of [
      [[cx, 0, cz + d / 2], [1, 0, 0], [0, 0, 1], w],
      [[cx, 0, cz - d / 2], [-1, 0, 0], [0, 0, -1], w],
      [[cx + w / 2, 0, cz], [0, 0, -1], [1, 0, 0], d],
      [[cx - w / 2, 0, cz], [0, 0, 1], [-1, 0, 0], d],
    ])
      towerSide(center, u, n, width, base, top);
  for (const [y, h, extra] of [
    [32.2, 0.7, 0.55],
    [33, 1, 0.2],
    [42, 0.6, 0.65],
    [42.6, 0.65, 1],
  ])
    B('trim', cx, y, cz, w + extra, h, d + extra);
  B('trim', cx, 43.25, cz, w - 0.5, 0.4, d - 0.5);
  B('trim', cx, 43.65, cz, 1.1, 1.1, 1.1);
  B('wood', cx, 44.75, cz, 0.12, 1.5, 0.12);
  if (detail) {
    const radius = 1.55,
      count = detail === 1 ? 12 : 24,
      z = cz + d / 2 + 0.75;
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count,
        b = (2 * Math.PI * (i + 1)) / count;
      f(
        'trim',
        [
          [cx, Y + 33.1, z],
          [cx + radius * Math.cos(a), Y + 33.1 + radius * Math.sin(a), z],
          [cx + radius * Math.cos(b), Y + 33.1 + radius * Math.sin(b), z],
        ],
        [0, 0, 1],
      );
    }
    B('wood', cx, 32.95, z + 0.02, 0.11, 1.2, 0.06);
    B('wood', cx + 0.34, 33.04, z + 0.02, 0.7, 0.11, 0.06);
    if (detail >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (2 * Math.PI * i) / 12;
        B(
          'wood',
          cx + 1.27 * Math.cos(a),
          33.1 + 1.27 * Math.sin(a) - 0.05,
          z + 0.03,
          0.1,
          0.1,
          0.05,
        );
      }
  }
  if (detail >= 2) {
    // Hidden side/court window rhythm is approximate, clipped to the wall's own height.
    for (const p of r.main)
      for (const ring of [p.outline, ...p.holes]) {
        const sign = Math.sign(
          ring.reduce(
            (s, a, i) =>
              s + a[0] * ring[(i + 1) % ring.length][1] - a[1] * ring[(i + 1) % ring.length][0],
            0,
          ),
        );
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            len = Math.hypot(dx, dz);
          if (len < 8 || Math.min(a[1], b[1]) > -0.2) continue;
          const u = [dx / len, 0, dz / len],
            n = [(dz / len) * sign, 0, (-dx / len) * sign],
            count = Math.floor(len / 6);
          for (let j = 0; j < count; j++)
            for (const y of [7, 12, 17]) {
              const t = (j + 0.5) / count;
              window(
                a[0] + t * dx + n[0] * 0.05,
                y,
                a[1] + t * dz + n[2] * 0.05,
                1.6,
                2.4,
                u,
                n,
                false,
              );
            }
        }
      }
  }
}
