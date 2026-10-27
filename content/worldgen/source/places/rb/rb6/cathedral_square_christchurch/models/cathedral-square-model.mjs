/** Intact central Cathedral Square architecture in the fixed prequake geographic frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  A = p.cathedral,
  R = p.nativeOutline,
  F = p.floors.cathedral.y;
const C = {
  wall: rgb('8f9794'),
  trim: rgb('e1ddca'),
  roof: rgb('68736f'),
  paint: rgb('527083'),
  steel: rgb('c5d0d0'),
  bronze: rgb('7b8c78'),
  red: rgb('a96b61'),
  blue: rgb('548ab3'),
  green: rgb('568b7b'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_basalt', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.5, metallic: 0.7 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.7, metallic: 0.5 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  lift = (q, y) => [q[0], y, q[1]],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
let tris = 0;
export const partEvidence = [],
  apertureEvidence = [],
  figureEvidence = [],
  leafEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => q.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
  tris++;
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function cap(o, k, r, y, up = 1, col) {
  for (const t of ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  ))
    T(
      o,
      k,
      t.map((i) => lift(r[i], typeof y === 'function' ? y(r[i]) : y)),
      [0, up, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col) {
  const s = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [lift(a, y), lift(b, y), lift(b, Y), lift(a, Y)],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, Y, 1, col);
  cap(o, k, r, y, -1, col);
}
function B(o, k, x, y, z, w, h, d, col) {
  solid(o, k, rect(x, z, w, d), y, y + h, col);
}
function bar(o, k, a, b, r, sides = 5, col) {
  const dir = sub(b, a),
    L = Math.hypot(...dir);
  if (L < 1e-7) return;
  const w = dir.map((v) => v / L),
    base = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
    v = cross(w, base),
    V = v.map((q) => q / Math.hypot(...v)),
    U = cross(w, V),
    ring = (c, i) =>
      c.map(
        (v, k) =>
          v +
          r *
            (U[k] * Math.cos((i * 2 * Math.PI) / sides) +
              V[k] * Math.sin((i * 2 * Math.PI) / sides)),
      );
  for (let i = 0; i < sides; i++)
    Q(
      o,
      k,
      [ring(a, i), ring(a, i + 1), ring(b, i + 1), ring(b, i)],
      U.map(
        (v, k) =>
          v * Math.cos(((i + 0.5) * 2 * Math.PI) / sides) +
          V[k] * Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
      ),
      col,
    );
}
function sphere(o, k, c, s, n = 8, rows = 5, col, heading = 0) {
  const q = (i, j) => {
    const t = -Math.PI / 2 + (j * Math.PI) / rows,
      a = (i * 2 * Math.PI) / n;
    return [
      c[0] +
        s[0] * Math.cos(t) * Math.cos(a) * Math.cos(heading) +
        s[2] * Math.cos(t) * Math.sin(a) * Math.sin(heading),
      c[1] + s[1] * Math.sin(t),
      c[2] -
        s[0] * Math.cos(t) * Math.cos(a) * Math.sin(heading) +
        s[2] * Math.cos(t) * Math.sin(a) * Math.cos(heading),
    ];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++)
      Q(
        o,
        k,
        [q(i, j), q(i + 1, j), q(i + 1, j + 1), q(i, j + 1)],
        sub(q(i + 0.5, j + 0.5), c),
        col,
      );
}
function circle(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / n),
    y + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function arch(cx, w, y, spring, top, n) {
  const r = [
    [cx - w / 2, y],
    [cx + w / 2, y],
    [cx + w / 2, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    r.push([cx + (w / 2) * (1 - t * t), spring + (top - spring) * t]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = i / n;
    r.push([cx - (w / 2) * (1 - t * t), spring + (top - spring) * t]);
  }
  return r;
}
function face(o, a, b, lo, hi, holes, lod, s = 1, id = 'window', col = C.paint) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    u = [dx / L, dz / L],
    N = [(s * dz) / L, 0, (-s * dx) / L],
    P = (q, d = 0) => [a[0] + u[0] * q[0] - N[0] * d, q[1], a[1] + u[1] * q[0] - N[2] * d],
    outer = [
      [0, lo],
      [L, lo],
      [L, hi],
      [0, hi],
    ],
    valid = holes.filter((r) =>
      r.every((q) => q[0] > 0.04 && q[0] < L - 0.04 && q[1] > lo + 0.04 && q[1] < hi - 0.04),
    );
  if (
    lod > 0 &&
    id.startsWith('cathedral-native-wall-') &&
    id !== 'cathedral-native-wall-3' &&
    L > 4.5
  ) {
    const count = Math.max(1, Math.floor(L / 4));
    for (let j = 0; j <= count; j++)
      B(
        o,
        'trim',
        a[0] + (u[0] * L * j) / count + N[0] * 0.12,
        lo,
        a[1] + (u[1] * L * j) / count + N[2] * 0.12,
        0.35,
        hi - lo,
        0.35,
      );
  }
  if (lod < 2) {
    Q(
      o,
      'wall',
      outer.map((q) => P(q)),
      N,
    );
    if (lod === 1)
      for (const r of valid)
        for (const t of ShapeUtils.triangulateShape(
          r.map((q) => new Vector2(...q)),
          [],
        ))
          T(
            o,
            'paint',
            t.map((i) => P(r[i], -0.015)),
            N,
            id.startsWith('tower-face-') && Math.max(...r.map((q) => q[1])) < F + 20
              ? C.paint
              : col,
          );
    return;
  }
  const points = outer.concat(...valid);
  for (const t of ShapeUtils.triangulateShape(
    outer.map((q) => new Vector2(...q)),
    valid.map((r) => r.map((q) => new Vector2(...q))),
  ))
    T(
      o,
      'wall',
      t.map((i) => P(points[i])),
      N,
    );
  for (const r of valid) {
    const pane =
      id.startsWith('tower-face-') && Math.max(...r.map((q) => q[1])) < F + 20 ? C.paint : col;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      Q(o, 'trim', [P(a), P(b), P(b, 0.34), P(a, 0.34)]);
    }
    for (const t of ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      [],
    ))
      T(
        o,
        'paint',
        t.map((i) => P(r[i], 0.34)),
        N,
        pane,
      );
    const cx = r.reduce((s, q) => s + q[0], 0) / r.length,
      cy = (Math.min(...r.map((q) => q[1])) + Math.max(...r.map((q) => q[1]))) / 2;
    apertureEvidence.push({ id, center: P([cx, cy]), normal: N, depth: 0.34 });
    if (lod >= 3) {
      const c = [cx, cy],
        expanded = r.map((q) => [c[0] + (q[0] - c[0]) * 1.12, c[1] + (q[1] - c[1]) * 1.04]);
      for (let i = 0; i < r.length; i++)
        Q(
          o,
          'trim',
          [
            P(r[i], -0.035),
            P(r[(i + 1) % r.length], -0.035),
            P(expanded[(i + 1) % r.length], -0.035),
            P(expanded[i], -0.035),
          ],
          N,
        );
    }
  }
}
function roof(o, x, X, z, Z, eave, peak, alongX = true) {
  if (alongX) {
    const mid = (z + Z) / 2;
    Q(
      o,
      'roof',
      [
        [x, eave, z],
        [X, eave, z],
        [X, peak, mid],
        [x, peak, mid],
      ],
      [0, 1, -1],
    );
    Q(
      o,
      'roof',
      [
        [x, peak, mid],
        [X, peak, mid],
        [X, eave, Z],
        [x, eave, Z],
      ],
      [0, 1, 1],
    );
    T(
      o,
      'wall',
      [
        [x, eave, z],
        [x, peak, mid],
        [x, eave, Z],
      ],
      [-1, 0, 0],
    );
    T(
      o,
      'wall',
      [
        [X, eave, Z],
        [X, peak, mid],
        [X, eave, z],
      ],
      [1, 0, 0],
    );
  } else {
    const mid = (x + X) / 2;
    Q(
      o,
      'roof',
      [
        [x, eave, z],
        [mid, peak, z],
        [mid, peak, Z],
        [x, eave, Z],
      ],
      [-1, 1, 0],
    );
    Q(
      o,
      'roof',
      [
        [mid, peak, z],
        [X, eave, z],
        [X, eave, Z],
        [mid, peak, Z],
      ],
      [1, 1, 0],
    );
    T(
      o,
      'wall',
      [
        [x, eave, Z],
        [mid, peak, Z],
        [X, eave, Z],
      ],
      [0, 0, 1],
    );
    T(
      o,
      'wall',
      [
        [X, eave, z],
        [mid, peak, z],
        [x, eave, z],
      ],
      [0, 0, -1],
    );
  }
}
function ringFace(o, k, x, cy, cz, r, R, n, col) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    Q(
      o,
      k,
      [
        [x, cy + r * Math.sin(a), cz + r * Math.cos(a)],
        [x, cy + r * Math.sin(b), cz + r * Math.cos(b)],
        [x, cy + R * Math.sin(b), cz + R * Math.cos(b)],
        [x, cy + R * Math.sin(a), cz + R * Math.cos(a)],
      ],
      [-1, 0, 0],
      col,
    );
  }
}
function cathedral(o, lod) {
  const before = tris,
    n = [4, 3, 12, 16][lod];
  solid(o, 'trim', R, F - A.foundationDepth, F);
  cap(o, 'roof', R, F + A.aisleEaves);
  const s = Math.sign(area(R));
  for (let i = 0; i < R.length; i++) {
    if ([0, 43, 44, 45].includes(i)) continue;
    const a = R[i],
      b = R[(i + 1) % R.length],
      L = Math.hypot(...sub(a, b));
    let hs = [];
    if (i === 3) {
      hs = [
        arch(L / 2, 3.6, F + 0.3, F + 4.4, F + 7.2, n),
        arch(L / 2 - 4, 1.15, F + 1.3, F + 3.7, F + 5.4, n),
        arch(L / 2 + 4, 1.15, F + 1.3, F + 3.7, F + 5.4, n),
      ];
    } else if (L > 4.5) {
      const count = Math.max(1, Math.floor(L / 4));
      hs = Array.from({ length: count }, (_, j) =>
        arch((L * (j + 0.5)) / count, Math.min(1.6, (L / count) * 0.5), F + 2, F + 4.8, F + 6.6, n),
      );
    }
    if (i === 12) hs = [-3.3, 0, 3.3].map((v) => arch(L / 2 + v, 2, F + 3, F + 14.8, F + 17.3, n));
    face(
      o,
      a,
      b,
      F,
      F + (i === 12 ? A.transeptEaves : A.aisleEaves),
      hs,
      lod,
      s,
      'cathedral-native-wall-' + i,
      i === 3 ? C.red : C.paint,
    );
  }
  const x = A.naveWest,
    X = A.naveEast,
    z = A.naveNorth,
    Z = A.naveSouth,
    upper = rect((x + X) / 2, (z + Z) / 2, X - x, Z - z);
  for (let i = 0; i < 4; i++) {
    const a = upper[i],
      b = upper[(i + 1) % 4],
      L = Math.hypot(...sub(a, b)),
      hs =
        i === 3
          ? [circle(L / 2, F + A.frontRose.y, A.frontRose.radius, [8, 16, 32, 48][lod])]
          : i % 2 === 0
            ? Array.from({ length: 11 }, (_, j) =>
                arch((L * (j + 0.5)) / 11, 2.1, F + 14.6, F + 17.5, F + 19.4, n),
              )
            : [];
    const visible = hs.filter((r) => {
      if (i !== 0 && i !== 2) return true;
      const u = r.reduce((s, q) => s + q[0], 0) / r.length,
        xx = a[0] + ((b[0] - a[0]) * u) / L;
      return xx < 33.6 || xx > 46.3;
    });
    face(o, a, b, F + A.aisleEaves, F + A.naveEaves, visible, lod, 1, 'clerestory-' + i);
  }
  roof(o, x, X, z, Z, F + A.naveEaves, F + A.naveRidge);
  Q(
    o,
    'roof',
    [
      [x, F + 8.8, -16.7],
      [X, F + 8.8, -16.7],
      [X, F + 13.4, z],
      [x, F + 13.4, z],
    ],
    [0, 1, -1],
  );
  Q(
    o,
    'roof',
    [
      [x, F + 13.4, Z],
      [X, F + 13.4, Z],
      [X, F + 8.8, 6.8],
      [x, F + 8.8, 6.8],
    ],
    [0, 1, 1],
  );
  // Two complete transept arms and intrinsic lower east annexes.
  for (const [z, Z] of [
    [-20.3, -13],
    [1, 10.2],
  ]) {
    const ring = rect(39.95, (z + Z) / 2, 12.7, Z - z);
    for (let j = 0; j < 4; j++)
      if (!(z > 0 && j === 2))
        face(
          o,
          ring[j],
          ring[(j + 1) % 4],
          F + 8.8,
          F + A.transeptEaves,
          [],
          lod,
          1,
          'transept-side',
        );
    cap(o, 'wall', ring, F + A.transeptEaves);
    roof(
      o,
      33.6,
      46.3,
      z < 0 ? z : A.naveAxis,
      z < 0 ? A.naveAxis : Z,
      F + A.transeptEaves,
      F + A.transeptRidge,
      false,
    );
  }
  roof(o, 46.3, 65.35, 8.4, 13.9, F + 8.8, F + 11.5);
  roof(o, 51.25, 64.7, -21.95, -12.35, F + 8.8, F + 12.8);
  roof(o, 8.8, 16.9, 6.9, 11.4, F + 8.8, F + 12.2, false);
  const apse = [R[18], ...R.slice(19, 29)],
    center = A.apseCenter;
  solid(o, 'wall', apse, F + 8.8, F + A.apseEaves);
  for (let i = 0; i < apse.length - 1; i++)
    T(
      o,
      'roof',
      [
        lift(center, F + A.apseRidge),
        lift(apse[i], F + A.apseEaves),
        lift(apse[i + 1], F + A.apseEaves),
      ],
      [0, 1, 0],
    );
  // Whole west entrance, rose tracery and stone quoin rhythm.
  roof(o, -5.5, 0.92, -10.45, 1.42, F + 7.8, F + A.porchPeak);
  const rx = x - 0.03,
    cy = F + A.frontRose.y,
    cz = A.frontRose.z;
  ringFace(o, 'trim', rx, cy, cz, A.frontRose.radius, 3.65, [8, 16, 28, 48][lod]);
  if (lod > 0) {
    ringFace(o, 'trim', rx - 0.03, cy, cz, 0.44, 0.7, [8, 12, 16, 24][lod]);
    for (let i = 0; i < [4, 8, 12, 12][lod]; i++) {
      const a = (i * 2 * Math.PI) / [4, 8, 12, 12][lod];
      bar(
        o,
        'trim',
        [rx - 0.05, cy + 0.7 * Math.sin(a), cz + 0.7 * Math.cos(a)],
        [rx - 0.05, cy + 3.15 * Math.sin(a), cz + 3.15 * Math.cos(a)],
        lod === 1 ? 0.09 : 0.07,
        4,
      );
      if (lod >= 2)
        ringFace(
          o,
          'trim',
          rx - 0.07,
          cy + 2.35 * Math.sin(a),
          cz + 2.35 * Math.cos(a),
          0.42,
          0.58,
          lod === 2 ? 8 : 12,
        );
    }
  }
  if (lod > 0) {
    for (let i = 0; i < 4; i++)
      B(
        o,
        'trim',
        i === 0 ? -6.3 : -6.6 - i,
        F + 0.18 - i * 0.1,
        -4.5,
        i === 0 ? 1.6 : 1.0,
        0.12,
        12.2 + i * 0.35,
      );
    for (const zz of [z, Z]) B(o, 'trim', x - 0.08, F + 8.8, zz, 0.4, 12.5, 0.4);
  }
  if (lod >= 2) {
    for (const side of [-1, 1])
      for (const t of [0.28, 0.57, 0.82]) {
        const zz = -6 + side * 7 * t,
          y = F + 30 - 8.7 * t;
        for (let i = 0; i < 13; i++) {
          const xx = 2.0 + i * 3.9;
          Q(
            o,
            'roof',
            [
              [xx, y, zz],
              [xx + 1.65, y - 0.8, zz + side * 0.65],
              [xx + 3.3, y, zz],
              [xx + 1.65, y + 0.8, zz - side * 0.65],
            ],
            [0, 1, side],
            rgb('87928a'),
          );
        }
      }
  }
  partEvidence.push({ id: 'whole-native-cathedral', triangles: tris - before });
}
function tower(o, lod) {
  const before = tris,
    r = A.towerFootprint,
    s = Math.sign(area(r)),
    x = A.towerCenter[0],
    z = A.towerCenter[1],
    n = [4, 3, 10, 14][lod];
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(...sub(a, b)),
      hs = [
        arch(L * 0.28, 1.3, F + 5, F + 12.2, F + 14.2, n),
        arch(L * 0.72, 1.3, F + 5, F + 12.2, F + 14.2, n),
        arch(L * 0.3, 2.45, F + 24, F + 29.3, F + 31.6, n),
        arch(L * 0.7, 2.45, F + 24, F + 29.3, F + 31.6, n),
      ];
    face(o, a, b, F, F + A.towerCornice, hs, lod, s, 'tower-face-' + i, C.red);
    if (lod > 0) {
      const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        N = [s * u[1], -s * u[0]];
      for (const t of [0.05, 0.95]) {
        B(
          o,
          'trim',
          a[0] + (b[0] - a[0]) * t + N[0] * 0.12,
          F,
          a[1] + (b[1] - a[1]) * t + N[1] * 0.12,
          0.62,
          33.6,
          0.62,
        );
      }
      if (lod >= 2)
        for (const t of [0.3, 0.7])
          for (let j = 0; j < 6; j++) {
            const mid = [
              a[0] + u[0] * L * t - N[0] * 0.24,
              F + 24.4 + j * 0.85,
              a[1] + u[1] * L * t - N[1] * 0.24,
            ];
            bar(
              o,
              'paint',
              [mid[0] - u[0] * 1.15, mid[1], mid[2] - u[1] * 1.15],
              [mid[0] + u[0] * 1.15, mid[1], mid[2] + u[1] * 1.15],
              0.08,
              4,
              C.red,
            );
          }
    }
  }
  for (const [y, w] of [
    [16, 0.22],
    [22, 0.28],
    [33.4, 0.45],
  ])
    solid(
      o,
      'trim',
      r.map((q) => [x + (q[0] - x) * (1 + w / 5.5), z + (q[1] - z) * (1 + w / 5.5)]),
      F + y,
      F + y + 0.3,
    );
  const count = 8,
    point = (rr, y, i) => [
      x + rr * Math.cos((i * 2 * Math.PI) / count + Math.PI / 8),
      F + y,
      z + rr * Math.sin((i * 2 * Math.PI) / count + Math.PI / 8),
    ],
    levels = [
      [4.7, 34.5],
      [1.0, 56.5],
      [0.05, 61.4],
    ];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < count; i++)
      Q(
        o,
        j === 0 ? 'roof' : 'paint',
        [
          point(...levels[j], i),
          point(...levels[j], i + 1),
          point(...levels[j + 1], i + 1),
          point(...levels[j + 1], i),
        ],
        [
          Math.cos(((i + 0.5) * 2 * Math.PI) / count + Math.PI / 8),
          0,
          Math.sin(((i + 0.5) * 2 * Math.PI) / count + Math.PI / 8),
        ],
        j === 0 ? C.roof : C.green,
      );
  for (const a of r) {
    B(o, 'trim', a[0], F + 34, a[1], 0.7, 2.3, 0.7);
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2,
        v = (rr, y, t) => [a[0] + rr * Math.cos(t), F + y, a[1] + rr * Math.sin(t)];
      T(o, 'trim', [v(0.6, 36.3, t), v(0.6, 36.3, t + Math.PI / 2), v(0, 40, t)], [0, 1, 0]);
    }
  }
  bar(o, 'trim', [x, F + 61.35, z], [x, F + 62, z], 0.07, 4);
  bar(o, 'trim', [x - 0.24, F + 61.72, z], [x + 0.24, F + 61.72, z], 0.06, 4);
  partEvidence.push({ id: 'complete-native-tower-spire', triangles: tris - before });
}
function chalice(o, lod) {
  const before = tris,
    a = p.chalice,
    [x, z] = a.center,
    f = p.floors.chalice.y,
    N = [6, 8, 12, 16][lod],
    rr = Array.from({ length: N }, (_, i) => [
      x + a.graniteBandRadius * Math.cos((i * 2 * Math.PI) / N),
      z + a.graniteBandRadius * Math.sin((i * 2 * Math.PI) / N),
    ]);
  solid(o, 'wall', rr, f - 0.65, f + 0.12);
  const P = (angle, y, spread = 0) => {
    const r = a.baseRadius + ((a.topRadius - a.baseRadius) * y) / a.height;
    return [
      x + r * Math.cos(angle) - spread * Math.sin(angle),
      f + y,
      z + r * Math.sin(angle) + spread * Math.cos(angle),
    ];
  };
  const rows = [3, 5, 7, 7][lod],
    around = [4, 6, 6, 6][lod];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < around; i++) {
      const y = 1.3 + (j + 0.5) * (16.7 / rows),
        angle = ((i + (lod ? (j % 2) * 0.5 : 0)) * 2 * Math.PI) / around,
        w = (0.48 + y * 0.055) * (lod ? 1 : 0.9),
        h = (16.7 / rows) * 0.7,
        shape =
          lod < 2
            ? [
                [0, -h],
                [w, 0],
                [0, h],
                [-w, 0],
              ]
            : [
                [0, -h],
                [w * 0.45, -h * 0.5],
                [w, -h * 0.3],
                [w * 0.62, 0.1],
                [w, h * 0.38],
                [w * 0.2, h * 0.7],
                [0, h],
                [-w * 0.2, h * 0.7],
                [-w, h * 0.38],
                [-w * 0.62, 0.1],
                [-w, -h * 0.3],
                [-w * 0.45, -h * 0.5],
              ],
        q = shape.map(([s, t]) => P(angle, Math.min(a.height, Math.max(0.3, y + t)), s));
      for (let k = 1; k < q.length - 1; k++) {
        T(o, 'steel', [q[0], q[k], q[k + 1]], [Math.cos(angle), 0, Math.sin(angle)], C.steel);
        T(o, 'steel', [q[k + 1], q[k], q[0]], [-Math.cos(angle), 0, -Math.sin(angle)], C.blue);
      }
      leafEvidence.push({ center: P(angle, y), row: j, index: i });
    }
  if (!lod) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      bar(o, 'steel', P(angle, 0), P(angle, 18), 0.09, 4);
      bar(o, 'steel', P(angle, 18), P(angle + Math.PI / 2, 18), 0.09, 4);
    }
  } else {
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < around; i++) {
        const angle = ((i + (j % 2) * 0.5) * 2 * Math.PI) / around;
        bar(
          o,
          'steel',
          P(angle, (j * 18) / rows),
          P(angle + (2 * Math.PI) / around, (j * 18) / rows),
          0.055,
          4,
        );
        if (j < rows)
          bar(
            o,
            'steel',
            P(angle, (j * 18) / rows),
            P(((i + ((j + 1) % 2) * 0.5) * 2 * Math.PI) / around, ((j + 1) * 18) / rows),
            0.055,
            4,
          );
      }
  }
  partEvidence.push({
    id: 'whole-openwork-chalice',
    triangles: tris - before,
    motifs: leafEvidence.length,
  });
}
function person(o, x, y, z, h, lod, kind, angle = 0) {
  const before = tris,
    co = Math.cos(angle),
    si = Math.sin(angle),
    W = (q) => [x + q[0] * co + q[2] * si, y + q[1], z - q[0] * si + q[2] * co],
    bone = (a, b, r) => bar(o, 'bronze', W(a), W(b), r, [4, 4, 6, 8][lod]),
    blob = (c, s) =>
      sphere(o, 'bronze', W(c), s, [4, 4, 8, 10][lod], [2, 2, 4, 5][lod], undefined, angle);
  if (!lod) {
    bone([0, 0, 0], [0, h * 0.76, 0], h * 0.12);
    blob([0, h * 0.9, 0], [h * 0.11, h * 0.12, h * 0.1]);
    if (kind === 'angel')
      for (const side of [-1, 1]) {
        const q = [
          [0.08 * side * h, h * 0.68, -0.08 * h],
          [0.25 * side * h, h * 1.18, -0.16 * h],
          [0.68 * side * h, h * 1.42, -0.22 * h],
          [0.55 * side * h, h * 0.73, -0.14 * h],
        ].map(W);
        Q(o, 'bronze', q);
        Q(o, 'bronze', q.slice().reverse());
      }
    figureEvidence.push({ kind, center: [x, y + h / 2, z], height: h, triangles: tris - before });
    return;
  }
  const seated = kind === 'sacrifice',
    hip = seated ? h * 0.36 : h * 0.5,
    shoulder = seated ? h * 0.62 : h * 0.77;
  blob([0, (hip + shoulder) / 2, 0], [h * 0.18, (shoulder - hip) / 2 + h * 0.08, h * 0.12]);
  blob([0, shoulder + h * 0.11, 0], [h * 0.105, h * 0.13, h * 0.1]);
  bone(
    [-0.1 * h, hip, 0],
    [-0.13 * h, seated ? h * 0.25 : 0.08 * h, seated ? 0.25 * h : 0],
    h * 0.085,
  );
  bone(
    [0.1 * h, hip, 0],
    [0.13 * h, seated ? h * 0.25 : 0.08 * h, seated ? 0.25 * h : 0],
    h * 0.085,
  );
  if (seated) {
    bone([-0.13 * h, 0.25 * h, 0.25 * h], [-0.13 * h, 0.02 * h, 0.25 * h], h * 0.07);
    bone([0.13 * h, 0.25 * h, 0.25 * h], [0.13 * h, 0.02 * h, 0.25 * h], h * 0.07);
  }
  const left =
      kind === 'youth'
        ? [
            [-0.17 * h, shoulder, 0],
            [-0.3 * h, h * 0.92, 0.02 * h],
            [-0.25 * h, h * 1.2, 0.02 * h],
          ]
        : kind === 'godley'
          ? [
              [-0.17 * h, shoulder, 0],
              [-0.27 * h, h * 0.58, 0.03 * h],
              [-0.34 * h, h * 0.66, 0.09 * h],
            ]
          : [
              [-0.17 * h, shoulder, 0],
              [-0.27 * h, h * 0.51, 0.1 * h],
              [-0.42 * h, h * 0.45, 0.12 * h],
            ],
    right =
      kind === 'angel'
        ? [
            [0.17 * h, shoulder, 0],
            [0.34 * h, h * 0.9, 0],
            [0.17 * h, h * 1.1, 0.1 * h],
          ]
        : [
            [0.17 * h, shoulder, 0],
            [0.26 * h, h * 0.53, 0],
            [0.24 * h, h * 0.3, 0.05 * h],
          ];
  for (const arm of [left, right]) {
    bone(arm[0], arm[1], h * 0.06);
    bone(arm[1], arm[2], h * 0.045);
    blob(arm[2], [h * 0.05, h * 0.06, h * 0.04]);
  }
  for (const xx of [-0.13 * h, 0.13 * h])
    blob([xx, 0.025 * h, seated ? 0.29 * h : 0.05 * h], [h * 0.09, h * 0.045, h * 0.15]);
  if (kind === 'godley') {
    bone([-0.33 * h, h * 0.62, 0.02 * h], [-0.3 * h, 0.1 * h, 0.03 * h], h * 0.11);
    blob([0.25 * h, 0.23 * h, 0.07 * h], [h * 0.13, h * 0.12, h * 0.04]);
  }
  if (kind === 'youth')
    bone([-0.25 * h, h * 1.18, 0.02 * h], [-0.25 * h, h * 1.36, 0.02 * h], h * 0.035);
  if (kind === 'angel') {
    for (const side of [-1, 1]) {
      const q = [
        [0.08 * side * h, h * 0.68, -0.08 * h],
        [0.25 * side * h, h * 1.18, -0.16 * h],
        [0.68 * side * h, h * 1.42, -0.22 * h],
        [0.55 * side * h, h * 0.73, -0.14 * h],
      ].map(W);
      Q(o, 'bronze', q);
      Q(o, 'bronze', q.slice().reverse());
    }
    bone([-0.25 * h, h * 1.1, 0.12 * h], [0.25 * h, h * 1.1, 0.12 * h], h * 0.025);
  }
  if (lod >= 3) {
    blob([0, shoulder + h * 0.11, 0.095 * h], [h * 0.035, h * 0.04, h * 0.035]);
    for (const xx of [-0.04 * h, 0.04 * h])
      blob([xx, shoulder + h * 0.145, 0.081 * h], [h * 0.018, h * 0.012, h * 0.008]);
    for (let i = 0; i < 4; i++)
      bone(
        [-0.12 * h + i * 0.08 * h, hip, 0],
        [-0.12 * h + i * 0.08 * h, shoulder, 0.1 * h],
        h * 0.012,
      );
  }
  figureEvidence.push({ kind, center: [x, y + h / 2, z], height: h, triangles: tris - before });
}
function godley(o, lod) {
  const before = tris,
    a = p.godley,
    [x, z] = a.center,
    f = p.floors.godley.y,
    s = [4, 8, 8, 8][lod];
  for (const [w, y, h] of lod === 0
    ? [
        [4.2, -0.8, 1.5],
        [1.9, 0.7, 3.0],
      ]
    : [
        [4.2, -0.8, 1.0],
        [3.6, 0.2, 0.25],
        [3.0, 0.45, 0.25],
        [2.35, 0.7, 0.4],
        [1.9, 1.1, 2.35],
        [2.05, 3.45, 0.25],
      ]) {
    const ring = Array.from({ length: s }, (_, i) => {
      const t = (i * 2 * Math.PI) / s + Math.PI / 8;
      return [x + w * 0.54 * Math.cos(t), z + w * 0.54 * Math.sin(t)];
    });
    solid(o, 'wall', ring, f + y, f + y + h);
  }
  person(o, x, f + a.plinthHeight, z, a.figureHeight, lod, 'godley', Math.PI / 2);
  partEvidence.push({ id: 'whole-godley-statue-and-plinth', triangles: tris - before });
}
function memorial(o, lod) {
  const before = tris,
    a = p.memorial,
    [x, z] = a.center,
    f = p.floors.memorial.y,
    r = a.nativeOutline;
  for (const [scale, y, Y] of lod === 0
    ? [
        [1, -0.8, 0.7],
        [0.37, 0.7, 2.1],
      ]
    : [
        [1, -0.8, 0.2],
        [0.85, 0.2, 0.45],
        [0.7, 0.45, 0.7],
        [0.5, 0.7, 1.2],
        [0.37, 1.2, 2.1],
      ])
    solid(
      o,
      'trim',
      r.map((q) => [x + (q[0] - x) * scale, z + (q[1] - z) * scale]),
      f + y,
      f + Y,
    );
  B(o, 'trim', x, f + 2.1, z, 1.25, 12.9, 1.15);
  B(o, 'trim', x, f + 12.8, z, 5.0, 0.95, 1.15);
  B(o, 'trim', x, f + 1.7, z, 3.4, 2.8, 2.3);
  const poses = [
    ['sacrifice', [-2, 0, 0], -Math.PI / 2],
    ['youth', [-0.7, 0, -1.7], -0.3],
    ['george', [0.7, 0, 1.7], 2.6],
    ['peace', [1.5, 0, -1.6], 0.3],
    ['justice', [1.5, 0, 1.1], 2.9],
    ['angel', [-0.7, 6.9, 0], -Math.PI / 2],
  ];
  for (const [k, q, angle] of poses)
    person(o, x + q[0], f + 2.1 + q[1], z + q[2], k === 'angel' ? 2.35 : 2, lod, k, angle);
  partEvidence.push({ id: 'whole-war-memorial-cross-six-figures', triangles: tris - before });
}
export function buildCathedralSquare(o, _frame, lod = 3) {
  tris = 0;
  partEvidence.length = 0;
  apertureEvidence.length = 0;
  figureEvidence.length = 0;
  leafEvidence.length = 0;
  cathedral(o, lod);
  tower(o, lod);
  chalice(o, lod);
  godley(o, lod);
  memorial(o, lod);
}
export const squareSkyline = (o) => buildCathedralSquare(o, null, 0),
  squareDistrict = (o) => buildCathedralSquare(o, null, 1),
  squareStreet = (o) => buildCathedralSquare(o, null, 2),
  squareCloseup = (o) => buildCathedralSquare(o, null, 3);
const look = [7, 20, -3],
  outlines = [
    R,
    p.memorial.nativeOutline,
    circle(...p.chalice.center, p.chalice.graniteBandRadius, 12),
    rect(...p.godley.center, 4.6, 4.6),
    rect(-7.8, -4.5, 4.7, 13.3),
  ];
export const cathedralSquareModel = {
  id: 'cathedral_square_christchurch',
  key: 'cathedral_square_christchurch',
  cell: 'rb/rb6',
  title: 'Cathedral Square, Christchurch — intact2008 architectural ensemble',
  wikidataId: 'Q1050885',
  category: 'civic-architecture',
  recipe: 'cathedral-square-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCathedralSquare,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief: p.scope,
  appearance: {
    kind: 'historical',
    representedDate: p.representedDate,
    validFrom: '2008-01-01',
    validUntil: '2011-02-21',
    currentWorldEligible: false,
  },
  camera: [-135, 92, 150],
  lookAt: look,
  mediumFiContext: {
    scale: 2,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  groundCutout: {
    outline: R,
    outlines,
    additionalOutlines: outlines.slice(1),
    basis:
      'Four physical architecture/monument bases only. No entire square/road/parcel/landscape cutout or field normalization. Prequake interpretation, current source contact not certified.',
  },
  qaCameras: [
    { name: 'whole-prequake-square', position: [-125, 85, 125], lookAt: look },
    { name: 'west-rose-gothic-portals', position: [-54, 23, 12], lookAt: [0, 16, -6] },
    { name: 'whole-south-aisle-transept-and-apse', position: [85, 50, 70], lookAt: [30, 15, -5] },
    { name: 'red-belfry-and-intact-spire', position: [-40, 45, -65], lookAt: [2, 36, -21] },
    { name: 'openwork-chalice', position: [-45, 13, 64], lookAt: [-22, 10, 40] },
    {
      name: 'godley-full-statue-and-plinth',
      position: [-49.5, 4.8, 2],
      lookAt: [-58.47, 3, -4.37],
    },
    { name: 'whole-six-figure-memorial', position: [-8, 10, -58], lookAt: [14.7, 7, -42.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-square-' + reviewLod,
    position: [-125, 85, 125],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/rb/rb6/cathedral_square_christchurch/models/cathedral-square-model.mjs',
    level: 'skyline',
    export: 'squareSkyline',
    errorMeters: p.lodErrorBudgets.skyline,
    surfaces,
    authoredLevels: {
      district: { export: 'squareDistrict', errorMeters: p.lodErrorBudgets.district, surfaces },
      street: { export: 'squareStreet', errorMeters: p.lodErrorBudgets.street, surfaces },
      closeup: { export: 'squareCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.sectionBasis,
    p.limitations,
    'Dated2008only; no current damaged-cathedral or later relocated monument/site appearance claim. Complete ensemble geometry includes approximate sculpture anatomy/ornament and hidden cathedral roofs/elevations; source photographs never become textures. Original field/frame/floors/main sections remain fixed.',
  ],
};
