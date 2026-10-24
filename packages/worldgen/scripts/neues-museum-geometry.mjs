/** 'neues_museum': Neues Museum colonnade, pediments, twin glazed courts and low corner domes. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildNeuesMuseum(face, detail, r) {
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
      cap(band.hi === 19.7 ? 'roof' : 'trim', p, Y + band.hi);
    if (i > 0)
      for (const p of pc.difference(multi(band.polygons), multi(below)).map(clean))
        cap('trim', p, Y + band.lo, [0, -1, 0]);
  }
  for (const spans of walls.values())
    for (const w of spans)
      f(
        (w.a[0] + w.b[0]) / 2 < -45 ? 'brick' : 'wall',
        [
          [w.a[0], w.lo, w.a[2]],
          [w.b[0], w.lo, w.b[2]],
          [w.b[0], w.hi, w.b[2]],
          [w.a[0], w.hi, w.a[2]],
        ],
        w.n,
      );
  for (const p of r.floors) cap('trim', p, r.foundationY, [0, -1, 0]);
  for (const p of r.floors) prism(f, 'trim', p, r.foundationY, Y, false);
  const segments = [6, 6, 12, 16][detail];
  const column = (role, x, z, lo, hi, radius, count = segments) => {
    const lower = [],
      upper = [];
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      lower.push([x + Math.cos(a) * radius, Y + lo, z + Math.sin(a) * radius]);
      upper.push([x + Math.cos(a) * radius * 0.84, Y + hi, z + Math.sin(a) * radius * 0.84]);
    }
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      f(
        role,
        [lower[i], lower[j], upper[j], upper[i]],
        [(lower[i][0] + lower[j][0]) / 2 - x, 0, (lower[i][2] + lower[j][2]) / 2 - z],
      );
    }
    f(role, lower, [0, -1, 0]);
    f(role, upper, [0, 1, 0]);
  };
  // The shared mapped U-shaped colonnade retains garden ground and paths underneath.
  for (const poly of r.outdoorRoofCoarse) {
    const points = poly.outline.map((p, i) => [p[0], poly.heights[i], p[1]]),
      holes = [];
    if (detail)
      for (const c of r.outdoorColumns) {
        holes.push(points.length);
        points.push([c.center[0], c.baseY + 5.35, c.center[1]]);
      }
    const ix = earcut(
      points.flatMap((p) => [p[0], p[2]]),
      holes,
    );
    for (let i = 0; i < ix.length; i += 3) {
      const tri = ix.slice(i, i + 3).map((j) => points[j]);
      f('trim', tri, [0, -1, 0]);
      f(
        'roof',
        tri.map((p) => [p[0], p[1] + 0.32, p[2]]),
        [0, 1, 0],
      );
    }
    for (let i = 0; i < poly.outline.length; i++) {
      const j = (i + 1) % poly.outline.length,
        a = points[i],
        b = points[j];
      f(
        'trim',
        [a, b, [b[0], b[1] + 0.32, b[2]], [a[0], a[1] + 0.32, a[2]]],
        [b[2] - a[2], 0, a[0] - b[0]],
      );
    }
  }
  for (const c of r.outdoorColumns) {
    if (!detail && !c.skyline) continue;
    const [x, z] = c.center,
      top = detail ? c.baseY + 5.35 : c.skylineTopY;
    column('trim', x, z, c.baseY - Y, top - Y, 0.28, [4, 4, 6, 8][detail]);
    if (detail > 1) {
      if (detail === 3) B('trim', x, c.baseY - Y, z, 0.75, 0.2, 0.75);
      B('trim', x, top - Y - 0.22, z, 0.78, 0.22, 0.78);
    }
  }
  // Raised central hall and supported pediments at both long elevations.
  B('wall', 0, 19.7, -20.5, 20, 3.3, 40.7);
  const gable = (z, sign) => {
    const tri = [
        [-10, Y + 23, z],
        [10, Y + 23, z],
        [0, Y + 26.2, z],
      ],
      back = tri.map((p) => [p[0], p[1], z - sign * 0.65]);
    f('trim', tri, [0, 0, sign]);
    f('trim', back, [0, 0, -sign]);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      f('trim', [tri[i], back[i], back[j], tri[j]], [0, i === 0 ? -1 : 1, 0]);
    }
    if (detail) {
      B('trim', 0, 22.65, z - sign * 0.2, 20.5, 0.5, 1);
      bar('trim', [-10.15, 23.1, z + sign * 0.08], [0, 26.36, z + sign * 0.08], 0.28);
      bar('trim', [0, 26.36, z + sign * 0.08], [10.15, 23.1, z + sign * 0.08], 0.28);
    }
    if (detail > 1)
      for (const x of [-6, -3, 0, 3, 6])
        B('trim', x, 23.5, z + sign * 0.1, 1.3, 1.5 - Math.abs(x) * 0.12, 0.22);
  };
  gable(0.04, 1);
  gable(-41, -1);
  f(
    'roof',
    [
      [-10, Y + 23, -41],
      [0, Y + 26.2, -41],
      [0, Y + 26.2, 0],
      [-10, Y + 23, 0],
    ],
    [-1, 1, 0],
  );
  f(
    'roof',
    [
      [0, Y + 26.2, -41],
      [10, Y + 23, -41],
      [10, Y + 23, 0],
      [0, Y + 26.2, 0],
    ],
    [1, 1, 0],
  );
  // Roof courts are covered by opaque reflected glazing, as in the ordinary aerial.
  const barrel = (q) => {
    const n = [2, 3, 6, 10][detail],
      edge = (u) =>
        Array.from({ length: n + 1 }, (_, i) => {
          const t = i / n,
            a = q.outline[0].map((v, k) => v * (1 - t) + q.outline[3][k] * t),
            b = q.outline[1].map((v, k) => v * (1 - t) + q.outline[2][k] * t);
          return [
            a[0] * (1 - u) + b[0] * u,
            Y + 19.9 + 2.2 * Math.sin(t * Math.PI),
            a[1] * (1 - u) + b[1] * u,
          ];
        });
    const left = edge(0),
      right = edge(1);
    for (let i = 0; i < n; i++)
      f('glass', [left[i], right[i], right[i + 1], left[i + 1]], [0, 1, 0]);
    f('glass', [...left.toReversed(), [left[0][0], Y + 19.7, left[0][2]]], [-1, 0, 0]);
    f('glass', [...right, [right[0][0], Y + 19.7, right[0][2]]], [1, 0, 0]);
    for (const i of [0, n])
      f(
        'glass',
        [
          left[i],
          right[i],
          [right[i][0], Y + 19.7, right[i][2]],
          [left[i][0], Y + 19.7, left[i][2]],
        ],
        [0, 0, i === 0 ? -1 : 1],
      );
    if (detail) {
      const count = [0, 3, 8, 12][detail];
      for (let k = 0; k <= count; k++) {
        const points = edge(k / count);
        for (let i = 0; i < n; i++)
          bar(
            'frame',
            points[i].map((v, j) => v - (j === 1 ? Y - 0.05 : 0)),
            points[i + 1].map((v, j) => v - (j === 1 ? Y - 0.05 : 0)),
            0.08,
          );
      }
      for (let i = 0; i <= n; i++)
        bar(
          'frame',
          left[i].map((v, j) => v - (j === 1 ? Y - 0.05 : 0)),
          right[i].map((v, j) => v - (j === 1 ? Y - 0.05 : 0)),
          0.08,
        );
    }
  };
  for (const q of r.glazedCourts) barrel(q);
  for (const dome of r.domes) {
    const [x, z] = dome.center,
      radius = dome.radius;
    B('wall', x, 19.7, z, radius * 2 + 0.5, 0.45, radius * 2 + 0.5);
    const n = [8, 12, 16, 24][detail],
      bands = [2, 3, 4, 6][detail];
    for (let j = 0; j < bands; j++) {
      const ring = (k) => {
          const u = k / bands,
            rr = radius * (1 - u * 0.85);
          return Array.from({ length: n }, (_, i) => {
            const a = (i * Math.PI * 2) / n;
            return [
              x + Math.cos(a) * rr,
              Y + 20.15 + 2.6 * Math.sin((u * Math.PI) / 2),
              z + Math.sin(a) * rr,
            ];
          });
        },
        low = ring(j),
        high = ring(j + 1);
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n;
        f(
          'roof',
          [low[i], low[k], high[k], high[i]],
          [(low[i][0] + low[k][0]) / 2 - x, 1, (low[i][2] + low[k][2]) / 2 - z],
        );
      }
      if (j === bands - 1) f('glass', high, [0, 1, 0]);
    }
    if (detail)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        bar(
          'frame',
          [x + (radius - 0.05) * Math.cos(a), 20.2, z + (radius - 0.05) * Math.sin(a)],
          [x + radius * 0.15 * Math.cos(a), 22.8, z + radius * 0.15 * Math.sin(a)],
          0.065,
        );
      }
  }
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
  if (!detail) return;
  for (const b of r.facade) {
    const [x, z] = b.center,
      t = b.tangent,
      n = b.normal,
      wide = Math.min(2.6, b.spacing - 1.1);
    const g = (role, ps, normal) =>
      f(
        role,
        ps.map(([u, y, d]) => [x + u * t[0] + d * n[0], y, z + u * t[1] + d * n[1]]),
        [normal[0] * t[0] + normal[2] * n[0], normal[1], normal[0] * t[1] + normal[2] * n[1]],
      );
    for (const [y, h] of [
      [0.85, 3.4],
      [7, 4.5],
      [14, 2.8],
    ]) {
      // Ground east windows are behind the real colonnade; upper bays follow map edges.
      const depth = 0.035;
      pane('glass', x + n[0] * depth, y, z + n[1] * depth, wide, h, t, n);
      if (detail === 2) {
        for (const u of [-wide / 2, wide / 2])
          pane(
            'trim',
            x + u * t[0] + n[0] * (depth + 0.05),
            y - 0.05,
            z + u * t[1] + n[1] * (depth + 0.05),
            0.16,
            h + 0.15,
            t,
            n,
          );
        box(g, 'trim', 0, Y + y - 0.18, depth + 0.08, wide + 0.35, 0.2, 0.23);
        pane(
          'trim',
          x + n[0] * (depth + 0.08),
          y + h,
          z + n[1] * (depth + 0.08),
          wide + 0.5,
          0.22,
          t,
          n,
        );
        pane('frame', x + n[0] * (depth + 0.14), y, z + n[1] * (depth + 0.14), 0.09, h, t, n);
      } else if (detail === 3) {
        for (const u of [-wide / 2, wide / 2])
          box(g, 'trim', u, Y + y - 0.05, depth + 0.05, 0.16, h + 0.15, 0.16);
        box(g, 'trim', 0, Y + y - 0.18, depth + 0.08, wide + 0.35, 0.2, 0.23);
        box(g, 'trim', 0, Y + y + h, depth + 0.08, wide + 0.5, 0.22, 0.25);
        pane('frame', x + n[0] * (depth + 0.14), y, z + n[1] * (depth + 0.14), 0.09, h, t, n);
      }
    }
    if (detail > 1)
      for (const y of [5.4, 12.2, 18.5, 19.35])
        box(g, 'trim', 0, Y + y, 0.15, b.spacing, 0.25, 0.45);
    if (detail === 3) {
      for (const y of [8.2, 15.2])
        pane('frame', x + n[0] * 0.17, y, z + n[1] * 0.17, wide, 0.085, t, n);
    }
  }
  for (const sign of [1, -1]) {
    const z = sign > 0 ? 0.08 : -41.04;
    for (const [y, h] of [
      [6.4, 5.6],
      [13.1, 6.0],
    ]) {
      pane('glass', 0, y, z, 11.8, h, [1, 0], [0, sign]);
      for (const x of [-6.1, -2, 2, 6.1]) {
        column('trim', x, z + sign * 0.22, y, y + h, 0.24);
        if (detail > 1) {
          B('trim', x, y + h - 0.12, z + sign * 0.2, 0.72, 0.24, 0.6);
          B('trim', x, y, z + sign * 0.2, 0.66, 0.18, 0.6);
        }
      }
      B('trim', 0, y + h, z + sign * 0.15, 13.2, 0.35, 0.65);
    }
  }
  // Recessed lower entrance is behind the colonnade, never a flat door painted on its outer edge.
  pane('glass', 0, 0.05, -1.18, 3.36, 3.45);
  if (detail > 1) {
    B('frame', 0, 0.05, -1.15, 0.09, 3.45, 0.07);
    B('frame', 0, 2.5, -1.14, 3.3, 0.08, 0.07);
  }
  if (detail > 1)
    for (const x of [-38, -30, -22, 20, 28, 36]) {
      B('roof', x, 19.7, -5.9, 2.1, 1.2, 2.3);
      B('glass', x, 20.9, -5.9, 1.65, 0.15, 1.8);
      B('roof', x, 19.7, -36.5, 2.1, 1.2, 2.3);
      B('glass', x, 20.9, -36.5, 1.65, 0.15, 1.8);
    }
}
