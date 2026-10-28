/** Whole mapped monument; original medium-fi interpretation of cleared creator-PD photographs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections;
const C = {
  wall: rgb('c6ad74'),
  stone: rgb('b0b1a6'),
  metal: rgb('b39443'),
  dark: rgb('292b28'),
  red: rgb('74302f'),
  relief: rgb('c5c6ba'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  unit = (v) => v.map((q) => q / Math.hypot(...v)),
  identity = (q) => q;
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function box(o, k, lo, hi, P = identity, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const q of [
    [
      [x, y, z],
      [x, y, Z],
      [X, y, Z],
      [X, y, z],
    ],
    [
      [x, Y, Z],
      [x, Y, z],
      [X, Y, z],
      [X, Y, Z],
    ],
    [
      [x, y, Z],
      [x, Y, Z],
      [X, Y, Z],
      [X, y, Z],
    ],
    [
      [X, y, z],
      [X, Y, z],
      [x, Y, z],
      [x, y, z],
    ],
    [
      [x, y, z],
      [x, Y, z],
      [x, Y, Z],
      [x, y, Z],
    ],
    [
      [X, y, Z],
      [X, Y, Z],
      [X, Y, z],
      [X, y, z],
    ],
  ])
    Q(o, k, q.map(P).reverse(), null, col);
}
function cylinder(o, k, profile, N = 16, P = identity, col) {
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        [r, y] = profile[j - 1],
        [R, Y] = profile[j];
      Q(
        o,
        k,
        [
          [r * Math.cos(a), y, r * Math.sin(a)],
          [r * Math.cos(b), y, r * Math.sin(b)],
          [R * Math.cos(b), Y, R * Math.sin(b)],
          [R * Math.cos(a), Y, R * Math.sin(a)],
        ]
          .reverse()
          .map(P),
        null,
        col,
      );
    }
  for (const [end, flip] of [
    [profile[0], true],
    [profile.at(-1), false],
  ]) {
    const [r, y] = end;
    for (let i = 0; i < N; i++) {
      const q = [
        [0, y, 0],
        [r * Math.cos((i * 2 * Math.PI) / N), y, r * Math.sin((i * 2 * Math.PI) / N)],
        [r * Math.cos(((i + 1) * 2 * Math.PI) / N), y, r * Math.sin(((i + 1) * 2 * Math.PI) / N)],
      ];
      if (!flip) q.reverse();
      T(o, k, q.map(P), null, col);
    }
  }
}
function prism(o, k, ring, y0, y1, col) {
  ring = ring.slice();
  if (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) ring.reverse();
  const c = ring.reduce((s, q) => s.map((v, i) => v + q[i] / ring.length), [0, 0]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
    T(
      o,
      k,
      [
        [c[0], y1, c[1]],
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
      ],
      [0, 1, 0],
      col,
    );
    T(
      o,
      k,
      [
        [c[0], y0, c[1]],
        [b[0], y0, b[1]],
        [a[0], y0, a[1]],
      ],
      [0, -1, 0],
      col,
    );
  }
}
function beam(o, k, a, b, r, P = identity, col) {
  const v = unit(sub(b, a)),
    u = unit(cross(v, Math.abs(v[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])),
    w = cross(v, u),
    R = (q) =>
      [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ].map(([x, z]) => q.map((v, i) => v + (u[i] * x + w[i] * z) * r));
  const lo = R(a),
    hi = R(b);
  for (let i = 0; i < 4; i++)
    Q(o, k, [lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]].map(P), null, col);
  Q(o, k, lo.slice().reverse().map(P), null, col);
  Q(o, k, hi.map(P), null, col);
}
function ellipsoid(o, k, center, radii, N, L, P = identity, col) {
  const rings = Array.from({ length: L + 1 }, (_, j) =>
    Array.from({ length: N }, (_, i) => {
      const a = (i * 2 * Math.PI) / N,
        t = -Math.PI / 2 + (j * Math.PI) / L;
      return P(
        center.map(
          (v, k) =>
            v +
            [
              radii[0] * Math.cos(t) * Math.cos(a),
              radii[1] * Math.sin(t),
              radii[2] * Math.cos(t) * Math.sin(a),
            ][k],
        ),
      );
    }),
  );
  for (let j = 1; j <= L; j++)
    for (let i = 0; i < N; i++) {
      const q = [rings[j - 1][i], rings[j - 1][(i + 1) % N], rings[j][(i + 1) % N], rings[j][i]],
        c = P(center),
        m = q.reduce((s, v) => s.map((n, k) => n + v[k] / 4), [0, 0, 0]);
      Q(o, k, q, sub(m, c), col);
    }
}
const outline = (id) => f.features.find((q) => q.id === `way/${id}`).outline;
/** Ear clipping keeps the swept, slightly concave wing boundary intact. */
function triangulate(ring) {
  const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const ids = ring.map((_, i) => i);
  const area = ring.reduce((s, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area < 0) ids.reverse();
  const triangles = [];
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cross2(ring[a], ring[b], ring[c]) < 1e-10) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross2(ring[a], ring[b], ring[k]) >= -1e-10 &&
            cross2(ring[b], ring[c], ring[k]) >= -1e-10 &&
            cross2(ring[c], ring[a], ring[k]) >= -1e-10,
        )
      )
        continue;
      triangles.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid swept wing profile');
  }
  triangles.push(ids);
  return triangles;
}
export const wingFrames = [217306130, 217306131, 217306132, 217306133].map((id) => {
  const r = outline(id).slice(0, -1),
    center = r.reduce((s, q) => s.map((v, i) => v + q[i] / 4), [0, 0]),
    edges = r
      .map((q, i) => ({ a: q, b: r[(i + 1) % 4], l: Math.hypot(...sub(r[(i + 1) % 4], q)) }))
      .sort((a, b) => b.l - a.l);
  let u = unit(sub(edges[0].b, edges[0].a));
  if (dot(u, center) < 0) u = u.map((v) => -v);
  const v = [-u[1], u[0]],
    width = edges.at(-1).l;
  return {
    id,
    center,
    u,
    v,
    length: edges[0].l,
    width,
    P: ([x, y, z]) => [center[0] + u[0] * x + v[0] * z, y, center[1] + u[1] * x + v[1] * z],
  };
});
function wing(o, w, lod) {
  const { P, length: L, width: D } = w;
  prism(o, 'stone', outline(w.id), A.wingPedestalBottom, A.wingPedestalTop - 0.4);
  box(o, 'wall', [-L / 2 - 0.12, 3.95, -D / 2 - 0.12], [L / 2 + 0.12, 4.2, D / 2 + 0.12], P);
  box(o, 'wall', [-L / 2, 1.05, -D / 2 - 0.015], [L / 2, 1.45, D / 2 + 0.015], P);
  if (lod >= 1)
    for (const sign of [-1, 1]) {
      box(
        o,
        'stone',
        [-L * 0.44, 1.55, sign > 0 ? D / 2 : D / -2 - 0.07],
        [L * 0.44, 3.65, sign > 0 ? D / 2 + 0.07 : D / -2],
        P,
        C.relief,
      );
      if (lod >= 2) relief(o, P, L, D, sign, lod);
    }
  const steps = [3, 6, 10, 16][lod],
    profile = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      inner = -L * 0.45 + L * 0.8 * Math.pow(t, 0.88);
    profile.push([inner, 4.2 + (A.wingTop - 4.2 - 0.16) * t]);
  }
  profile.push([L * 0.39, A.wingTop], [L * 0.46, A.wingTop - 0.12], [L * 0.46, 4.2]);
  const V = (q, z) => P([q[0], q[1], z]);
  for (const triangle of triangulate(profile))
    for (const sign of [-1, 1])
      T(
        o,
        'wall',
        [...triangle.map((i) => V(profile[i], (sign * A.wingThickness) / 2))],
        [sign * w.v[0], 0, sign * w.v[1]],
      );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      c = [(b[1] - a[1]) * w.u[0], a[0] - b[0], (b[1] - a[1]) * w.u[1]];
    Q(
      o,
      'wall',
      [
        V(a, -A.wingThickness / 2),
        V(b, -A.wingThickness / 2),
        V(b, A.wingThickness / 2),
        V(a, A.wingThickness / 2),
      ],
      c,
    );
  }
  if (lod >= 1) {
    for (const sign of [-1, 1]) {
      const z = sign * (A.wingThickness / 2 + 0.025);
      box(
        o,
        'stone',
        [L * 0.32, 4.2, Math.min(z, z + sign * 0.04)],
        [L * 0.39, 18, Math.max(z, z + sign * 0.04)],
        P,
      );
      for (let i = 1; i <= 7; i++) {
        const t = i / 9,
          y = 4.2 + (A.wingTop - 4.2 - 0.16) * t,
          u = -L * 0.45 + L * 0.8 * Math.pow(t, 0.88);
        if (lod === 1)
          Q(
            o,
            'wall',
            [
              [u + 0.03, y, z],
              [L * 0.27, y - 1.3, z],
              [L * 0.27, y - 1.27, z],
              [u + 0.03, y + 0.03, z],
            ].map(P),
            [sign * w.v[0], 0, sign * w.v[1]],
            rgb('a58e61'),
          );
        else beam(o, 'wall', [u + 0.03, y, z], [L * 0.27, y - 1.3, z], 0.018, P, rgb('a58e61'));
      }
      if (lod >= 2)
        for (let i = 0; i < 22; i++) {
          const y = 4.45 + i * 0.6;
          beam(
            o,
            'stone',
            [L * 0.32, y, z + 0.01 * sign],
            [L * 0.385, y + 0.18, z + 0.04 * sign],
            0.045,
            P,
          );
        }
    }
    naga(o, w, lod);
  }
}
function relief(o, P, L, D, sign, lod) {
  const N = lod === 2 ? 5 : 7,
    z = sign * (D / 2 + 0.1),
    F = ([x, y, d]) => P([x, y, z + sign * d]);
  for (let i = 0; i < N; i++) {
    const x = -L * 0.36 + i * ((L * 0.72) / (N - 1)),
      y = 1.67 + (i % 2) * 0.05;
    ellipsoid(
      o,
      'stone',
      [x, y + 1.35, 0.07],
      [0.14, 0.18, 0.13],
      lod === 2 ? 5 : 8,
      lod === 2 ? 3 : 5,
      F,
      C.relief,
    );
    ellipsoid(
      o,
      'stone',
      [x, y + 0.85, 0.065],
      [0.26, 0.4, 0.12],
      lod === 2 ? 5 : 8,
      3,
      F,
      C.relief,
    );
    for (const s of [-1, 1]) {
      beam(o, 'stone', [x + s * 0.12, y + 0.54, 0.09], [x + s * 0.17, y, 0.09], 0.085, F, C.relief);
      beam(
        o,
        'stone',
        [x + s * 0.2, y + 1.1, 0.06],
        [x + s * 0.37, y + 0.75 + (i % 3) * 0.2, 0.12],
        0.075,
        F,
        C.relief,
      );
    }
  }
}
function naga(o, w, lod) {
  const { length: L, width: D } = w,
    P = ([x, y, z]) => w.P([L / 2 + 0.09 + z, y, x]);
  box(o, 'wall', [-D / 2 + 0.1, 0.7, -0.05], [D / 2 - 0.1, 2.1, 0.04], P);
  if (lod === 1) {
    beam(o, 'stone', [0, 0.9, 0.1], [0, 2.6, 0.3], 0.16, P);
    return;
  }
  ellipsoid(o, 'stone', [0, 1.15, 0.13], [0.58, 0.53, 0.19], lod === 2 ? 8 : 14, 5, P);
  beam(o, 'stone', [0.05, 1, 0.25], [-0.2, 2.15, 0.34], 0.17, P);
  beam(o, 'stone', [-0.2, 2.15, 0.34], [-0.1, 2.75, 0.55], 0.13, P);
  ellipsoid(o, 'stone', [-0.12, 2.8, 0.63], [0.25, 0.15, 0.3], 8, 4, P);
  box(o, 'dark', [-0.27, 2.69, 0.78], [0.06, 2.78, 0.87], P);
  for (let i = 0; i < 3; i++)
    beam(
      o,
      'stone',
      [-0.22 + i * 0.1, 2.82, 0.51],
      [-0.2 + i * 0.1, 3.08 - i * 0.035, 0.54],
      0.06,
      P,
    );
  box(o, 'stone', [-1.1, 0.12, 0.18], [1.1, 0.27, 1.3], P);
  for (const side of [-1, 1])
    box(o, 'stone', [side > 0 ? 0.98 : -1.12, 0.27, 0.18], [side > 0 ? 1.12 : -0.98, 0.44, 1.4], P);
  box(o, 'stone', [-1.12, 0.27, 1.25], [1.12, 0.44, 1.4], P);
}
function shrine(o, lod) {
  const N = [12, 18, 30, 48][lod];
  for (const [r, y] of lod === 0 ? [A.centralSteps.at(-1)] : A.centralSteps)
    cylinder(
      o,
      'stone',
      [
        [r, 1],
        [r, y],
      ],
      N,
    );
  if (lod === 0) {
    cylinder(
      o,
      'wall',
      [
        [A.pavilionRadius, 1.7],
        [A.pavilionRadius, 6.9],
        [1.15, 8.35],
      ],
      6,
    );
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        R = A.pavilionRadius * Math.cos(Math.PI / 6) + 0.01,
        P = ([x, y, z]) => [
          Math.cos(a) * R - Math.sin(a) * x + Math.cos(a) * z,
          y,
          Math.sin(a) * R + Math.cos(a) * x + Math.sin(a) * z,
        ];
      Q(
        o,
        'metal',
        [
          [-0.6, 1.7, 0],
          [0.6, 1.7, 0],
          [0.6, 4.6, 0],
          [-0.6, 4.6, 0],
        ].map(P),
        [Math.cos(a), 0, Math.sin(a)],
        C.red,
      );
    }
  } else for (let i = 0; i < 6; i++) shrineFace(o, i, lod);
  cylinder(
    o,
    'metal',
    lod === 0
      ? A.offeringProfile.filter((_q, i) => i % 2 === 0 || i === A.offeringProfile.length - 1)
      : A.offeringProfile,
    [6, 12, 24, 40][lod],
  );
  const B = A.constitutionBook;
  box(o, 'metal', [-B.width / 2, B.bottom, -B.depth / 2], [B.width / 2, B.top, B.depth / 2]);
  if (lod >= 2)
    for (let i = 0; i < 4; i++)
      box(
        o,
        'metal',
        [-B.width / 2 - 0.01, B.bottom + 0.05 * i, -B.depth / 2 - 0.01],
        [B.width / 2 + 0.01, B.bottom + 0.05 * i + 0.012, B.depth / 2 + 0.01],
        identity,
        rgb('d0b167'),
      );
}
function shrineFace(o, index, lod) {
  const a = (index * Math.PI) / 3,
    R = A.pavilionRadius * Math.cos(Math.PI / 6),
    W = A.pavilionRadius / 2,
    P = ([x, y, z]) => [
      Math.cos(a) * (R + z) - Math.sin(a) * x,
      y,
      Math.sin(a) * (R + z) + Math.cos(a) * x,
    ],
    normal = [Math.cos(a), 0, Math.sin(a)],
    rect = (k, x0, y0, x1, y1, z = 0, col) =>
      Q(
        o,
        k,
        [
          [x0, y0, z],
          [x1, y0, z],
          [x1, y1, z],
          [x0, y1, z],
        ].map(P),
        normal,
        col,
      ),
    h = A.doorWidth / 2,
    r = A.apertureRadius,
    cy = A.apertureCenterY;
  rect('wall', -W, 1.7, -h, cy - r);
  rect('wall', h, 1.7, W, cy - r);
  Q(
    o,
    'wall',
    [
      [-h, A.doorTop, 0],
      [0, A.doorPeak, 0],
      [0, cy - r, 0],
      [-h, cy - r, 0],
    ].map(P),
    normal,
  );
  Q(
    o,
    'wall',
    [
      [0, A.doorPeak, 0],
      [h, A.doorTop, 0],
      [h, cy - r, 0],
      [0, cy - r, 0],
    ].map(P),
    normal,
  );
  // Actual closed doorway behind a five-sided physical reveal; no solid wall spans its front.
  const door = [
    [-h, 1.7],
    [h, 1.7],
    [h, A.doorTop],
    [0, A.doorPeak],
    [-h, A.doorTop],
  ];
  for (let j = 0; j < door.length; j++) {
    const b = door[j],
      c = door[(j + 1) % door.length];
    Q(
      o,
      'wall',
      [
        [...b, 0],
        [...c, 0],
        [...c, -A.doorDepth],
        [...b, -A.doorDepth],
      ].map(P),
    );
  }
  rect('metal', -h, 1.7, h, A.doorTop, -A.doorDepth, C.red);
  T(
    o,
    'metal',
    [
      [-h, A.doorTop, -A.doorDepth],
      [h, A.doorTop, -A.doorDepth],
      [0, A.doorPeak, -A.doorDepth],
    ].map(P),
    normal,
  );
  beam(o, 'metal', [0, 1.7, -A.doorDepth + 0.015], [0, 4.4, -A.doorDepth + 0.015], 0.025, P);
  for (const s of [-1, 1])
    box(
      o,
      'metal',
      [s * 0.22 - 0.025, 2.6, -A.doorDepth + 0.01],
      [s * 0.22 + 0.025, 2.85, -A.doorDepth + 0.06],
      P,
    );
  rect('wall', -W, cy - r, -r, cy + r);
  rect('wall', r, cy - r, W, cy + r);
  rect('wall', -W, cy + r, W, 6.9);
  const seg = [0, 12, 20, 32][lod];
  for (let j = 0; j < seg; j++) {
    const t = (j * 2 * Math.PI) / seg,
      u = ((j + 1) * 2 * Math.PI) / seg,
      ring = (v) => [r * Math.cos(v), cy + r * Math.sin(v)],
      sq = (v) => {
        const c = Math.cos(v),
          s = Math.sin(v),
          k = r / Math.max(Math.abs(c), Math.abs(s));
        return [k * c, cy + k * s];
      },
      b = ring(t),
      c = ring(u);
    Q(
      o,
      'wall',
      [
        [...b, 0],
        [...sq(t), 0],
        [...sq(u), 0],
        [...c, 0],
      ].map(P),
      normal,
    );
    Q(
      o,
      'wall',
      [
        [...b, 0],
        [...c, 0],
        [...c, -A.apertureDepth],
        [...b, -A.apertureDepth],
      ].map(P),
    );
    T(
      o,
      'dark',
      [
        [0, cy, -A.apertureDepth],
        [...b, -A.apertureDepth],
        [...c, -A.apertureDepth],
      ].map(P),
      normal,
    );
  }
  // Six curved roof lobes meet a small upper collar, with pale ribs defining the seams.
  const roof = [
    [R, 6.9],
    [R * 0.97, 7.4],
    [R * 0.82, 7.9],
    [1.15, 8.35],
  ];
  for (let j = 1; j < roof.length; j++) {
    const [r0, y0] = roof[j - 1],
      [r1, y1] = roof[j],
      w0 = r0 * Math.tan(Math.PI / 6),
      w1 = r1 * Math.tan(Math.PI / 6);
    Q(
      o,
      'wall',
      [P([-w0, y0, r0 - R]), P([w0, y0, r0 - R]), P([w1, y1, r1 - R]), P([-w1, y1, r1 - R])],
      [normal[0], 1, normal[2]],
    );
  }
  for (const s of [-1, 1]) {
    beam(o, 'stone', [s * W, 3.1, 0.025], [s * W, 6.85, 0.025], 0.055, P);
    for (let j = 1; j < roof.length; j++) {
      const [r0, y0] = roof[j - 1],
        [r1, y1] = roof[j];
      beam(
        o,
        'stone',
        [s * r0 * Math.tan(Math.PI / 6), y0, r0 - R + 0.025],
        [s * r1 * Math.tan(Math.PI / 6), y1, r1 - R + 0.025],
        0.055,
        P,
      );
    }
    if (lod >= 2)
      for (let j = 0; j < 12; j++) {
        const y = 3.3 + j * 0.28;
        beam(o, 'stone', [s * (W - 0.06), y, 0.03], [s * (W - 0.14), y + 0.12, 0.06], 0.04, P);
      }
  }
}
function fence(o, lod) {
  if (lod === 0) return;
  const N = A.cannonCount,
    rad = A.cannonRadius;
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N,
      P = ([x, y, z]) => [rad * Math.cos(a) + x, y, rad * Math.sin(a) + z];
    cylinder(
      o,
      'dark',
      lod === 3
        ? [
            [0.13, 0.05],
            [0.13, 0.75],
            [0.09, 0.85],
          ]
        : [
            [0.13, 0.05],
            [0.09, 0.85],
          ],
      [0, 3, 5, 7][lod],
      P,
    );
    if (lod === 3)
      cylinder(
        o,
        'dark',
        [
          [0.055, 0.85],
          [0.055, 0.86],
        ],
        [0, 3, 5, 7][lod],
        P,
      );
    const n = lod === 1 ? 1 : 3;
    let prev = [rad * Math.cos(a), 0.62, rad * Math.sin(a)];
    for (let j = 1; j <= n; j++) {
      const t = j / n,
        q = [
          rad * ((1 - t) * Math.cos(a) + t * Math.cos(b)),
          0.62 - 0.19 * Math.sin(Math.PI * t),
          rad * ((1 - t) * Math.sin(a) + t * Math.sin(b)),
        ];
      if (lod < 3) {
        Q(o, 'dark', [prev, q, [q[0], q[1] + 0.035, q[2]], [prev[0], prev[1] + 0.035, prev[2]]]);
        if (lod === 2)
          Q(o, 'dark', [
            [prev[0] - 0.018, prev[1], prev[2]],
            [q[0] - 0.018, q[1], q[2]],
            [q[0] + 0.018, q[1], q[2]],
            [prev[0] + 0.018, prev[1], prev[2]],
          ]);
      } else beam(o, 'dark', prev, q, 0.018);
      prev = q;
    }
  }
}
export function buildDemocracy(o, _frame = null, lod = 3) {
  prism(o, 'stone', outline(867021614), 0, A.lowerPlinthTop);
  prism(o, 'stone', outline(867021615), A.lowerPlinthTop, A.upperPlatformTop);
  for (const w of wingFrames) wing(o, w, lod);
  shrine(o, lod);
  fence(o, lod);
}
export const democracySkyline = (o) => buildDemocracy(o, null, 0),
  democracyDistrict = (o) => buildDemocracy(o, null, 1),
  democracyStreet = (o) => buildDemocracy(o, null, 2),
  democracyCloseup = (o) => buildDemocracy(o, null, 3);
export const democracyModel = {
  id: 'democracy_monument',
  key: 'democracy_monument',
  cell: 'w4/w4r',
  title: 'Democracy Monument',
  wikidataId: 'Q1186076',
  recipe: 'democracy-monument-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'monument',
  brief:
    'Whole mapped Democracy Monument: four24m swept ochre wings/diagonal feather seams/pale edge trim, gray relief pedestals, Naga fountain spouts/basins, six-face central shrine with physical recessed red doors and round upper apertures, lobed roof/twin golden offering bowls/constitution book, native architectural platforms/steps and75 cannon posts/chains. Original bounded medium-fi sculpture; traffic island roads/gardens/temporary flags/people/interiors excluded.',
  surfaces,
  build: buildDemocracy,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: [53, 33, 61],
  lookAt: [0, 9, 0],
  portableGroundY: -0.25,
  mediumFiContext: { scale: '1', groundY: -0.25 },
  qaCameras: [
    { name: 'whole-four-wings-and-central-shrine', position: [52, 32, 58], lookAt: [0, 10, 0] },
    {
      name: 'opposite-pedestal-relief-and-swept-wings',
      position: [-53, 28, -57],
      lookAt: [0, 10, 0],
    },
    {
      name: 'central-six-face-shrine-round-openings-red-doors-twin-bowls',
      position: [12, 9, 14],
      lookAt: [0, 6, 0],
    },
    {
      name: 'southwest-relief-pedestal-and-naga-basin',
      position: [-25, 7, 28],
      lookAt: [-10, 3, 12],
    },
    { name: 'native-component-plan-and-cannon-fence', position: [25, 75, 20], lookAt: [0, 0, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/democracy-runtime-overlay.mjs',
    level: 'skyline',
    export: 'democracySkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'democracyDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'democracyStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'democracyCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Four exact July2006 creator-public-domain originals already published on Qualla only. No supplemental imagery/copied pixels/bitmaps/metadata repairs. Sculptural relief figures and Naga forms are original medium-fi approximations, no exact portraits/calligraphy or current finish survey. Native site boundary is context only and not filled; lower/upper plinth/component controls retained. Skyline omits small fence/fountains/relief figures; district restores75 posts/chains/round openings/physical doors; nearlevels restore original sculptural interpretations.',
    'Independent400m129x129 sourcefield/two raw tiles frozen before all floors/sections. Fixed8.0674m provider datum unmodified. Urban DEM artifacts/source grade unsurveyed; exact footing and fountain basin contacts unresolved. Geographic preview/replaceFootprint=false; no fit/flatten/reacquire.',
  ],
};
