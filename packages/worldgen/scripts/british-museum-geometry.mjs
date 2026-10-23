/** 'N0737': Native museum wings, mapped Ionic columns, curved Great Court and Reading Room. */
import { beam, cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export function britishRadius(poly, center, a) {
  const d = [Math.cos(a), Math.sin(a)],
    hits = [],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i].map((v, k) => v - center[k]),
      q = poly[(i + 1) % poly.length],
      v = q.map((v, k) => v - center[k] - p[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-9) continue;
    const t = cross(p, v) / den,
      u = cross(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error('N0737 missing radial native boundary');
  return Math.min(...hits);
}
export function britishCourtTriangles(r, detail) {
  const source = r.courtTriangles;
  if (detail < 2) {
    const n = detail ? 24 : 12,
      nr = detail ? 2 : 1,
      out = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < nr; j++) {
        const point = (i, j) => {
            const a = (i * tau) / n,
              inner = britishRadius(r.drum.outline, r.drum.center, a),
              outer = britishRadius(r.courtOutline, r.drum.center, a),
              t = j / nr,
              R = inner * (1 - t) + outer * t;
            return [
              r.drum.center[0] + R * Math.cos(a),
              20 + t + 5.7 * Math.sin(Math.PI * t),
              r.drum.center[1] + R * Math.sin(a),
            ];
          },
          A = point(i, j),
          B = point(i + 1, j),
          C = point(i + 1, j + 1),
          D = point(i, j + 1);
        out.push([A, B, C], [A, C, D]);
      }
    return out;
  }
  if (detail === 2) return source;
  const out = [];
  for (const [A, B, C] of source) {
    const m = (a, b) => a.map((v, k) => (v + b[k]) / 2),
      AB = m(A, B),
      BC = m(B, C),
      CA = m(C, A);
    out.push([A, AB, CA], [AB, B, BC], [CA, BC, C], [AB, BC, CA]);
  }
  return out;
}
export function buildBritishMuseum(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, N) => face(role, ps.map(P), D(N)),
    adapter = {
      addQuad: (role, _ref, ps, N) => f(role, ps, N),
      addConvexPolygon: (role, _ref, ps, N) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], N);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    slab = (role, ps, thick = 0.2) => {
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        if (detail)
          f(
            role,
            ids.map((i) => [ps[i][0], ps[i][1] - thick, ps[i][2]]),
            [0, -1, 0],
          );
      }
      const sg = Math.sign(
        ps.reduce((s, p, i) => s + p[0] * ps[(i + 1) % 4][2] - p[2] * ps[(i + 1) % 4][0], 0),
      );
      for (let i = 0; i < 4; i++) {
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sg, 0, (p[0] - q[0]) * sg],
        );
      }
    },
    ring = (c, R, y, n, phase = 0) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * tau) / n + phase;
        return [c[0] + R * Math.cos(a), y, c[1] + R * Math.sin(a)];
      }),
    loft = (role, rings, caps = true) => {
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < rings[j].length; i++) {
          const k = (i + 1) % rings[j].length,
            a = rings[j - 1][i],
            b = rings[j - 1][k],
            m = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2],
            c = rings[j].reduce(
              (s, p) => [s[0] + p[0] / rings[j].length, 0, s[2] + p[2] / rings[j].length],
              [0, 0, 0],
            );
          f(role, [a, b, rings[j][k], rings[j][i]], [m[0] - c[0], 0, m[2] - c[2]]);
        }
      if (caps)
        for (const [ps, dy] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ]) {
          const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
          for (let i = 0; i < ps.length; i++)
            f(role, [c, ps[i], ps[(i + 1) % ps.length]], [0, dy, 0]);
        }
    };
  for (const p of r.foundations[detail])
    prism(f, 'paving', p, r.minGround - F - 0.5, 2, detail > 0);
  for (const b of r.bodyLevels[detail])
    prism(
      (role, ps, N) => {
        const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
        let material = role;
        if (N[1] > 0.5) material = 'roof';
        else if (Math.abs(N[1]) < 0.5 && role === 'stone' && (Math.abs(c[0]) > 56 || c[2] < -55))
          material = 'brick';
        f(material, ps, N);
      },
      b.role,
      b.geometry,
      b.lo,
      b.height,
      b.lo > 2 || detail > 1,
    );
  // Mapped overhead U-shaped colonnade beam; the forecourt remains open below it.
  for (const p of r.portico) prism(f, 'stone', p, 17, 20);
  const cols = detail === 0 ? r.columns.filter((_, i) => i % 6 === 0) : r.columns,
    nc = [4, 6, 12, 24][detail];
  for (const c of cols) {
    const center = c.center,
      R = c.radius,
      shaft = ring(center, R, 2.7, nc).map((p, i) => {
        const a = (i * tau) / nc;
        return [
          center[0] + R * (detail === 3 && i % 2 ? 0.95 : 1) * Math.cos(a),
          p[1],
          center[1] + R * (detail === 3 && i % 2 ? 0.95 : 1) * Math.sin(a),
        ];
      }),
      upper = shaft.map((p) => [
        center[0] + (p[0] - center[0]) * 0.83,
        16.05,
        center[1] + (p[2] - center[1]) * 0.83,
      ]);
    if (detail === 0) {
      prism(
        f,
        'stone',
        { outline: ring(center, R * 1.2, 2, 3).map((p) => [p[0], p[2]]) },
        2,
        17,
        false,
      );
      continue;
    }
    loft('stone', [shaft, upper], false);
    box(f, 'stone', center[0], 2, center[1], R * 2.5, 0.7, R * 2.5);
    box(f, 'stone', center[0], 16.05, center[1], R * 2.6, 0.95, R * 2.1);
    if (detail > 1) {
      const ns = detail === 3 ? 6 : 1;
      for (const zsign of [-1, 1])
        for (const sign of [-1, 1])
          for (let j = 0; j < ns; j++) {
            const point = (k) => {
              const t = k / ns,
                a = t * tau * 1.15,
                rr = R * 0.42 * (1 - 0.7 * t);
              return [
                center[0] + sign * (R * 0.84 + rr * Math.cos(a)),
                16.5 + rr * Math.sin(a),
                center[1] + zsign * R * 1.16,
              ];
            };
            triBar('stone', point(j), point(j + 1), R * 0.15);
          }
    }
  }
  // Closed triangular pediment with a restrained, geometric relief in the nearest level.
  const x0 = -19.4,
    x1 = 18.8,
    cz = -0.3;
  for (const z of [68.6, 81.04])
    f(
      'stone',
      [
        [x0, 20, z],
        [x1, 20, z],
        [cz, 24, z],
      ],
      [0, 0, z > 80 ? 1 : -1],
    );
  slab(
    'slate',
    [
      [x0, 20, 68.6],
      [cz, 24, 68.6],
      [cz, 24, 81.04],
      [x0, 20, 81.04],
    ],
    0.2,
  );
  slab(
    'slate',
    [
      [cz, 24, 68.6],
      [x1, 20, 68.6],
      [x1, 20, 81.04],
      [cz, 24, 81.04],
    ],
    0.2,
  );
  f(
    'stone',
    [
      [x0, 20, 68.6],
      [x1, 20, 68.6],
      [x1, 20, 81.04],
      [x0, 20, 81.04],
    ],
    [0, -1, 0],
  );
  if (detail > 1) {
    for (const p of r.portico)
      for (let i = 0; i < p.outline.length; i++) {
        const a = p.outline[i],
          b = p.outline[(i + 1) % p.outline.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.5) continue;
        for (const y of [17.25, 18.2, 19.8]) bar('stone', [a[0], y, a[1]], [b[0], y, b[1]], 0.22);
      }
  }
  if (detail === 3)
    for (let i = 0; i < 13; i++) {
      const x = -16 + (32 * i) / 12,
        h = Math.max(0.35, 3.3 * (1 - Math.abs(x - cz) / 19));
      box(f, 'stone', x, 20.15, 81.18, 0.55, h * 0.6, 0.32);
      loft('stone', [
        ring([x, 81.28], 0.18, 20.15 + h * 0.59, 6),
        ring([x, 81.28], 0.21, 20.15 + h * 0.84, 6),
        ring([x, 81.28], 0.12, 20.15 + h, 6),
      ]);
      for (const s of [-1, 1])
        bar('stone', [x, 20.15 + h * 0.5, 81.3], [x + s * 0.5, 20.15 + h * 0.3, 81.3], 0.16);
    }
  // Original-contact south steps, partitioned out of the raised foundation cap.
  const stepN = [1, 2, 4, 8][detail],
    p = r.steps.outline,
    A = p[0],
    B = p[3],
    C = p[2],
    E = p[1];
  for (let i = 0; i < stepN; i++) {
    const point = (t, left, y) => {
        const a = left ? A : B,
          b = left ? E : C;
        return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
      },
      t = i / stepN,
      u = (i + 1) / stepN,
      y = 2 - (2 - r.steps.frontY) * t;
    slab(
      'stone',
      [point(t, true, y), point(t, false, y), point(u, false, y), point(u, true, y)],
      (2 - r.steps.frontY) / stepN + 0.1,
    );
  }
  // Reading Room cylinder, pale dome and native small lantern.
  const d = r.drum,
    n = [12, 16, 30, 30][detail],
    angles = Array.from({ length: n }, (_, i) => (i * tau) / n),
    base = angles.map((a) => {
      const R = britishRadius(d.outline, d.center, a);
      return [d.center[0] + R * Math.cos(a), 20, d.center[1] + R * Math.sin(a)];
    });
  prism(
    f,
    'stone',
    { outline: base.map((p) => [p[0], p[2]]) },
    r.minGround - F - 0.5,
    20,
    detail > 1,
  );
  if (detail > 1)
    prism(
      f,
      'stone',
      {
        outline: base.map((p) => {
          const dx = p[0] - d.center[0],
            dz = p[2] - d.center[1],
            scale = 1 + 0.4 / Math.hypot(dx, dz);
          return [d.center[0] + dx * scale, d.center[1] + dz * scale];
        }),
        holes: [base.map((p) => [p[0], p[2]])],
      },
      19.4,
      20.2,
    );
  const lat = [2, 4, 6, 10][detail],
    rings = Array.from({ length: lat }, (_, j) => {
      const t = ((j / lat) * Math.PI) / 2;
      return base.map((p) => [
        d.center[0] + (p[0] - d.center[0]) * Math.cos(t),
        20 + 14 * Math.sin(t),
        d.center[1] + (p[2] - d.center[1]) * Math.cos(t),
      ]);
    });
  loft('dome', rings, false);
  for (let i = 0; i < n; i++)
    f(
      'dome',
      [rings.at(-1)[i], rings.at(-1)[(i + 1) % n], [...d.center.slice(0, 1), 34, d.center[1]]],
      [0, 1, 0],
    );
  const lantern = detail ? r.lantern.outline : r.lantern.outline.filter((_, i) => i % 3 === 0);
  prism(f, 'metal', { outline: lantern }, 33.1, 36, detail > 1);
  prism(f, 'roof', { outline: lantern }, 36, 37, detail > 1);
  if (detail > 1)
    for (let i = 0; i < (detail === 3 ? 24 : 12); i++) {
      const a = ((i + 0.5) * tau) / (detail === 3 ? 24 : 12),
        R = britishRadius(d.outline, d.center, a) + 0.24,
        N = [Math.cos(a), 0, Math.sin(a)],
        T = [-Math.sin(a), 0, Math.cos(a)],
        at = (x, y, extra = 0) => [
          d.center[0] + N[0] * (R + extra) + T[0] * x,
          y,
          d.center[1] + N[2] * (R + extra) + T[2] * x,
        ],
        window = [
          at(-1.5, 9.5),
          at(1.5, 9.5),
          ...Array.from({ length: 9 }, (_, j) => {
            const a = (j * Math.PI) / 8;
            return at(1.5 * Math.cos(a), 16.2 + 1.5 * Math.sin(a));
          }),
        ];
      f('glass', window, N);
      for (let j = 0; j < window.length; j++)
        triBar('stone', window[j], window[(j + 1) % window.length], 0.19);
      if (detail === 3) triBar('stone', at(0, 9.5, 0.05), at(0, 17.7, 0.05), 0.14);
    }
  function triBar(role, a, b, w) {
    const axis = normalize(b.map((v, k) => v - a[k])),
      U = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
      V = cross(axis, U),
      ring = (p) =>
        [
          [-0.5, -0.3],
          [0.5, -0.3],
          [0, 0.6],
        ].map(([u, v]) => p.map((x, k) => x + w * (u * U[k] + v * V[k]))),
      A = ring(a),
      B = ring(b);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3,
        m = A[i].map((v, k) => (v + A[j][k]) / 2 - a[k]);
      f(role, [A[i], A[j], B[j], B[i]], m);
    }
    f(
      role,
      A,
      axis.map((v) => -v),
    );
    f(role, B, axis);
  }
  // Connected glass shell and geometric lattice; local image-free PBR keeps the court translucent.
  const tris = britishCourtTriangles(r, detail),
    edges = new Map(),
    key = (p) => p.map((v) => Math.round(v * 1e5)).join(',');
  for (const tri of tris) {
    f('clearGlass', tri, [0, 1, 0]);
    if (detail)
      f(
        'clearGlass',
        tri.map((p) => [p[0], p[1] - 0.05, p[2]]),
        [0, -1, 0],
      );
    for (let i = 0; i < 3; i++) {
      const a = tri[i],
        b = tri[(i + 1) % 3],
        K = [key(a), key(b)].sort().join('|'),
        e = edges.get(K);
      if (e) e.count++;
      else edges.set(K, { a, b, count: 1 });
    }
  }
  for (const e of edges.values()) {
    const { a, b } = e;
    if (e.count === 1) {
      f(
        'clearGlass',
        [a, [a[0], a[1] - 0.05, a[2]], [b[0], b[1] - 0.05, b[2]], b],
        [b[2] - a[2], 0, a[0] - b[0]],
      );
      if (detail) triBar('metal', a, b, 0.16);
      if (Math.hypot(a[0] - d.center[0], a[2] - d.center[1]) > 25 && detail)
        f('stone', [[a[0], 20, a[2]], [b[0], 20, b[2]], b, a], [b[2] - a[2], 0, a[0] - b[0]]);
    } else if (detail > 1) triBar('metal', a, b, detail === 3 ? 0.09 : 0.13);
  }
  // Rooflights of the original gallery wings follow the mapped roof planes below them.
  if (detail > 1)
    for (const l of r.rooflights.filter((_, i) => (detail === 1 ? i % 4 === 0 : true))) {
      const { x, z, alongX } = l,
        w = alongX ? 8 : 10,
        deep = alongX ? 10 : 8,
        y = l.height;
      box(f, 'stone', x, y, z, w, 0.5, deep);
      const ps = [
          [x - w / 2, y + 0.5, z - deep / 2],
          [x + w / 2, y + 0.5, z - deep / 2],
          [x + w / 2, y + 0.5, z + deep / 2],
          [x - w / 2, y + 0.5, z + deep / 2],
        ],
        A = [x, y + 2.7, z - deep / 2],
        B = [x, y + 2.7, z + deep / 2];
      slab('glass', [ps[0], A, B, ps[3]], 0.12);
      slab('glass', [A, ps[1], ps[2], B], 0.12);
      if (detail > 1) {
        bar('metal', A, B, 0.14);
        for (const p of ps) bar('metal', p, p[0] < x ? (p[2] < z ? A : B) : p[2] < z ? A : B, 0.14);
      }
    }
  if (detail > 1)
    for (const w of r.windows.filter((_, i) => (detail === 2 ? i % 2 === 0 : true))) {
      const { a, b, y0, y1, N, role } = w;
      f(
        'glass',
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        N,
      );
      if (detail === 3)
        for (const [p, q] of [
          [
            [a[0], y0, a[1]],
            [b[0], y0, b[1]],
          ],
          [
            [a[0], y1, a[1]],
            [b[0], y1, b[1]],
          ],
          [
            [a[0], y0, a[1]],
            [a[0], y1, a[1]],
          ],
          [
            [b[0], y0, b[1]],
            [b[0], y1, b[1]],
          ],
        ])
          bar(role ?? 'stone', p, q, 0.16);
    }
}
