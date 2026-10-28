/** Whole native Canonbury Tower and attached house/ranges; photographic estimates, not a survey. */
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
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
  brick: rgb('a77760'),
  plaster: rgb('d6cdbb'),
  roof: rgb('68554b'),
  wood: rgb('ddd7c7'),
  glass: rgb('36413e'),
  metal: rgb('434748'),
};
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.1 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.3 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, h = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      h.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  native = frame.features[0].outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
  nativeEvidence = [],
  partEvidence = [],
  openingEvidence = [],
  roofEvidence = [],
  buttressEvidence = [],
  bayEvidence = [],
  stairEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
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
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], top = true) {
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
      col,
    );
  }
  if (top) cap(o, k, r, Y, true, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  box = (o, k, x, y, z, w, h, d, col) =>
    solid(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, y + h, col),
  B = (o, k, a, b, w, d, col = C[k]) => beam(o, k, toWorld(a), toWorld(b), w, d, col);
function panel(a, b, r) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
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
function plane(o, k, f, l, r, y, Y, v = 0, col = C[k]) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]], col);
}
function facades(o, k, r, y, Y, holes, lod, name) {
  for (let i = 0; i < r.length; i++) {
    const f = panel(r[i], r[(i + 1) % r.length], r),
      hs = holes(f, i);
    if (lod === 0) {
      plane(o, k, f, 0, f.L, y, Y);
      for (const h of hs) plane(o, 'glass', f, h.x - h.w / 2, h.x + h.w / 2, h.y, h.Y, 0.015);
      continue;
    }
    const outer = [
        [0, y],
        [f.L, y],
        [f.L, Y],
        [0, Y],
      ],
      cuts = hs.map((h) => [
        [h.x - h.w / 2, h.y],
        [h.x - h.w / 2, h.Y],
        [h.x + h.w / 2, h.Y],
        [h.x + h.w / 2, h.y],
      ]),
      all = [...outer, ...cuts.flat()];
    for (const ix of triangulate(outer, cuts))
      T(
        o,
        k,
        ix.map((i) => f.P(...all[i])),
        [f.n[0], 0, f.n[1]],
      );
    for (const h of hs) {
      const l = h.x - h.w / 2,
        R = h.x + h.w / 2,
        D = -A.windowDepth;
      for (const [a, b, n] of [
        [[l, h.y], [l, h.Y], f.u],
        [[R, h.Y], [R, h.y], f.u.map((v) => -v)],
      ])
        Q(o, k, [f.P(...a), f.P(...b), f.P(...b, D), f.P(...a, D)], [n[0], 0, n[1]]);
      Q(o, k, [f.P(l, h.y), f.P(l, h.y, D), f.P(R, h.y, D), f.P(R, h.y)], [0, 1, 0]);
      Q(o, k, [f.P(l, h.Y), f.P(R, h.Y), f.P(R, h.Y, D), f.P(l, h.Y, D)], [0, -1, 0]);
      plane(o, 'glass', f, l, R, h.y, h.Y, D);
      openingEvidence.push({
        name,
        index: i,
        center: f.P(h.x, (h.y + h.Y) / 2),
        normal: [f.n[0], 0, f.n[1]],
        depth: A.windowDepth,
      });
      if (lod >= 2) {
        for (const t of [l - 0.08, R + 0.08])
          B(o, 'wood', f.P(t, h.y - 0.1, 0.04), f.P(t, h.Y + 0.1, 0.04), 0.14, 0.14);
        B(o, 'wood', f.P(l - 0.15, h.y - 0.12, 0.1), f.P(R + 0.15, h.y - 0.12, 0.1), 0.15, 0.22);
        const N = lod === 3 ? 5 : 2;
        for (let j = 1; j <= N; j++) {
          const t = l + (h.w * j) / (N + 1);
          B(o, 'wood', f.P(t, h.y, D + 0.025), f.P(t, h.Y, D + 0.025), 0.045, 0.045);
        }
        if (name === 'house') {
          for (let j = 1; j <= N; j++) {
            const yy = h.y + ((h.Y - h.y) * j) / (N + 1);
            B(o, 'wood', f.P(l, yy, D + 0.03), f.P(R, yy, D + 0.03), 0.045, 0.05);
          }
          B(o, 'wood', f.P(l - 0.1, h.Y + 0.07, 0.06), f.P(R + 0.1, h.Y + 0.07, 0.06), 0.14, 0.16);
        }
      }
    }
  }
}
function ring(o, k, r, y, Y, depth, col) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const f = panel(r[i], r[(i + 1) % r.length], r),
      a = f.P(0, 0, depth),
      b = f.P(f.L, 0, depth),
      c = f.P(f.L, 0, -0.02),
      d = f.P(0, 0, -0.02);
    solid(
      o,
      k,
      [
        [a[0], a[2]],
        [b[0], b[2]],
        [c[0], c[2]],
        [d[0], d[2]],
      ],
      y,
      Y,
      col,
    );
  }
  return s;
}
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
const house = p.derivedParts.lowerHouse.outline,
  tower = p.derivedParts.tower.outline,
  south = clip(house, 0, -1, 0.83),
  west = clip(house, 0, 1, -0.83);
export const roofParts = [
  { name: 'west-gabled-house', ring: west, ridge: A.houseRidge, cross: false },
  { name: 'south-cross-gabled-range', ring: south, ridge: A.southRidge, cross: true },
];
function planes(part) {
  const r = part.ring,
    x = Math.min(...r.map((q) => q[0])),
    X = Math.max(...r.map((q) => q[0])),
    z = Math.min(...r.map((q) => q[1])),
    Z = Math.max(...r.map((q) => q[1])),
    cx = (x + X) / 2,
    cz = (z + Z) / 2,
    k = (part.ridge - A.houseEave) / ((X - x) / 2),
    j = (part.ridge - A.houseEave) / ((Z - z) / 2);
  return {
    cx,
    cz,
    u: [
      [k, 0, A.houseEave - k * x],
      [-k, 0, A.houseEave + k * X],
    ],
    v: part.cross
      ? [
          [0, j, A.houseEave - j * z],
          [0, -j, A.houseEave + j * Z],
        ]
      : null,
  };
}
export function roofHeight(q, part) {
  const ps = planes(part),
    h = ps.u.map(([a, b, c]) => a * q[0] + b * q[1] + c),
    v = ps.v?.map(([a, b, c]) => a * q[0] + b * q[1] + c);
  return v ? Math.max(Math.min(...h), Math.min(...v)) : Math.min(...h);
}
function roofs(o, lod) {
  for (const part of roofParts) {
    const ps = planes(part);
    for (const base of triangulate(part.ring))
      for (let ui = 0; ui < 2; ui++)
        for (let vi = 0; vi < (ps.v ? 2 : 1); vi++) {
          let r = base.map((i) => part.ring[i]);
          r = ui === 0 ? clip(r, 1, 0, ps.cx) : clip(r, -1, 0, -ps.cx);
          if (ps.v) r = vi === 0 ? clip(r, 0, 1, ps.cz) : clip(r, 0, -1, -ps.cz);
          if (r.length < 3) continue;
          const P = ps.u[ui],
            V = ps.v?.[vi],
            fields = V ? [P, V] : [P];
          for (let i = 0; i < fields.length; i++) {
            const a = fields[i],
              b = fields[1 - i];
            let cut = r;
            if (b) cut = clip(cut, b[0] - a[0], b[1] - a[1], a[2] - b[2]);
            if (cut.length < 3) continue;
            for (const ix of triangulate(cut))
              T(
                o,
                'roof',
                ix.map((j) => [cut[j][0], a[0] * cut[j][0] + a[1] * cut[j][1] + a[2], cut[j][1]]),
                [0, 1, 0],
              );
          }
        }
    const sign = area(part.ring) > 0 ? 1 : -1,
      all = [...ps.u, ...(ps.v ?? [])];
    for (let i = 0; i < part.ring.length; i++) {
      const a = part.ring[i],
        b = part.ring[(i + 1) % part.ring.length],
        delta = sub(b, a),
        ts = [0, 1];
      for (let j = 0; j < all.length; j++)
        for (let k = j + 1; k < all.length; k++) {
          const u = all[j][0] - all[k][0],
            v = all[j][1] - all[k][1],
            den = u * delta[0] + v * delta[1];
          if (Math.abs(den) < 1e-9) continue;
          const t = (all[k][2] - all[j][2] - u * a[0] - v * a[1]) / den;
          if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
        }
      ts.sort((a, b) => a - b);
      for (let j = 0; j < ts.length - 1; j++) {
        if (ts[j + 1] - ts[j] < 1e-6) continue;
        const c = a.map((v, k) => v + delta[k] * ts[j]),
          d = a.map((v, k) => v + delta[k] * ts[j + 1]);
        Q(
          o,
          'plaster',
          [
            [c[0], A.houseEave - 0.05, c[1]],
            [d[0], A.houseEave - 0.05, d[1]],
            [d[0], roofHeight(d, part), d[1]],
            [c[0], roofHeight(c, part), c[1]],
          ],
          [sign * delta[1], 0, -sign * delta[0]],
        );
      }
      if (lod >= 1)
        B(
          o,
          'wood',
          [a[0], A.houseEave - 0.05, a[1]],
          [b[0], A.houseEave - 0.05, b[1]],
          0.12,
          0.18,
        );
    }
    roofEvidence.push({ name: part.name, ring: part.ring, ridge: part.ridge });
  }
}
function houseBody(o, lod) {
  solid(o, 'brick', native, A.foundationBottom, A.platformTop);
  for (const q of native) nativeEvidence.push(toWorld([q[0], 0, q[1]]));
  for (const [y, Y, level] of [
    [A.platformTop, A.houseLowerBrickTop, 0],
    [A.houseLowerBrickTop, A.houseUpperFloor, 1],
    [A.houseUpperFloor, A.houseSecondFloor, 2],
    [A.houseSecondFloor, A.houseEave, 3],
  ]) {
    if (level === 1) {
      solid(o, 'plaster', house, y, Y);
      continue;
    }
    facades(
      o,
      level === 0 ? 'brick' : 'plaster',
      house,
      y,
      Y,
      (f, i) => {
        if (i === 6) return [];
        if (level === 0 && i === 0) return [{ x: f.L * 0.53, w: 1.2, y: 0.8, Y: 2.85 }];
        const n = f.L > 6 ? 2 : f.L > 3 ? 1 : 0;
        return Array.from({ length: n }, (_, j) => ({
          x: (f.L * (j + 0.5)) / n,
          w: 1.0,
          y: level === 0 ? 0.85 : level === 2 ? 4.0 : 7.0,
          Y: level === 0 ? 2.5 : level === 2 ? 5.65 : 8.65,
        }));
      },
      lod,
      'house',
    );
  }
  cap(o, 'plaster', house, A.houseEave);
}
const towerHoles = (f, i) => {
  const heights =
    i === 0
      ? [1.0, 4.1, 7.25, 10.4, 13.55, 16.8]
      : i === 1
        ? [11.0, 16.8]
        : i === 2
          ? [12.1, 16.5]
          : [13.3, 17.0];
  return heights.map((y, j) => ({
    x: f.L / 2 + (i === 0 ? (j % 2 === 0 ? -0.65 : 0.65) : 0),
    w: i === 0 ? 1.12 : 0.8,
    y,
    Y: y + 1.65,
  }));
};
function towerBody(o, lod) {
  facades(o, 'brick', tower, A.platformTop, A.towerTop, towerHoles, lod, 'tower');
  cap(o, 'roof', tower, A.towerTop);
  ring(o, 'brick', tower, A.towerTop, A.towerParapetTop, 0.08);
  for (const y of A.towerStages)
    for (let i = 0; i < tower.length; i++) {
      const f = panel(tower[i], tower[(i + 1) % 4], tower),
        cuts = towerHoles(f, i)
          .filter((h) => h.y < y + 0.12 && h.Y > y)
          .map((h) => [h.x - h.w / 2 - 0.02, h.x + h.w / 2 + 0.02])
          .sort((a, b) => a[0] - b[0]),
        spans = [];
      let l = 0;
      for (const [a, b] of cuts) {
        if (a > l) spans.push([l, a]);
        l = Math.max(l, b);
      }
      if (l < f.L) spans.push([l, f.L]);
      for (const [a, b] of spans) {
        const qs = [
          f.P(a, 0, lod === 0 ? 0.1 : 0.17),
          f.P(b, 0, lod === 0 ? 0.1 : 0.17),
          f.P(b, 0, -0.02),
          f.P(a, 0, -0.02),
        ];
        solid(
          o,
          'brick',
          qs.map((q) => [q[0], q[2]]),
          y,
          y + 0.12,
        );
      }
    }
  const front = panel(tower[0], tower[1], tower);
  for (const t of [0.22, front.L - 0.22]) {
    const q = front.P(t, 0, 0.22);
    for (const [y, Y, w, d] of [
      [0, 4.4, 0.52, 0.66],
      [4.4, 9.2, 0.43, 0.5],
      [9.2, 14.2, 0.34, 0.34],
    ])
      box(o, 'brick', q[0], y, q[2], w, Y - y, d);
    buttressEvidence.push({ center: q, top: 14.2 });
  }
  const top = A.towerParapetTop;
  for (let i = 0; i < tower.length; i++) {
    const f = panel(tower[i], tower[(i + 1) % 4], tower),
      N = lod === 0 ? 1 : lod === 1 ? 4 : lod === 2 ? 7 : 12;
    B(o, 'metal', f.P(0, A.towerRailTop), f.P(f.L, A.towerRailTop), 0.05, 0.05);
    if (lod >= 1) B(o, 'metal', f.P(0, top + 0.4), f.P(f.L, top + 0.4), 0.035, 0.035);
    for (let j = 0; j <= N; j++)
      B(o, 'metal', f.P((f.L * j) / N, top), f.P((f.L * j) / N, A.towerRailTop), 0.045, 0.045);
  }
  const x = (tower[0][0] + tower[1][0]) / 2,
    z = (tower[0][1] + tower[2][1]) / 2;
  B(o, 'metal', [x, A.towerTop, z], [x, 23.8, z], 0.055, 0.055);
  B(o, 'metal', [x - 0.55, 23.2, z], [x + 0.55, 23.2, z], 0.04, 0.04);
  T(
    o,
    'metal',
    [
      [x - 0.4, 23.0, z],
      [x - 0.4, 23.4, z],
      [x - 0.05, 23.2, z],
    ],
    [0, 0, 1],
  );
}
function bayAndPorch(o, lod) {
  const frontV = p.derivedParts.bay.frontV,
    x = p.derivedParts.bay.centerU,
    r = [
      [x - 1.22, frontV],
      [x - 0.82, frontV - 0.85],
      [x + 0.82, frontV - 0.85],
      [x + 1.22, frontV],
    ];
  solid(o, 'wood', r, 3.9, 4.08);
  facades(
    o,
    'wood',
    r,
    4.08,
    5.65,
    (f, i) => (i === 3 ? [] : [{ x: f.L / 2, w: f.L * 0.67, y: 4.2, Y: 5.5 }]),
    lod,
    'bay',
  );
  solid(o, 'wood', r, 5.65, 5.84);
  cap(o, 'roof', r, 5.85);
  bayEvidence.push({ name: 'north-canted-wooden-first-floor-bay', outline: r });
  const westU = Math.min(...house.map((q) => q[0])),
    porch = rect(westU - 1.35, westU + 0.03, 1.5, 4.5);
  solid(o, 'brick', porch, A.foundationBottom, 0.2);
  facades(
    o,
    'brick',
    porch,
    0.2,
    A.porchEave,
    (f, i) => (i === 3 ? [{ x: f.L / 2, w: 1.05, y: 0.25, Y: 2.45 }] : []),
    lod,
    'porch',
  );
  cap(o, 'roof', porch, A.porchEave);
  const roofPart = {
      name: 'intrinsic-low-west-gabled-porch',
      ring: porch,
      ridge: A.porchRidge,
      cross: false,
    },
    mid = (Math.min(...porch.map((q) => q[0])) + Math.max(...porch.map((q) => q[0]))) / 2;
  for (const sign of [-1, 1]) {
    const edge = sign < 0 ? westU - 1.35 : westU + 0.03;
    Q(
      o,
      'roof',
      [
        [edge, A.porchEave, 1.5],
        [edge, A.porchEave, 4.5],
        [mid, A.porchRidge, 4.5],
        [mid, A.porchRidge, 1.5],
      ],
      [sign, 1, 0],
    );
  }
  for (const z of [1.5, 4.5])
    T(
      o,
      'brick',
      [
        [westU - 1.35, A.porchEave, z],
        [westU + 0.03, A.porchEave, z],
        [mid, A.porchRidge, z],
      ],
      [0, 0, z === 1.5 ? -1 : 1],
    );
  roofEvidence.push(roofPart);
  const eastDoor = panel(house[0], house[1], house);
  for (let j = 0; j < A.entrySteps; j++) {
    const y = 0.2 * (j + 1),
      q = eastDoor.P(eastDoor.L * 0.53, 0, 1.1 - j * 0.28);
    const rr = [
      eastDoor.P(eastDoor.L * 0.53 - 0.9, 0, 1.24 - j * 0.28),
      eastDoor.P(eastDoor.L * 0.53 + 0.9, 0, 1.24 - j * 0.28),
      eastDoor.P(eastDoor.L * 0.53 + 0.9, 0, 0.96 - j * 0.28),
      eastDoor.P(eastDoor.L * 0.53 - 0.9, 0, 0.96 - j * 0.28),
    ].map((v) => [v[0], v[2]]);
    solid(o, 'brick', rr, 0, y);
    stairEvidence.push({ center: [q[0], q[2]], top: y });
  }
}
function detail(o, lod) {
  for (const [x, z, y] of [
    [1.85, -4.9, 11.3],
    [-5.3, 3.8, 12.0],
  ]) {
    box(o, 'brick', x, y, z, 0.85, A.chimneyTop - y, 0.72);
    box(o, 'brick', x, A.chimneyTop - 0.15, z, 1.03, 0.24, 0.92);
    for (const s of [-1, 1]) box(o, 'roof', x + s * 0.23, A.chimneyTop + 0.09, z, 0.19, 0.65, 0.19);
  }
  const r = p.derivedParts.lowLink.outline;
  solid(o, 'plaster', r, A.foundationBottom, A.lowLinkTop);
  cap(o, 'roof', r, A.lowLinkTop + 0.08);
  if (lod >= 2) {
    for (const y of [3.3, 6.3]) ring(o, 'wood', house, y - 0.08, y + 0.04, 0.035);
    for (let i = 0; i < house.length; i++) {
      const f = panel(house[i], house[(i + 1) % house.length], house);
      if (i === 6) continue;
      B(o, 'metal', f.P(0.12, 0.1, 0.12), f.P(0.12, A.houseEave - 0.1, 0.12), 0.065, 0.065);
    }
  }
}
export function buildCanonburyHouseAndTower(target, _frame, lod = 3) {
  for (const list of [
    nativeEvidence,
    partEvidence,
    openingEvidence,
    roofEvidence,
    buttressEvidence,
    bayEvidence,
    stairEvidence,
  ])
    list.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-eight-native-control-attached-house-ranges', () => houseBody(o, lod));
  part('six-storey-stair-tower-buttresses-four-stage-courses-open-roof-rail-and-vane', () =>
    towerBody(o, lod),
  );
  part('west-gable-and-south-cross-gable-roof-parts', () => roofs(o, lod));
  part('north-canted-window-bay-low-porch-and-intrinsic-steps', () => bayAndPorch(o, lod));
  part('chimneys-low-intrinsic-link-and-drainpipes', () => detail(o, lod));
}
export const canonburyHouseAndTowerSkyline = (o) => buildCanonburyHouseAndTower(o, null, 0),
  canonburyHouseAndTowerDistrict = (o) => buildCanonburyHouseAndTower(o, null, 1),
  canonburyHouseAndTowerStreet = (o) => buildCanonburyHouseAndTower(o, null, 2),
  canonburyHouseAndTowerCloseup = (o) => buildCanonburyHouseAndTower(o, null, 3),
  cam = (x, y, z) => toWorld([x, y, z]);
export const canonburyHouseAndTowerModel = {
  id: 'canonbury_house_and_canonbury_tower',
  key: 'canonbury_house_and_canonbury_tower',
  cell: 'gc/gcp',
  title: 'Canonbury House and Canonbury Tower',
  wikidataId: 'Q17552171',
  category: 'historic-house-tower',
  recipe: 'canonbury-house-and-tower-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCanonburyHouseAndTower,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole native eight-control Canonbury Tower/attached lower house ranges: tall brick stair tower/stepped casements/offset north buttresses/four string-course stages/flat parapet/open roof rail/weather vane; plastered gabled west and cross-gabled south ranges, canted wooden window bay/intrinsic low porch/entry steps/two chimneys/short low hall-link. Published Cooke1827CC0 engraving and Dixon1880PD photograph plus primary listing text. Native whole plan retained; tower subdivision/heights/hidden details/current repairs bounded. Separate named house/school/gardens/pond excluded.',
  camera: cam(-38, 30, -47),
  lookAt: cam(0, 10, 0),
  portableGroundY: F - 0.45,
  mediumFiContext: { cameraYaw: -2.45, groundY: F - 0.3 },
  embeddedCanonicalGraphs: ['brick', 'plaster_lime', 'tile_flat', 'wood_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-north-tower-and-attached-gabled-house',
      position: cam(-29, 20, -34),
      lookAt: cam(0, 9, 0),
    },
    {
      name: 'whole-native-assembly-roof-plan-and-short-intrinsic-link',
      position: cam(0, 55, 0.1),
      lookAt: cam(0, 4, 0),
    },
    {
      name: 'stepped-tower-casements-offset-buttresses-roof-rail-and-vane',
      position: cam(5, 15, -19),
      lookAt: cam(5, 13, -4),
    },
    {
      name: 'canted-window-bay-and-west-house-gable',
      position: cam(-13, 8, -17),
      lookAt: cam(-1, 5, -5),
    },
    {
      name: 'whole-south-cross-gabled-range-low-porch-and-chimneys',
      position: cam(-24, 16, 27),
      lookAt: cam(-2, 6, 1),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/canonbury-house-and-tower-runtime-overlay.mjs',
    level: 'skyline',
    export: 'canonburyHouseAndTowerSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'canonburyHouseAndTowerDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'canonburyHouseAndTowerStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'canonburyHouseAndTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Only exact published Cooke1827YaleCC0 engraving and Dixon1880public-domain photograph supply imagery. Primary HistoricEngland1280424 is used as technical text only. Current plaster/brick colors/roof partitions/hidden facades/window census/bay detail/alterations are original bounded estimates; no surveyed current fitout or exact restored ornament is claimed. Historical ivy/pond/fences/gardens/interiors and image pixels excluded.',
    'All eight native exterior controls retained in physical foundation/house ranges at all levels. Tower subpart uses explicitly reconstructed northeast subdivision within native outline near independent mapped tower point. Canted bay, porch/stairs and short hall-link are intrinsic derived architecture; separate named modern house/school/former hall and detached garden houses are excluded.',
    'Original native frame/256m129field/floor/mainsections fixed before geometry; no source-field replacement/fitting/flattening/reframe/reacquisition/raising. Exact threshold/foundation contact unverified, geographic preview/replacement false. Flat review ground and synthetic neighbors are fixtures.',
  ],
};
