/** Whole native Boughton House and open courtyard; bounded photographic roof partitions. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters,
  R = p.derivedRoofRegions;
const C = {
  stone: rgb('c9c1a9'),
  brick: rgb('a07964'),
  roof: rgb('747469'),
  wood: rgb('d8d3c5'),
  glass: rgb('344441'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.08 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  triangulate = (r, h = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      h.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  native = f.geometry.outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
  court = f.geometry.holes[0].slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
  partEvidence = [],
  openingEvidence = [],
  arcadeEvidence = [],
  dormerEvidence = [],
  chimneyEvidence = [],
  stairEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function cap(o, k, r, y) {
  for (const t of triangulate(r))
    T(
      o,
      k,
      t.map((i) => [r[i][0], y, r[i][1]]),
      [0, 1, 0],
    );
}
function solid(o, k, r, y, Y) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
  cap(o, k, r, Y);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  box = (o, k, x, y, z, w, h, d) =>
    solid(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, y + h),
  B = (o, k, a, b, w, d) => beam(o, k, toWorld(a), toWorld(b), w, d, C[k]);
function clip(r, a, b, c) {
  const out = [],
    inside = (q) => a * q[0] + b * q[1] <= c + 1e-8;
  for (let i = 0; i < r.length; i++) {
    const q = r[i],
      s = r[(i + 1) % r.length],
      I = inside(q),
      J = inside(s);
    if (I) out.push(q);
    if (I !== J) {
      const t = (c - a * q[0] - b * q[1]) / (a * (s[0] - q[0]) + b * (s[1] - q[1]));
      out.push(q.map((v, k) => v + (s[k] - v) * t));
    }
  }
  return out.filter((q, i, r) => !i || Math.hypot(...sub(q, r[i - 1])) > 1e-7);
}
function clipped(r, b) {
  for (const [a, c, d] of [
    [-1, 0, -b[0]],
    [1, 0, b[1]],
    [0, -1, -b[2]],
    [0, 1, b[3]],
  ])
    r = clip(r, a, c, d);
  return r;
}
function section(q) {
  const [x, z] = q;
  if (x < -20.955 && z < -17.23)
    return { name: 'north-west-pavilion', eave: A.northEave, bounds: R.northWest, mansard: true };
  if (x >= 9.004 && x < 21.46 && z < -15.67)
    return { name: 'north-east-pavilion', eave: A.northEave, bounds: R.northEast, mansard: true };
  if (x >= -20.955 && x < 9.004 && z < -5.5)
    return {
      name: 'north-nine-bay-main-range',
      eave: A.northEave,
      bounds: R.northCenter,
      mansard: true,
    };
  if (x < -20.955) return { name: 'long-west-balustraded-range', eave: A.westEave, flat: true };
  if (x >= 21.46) return { name: 'eastern-attached-spur', eave: A.eastEave, bounds: R.easternSpur };
  if (x >= 9.004)
    return { name: 'eastern-seven-bay-range', eave: A.eastEave, bounds: R.easternRange };
  return { name: 'earlier-courtyard-and-hall-ranges', eave: A.courtEave, bounds: R.courtHall };
}
function planes(s) {
  if (s.flat) return [[0, 0, 0]];
  const [x, X, z, Z] = s.bounds,
    k = s.mansard ? 1.42 : 0.8,
    rows = [
      [k, 0, -k * x],
      [-k, 0, k * X],
      [0, k, -k * z],
      [0, -k, k * Z],
    ];
  if (s.mansard)
    rows.push(
      ...[
        [0.24, 0, 2.825352 - 0.24 * x],
        [-0.24, 0, 2.825352 + 0.24 * X],
        [0, 0.24, 2.825352 - 0.24 * z],
        [0, -0.24, 2.825352 + 0.24 * Z],
      ],
      [0, 0, A.northRoofTop - s.eave],
    );
  else rows.push([0, 0, (s.name.includes('earlier') ? A.courtRoofTop : A.eastRoofTop) - s.eave]);
  return rows;
}
export function roofHeight(q, s = section(q)) {
  return s.eave + Math.max(0, Math.min(...planes(s).map(([a, b, c]) => a * q[0] + b * q[1] + c)));
}
const footprint = [...native, ...court],
  footTriangles = triangulate(native, [court]).map((t) => t.map((i) => footprint[i])),
  cells = [];
for (let i = 0; i < R.xBreaks.length - 1; i++)
  for (let j = 0; j < R.zBreaks.length - 1; j++) {
    const b = [R.xBreaks[i], R.xBreaks[i + 1], R.zBreaks[j], R.zBreaks[j + 1]];
    cells.push({ bounds: b, section: section([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]) });
  }
function roofs(o, lod) {
  if (lod === 0) {
    for (const tri of footTriangles)
      T(
        o,
        'roof',
        tri.map((q) => [q[0], roofHeight(q), q[1]]),
        [0, 1, 0],
      );
    for (const b of [R.northWest, R.northCenter, R.northEast]) {
      const rings = [
        [0, A.northEave],
        [2.4, A.northMansardBreak],
        [4.5, A.northRoofTop],
      ].map(([d, y]) => rect(b[0] + d, b[1] - d, b[2] + d, b[3] - d).map((q) => [q[0], y, q[1]]));
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < 4; i++)
          Q(
            o,
            'roof',
            [rings[j - 1][i], rings[j - 1][(i + 1) % 4], rings[j][(i + 1) % 4], rings[j][i]],
            [0, 1, 0],
          );
      cap(
        o,
        'roof',
        rings.at(-1).map((q) => [q[0], q[2]]),
        A.northRoofTop,
      );
    }
    return;
  }
  for (const cell of cells) {
    const ps = planes(cell.section);
    for (const tri of footTriangles) {
      const r = clipped(tri, cell.bounds);
      if (r.length < 3) continue;
      for (let k = 0; k < ps.length; k++) {
        const P = ps[k];
        let piece = r;
        for (let j = 0; j < ps.length; j++)
          if (j !== k) {
            const H = ps[j];
            piece = clip(piece, P[0] - H[0], P[1] - H[1], H[2] - P[2]);
          }
        for (const [poly, flat] of [
          [clip(piece, -P[0], -P[1], P[2]), false],
          [clip(piece, P[0], P[1], -P[2]), true],
        ]) {
          if (poly.length < 3 || Math.abs(area(poly)) < 1e-8) continue;
          if (flat && P.every((v) => v === 0)) continue;
          const height = (q) => cell.section.eave + (flat ? 0 : P[0] * q[0] + P[1] * q[1] + P[2]);
          for (let i = 1; i < poly.length - 1; i++)
            T(
              o,
              cell.section.flat ? 'stone' : 'roof',
              [poly[0], poly[i], poly[i + 1]].map((q) => [q[0], height(q), q[1]]),
              [0, 1, 0],
            );
        }
      }
    }
  }
}
function panel(a, b, r, inward = false) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((x) => x / L),
    s = (area(r) > 0 ? 1 : -1) * (inward ? -1 : 1),
    n = [s * u[1], -s * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function plane(o, k, f, l, r, y, Y, v = 0) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]]);
}
function rectangle(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function arch(x, lod) {
  const r = A.loggiaRadius,
    s = A.loggiaSpring,
    N = [4, 8, 12, 20][lod],
    out = [
      [x - r, A.loggiaSill],
      [x + r, A.loggiaSill],
      [x + r, s],
    ];
  for (let i = 1; i <= N; i++) {
    const t = (i * Math.PI) / N;
    out.push([x + r * Math.cos(t), s + r * Math.sin(t)]);
  }
  return out;
}
function facade(o, k, f, Y, holes, lod, name, open = false) {
  if (f.L < 1e-6) return;
  const outer = [
      [0, A.foundationBottom],
      [f.L, A.foundationBottom],
      [f.L, Y],
      [0, Y],
    ],
    cuts = holes.map((h) => h.ring),
    all = [...outer, ...cuts.flat()];
  for (const ix of triangulate(outer, cuts))
    T(
      o,
      k,
      ix.map((i) => f.P(...all[i])),
      [f.n[0], 0, f.n[1]],
    );
  for (const h of holes) {
    const isOpen = h.open ?? open,
      D = isOpen ? A.loggiaDepth : A.windowDepth,
      r = h.ring;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        n = [(b[1] - a[1]) * f.u[0], a[0] - b[0], (b[1] - a[1]) * f.u[1]];
      Q(
        o,
        k,
        [f.P(...a), f.P(...b), f.P(...b, -D), f.P(...a, -D)],
        n.map((v) => -v),
      );
    }
    if (!isOpen) {
      const center = [h.x, h.y + h.h / 2];
      for (const ix of triangulate(r))
        T(
          o,
          h.material ?? 'glass',
          ix.map((i) => f.P(...r[i], -D)),
          [f.n[0], 0, f.n[1]],
        );
      openingEvidence.push({ name, center: f.P(...center), normal: [f.n[0], 0, f.n[1]], depth: D });
      if (lod >= 2 && !h.round) {
        for (const t of [h.x - h.w / 2 - 0.07, h.x + h.w / 2 + 0.07])
          B(o, 'wood', f.P(t, h.y - 0.08, 0.04), f.P(t, h.y + h.h + 0.08, 0.04), 0.12, 0.12);
        for (const yy of [h.y - 0.08, h.y + h.h + 0.08])
          B(
            o,
            'wood',
            f.P(h.x - h.w / 2 - 0.13, yy, 0.05),
            f.P(h.x + h.w / 2 + 0.13, yy, 0.05),
            0.12,
            0.16,
          );
        B(o, 'wood', f.P(h.x, h.y, -D + 0.03), f.P(h.x, h.y + h.h, -D + 0.03), 0.05, 0.05);
        const bars = lod === 3 ? 5 : 1;
        for (let j = 1; j <= bars; j++) {
          const y = h.y + (h.h * j) / (bars + 1);
          B(
            o,
            'wood',
            f.P(h.x - h.w / 2, y, -D + 0.04),
            f.P(h.x + h.w / 2, y, -D + 0.04),
            0.04,
            0.04,
          );
        }
      }
    } else arcadeEvidence.push({ center: f.P(h.x, 2.2), normal: [f.n[0], 0, f.n[1]], depth: D });
  }
}
function splitEdge(a, b) {
  const ts = [0, 1],
    d = sub(b, a);
  for (const [axis, breaks] of [
    [0, R.xBreaks],
    [1, R.zBreaks],
  ])
    if (Math.abs(d[axis]) > 1e-9)
      for (const v of breaks) {
        const t = (v - a[axis]) / d[axis];
        if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
      }
  ts.sort((a, b) => a - b);
  return ts
    .slice(1)
    .map((t, i) => [a.map((v, k) => v + d[k] * ts[i]), a.map((v, k) => v + d[k] * t)]);
}
function body(o, lod) {
  for (const [ring, hole] of [
    [native, false],
    [court, true],
  ])
    for (let i = 0; i < ring.length; i++)
      for (const [a, b] of splitEdge(ring[i], ring[(i + 1) % ring.length])) {
        const f = panel(a, b, ring, hole),
          mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          s = section(mid),
          front = !hole && i === 20,
          holes = [];
        if (front && f.L > 20) {
          for (let j = 0; j < 9; j++) {
            const x = (f.L * (j + 0.5)) / 9,
              w = 1.6,
              h = 3.8,
              y = 6.7;
            holes.push({ x, ring: arch(x, lod), open: true });
            if (lod > 0) holes.push({ x, w, h, y, ring: rectangle(x, y, w, h), open: false });
            else plane(o, 'glass', f, x - w / 2, x + w / 2, y, y + h, 0.02);
            if (lod >= 2)
              B(
                o,
                'stone',
                f.P(x - f.L / 18 + 0.14, 6.15, 0.12),
                f.P(x - f.L / 18 + 0.14, 12.1, 0.12),
                0.18,
                0.16,
              );
          }
          facade(o, 'stone', f, s.eave, holes, lod, 'north-loggia-and-upper-sash');
          const rear = { ...f, P: (t, y, v = 0) => f.P(t, y, v - A.loggiaDepth) },
            wins = [];
          for (let j = 0; j < 8; j++) {
            const x = (f.L * (j + 1)) / 9,
              w = 0.65,
              h = 0.65,
              y = 2.2,
              N = lod === 0 ? 4 : lod === 1 ? 8 : 16;
            const ring = Array.from({ length: N }, (_, i) => [
              x + (w / 2) * Math.cos((i * 2 * Math.PI) / N),
              y + h / 2 + (h / 2) * Math.sin((i * 2 * Math.PI) / N),
            ]);
            if (lod === 0)
              for (const ix of triangulate(ring))
                T(
                  o,
                  'glass',
                  ix.map((i) => rear.P(...ring[i], 0.02)),
                  [rear.n[0], 0, rear.n[1]],
                );
            else wins.push({ x, w, h, y, ring, round: true });
          }
          for (const j of [0, 4, 8]) {
            const x = (f.L * (j + 0.5)) / 9,
              w = 1.3,
              h = 3.6,
              y = 0.35;
            wins.push({ x, w, h, y, ring: rectangle(x, y, w, h), material: 'wood' });
          }
          facade(o, 'stone', rear, 6, wins, lod, 'loggia-rear-oculus-approximations');
        } else {
          const n = Math.max(
            0,
            Math.floor(f.L / (lod === 0 ? 9 : lod === 1 ? 6.6 : lod === 2 ? 6.2 : 4.0)),
          );
          for (let j = 0; j < n; j++) {
            const x = (f.L * (j + 0.5)) / n,
              w = Math.min(1.55, (f.L / n) * 0.46);
            for (const [y, h] of s.eave > 11
              ? [
                  [1.35, 3.5],
                  [6.7, 3.8],
                ]
              : s.eave > 9
                ? [
                    [1.15, 2.9],
                    [5.6, 3.2],
                  ]
                : [
                    [1.1, 2.45],
                    [4.7, 2.25],
                  ])
              holes.push({ x, w, h, y, ring: rectangle(x, y, w, h) });
          }
          if (lod === 0) {
            plane(o, hole ? 'brick' : 'stone', f, 0, f.L, A.foundationBottom, s.eave);
            for (const h of holes)
              plane(o, 'glass', f, h.x - h.w / 2, h.x + h.w / 2, h.y, h.y + h.h, 0.018);
          } else
            facade(
              o,
              hole ? 'brick' : 'stone',
              f,
              s.eave,
              holes,
              lod,
              hole ? 'courtyard-cross-casements' : 'outer-cross-casements',
            );
        }
        if (f.L > 0.05) {
          const H0 = roofHeight(a, s),
            H1 = roofHeight(b, s);
          Q(
            o,
            s.flat ? 'stone' : 'roof',
            [f.P(0, s.eave), f.P(f.L, s.eave), f.P(f.L, H1), f.P(0, H0)],
            [f.n[0], 0, f.n[1]],
          );
          for (const y of lod === 0 ? [s.eave] : [s.eave - 0.28, s.eave]) {
            plane(o, 'stone', f, 0, f.L, y, y + 0.13, 0.16);
            if (lod >= 1)
              Q(
                o,
                'stone',
                [
                  f.P(0, y + 0.13),
                  f.P(f.L, y + 0.13),
                  f.P(f.L, y + 0.13, 0.25),
                  f.P(0, y + 0.13, 0.25),
                ],
                [0, 1, 0],
              );
          }
          if (!front && s.eave > 9) plane(o, 'stone', f, 0, f.L, 5.0, 5.16, 0.09);
        }
      }
}
function dormer(o, lod, x, z, side, index, name, eave = A.northEave) {
  const w = 1.45,
    bottom = eave + 0.75,
    top = eave + 2.85,
    u = side === 'north' ? [1, 0] : [0, 1],
    n = side === 'north' ? [0, -1] : side === 'east' ? [1, 0] : [-1, 0],
    P = (t, y, v = 0) => [x + u[0] * t + n[0] * v, y, z + u[1] * t + n[1] * v],
    r = [P(-w / 2, 0), P(w / 2, 0), P(w / 2, 0, -1.9), P(-w / 2, 0, -1.9)].map((q) => [q[0], q[2]]);
  if (lod === 0) {
    Q(
      o,
      'stone',
      [P(-w / 2, bottom), P(w / 2, bottom), P(w / 2, top), P(-w / 2, top)],
      [n[0], 0, n[1]],
    );
    Q(
      o,
      'roof',
      [P(-w / 2, top), P(w / 2, top), P(w / 2, top, -1.9), P(-w / 2, top, -1.9)],
      [0, 1, 0],
    );
    T(
      o,
      'stone',
      [P(-w / 2, top, 0.01), P(w / 2, top, 0.01), P(0, top + 0.5, 0.01)],
      [n[0], 0, n[1]],
    );
    plane(o, 'glass', { P, n }, -w * 0.34, w * 0.34, bottom + 0.16, top - 0.22, 0.02);
    dormerEvidence.push({ name, center: P(0, bottom + 0.9), pediment: 'triangular' });
    return;
  }
  solid(o, 'stone', r, bottom, top);
  plane(
    o,
    'glass',
    { P: (t, y, v = 0) => P(t, y, v), n },
    -w * 0.34,
    w * 0.34,
    bottom + 0.16,
    top - 0.22,
    0.025,
  );
  if (lod >= 2) B(o, 'wood', P(0, bottom + 0.15, 0.045), P(0, top - 0.2, 0.045), 0.06, 0.06);
  const segment = index % 2 && lod > 0,
    N = segment ? 8 : 2,
    points = Array.from({ length: N + 1 }, (_, j) => {
      const t = j / N;
      return P(
        -w * 0.6 + w * 1.2 * t,
        top + (segment ? 0.38 * Math.sin(Math.PI * t) : 0.52 * (1 - Math.abs(t * 2 - 1))),
        0.1,
      );
    });
  for (let j = 1; j < points.length; j++)
    T(o, 'stone', [P(0, top, 0.1), points[j - 1], points[j]], [n[0], 0, n[1]]);
  Q(
    o,
    'roof',
    [
      P(-w * 0.6, top, 0.05),
      P(w * 0.6, top, 0.05),
      P(w * 0.6, top, -2.05),
      P(-w * 0.6, top, -2.05),
    ],
    [0, 1, 0],
  );
  dormerEvidence.push({
    name,
    center: P(0, bottom + 0.9),
    pediment: segment ? 'segmental' : 'triangular',
  });
}
function details(o, lod) {
  solid(o, 'stone', rect(-20.955, 9.004, -22.06, -19.26), 0.18, A.loggiaSill);
  const step = lod === 0 ? 3 : 1;
  for (let j = 0; j < 9; j += step)
    dormer(
      o,
      lod,
      -20.955 + (29.959 * (j + 0.5)) / 9,
      -21.6,
      'north',
      j,
      'north-main-nine-dormers',
    );
  for (const [bounds, name] of [
    [R.northWest, 'north-west-pavilion'],
    [R.northEast, 'north-east-pavilion'],
  ])
    for (let j = 0; j < 3; j += lod === 0 ? 2 : 1)
      dormer(
        o,
        lod,
        bounds[0] + ((bounds[1] - bounds[0]) * (j + 0.5)) / 3,
        bounds[2] + 0.48,
        'north',
        j,
        name,
      );
  if (lod >= 1)
    for (let j = 0; j < 4; j++)
      dormer(o, lod, -34.78, -33 + (j + 0.5) * 3.8, 'west', j, 'west-pavilion-side');
  for (let j = 0; j < 6; j += lod === 0 ? 3 : 1)
    dormer(
      o,
      lod === 1 ? 0 : lod,
      18.9,
      -9 + (j + 0.5) * 4,
      'east',
      j,
      'eastern-six-dormers',
      A.eastEave,
    );
  const stacks = [
    [-30, -25],
    [-27, -8],
    [14, -28],
    [16, -6],
    [-26, 18],
    [4, 27],
    [16, 15],
    [30, 19],
  ];
  for (const [i, [x, z]] of stacks.entries()) {
    if (lod === 0 && i % 2) continue;
    const y = roofHeight([x, z]),
      top = z < 0 ? A.chimneyTop : 17.4;
    box(o, 'stone', x, y - 0.3, z, 1.35, Math.max(1.7, top - y), 0.9);
    if (lod > 1) box(o, 'stone', x, Math.max(y + 1.4, top - 0.2), z, 1.6, 0.24, 1.12);
    chimneyEvidence.push({ center: [x, y, z], top: Math.max(y + 1.64, top + 0.04) });
  }
  const a = native[2],
    b = native[3],
    f = panel(a, b, native),
    Y = A.westBalustradeTop;
  B(o, 'stone', f.P(0, Y), f.P(f.L, Y), 0.28, 0.42);
  if (lod === 0) plane(o, 'stone', f, 0, f.L, A.westEave, Y, 0.03);
  else
    for (let j = 0; j <= Math.ceil(f.L / (lod === 1 ? 3.4 : 1.1)); j++) {
      const t = (f.L * j) / Math.ceil(f.L / (lod === 1 ? 3.4 : 1.1));
      B(o, 'stone', f.P(t, A.westEave), f.P(t, Y), 0.18, 0.18);
    }
  const z = -22.06;
  for (let j = 0; j < A.entrySteps; j++) {
    const y = (0.35 * j) / A.entrySteps;
    box(o, 'stone', -5.98, y - 0.09, z - 0.34 * (A.entrySteps - j), 3.2, 0.12, 0.34);
    stairEvidence.push({ center: [-5.98, y, z - 0.34 * (A.entrySteps - j)] });
  }
}
function inRing(q, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function roofJoins(o) {
  for (const [axis, breaks, crossBreaks] of [
    [0, R.xBreaks, R.zBreaks],
    [1, R.zBreaks, R.xBreaks],
  ])
    for (const value of breaks.slice(1, -1)) {
      const cuts = [...crossBreaks];
      for (const ring of [native, court])
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            den = b[axis] - a[axis];
          if (Math.abs(den) < 1e-10) continue;
          const t = (value - a[axis]) / den;
          if (t >= 0 && t <= 1) cuts.push(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]));
        }
      cuts.sort((a, b) => a - b);
      const unique = cuts.filter((v, i) => !i || v - cuts[i - 1] > 1e-7),
        q = (v) => (axis === 0 ? [value, v] : [v, value]);
      for (let k = 1; k < unique.length; k++) {
        const lo = unique[k - 1],
          hi = unique[k],
          mid = q((lo + hi) / 2);
        if (!inRing(mid, native) || inRing(mid, court)) continue;
        const a = section(mid.map((v, i) => v + (i === axis ? -0.00001 : 0))),
          b = section(mid.map((v, i) => v + (i === axis ? 0.00001 : 0)));
        if (a.name === b.name) continue;
        const ticks = [lo, hi];
        for (const s of [a, b]) {
          const P = planes(s).map((p) => [p[1 - axis], p[axis] * value + p[2]]);
          for (let i = 0; i < P.length; i++) {
            const roots = [[...P[i]]];
            for (let j = i + 1; j < P.length; j++)
              roots.push([P[i][0] - P[j][0], P[i][1] - P[j][1]]);
            for (const [m, c] of roots)
              if (Math.abs(m) > 1e-10) {
                const v = -c / m;
                if (v > lo && v < hi) ticks.push(v);
              }
          }
        }
        ticks.sort((a, b) => a - b);
        const nodes = ticks
          .filter((v, i) => !i || v - ticks[i - 1] > 1e-7)
          .map((v) => [v, roofHeight(q(v), a), roofHeight(q(v), b)]);
        for (let i = 1; i < nodes.length - 1; ) {
          const x = nodes[i - 1],
            y = nodes[i],
            z = nodes[i + 1],
            t = (y[0] - x[0]) / (z[0] - x[0]);
          if ([1, 2].every((j) => Math.abs(y[j] - (x[j] + t * (z[j] - x[j]))) < 1e-6))
            nodes.splice(i, 1);
          else i++;
        }
        for (let i = 1; i < nodes.length; i++) {
          const x = nodes[i - 1],
            y = nodes[i];
          if (Math.max(Math.abs(x[1] - x[2]), Math.abs(y[1] - y[2])) < 1e-6) continue;
          const Q3 = (v, h) => {
              const t = q(v);
              return [t[0], h, t[1]];
            },
            n =
              axis === 0
                ? [x[1] + y[1] > x[2] + y[2] ? 1 : -1, 0, 0]
                : [0, 0, x[1] + y[1] > x[2] + y[2] ? 1 : -1];
          Q(o, 'stone', [Q3(x[0], x[1]), Q3(y[0], y[1]), Q3(y[0], y[2]), Q3(x[0], x[2])], n);
        }
      }
    }
}
export function buildBoughtonHouse(target, _frame, lod = 3) {
  for (const e of [
    partEvidence,
    openingEvidence,
    arcadeEvidence,
    dormerEvidence,
    chimneyEvidence,
    stairEvidence,
  ])
    e.length = 0;
  let count = 0;
  const out = {
      addTriangle(...args) {
        count++;
        target.addTriangle(...args);
      },
      addQuad(...args) {
        count += 2;
        target.addQuad(...args);
      },
      addConvexPolygon(...args) {
        count += args[2].length - 2;
        target.addConvexPolygon(...args);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-native23-outer8-courtyard-facades-and-real-open-loggia', () => body(out, lod));
  part('whole-native-multi-range-roof-with-open-courtyard', () => {
    roofs(out, lod);
    roofJoins(out);
  });
  part('mansard-dormers-stacks-west-balustrade-and-four-entry-treads', () => details(out, lod));
}
export const boughtonHouseSkyline = (o) => buildBoughtonHouse(o, null, 0),
  boughtonHouseDistrict = (o) => buildBoughtonHouse(o, null, 1),
  boughtonHouseStreet = (o) => buildBoughtonHouse(o, null, 2),
  boughtonHouseCloseup = (o) => buildBoughtonHouse(o, null, 3);
const cam = (q) => toWorld(q);
export const boughtonHouseModel = {
  id: 'boughton_house',
  key: 'boughton_house',
  cell: 'gc/gcr',
  title: 'Boughton House',
  wikidataId: 'Q4949432',
  category: 'historic-residence',
  recipe: 'boughton-house-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBoughtonHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole native23-control Boughton House with eight-control open court, north half-H stone range/three mansard roofs/physical dormers, nine real open loggia bays/upper sash windows, long west balustraded range, eastern and earlier brick courtyard ranges, stone stacks and intrinsic entry treads. Four exact public-domain CharlesLatham1909 photographs after Qualla-first31family search. Roof/court subdivisions/heights/hidden/current details bounded original estimates.',
  camera: cam([100, 65, -130]),
  lookAt: cam([0, 7, 0]),
  portableGroundY: F - 0.5,
  mediumFiContext: { scale: 1.35, cameraYaw: Math.PI, groundY: F - 0.5 },
  embeddedCanonicalGraphs: ['stone_limestone', 'brick', 'tile_flat', 'wood_plain'],
  qaCameras: [
    {
      name: 'whole-north-half-h-mansards-and-open-loggia',
      position: cam([60, 38, -110]),
      lookAt: cam([-6, 8, -17]),
    },
    {
      name: 'west-balustraded-and-earlier-ranges',
      position: cam([-105, 45, 25]),
      lookAt: cam([-21, 7, 3]),
    },
    {
      name: 'native-open-eight-control-courtyard',
      position: cam([-10, 65, 12]),
      lookAt: cam([-10, 3, 12]),
    },
    { name: 'north-nine-bay-open-arcade', position: cam([-6, 8, -42]), lookAt: cam([-6, 3, -20]) },
    {
      name: 'whole-eastern-and-south-ranges',
      position: cam([105, 55, 100]),
      lookAt: cam([9, 7, 3]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/boughton-house-runtime-overlay.mjs',
    level: 'skyline',
    export: 'boughtonHouseSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'boughtonHouseDistrict', errorMeters: 1, surfaces },
      street: { export: 'boughtonHouseStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'boughtonHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'All23nativeouter and8nativecourt controls retained; court stays open. Native wall polygons do not measure roof subdivisions/hidden courtyards or heights. Mansard/range/hip joins/oculus approximations/window census/stone colors/current repairs are bounded original photographic/listing-text estimates; no survey, exact current fitout or interior reconstruction.',
    'Only four exact1909CharlesLatham public-domain original book photographs adopted after publishedQualla31families first. Exact named creator1847-1912, dated library book/photographic attribution and explicit nativePD-old-70-1923 retained. No source photograph pixels/ivy/gardens/trees/detachedstables/gates/estateparcel or protected listing imagery embedded.',
    'Original512m129field/fourrawtiles/frame frozen before fixed floor/mainsections/geometry. No field/floor fitting, flattening, replacement, reframing, reacquisition or raising. Exact threshold/courtyard/foundation contact unverified; preview/replacement false.',
  ],
};
