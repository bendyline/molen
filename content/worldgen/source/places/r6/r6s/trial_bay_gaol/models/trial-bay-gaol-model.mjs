/** Surviving native gaol compound; open yards and roofless cells remain real voids. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections;
const C = {
    stone: rgb('b6b2a4'),
    cell: rgb('93988f'),
    metal: rgb('5c655e'),
    roof: rgb('a57653'),
    sheet: rgb('c1c6be'),
    dark: rgb('656861'),
  },
  colors = ['b5b0a2', 'bab5a6', 'ada99c', 'b3af9f', 'a8a99d', 'bdb9ac'].map(rgb);
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  cell: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.1 },
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  cellEvidence = [],
  towerEvidence = [],
  roofEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  G = (q) => [q[0], q[1] + F, q[2]],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  R = (id) => frame.features.find((f) => f.id === `way/${id}`).outline.slice(0, -1),
  bounds = (r) => ({
    x: Math.min(...r.map((q) => q[0])),
    X: Math.max(...r.map((q) => q[0])),
    z: Math.min(...r.map((q) => q[1])),
    Z: Math.max(...r.map((q) => q[1])),
  });
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => G(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function triangles(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-8 &&
            cr(r[b], r[c], r[k]) >= -1e-8 &&
            cr(r[c], r[a], r[k]) >= -1e-8,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid gaol polygon');
  }
  if (ids.length === 3 && Math.abs(cr(...ids.map((i) => r[i]))) > 1e-8) out.push(ids);
  return out;
}
function solid(o, k, r, y, Y, col = C[k]) {
  const sign = area(r) > 0 ? 1 : -1;
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
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  for (const ids of triangles(r))
    for (const h of [y, Y])
      T(
        o,
        k,
        ids.map((i) => [r[i][0], h, r[i][1]]),
        [0, h === y ? -1 : 1, 0],
        col,
      );
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  box = (o, k, x, X, y, Y, z, Z, col) => solid(o, k, rect(x, X, z, Z), y, Y, col);
function B(o, k, a, b, w, d, col = C[k]) {
  beam(o, k, G(a), G(b), w, d, col);
}
/** Extruded convex wall piece in segment-distance/height coordinates. */
function piece(o, k, a, b, depth, r, col = C[k]) {
  r = r.filter((v, i) => i === 0 || Math.hypot(...sub(v, r[i - 1])) > 1e-7);
  if (r.length < 3 || Math.abs(area(r)) < 1e-7) return;
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = [d[0] / L, d[1] / L],
    n = [u[1], -u[0]],
    P = (q, v) => [a[0] + u[0] * q[0] + n[0] * v, q[1], a[1] + u[1] * q[0] + n[1] * v];
  for (const ids of triangles(r))
    for (const v of [0, -depth])
      T(
        o,
        k,
        ids.map((i) => P(r[i], v)),
        [n[0] * (v === 0 ? 1 : -1), 0, n[1] * (v === 0 ? 1 : -1)],
        col,
      );
}
const archTop = (h, x) =>
  h.spring + Math.sqrt(Math.max(0, h.radius * h.radius - (x - h.center) * (x - h.center)));
/** Genuine through-openings, with inward returns and closed masonry around each arch. */
function wall(o, k, a, b, depth, y, Y, holes, lod, col = C[k], courses = false) {
  const L = Math.hypot(...sub(b, a)),
    N = [2, 4, 8, 16][lod],
    list = holes.filter((h) => h.center - h.radius > 0.02 && h.center + h.radius < L - 0.02),
    cuts = [0, L];
  for (const h of list)
    for (let i = 0; i <= (h.arch ? N : 1); i++)
      cuts.push(h.center - h.radius + (2 * h.radius * i) / (h.arch ? N : 1));
  const cs = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 1; i < cs.length; i++) {
    const l = cs[i - 1],
      r = cs[i],
      mid = (l + r) / 2,
      hs = list
        .filter((h) => mid > h.center - h.radius && mid < h.center + h.radius)
        .sort((a, b) => a.bottom - b.bottom);
    let bottomL = y,
      bottomR = y;
    for (const h of hs) {
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [l, bottomL],
          [r, bottomR],
          [r, h.bottom],
          [l, h.bottom],
        ],
        col,
      );
      bottomL = h.arch ? archTop(h, l) : h.top;
      bottomR = h.arch ? archTop(h, r) : h.top;
    }
    piece(
      o,
      k,
      a,
      b,
      depth,
      [
        [l, bottomL],
        [r, bottomR],
        [r, Y],
        [l, Y],
      ],
      col,
    );
  }
  const u = sub(b, a).map((v) => v / L),
    normal = [u[1], -u[0]],
    P = (q, d) => [a[0] + u[0] * q[0] + normal[0] * d, q[1], a[1] + u[1] * q[0] + normal[1] * d];
  const edge = (q, t, sign) => {
    const dx = t[0] - q[0],
      dy = t[1] - q[1];
    Q(
      o,
      k,
      [P(q, 0), P(t, 0), P(t, -depth), P(q, -depth)],
      [sign * u[0] * dy, -sign * dx, sign * u[1] * dy],
      col,
    );
  };
  const border = [
    [0, y],
    [L, y],
    [L, Y],
    [0, Y],
  ];
  for (let i = 0; i < 4; i++) if (lod > 0 || i === 2) edge(border[i], border[(i + 1) % 4], 1);
  for (const h of list) {
    const a = h.center - h.radius,
      b = h.center + h.radius,
      ring = [
        [a, h.bottom],
        [b, h.bottom],
      ];
    if (h.arch)
      for (let i = 0; i <= N; i++) {
        const x = b - ((b - a) * i) / N;
        ring.push([x, archTop(h, x)]);
      }
    else ring.push([b, h.top], [a, h.top]);
    for (let i = 0; i < ring.length; i++) edge(ring[i], ring[(i + 1) % ring.length], -1);
  }
  for (const h of list) openingEvidence.push({ kind: k, a, b, depth, ...h });
  if (!courses || lod < 2) return;
  const n = [u[1], -u[0]],
    row = lod === 2 ? 0.84 : 0.42,
    w = lod === 2 ? 4.8 : 1.9;
  for (let j = 0; j < Math.ceil((Y - y) / row); j++) {
    const yy = y + j * row + 0.018,
      YY = Math.min(Y - 0.012, yy + row - 0.034);
    if (YY <= yy) continue;
    for (let i = -1; i < Math.ceil(L / w); i++) {
      const l = Math.max(0.012, (i + (j % 2) * 0.5) * w + 0.016),
        r = Math.min(L - 0.012, (i + 1 + (j % 2) * 0.5) * w - 0.016);
      if (r <= l) continue;
      if (
        list.some(
          (h) =>
            r > h.center - h.radius - 0.1 &&
            l < h.center + h.radius + 0.1 &&
            YY > h.bottom - 0.04 &&
            yy < (h.arch ? h.spring + h.radius : h.top) + 0.04,
        )
      )
        continue;
      const P = (t, h, d) => [a[0] + u[0] * t + n[0] * d, h, a[1] + u[1] * t + n[1] * d],
        col2 = colors[(j * 7 + i * 13 + 600) % colors.length],
        dd = lod === 3 ? 0.035 : 0.012;
      Q(o, k, [P(l, yy, dd), P(r, yy, dd), P(r, YY, dd), P(l, YY, dd)], [n[0], 0, n[1]], col2);
      if (lod === 3) {
        Q(o, k, [P(l, YY, 0), P(l, YY, dd), P(r, YY, dd), P(r, YY, 0)], [0, 1, 0], col2);
        Q(o, k, [P(r, yy, 0), P(r, yy, dd), P(r, YY, dd), P(r, YY, 0)], [u[0], 0, u[1]], col2);
      }
    }
  }
}
function shell(o, id, y, Y, k, lod, { holes = null, courses = false, thickness = 0.5 } = {}) {
  const r = R(id),
    rr = area(r) > 0 ? r : r.slice().reverse();
  for (const q of r) nativeEvidence.push({ id, local: [q[0], Y, q[1]] });
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length];
    wall(o, k, a, b, thickness, y, Y, holes?.(a, b, i) ?? [], lod, C[k], courses);
  }
}
function roof(o, id, eave, ridge, col, lod) {
  const r = R(id),
    b = bounds(r),
    cx = (b.x + b.X) / 2,
    cz = (b.z + b.Z) / 2,
    spanX = b.X - b.x,
    spanZ = b.Z - b.z;
  // A continuous faceted hip over the exact concave native roof outline. Interior ridge/hips
  // are original sections; every native eave vertex is retained.
  const inner = r.map((q) => [cx + (q[0] - cx) * 0.55, cz + (q[1] - cz) * 0.55]);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    Q(
      o,
      'roof',
      [
        [r[i][0], eave, r[i][1]],
        [r[j][0], eave, r[j][1]],
        [inner[j][0], ridge, inner[j][1]],
        [inner[i][0], ridge, inner[i][1]],
      ],
      [0, 1, 0],
      col,
    );
  }
  for (const ix of triangles(inner))
    T(
      o,
      'roof',
      ix.map((i) => [inner[i][0], ridge, inner[i][1]]),
      [0, 1, 0],
      col,
    );
  if (lod >= 2)
    for (let i = 0; i < r.length; i++) {
      const q = r[i],
        t = r[(i + 1) % r.length];
      B(o, 'metal', [q[0], eave, q[1]], [t[0], eave, t[1]], 0.1, 0.12, C.sheet);
    }
  if (lod >= 2) {
    const N = Math.ceil(Math.max(spanX, spanZ) / 0.6);
    for (let i = 1; i < N; i++) {
      const t = i / N,
        xx = b.x + t * spanX;
      if (spanX > spanZ)
        B(o, 'roof', [xx, eave + 0.04, b.z], [xx, ridge + 0.04, cz], 0.035, 0.025, col);
    }
  }
  roofEvidence.push({ id, eave, ridge, originalEstimate: true });
}
function enclosingWall(o, lod) {
  const r = R(1069791216),
    rr = area(r) > 0 ? r : r.slice().reverse(),
    gate = bounds(R(1069791223));
  for (const q of r) nativeEvidence.push({ id: 1069791216, local: [q[0], A.wallHeight, q[1]] });
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length];
    if (
      a[0] > 46 &&
      b[0] > 46 &&
      Math.min(a[1], b[1]) >= gate.z - 0.1 &&
      Math.max(a[1], b[1]) <= gate.Z + 0.1
    )
      continue;
    wall(
      o,
      'stone',
      a,
      b,
      A.wallThickness,
      A.foundationBottom,
      A.wallHeight,
      [],
      lod,
      C.stone,
      true,
    );
    if (lod >= 2)
      B(
        o,
        'stone',
        [a[0], A.wallHeight + 0.05, a[1]],
        [b[0], A.wallHeight + 0.05, b[1]],
        0.9,
        0.18,
        colors[1],
      );
  }
}
function gate(o, lod) {
  const r = R(1069791223),
    b = bounds(r),
    cz = (b.z + b.Z) / 2,
    L = b.Z - b.z,
    a = [b.X, b.z],
    z = [b.X, b.Z],
    holes = [
      {
        center: L / 2,
        radius: A.gateArchRadius,
        bottom: 0.02,
        spring: A.gateArchSpring,
        arch: true,
        role: 'whole-depth-central-gate',
      },
    ];
  if (lod > 0)
    for (const t of [0.16, 0.32, 0.68, 0.84]) {
      holes.push({
        center: L * t,
        radius: 0.46,
        bottom: 1.05,
        top: 2.45,
        arch: false,
        role: 'gate-lower-barred-window',
      });
      holes.push({
        center: L * t,
        radius: 0.6,
        bottom: 3.65,
        spring: 5.5,
        arch: true,
        role: 'gate-upper-arched-barred-window',
      });
    }
  wall(o, 'stone', a, z, b.X - b.x, A.foundationBottom, A.gateEave, holes, lod, colors[1], true);
  for (const q of r) nativeEvidence.push({ id: 1069791223, local: [q[0], A.gateEave, q[1]] });
  if (lod > 0) box(o, 'stone', b.x, b.X, 7.0, 7.22, cz - 3.1, cz + 3.1, colors[0]);
  box(o, 'stone', b.x + 0.1, b.X + 0.12, 7.22, 7.7, cz - 2.7, cz + 2.7, colors[1]);
  box(o, 'stone', b.x + 0.18, b.X + 0.13, 7.7, 8.15, cz - 2.1, cz + 2.1, colors[0]);
  box(o, 'stone', b.x + 0.23, b.X + 0.15, 8.15, A.gatePediment, cz - 1.35, cz + 1.35, colors[1]);
  if (lod > 0) {
    if (lod >= 2)
      for (const h of holes.slice(1)) {
        const xs = [b.X + 0.06, b.x - 0.06],
          y1 = h.arch ? h.spring + h.radius : h.top;
        for (const xx of xs) {
          for (let i = 0; i <= [3, 4, 5][lod - 1]; i++) {
            const zz = b.z + h.center - h.radius + (2 * h.radius * i) / [3, 4, 5][lod - 1];
            B(
              o,
              'metal',
              [xx, h.bottom, zz],
              [xx, (h.arch ? archTop(h, zz - b.z) : y1) - 0.09, zz],
              0.035,
              0.045,
            );
          }
          B(
            o,
            'metal',
            [xx, h.bottom, b.z + h.center - h.radius],
            [xx, h.bottom, b.z + h.center + h.radius],
            0.07,
            0.08,
          );
        }
      }
    const h = holes[0],
      N = [0, 7, 13, 19][lod];
    for (const xx of [b.X + 0.1, b.x - 0.1])
      for (let i = 0; i < N; i++) {
        const t = (i * Math.PI) / N,
          u = ((i + 1) * Math.PI) / N,
          r0 = h.radius + 0.04,
          r1 = h.radius + 0.36,
          cc = b.z + h.center,
          P = (r, t) => [xx, A.gateArchSpring + r * Math.sin(t), cc + r * Math.cos(t)];
        Q(
          o,
          'stone',
          [P(r0, t), P(r0, u), P(r1, u), P(r1, t)],
          [xx > b.X ? 1 : -1, 0, 0],
          colors[i % colors.length],
        );
      }
    B(
      o,
      'stone',
      [b.X + 0.08, A.gateEave, b.z],
      [b.X + 0.08, A.gateEave, b.Z],
      0.25,
      0.25,
      colors[1],
    );
  }
  // The native central front control is retained as an actual small coping vertex.
  if (lod > 0)
    for (const q of r)
      box(
        o,
        'stone',
        q[0] - 0.012,
        q[0] + 0.012,
        A.gateEave,
        A.gateEave + 0.025,
        q[1] - 0.012,
        q[1] + 0.012,
        colors[1],
      );
  roof(o, 1069791223, A.gateEave, A.gateEave + 0.38, C.roof, lod);
}
function quarters(o, id, lod) {
  shell(o, id, A.foundationBottom, A.quartersEave, 'stone', lod, {
    courses: true,
    thickness: 0.55,
    holes: (a, b) => {
      const L = Math.hypot(...sub(b, a));
      return lod === 0 || L < 5
        ? []
        : Array.from({ length: Math.floor(L / 3.5) }, (_, i) => ({
            center: (L * (i + 1)) / (Math.floor(L / 3.5) + 1),
            radius: 0.45,
            bottom: 1.2,
            top: 2.7,
            arch: false,
            role: 'quarters-window',
          }));
    },
  });
  roof(o, id, A.quartersEave, A.quartersRidge, C.roof, lod);
}
function cells(o, id, lod) {
  const r = R(id),
    rr = area(r) > 0 ? r : r.slice().reverse(),
    y = A.cellHeight;
  for (const q of r) nativeEvidence.push({ id, local: [q[0], y, q[1]] });
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      L = Math.hypot(...sub(b, a)),
      hs = [],
      n = lod === 0 ? 0 : lod === 1 ? 3 : 16;
    if (L > 25)
      for (let j = 0; j < n; j++) {
        const center = (L * (j + 0.5)) / n,
          outerPairs =
            id === 1069791225
              ? [
                  [0, 7],
                  [1, 2],
                ]
              : [
                  [0, 8],
                  [1, 2],
                ],
          external = outerPairs.some(
            (ix) =>
              ix.some((q) => Math.hypot(...sub(r[q], a)) < 1e-5) &&
              ix.some((q) => Math.hypot(...sub(r[q], b)) < 1e-5),
          );
        hs.push({
          center,
          radius: external ? 0.24 : 0.37,
          bottom: external ? 1.25 : 0.1,
          top: external ? 2.2 : 2.15,
          arch: false,
          role: external ? 'cell-lower-exterior-window' : 'cell-lower-aisle-door',
        });
        if (lod >= 2)
          hs.push({
            center,
            radius: external ? 0.24 : 0.37,
            bottom: external ? 4.5 : 3.6,
            top: external ? 5.4 : 5.72,
            arch: false,
            role: external ? 'cell-upper-exterior-window' : 'cell-upper-aisle-door',
          });
      }
    wall(o, 'cell', a, b, A.cellWallThickness, A.foundationBottom, y, hs, lod, C.cell, lod === 3);
  }
  // Two native U arms supply exact cell-row strips. Their open central aisle is never capped.
  const pairs =
    id === 1069791225
      ? [
          [0, 7, 6, 5],
          [1, 2, 3, 4],
        ]
      : [
          [0, 8, 7, 6],
          [1, 2, 4, 5],
        ];
  for (const ix of pairs) {
    const q = ix.map((i) => r[i]);
    solid(o, 'cell', q, A.cellFloor, A.cellFloor + A.cellFloorThickness, C.cell);
    const n = lod === 0 ? 0 : lod === 1 ? 3 : 16;
    for (let i = 1; i < n; i++) {
      const a = mix(q[0], q[1], i / n),
        b = mix(q[3], q[2], i / n);
      B(
        o,
        'cell',
        [a[0], (A.cellHeight + A.foundationBottom) / 2, a[1]],
        [b[0], (A.cellHeight + A.foundationBottom) / 2, b[1]],
        A.cellPartitionThickness,
        A.cellHeight - A.foundationBottom,
        C.cell,
      );
    }
    if (lod >= 2)
      for (let j = 0; j < n; j++) {
        const a = mix(q[3], q[2], (j + 0.5) / n),
          b = mix(q[0], q[1], (j + 0.5) / n),
          u = sub(b, a),
          L = Math.hypot(...u),
          nrm = [u[0] / L, u[1] / L],
          center = a.map((v, i) => v + nrm[i] * 0.04);
        for (const yy of [1.1, 4.65])
          for (let k = lod === 2 ? 0 : -1; k <= (lod === 2 ? 0 : 1); k++)
            B(
              o,
              'metal',
              [center[0] + (u[1] / L) * k * 0.13, yy - 0.8, center[1] - (u[0] / L) * k * 0.13],
              [center[0] + (u[1] / L) * k * 0.13, yy + 0.8, center[1] - (u[0] / L) * k * 0.13],
              0.025,
              0.03,
            );
      }
    cellEvidence.push({
      id,
      outline: q,
      floor: A.cellFloor,
      divisions: n,
      roofless: true,
      openCentralAisle: true,
    });
  }
}
function mess(o, lod) {
  const outer = R(1069791228),
    main = bounds(R(1069791227)),
    front = bounds(outer),
    centers = [1069791229, 1069791231, 1069791230].map((id) => {
      const b = bounds(R(id));
      return (b.z + b.Z) / 2;
    });
  // Native outer mass is modeled as thin standing walls, preserving roofless main hall and
  // all three mapped east recesses. Their external archways are physical holes.
  shell(o, 1069791228, A.foundationBottom, A.messWall, 'stone', lod, {
    thickness: 0.55,
    courses: true,
    holes: (a, b) => {
      const L = Math.hypot(...sub(b, a));
      if (Math.abs(a[0] - b[0]) > 0.2 || Math.min(a[0], b[0]) < main.X + 0.3 || L < 7) return [];
      return centers.map((z) => ({
        center: (z - a[1]) * (b[1] > a[1] ? 1 : -1),
        radius: A.messArchRadius,
        bottom: 0.04,
        spring: A.messArchSpring,
        arch: true,
        role: 'mess-front-three-through-arches',
      }));
    },
  });
  // Two north/south gables remain on the roofless hall; these are masonry, never a roof.
  for (const z of [main.z, main.Z]) {
    const r = [
      [main.x, z],
      [main.X, z],
      [main.X - 0.02, z + 0.22],
      [main.x + 0.02, z + 0.22],
    ];
    solid(o, 'stone', r, A.messWall, A.messWall + 0.12, C.stone);
    const cx = (main.x + main.X) / 2;
    for (const dz of [0, 0.24])
      T(
        o,
        'stone',
        [
          [main.x, A.messWall, z + dz],
          [main.X, A.messWall, z + dz],
          [cx, A.messGable, z + dz],
        ],
        [0, 0, dz === 0 ? -1 : 1],
        colors[1],
      );
    Q(
      o,
      'stone',
      [
        [main.x, A.messWall, z],
        [cx, A.messGable, z],
        [cx, A.messGable, z + 0.24],
        [main.x, A.messWall, z + 0.24],
      ],
      [-0.2, 1, 0],
      colors[1],
    );
    Q(
      o,
      'stone',
      [
        [cx, A.messGable, z],
        [main.X, A.messWall, z],
        [main.X, A.messWall, z + 0.24],
        [cx, A.messGable, z + 0.24],
      ],
      [0.2, 1, 0],
      colors[1],
    );
  }
  const frontZ = R(1069791228)
      .filter((q) => q[0] > front.X - 0.12)
      .map((q) => q[1]),
    z0 = Math.min(...frontZ),
    z1 = Math.max(...frontZ),
    zc = (z0 + z1) / 2;
  for (const xx of [front.X, front.X - 0.45])
    T(
      o,
      'stone',
      [
        [xx, A.messWall, z0],
        [xx, A.messWall, z1],
        [xx, A.messGable, zc],
      ],
      [xx === front.X ? 1 : -1, 0, 0],
      colors[1],
    );
  for (const zz of [z0, z1])
    Q(
      o,
      'stone',
      [
        [front.X, A.messWall, zz],
        [front.X, A.messGable, zc],
        [front.X - 0.45, A.messGable, zc],
        [front.X - 0.45, A.messWall, zz],
      ],
      [0, 1, 0],
      colors[1],
    );
  // Retain all mapped interior void controls as small floor-level reveals, no solid hall slab.
  for (const id of [1069791227, 1069791229, 1069791230, 1069791231]) {
    const r = R(id);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (lod > 0) wall(o, 'stone', a, b, 0.15, -0.12, 0.08, [], lod, colors[2]);
      else {
        const d = sub(b, a),
          L = Math.hypot(...d),
          n = [d[1] / L, -d[0] / L];
        Q(
          o,
          'stone',
          [
            [a[0], 0.08, a[1]],
            [b[0], 0.08, b[1]],
            [b[0] - n[0] * 0.15, 0.08, b[1] - n[1] * 0.15],
            [a[0] - n[0] * 0.15, 0.08, a[1] - n[1] * 0.15],
          ],
          [0, 1, 0],
          colors[2],
        );
      }
      nativeEvidence.push({ id, local: [a[0], 0.08, a[1]] });
    }
  }
  if (lod >= 1)
    for (const z of centers)
      for (const x of [front.X + 0.02, main.X - 0.04]) {
        const N = [0, 5, 9, 13][lod];
        for (let i = 0; i < N; i++) {
          const t = (i * Math.PI) / N,
            v = ((i + 1) * Math.PI) / N,
            P = (r, t) => [x, A.messArchSpring + r * Math.sin(t), z + r * Math.cos(t)];
          Q(
            o,
            'stone',
            [
              P(A.messArchRadius, t),
              P(A.messArchRadius, v),
              P(A.messArchRadius + 0.24, v),
              P(A.messArchRadius + 0.24, t),
            ],
            [1, 0, 0],
            colors[i % colors.length],
          );
        }
      }
}
function support(o, lod) {
  shell(o, 1069791232, A.foundationBottom, A.kitchenEave, 'stone', lod, {
    thickness: 0.45,
    courses: true,
  });
  roof(o, 1069791232, A.kitchenEave, A.kitchenRidge, C.sheet, lod);
  roof(o, 1069791233, A.shelterEave, A.shelterRidge, C.sheet, lod);
  roof(o, 1069791234, A.shelterEave, A.shelterRidge, C.sheet, lod);
  for (const id of [1069791233, 1069791234]) {
    const r = R(id);
    for (const q of r) {
      nativeEvidence.push({ id, local: [q[0], A.shelterEave, q[1]] });
      if (lod >= 1) B(o, 'metal', [q[0], 0, q[1]], [q[0], A.shelterEave, q[1]], 0.11, 0.11);
    }
  }
  shell(o, 1069791226, A.foundationBottom, A.supportEave, 'stone', lod, {
    thickness: 0.4,
    courses: true,
  });
  roof(o, 1069791226, A.supportEave, A.supportRidge, C.sheet, lod);
  // Current low archaeology within the full native southern support footprint, not a
  // conjectural restored hospital. The exposed bath channels/dividers are original estimates.
  shell(o, 1069791222, -0.24, A.ruinHeight, 'cell', lod, { thickness: 0.37 });
  const b = bounds(R(1069791222)),
    n = [2, 4, 7, 9][lod];
  for (let i = 1; i < n; i++) {
    const x = b.x + ((b.X - b.x) * i) / n;
    box(o, 'cell', x - 0.11, x + 0.11, -0.16, A.ruinHeight, b.z, b.Z, C.dark);
  }
  if (lod >= 2) {
    const n = lod === 2 ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const xx = b.x + 0.5 + (((i * 17) % 97) / 97) * (b.X - b.x - 1),
        zz = b.z + 0.3 + (((i * 31) % 89) / 89) * (b.Z - b.z - 0.6);
      box(
        o,
        'stone',
        xx - 0.18,
        xx + 0.24,
        0.02,
        0.23 + (i % 3) * 0.07,
        zz - 0.19,
        zz + 0.2,
        colors[i % colors.length],
      );
    }
  }
}
function towers(o, lod) {
  const wallRing = R(1069791216),
    indices = [11, 0, 8, 3],
    w = A.watchtowerWidth,
    h = w / 2;
  for (const i of indices) {
    const q = wallRing[i],
      x = q[0],
      z = q[1],
      r = rect(x - h, x + h, z - h, z + h);
    if (lod > 0) solid(o, 'stone', r, A.watchtowerBase, A.watchtowerBase + 0.18, C.stone);
    for (let j = 0; j < 4; j++) {
      const a = r[j],
        b = r[(j + 1) % 4];
      wall(
        o,
        'stone',
        a,
        b,
        A.watchtowerWall,
        A.watchtowerBase + 0.18,
        A.watchtowerTop,
        lod === 0
          ? []
          : [
              {
                center: w / 2,
                radius: 0.48,
                bottom: 5.25,
                top: 6.55,
                arch: false,
                role: 'watchtower-open-parapet-window',
              },
            ],
        lod,
        C.stone,
        lod === 3,
      );
    }
    towerEvidence.push({
      center: q,
      originalEstimate: true,
      nativeFootprint: false,
      openTop: true,
    });
  }
}
export function buildTrialBayGaol(o, _frame, lod = 3) {
  nativeEvidence.length = 0;
  openingEvidence.length = 0;
  cellEvidence.length = 0;
  towerEvidence.length = 0;
  roofEvidence.length = 0;
  let count = 0;
  const target = o;
  o = {
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
  };
  partEvidence.length = 0;
  const part = (name, run) => {
    const before = count;
    run();
    partEvidence.push({ name, triangles: count - before });
  };
  part('wall', () => enclosingWall(o, lod));
  part('gate', () => gate(o, lod));
  part('quarters', () => {
    quarters(o, 1069791235, lod);
    quarters(o, 1069791236, lod);
  });
  part('cells', () => {
    cells(o, 1069791225, lod);
    cells(o, 1069791224, lod);
  });
  part('mess', () => mess(o, lod));
  part('support', () => support(o, lod));
  part('towers', () => towers(o, lod));
}
export const trialBayGaolSkyline = (o) => buildTrialBayGaol(o, null, 0),
  trialBayGaolDistrict = (o) => buildTrialBayGaol(o, null, 1),
  trialBayGaolStreet = (o) => buildTrialBayGaol(o, null, 2),
  trialBayGaolCloseup = (o) => buildTrialBayGaol(o, null, 3);
export const trialBayGaolModel = {
  id: 'trial_bay_gaol',
  key: 'trial_bay_gaol',
  cell: 'r6/r6s',
  title: 'Trial Bay Gaol',
  category: p.category,
  recipe: 'trial-bay-gaol-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildTrialBayGaol,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole surviving Trial Bay Gaol compound in exact native regional frame: enclosing granite wall/four original inferred open watchtowers, stepped central arched east gatehouse/barred windows/terracotta wings and connected quarters; two angled double-row roofless cell wings with exposed divisions and open aisles; roofless mess hall/three real arches/standing gables; native western kitchen/bakehouse/covered walk/north shelter/southeast small support roof; full low southern support archaeology. No whole-yard slab or restored ruined roofs. Nine cleared published2025creatorCC0 Qualla originals first/only imagery, no copied pixels. Heights/towercount-finefootprints/roof sections/cell census/exposed rubble/hiddenparts and exact hostground-contact are original estimates; preview/replaceFootprintfalse.',
  camera: [155, F + 100, 145],
  lookAt: [0, F + 3, -1],
  portableGroundY: F - 0.24,
  sunDirection: [8, 14, -9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-west-opposite-open-cell-aisles-and-ruined-hall',
      position: [-145, F + 92, -135],
      lookAt: [0, F + 3, -2],
    },
    {
      name: 'east-gatehouse-full-depth-arch-barred-windows-and-stepped-pediment',
      position: [83, F + 9, -8],
      lookAt: [50, F + 4, -15],
    },
    {
      name: 'roofless-cell-blocks-and-open-yard-whole-plan',
      position: [-14, F + 175, -1],
      lookAt: [-3, F + 2, -1],
    },
    {
      name: 'mess-hall-three-archways-ruined-gables-and-two-wing-junction',
      position: [45, F + 12, -14],
      lookAt: [9, F + 3, -16],
    },
    {
      name: 'low-south-support-archaeology-and-native-enclosing-wall',
      position: [18, F + 10, 56],
      lookAt: [7, F + 0.7, 46],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/trial-bay-gaol-runtime-overlay.mjs',
    level: 'skyline',
    export: 'trialBayGaolSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'trialBayGaolDistrict', errorMeters: 0.75, surfaces },
      street: { export: 'trialBayGaolStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'trialBayGaolCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Nine exact published July2025 Aliceinthealice own/self-CC0 originals individually/contactsheet inspected and nativeSHA1 matched; unchanged published inventory policy passed. No supplementary images, questionable rights, source repairs/reclassification/guard changes or copied photographic textures. Complete native wall and physical component controls retained; operatorQID not adopted. Original inferred watchtowers/roof ridges/cell-wall/partitions and low archaeological form/census are bounded estimates; no survey or authoritative current reconstruction.',
    'Original independent400m129x12916641sample/one rawtile field, fixed nativebboxanchor/heading0 and SW12.0236m provider-relative datum frozen before floor/sections/geometry. Once-only eastgatefloor3.636m remains fixed. Extreme coastalDEM negatives retained, not archaeology/bathymetry. No fit/flatten/reacquire/reframe/late raising; precise ground and ruin-level contact unverified. Geographic preview/replaceFootprintfalse; flat portableground and contextneighbors are review fixtures only.',
  ],
};
