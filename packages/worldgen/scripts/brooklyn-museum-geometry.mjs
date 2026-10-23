/** 'N0766': connected Brooklyn Museum wings, six Ionic columns and stepped glass pavilion. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildBrooklynMuseum(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => f(role, ps, n),
    },
    bar = (role, a, b, w) =>
      beam(
        adapter,
        role,
        a.map((v, k) => v + (k === 1 ? Y : 0)),
        b.map((v, k) => v + (k === 1 ? Y : 0)),
        w,
        w,
        [1, 1, 1],
      ),
    multi = (ps) => ps.map((p) => [p.outline, ...p.holes]),
    clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
  const cap = (role, poly, y, normal = [0, 1, 0]) => {
    const rings = [poly.outline, ...poly.holes],
      flat = rings.flat(),
      holes = [];
    let off = rings[0].length;
    for (const ring of rings.slice(1)) {
      holes.push(off);
      off += ring.length;
    }
    const ix = earcut(flat.flat(), holes);
    for (let i = 0; i < ix.length; i += 3)
      f(
        role,
        ix.slice(i, i + 3).map((j) => [flat[j][0], y, flat[j][1]]),
        normal,
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
            last = spans.at(-1),
            lo = i === 0 ? r.foundationY : Y + band.lo;
          if (last && Math.abs(last.hi - lo) < 1e-6) last.hi = Y + band.hi;
          else spans.push({ a: ps[0], b: ps[1], lo, hi: Y + band.hi, n });
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
      cap(band.hi === 26 ? 'roof' : 'trim', p, Y + band.hi);
    if (i > 0)
      for (const p of pc.difference(multi(band.polygons), multi(below)).map(clean))
        cap('trim', p, Y + band.lo, [0, -1, 0]);
  }
  for (const spans of walls.values())
    for (const w of spans)
      f(
        'wall',
        [
          [w.a[0], w.lo, w.a[2]],
          [w.b[0], w.lo, w.b[2]],
          [w.b[0], w.hi, w.b[2]],
          [w.a[0], w.hi, w.a[2]],
        ],
        w.n,
      );
  for (const p of r.floors) cap('trim', p, r.foundationY, [0, -1, 0]);
  for (const p of r.pavilion)
    prism(
      (role, ps, n) => f(n[1] > 0.5 ? 'trim' : role, ps, n),
      'trim',
      p,
      r.foundationY,
      Y,
      false,
    );

  const ring = (x, z, y, radius, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [x + Math.cos(a) * radius, Y + y, z + Math.sin(a) * radius];
    });
  const loft = (role, rings) => {
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < rings[j].length; i++) {
        const k = (i + 1) % rings[j].length,
          a = rings[j - 1][i],
          b = rings[j - 1][k],
          c = rings[j].reduce((s, p) => s.map((v, k) => v + p[k] / rings[j].length), [0, 0, 0]);
        f(
          role,
          [a, b, rings[j][k], rings[j][i]],
          [(a[0] + b[0]) / 2 - c[0], 0, (a[2] + b[2]) / 2 - c[2]],
        );
      }
    for (const [ps, dy] of [
      [rings[0], -1],
      [rings.at(-1), 1],
    ]) {
      const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
      for (let i = 0; i < ps.length; i++) f(role, [c, ps[i], ps[(i + 1) % ps.length]], [0, dy, 0]);
    }
  };
  const n = [6, 8, 12, 20][detail];
  for (const x of r.columns) {
    if (detail) B('trim', x, 5.1, -1, 2.1, 0.45, 2.1);
    loft('trim', [
      ring(x, -1, 5.1, 0.95, n),
      ring(x, -1, 5.7, 0.84, n),
      ring(x, -1, 21.7, 0.68, n),
      ring(x, -1, 22.8, 1.05, n),
    ]);
    if (detail > 1) {
      B('trim', x, 22.45, -1, 2.2, 0.35, 2.1);
      for (const dx of [-0.72, 0.72]) {
        const rings = [-1.48, -0.52].map((z) =>
          Array.from({ length: detail === 3 ? 12 : 8 }, (_, i) => {
            const a = (i * Math.PI * 2) / (detail === 3 ? 12 : 8);
            return [x + dx + Math.cos(a) * 0.38, Y + 22.15 + Math.sin(a) * 0.38, z];
          }),
        );
        for (let i = 0; i < rings[0].length; i++) {
          const k = (i + 1) % rings[0].length;
          f(
            'trim',
            [rings[0][i], rings[0][k], rings[1][k], rings[1][i]],
            [
              Math.cos((i * 2 * Math.PI) / rings[0].length),
              Math.sin((i * 2 * Math.PI) / rings[0].length),
              0,
            ],
          );
        }
        for (const [ps, sign] of [
          [rings[0], -1],
          [rings[1], 1],
        ])
          f('trim', ps, [0, 0, sign]);
      }
    }
  }
  B('trim', 0, 22.8, -1, 28.6, 1.5, 3);
  const tri = [
      [-14.3, Y + 24.3, 0.35],
      [14.3, Y + 24.3, 0.35],
      [0, Y + 30, 0.35],
    ],
    back = tri.map((p) => [p[0], p[1], -0.55]);
  f('trim', tri, [0, 0, 1]);
  f('trim', back, [0, 0, -1]);
  for (let i = 0; i < 3; i++) {
    const k = (i + 1) % 3;
    f('trim', [tri[i], back[i], back[k], tri[k]], [0, i === 0 ? -1 : 1, 0]);
  }
  if (detail) {
    bar('trim', [-14.5, 24.35, 0.6], [0, 30.15, 0.6], 0.45);
    bar('trim', [0, 30.15, 0.6], [14.5, 24.35, 0.6], 0.45);
    for (const x of [-8, -4, 0, 4, 8])
      B('wall', x, 25, 0.91, 1.25, 0.7 + (1 - Math.abs(x) / 10), 0.25);
  }
  B('wall', 0, 26, -12, 28, 5.2, 22);
  if (detail) {
    B('trim', 0, 30.9, -12, 28.4, 0.6, 22.4);
    B('trim', 0, 26.1, -12, 28.2, 0.5, 22.2);
  }
  const domeN = [12, 16, 24, 32][detail],
    domeProfile =
      detail === 0
        ? [
            [31.2, 10.8],
            [34, 9.8],
            [37, 6.7],
            [39, 0.8],
          ]
        : [
            [31.2, 10.8],
            [32, 10.8],
            [34.8, 9.5],
            [37, 6.7],
            [38.4, 3.5],
            [39, 0.8],
          ];
  loft(
    'trim',
    domeProfile.map(([y, radius]) => ring(0, -12.5, y, radius, domeN)),
  );
  if (detail > 1)
    for (const y of [31.35, 32, 33])
      loft('trim', [
        ring(0, -12.5, y, 10.85 - (y - 31.35) * 0.3, domeN),
        ring(0, -12.5, y + 0.18, 10.85 - (y - 31.35) * 0.3, domeN),
      ]);

  const circle = (radius, count) =>
      Array.from({ length: count }, (_, i) => {
        const a = (i * Math.PI * 2) / count;
        return [Math.cos(a) * radius, -13 + Math.sin(a) * radius];
      }),
    roofCount = [12, 20, 32, 48][detail],
    radii = detail === 0 ? [0, 44] : [0, 20, 24, 28, 32, 44];
  for (let j = 1; j < radii.length; j++) {
    const outer = [[circle(radii[j], roofCount)]],
      annulus = j === 1 ? outer : pc.difference(outer, [[circle(radii[j - 1], roofCount)]]),
      polys = pc.intersection(multi(r.pavilion), annulus).map(clean),
      h = detail === 0 ? 4.9 : 6.4 - (j - 1) * 0.5;
    for (const p of polys) {
      prism(f, 'glass', p, Y + h - (detail && j < radii.length - 1 ? 0.5 : 0.16), Y + h);
      if (detail)
        for (let i = 0; i < p.outline.length; i++) {
          const a = p.outline[i],
            b = p.outline[(i + 1) % p.outline.length];
          bar('frame', [a[0], h + 0.04, a[1]], [b[0], h + 0.04, b[1]], detail === 3 ? 0.24 : 0.3);
        }
    }
  }
  const outline = r.pavilion[0].outline,
    sign = Math.sign(
      outline.reduce(
        (s, a, i) =>
          s +
          a[0] * outline[(i + 1) % outline.length][1] -
          a[1] * outline[(i + 1) % outline.length][0],
        0,
      ),
    );
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      d = b.map((v, k) => v - a[k]),
      L = Math.hypot(...d),
      normal = [d[1] * sign, 0, -d[0] * sign];
    const ts = [0, 1];
    if (detail && Math.max(a[1], b[1]) > r.entry.z - 1)
      for (const x of [-r.entry.width / 2, r.entry.width / 2]) {
        const t = (x - a[0]) / d[0];
        if (t > 0 && t < 1) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    for (let k = 1; k < ts.length; k++) {
      const p = a.map((v, j) => v + d[j] * ts[k - 1]),
        q = a.map((v, j) => v + d[j] * ts[k]),
        door =
          detail &&
          Math.max(p[1], q[1]) > r.entry.z - 1 &&
          Math.abs((p[0] + q[0]) / 2) < r.entry.width / 2;
      f(
        'glass',
        [
          [p[0], Y + (door ? r.entry.height : 0), p[1]],
          [q[0], Y + (door ? r.entry.height : 0), q[1]],
          [q[0], Y + 4.24, q[1]],
          [p[0], Y + 4.24, p[1]],
        ],
        normal,
      );
    }
    if (detail && L > 0.5) {
      const count = Math.max(1, Math.ceil(L / (detail === 3 ? 3.4 : 6)));
      for (let k = 0; k < count; k++) {
        const p = a.map((v, j) => v + (d[j] * k) / count);
        if (Math.abs(p[0]) < 2.15 && p[1] > r.entry.z - 1) continue;
        bar(
          'frame',
          [p[0], 0, p[1]],
          [p[0] + (p[1] > 4 ? -Math.sign(p[0]) * 0.45 : 0), 4.4, p[1] - 0.2],
          0.3,
        );
      }
    }
  }
  if (detail) {
    const e = r.entry,
      x0 = -e.width / 2,
      x1 = e.width / 2,
      front = e.z,
      back = front - e.depth;
    f(
      'glass',
      [
        [x0, Y, back],
        [x1, Y, back],
        [x1, Y + e.height, back],
        [x0, Y + e.height, back],
      ],
      [0, 0, 1],
    );
    for (const [x, n] of [
      [x0, 1],
      [x1, -1],
    ])
      f(
        'frame',
        [
          [x, Y, front],
          [x, Y, back],
          [x, Y + e.height, back],
          [x, Y + e.height, front],
        ],
        [n, 0, 0],
      );
    f(
      'frame',
      [
        [x0, Y + e.height, front],
        [x1, Y + e.height, front],
        [x1, Y + e.height, back],
        [x0, Y + e.height, back],
      ],
      [0, -1, 0],
    );
    B('trim', 0, -0.06, (front + back) / 2, e.width, 0.12, e.depth);
    for (const x of [x0, 0, x1])
      bar('frame', [x, 0.03, back + 0.04], [x, e.height, back + 0.04], 0.22);
    B('brick', 0, 0, -12.1, 25, 4.1, 0.3);
  }
  if (r.entry.stepBaseY !== undefined)
    for (let i = 0; i < 2; i++) {
      const top = Y + 0.06 - i * 0.18;
      box(
        f,
        'trim',
        0,
        r.entry.stepBaseY,
        r.entry.z + 0.3 + i * 0.6,
        4.6,
        top - r.entry.stepBaseY,
        0.6,
      );
    }

  if (detail)
    for (let i = 0; i < r.facade.length; i++) {
      const bay = r.facade[i],
        [x, z] = bay.center,
        [tx, tz] = bay.tangent,
        [nx, nz] = bay.normal;
      if (detail === 1 && i % 2) continue;
      const Q = (u, y, depth = 0.06) => [x + tx * u + nx * depth, Y + y, z + tz * u + nz * depth],
        w = Math.min(2, bay.spacing * 0.5);
      if (bay.court)
        f(
          'court',
          [
            Q(-bay.spacing / 2, 0, 0.025),
            Q(bay.spacing / 2, 0, 0.025),
            Q(bay.spacing / 2, 24, 0.025),
            Q(-bay.spacing / 2, 24, 0.025),
          ],
          [nx, 0, nz],
        );
      for (const y of [7, 14.5]) {
        f('glass', [Q(-w / 2, y), Q(w / 2, y), Q(w / 2, y + 4.2), Q(-w / 2, y + 4.2)], [nx, 0, nz]);
        if (detail === 3) {
          for (const u of [-w / 2, w / 2])
            bar(
              'trim',
              Q(u, y - 0.15).map((v, k) => v - (k === 1 ? Y : 0)),
              Q(u, y + 4.35).map((v, k) => v - (k === 1 ? Y : 0)),
              0.22,
            );
          for (const yy of [y - 0.1, y + 4.3])
            bar(
              'trim',
              Q(-w / 2 - 0.15, yy).map((v, k) => v - (k === 1 ? Y : 0)),
              Q(w / 2 + 0.15, yy).map((v, k) => v - (k === 1 ? Y : 0)),
              0.25,
            );
        }
        if (detail === 3) {
          bar(
            'frame',
            Q(0, y, 0.1).map((v, k) => v - (k === 1 ? Y : 0)),
            Q(0, y + 4.2, 0.1).map((v, k) => v - (k === 1 ? Y : 0)),
            0.14,
          );
          bar(
            'frame',
            Q(-w / 2, y + 2.1, 0.1).map((v, k) => v - (k === 1 ? Y : 0)),
            Q(w / 2, y + 2.1, 0.1).map((v, k) => v - (k === 1 ? Y : 0)),
            0.14,
          );
        }
      }
      if (detail > 1 && !bay.court) {
        const a = Q(-bay.spacing / 2 + 0.5, 4.8, 0.23),
          b = Q(-bay.spacing / 2 + 0.5, 23, 0.23);
        bar(
          'trim',
          a.map((v, k) => v - (k === 1 ? Y : 0)),
          b.map((v, k) => v - (k === 1 ? Y : 0)),
          0.85,
        );
        for (const yy of [5, 23.3, 25.7]) {
          const a = Q(-bay.spacing / 2, yy, 0.16),
            b = Q(bay.spacing / 2, yy, 0.16);
          bar(
            'trim',
            a.map((v, k) => v - (k === 1 ? Y : 0)),
            b.map((v, k) => v - (k === 1 ? Y : 0)),
            yy === 25.7 ? 0.6 : 0.3,
          );
        }
      }
    }
  if (detail) {
    B('glass', 0, 5.2, -5.62, 3, 6, 0.12);
    B('trim', 0, 5.1, -3.2, 4, 0.12, 5);
    for (const [x, z, w, d] of [
      [-46, -22, 53, 7],
      [44, -24, 48, 7],
      [-20, -66, 7, 31],
      [-70, -63, 7, 32],
    ]) {
      B('glass', x, 26.05, z, w, 0.7, d);
      if (detail > 1) {
        const count = Math.ceil(Math.max(w, d) / 5);
        for (let i = 0; i <= count; i++) {
          const u = i / count - 0.5;
          if (w > d)
            bar('frame', [x + w * u, 26.85, z - d / 2], [x + w * u, 26.85, z + d / 2], 0.26);
          else bar('frame', [x - w / 2, 26.85, z + d * u], [x + w / 2, 26.85, z + d * u], 0.26);
        }
      }
    }
    if (detail > 1)
      for (const x of [-68, -56, -44, -32, 32, 44, 56, 68]) {
        B('trim', x, 26, -13.7, 1.1, 1.5, 1.1);
        loft('trim', [ring(x, -13.7, 27.5, 0.55, 6), ring(x, -13.7, 28.1, 0.3, 6)]);
      }
  }
}
