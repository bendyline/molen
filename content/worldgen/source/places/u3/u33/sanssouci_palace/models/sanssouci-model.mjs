/** Original complete principal Sanssouci ensemble. Meters,+Y up,+X east,+Z south. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const sanssouciControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = sanssouciControls,
  H = a.geometryControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('ecd799'),
    stone: lin('dfd1b4'),
    frame: lin('eeebdf'),
    roof: lin('687270'),
    copper: lin('8db9ab'),
    glass: lin('8699a2'),
    trellis: lin('769c83'),
    dark: lin('555c5b'),
    gold: lin('c4a25c'),
  };
export const sanssouciSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.74, metallic: 0.15 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.65, metallic: 0.5 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.06 },
  trellis: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
};
const configs = {
  skyline: { far: true, sides: 4, dome: 8, stations: 8, curve: 4, arch: 2 },
  district: { flat: true, sides: 4, dome: 12, stations: 22, curve: 10, arch: 3 },
  street: { frames: true, flatFrames: true, sides: 8, dome: 20, stations: 22, curve: 16, arch: 6 },
  closeup: { frames: true, detail: true, sides: 12, dome: 32, stations: 22, curve: 20, arch: 12 },
  master: {
    frames: true,
    detail: true,
    fine: true,
    sides: 24,
    dome: 64,
    stations: 22,
    curve: 40,
    arch: 24,
  },
};
export function sanssouciGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    h = g.elevationsMeters,
    n = g.size[0];
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((t, p, i) => {
      const q = r[(i + 1) % r.length];
      return t + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  },
  ring = (i) => clean(parts[i].polygons[0][0]);
function B(o, c, lo, hi, s = 'wall', color = C.wall) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
function Q(o, c, p, s = 'wall', color = C.wall) {
  o.addQuad(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function L(o, c, r, s = 'stone', color = C.stone, cap = true) {
  loft(o, S(c, s), r, color, { cap });
}
function span(o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.stone) {
  beam(o, S(c, s), A, Z, w, d, color);
}
const plane = (x, z, N) => {
  const T = [N[1], -N[0]];
  return (u, y, d = 0) => [x + T[0] * u + N[0] * d, y, z + T[1] * u + N[1] * d];
};
function face(o, c, P, r, s = 'glass', color = C.glass) {
  const ids = earcut(r.flat(), [], 2),
    n = normalFor(P(0, 0), P(1, 0), P(1, 1));
  for (let k = 0; k < ids.length; k += 3) {
    let ps = ids.slice(k, k + 3).map((i) => P(...r[i]));
    if (normalFor(...ps).reduce((t, v, i) => t + v * n[i], 0) < 0) ps.reverse();
    o.addTriangle(
      S(c, s),
      'palette:#ffffff',
      ps,
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color,
    );
  }
}
function cap(o, c, r, y, s = 'wall', color = C.wall) {
  const p = clean(r),
    ids = earcut(p.flat(), [], 2);
  for (let k = 0; k < ids.length; k += 3) {
    let ps = ids.slice(k, k + 3).map((i) => [p[i][0], y, p[i][1]]);
    if (normalFor(...ps)[1] < 0) ps.reverse();
    o.addTriangle(
      S(c, s),
      'palette:#ffffff',
      ps,
      [0, 1, 0],
      ps.map((p) => [p[0], p[2]]),
      color,
    );
  }
}
function bounds(r) {
  return [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ];
}
function inset(r, d) {
  const p = clean(r),
    x = p.reduce((s, p) => s + p[0], 0) / p.length,
    z = p.reduce((s, p) => s + p[1], 0) / p.length;
  return p.map(([X, Z]) => {
    const n = Math.hypot(X - x, Z - z);
    return [X - ((X - x) / n) * d, Z - ((Z - z) / n) * d];
  });
}
function shape(o, c, r) {
  let p = cw(r);
  if (c.far) {
    const [x0, z0, x1, z1] = bounds(p);
    p = [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ];
  }
  for (let i = 0; i < p.length; i++) {
    const A = p[i],
      Z = p[(i + 1) % p.length],
      lo = Math.min(H.floor - 0.3, sanssouciGroundY(...A) - 0.3, sanssouciGroundY(...Z) - 0.3);
    Q(
      o,
      c,
      [
        [A[0], lo, A[1]],
        [Z[0], lo, Z[1]],
        [Z[0], H.floor, Z[1]],
        [A[0], H.floor, A[1]],
      ],
      'stone',
      C.stone,
    );
    Q(o, c, [
      [A[0], H.floor, A[1]],
      [Z[0], H.floor, Z[1]],
      [Z[0], H.eave, Z[1]],
      [A[0], H.eave, A[1]],
    ]);
  }
  cap(o, c, p, H.floor, 'stone', C.stone);
  cap(o, c, p, H.eave);
  const e = inset(p, -0.12),
    inner = inset(p, 0.32);
  L(
    o,
    c,
    [e.map(([x, z]) => [x, H.eave, z]), inner.map(([x, z]) => [x, H.roofRidge, z])],
    'roof',
    C.roof,
    false,
  );
  cap(o, c, inner, H.roofRidge, 'roof', C.roof);
  if (!c.far)
    L(
      o,
      c,
      [e.map(([x, z]) => [x, H.eave - 0.2, z]), e.map(([x, z]) => [x, H.cornice, z])],
      'stone',
      C.stone,
      false,
    );
}
function windowFrame(o, c, P, A, Z, w = 0.12) {
  if (!c.flatFrames) {
    span(o, c, P(...A, 0.055), P(...Z, 0.055), w, w, 'stone', C.frame);
    return;
  }
  const dx = Z[0] - A[0],
    dy = Z[1] - A[1],
    len = Math.hypot(dx, dy),
    v = [((dy / len) * w) / 2, ((-dx / len) * w) / 2];
  face(
    o,
    c,
    (u, y) => P(u, y, 0.055),
    [
      [A[0] - v[0], A[1] - v[1]],
      [Z[0] - v[0], Z[1] - v[1]],
      [Z[0] + v[0], Z[1] + v[1]],
      [A[0] + v[0], A[1] + v[1]],
    ],
    'stone',
    C.frame,
  );
}
function arch(o, c, P, u, b, w, h, frame = true) {
  const r = w / 2,
    spring = b + h - r,
    p = [
      [u - r, b],
      [u + r, b],
      [u + r, spring],
    ];
  for (let j = 1; j <= c.arch; j++) {
    const t = (j / c.arch) * Math.PI;
    p.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  face(o, c, P, p);
  if (c.frames && frame) {
    for (const sign of [-1, 1])
      windowFrame(o, c, P, [u + sign * r, b], [u + sign * r, spring], 0.13);
    for (let j = 0; j < c.arch; j++) {
      const t = (j / c.arch) * Math.PI,
        T = ((j + 1) / c.arch) * Math.PI;
      Q(
        o,
        c,
        [
          P(u + (r + 0.12) * Math.cos(t), spring + (r + 0.12) * Math.sin(t), 0.045),
          P(u + (r + 0.12) * Math.cos(T), spring + (r + 0.12) * Math.sin(T), 0.045),
          P(u + r * Math.cos(T), spring + r * Math.sin(T), 0.045),
          P(u + r * Math.cos(t), spring + r * Math.sin(t), 0.045),
        ],
        'stone',
        C.frame,
      );
    }
    if (!c.flatFrames) {
      span(o, c, P(u, b, 0.07), P(u, spring + r, 0.07), 0.055, 0.055, 'stone', C.frame);
      for (let y = b + 1; y < spring; y += 1)
        span(o, c, P(u - r, y, 0.07), P(u + r, y, 0.07), 0.05, 0.05, 'stone', C.frame);
    }
  }
}
function rectWindow(o, c, P, u, b, w, h) {
  face(o, c, P, [
    [u - w / 2, b],
    [u + w / 2, b],
    [u + w / 2, b + h],
    [u - w / 2, b + h],
  ]);
  if (c.frames) {
    for (const [A, Z] of [
      [
        [u - w / 2, b],
        [u - w / 2, b + h],
      ],
      [
        [u + w / 2, b],
        [u + w / 2, b + h],
      ],
      [
        [u - w / 2, b],
        [u + w / 2, b],
      ],
      [
        [u - w / 2, b + h],
        [u + w / 2, b + h],
      ],
    ])
      windowFrame(o, c, P, A, Z);
  }
}
function column(o, c, x, z, base, top, r = 0.3, capital = true) {
  if (c.secondary && c.detail && !c.fine) {
    L(
      o,
      c,
      [
        [base, r * 1.35],
        [base + 0.2, r],
        [top - 0.4, r * 0.85],
        [top, r * 1.5],
      ].map(([y, R]) => radialRing(y, R, R, 8, [x, z])),
      'stone',
      C.stone,
      false,
    );
    return;
  }
  if (c.far || c.flatFrames || c.flat) {
    L(
      o,
      c,
      [
        radialRing(base, r, r, c.sides, [x, z]),
        radialRing(top, r * 0.88, r * 0.88, c.sides, [x, z]),
      ],
      'stone',
      C.stone,
      false,
    );
    if (c.flat && capital)
      L(
        o,
        c,
        [
          radialRing(top - 0.35, r * 1.5, r * 1.5, 4, [x, z]),
          radialRing(top, r * 1.5, r * 1.5, 4, [x, z]),
        ],
        'stone',
        C.stone,
        false,
      );
    else if (!c.far && capital)
      B(
        o,
        c,
        [x - r * 1.5, top - 0.35, z - r * 1.5],
        [x + r * 1.5, top, z + r * 1.5],
        'stone',
        C.stone,
      );
    return;
  }
  const ps = [
    [base, r * 1.45],
    [base + 0.17, r * 1.45],
    [base + 0.3, r],
    [top - 0.6, r * 0.85],
    [top - 0.48, r * 1.35],
    [top - 0.2, r * 1.65],
    [top, r * 1.65],
  ];
  L(
    o,
    c,
    ps.map(([y, R]) => radialRing(y, R, R, c.sides, [x, z])),
    'stone',
    C.stone,
    false,
  );
  if (c.fine && capital)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        sphere(
          o,
          S(c, 'stone'),
          [x + sx * r, top - 0.28, z + sz * r],
          [0.15, 0.16, 0.15],
          C.stone,
          8,
          4,
        );
}
function herm(o, c, P, u, b, top) {
  if (!c.frames) return;
  if (c.flatFrames) {
    const p = P(u, (b + top) / 2, 0.2);
    span(o, c, [p[0], b, p[2]], [p[0], top, p[2]], 0.25, 0.25);
    return;
  }
  const n = c.fine ? 20 : 8,
    h = top - b,
    ring = (y, w, d) =>
      Array.from({ length: n }, (_, i) => {
        const t = (-i / n) * Math.PI * 2;
        return P(u + w * Math.cos(t), y, 0.2 + d * Math.sin(t));
      });
  L(
    o,
    c,
    [
      [0, 0.13, 0.12],
      [0.48, 0.18, 0.12],
      [0.62, 0.26, 0.18],
      [0.76, 0.4, 0.22],
      [0.83, 0.15, 0.13],
    ].map(([t, w, d]) => ring(b + t * h, w, d)),
  );
  const p = P(u, b + h * 0.88, 0.26);
  sphere(o, S(c, 'stone'), p, [0.2, 0.26, 0.2], C.stone, n, Math.max(4, n / 2));
  for (const sign of [-1, 1]) {
    span(
      o,
      c,
      P(u + sign * 0.3, b + h * 0.76, 0.24),
      P(u + sign * 0.48, b + h * 0.88, 0.26),
      0.14,
      0.16,
    );
    span(
      o,
      c,
      P(u + sign * 0.48, b + h * 0.88, 0.26),
      P(u + sign * 0.2, top - 0.03, 0.2),
      0.13,
      0.15,
    );
  }
}
function urn(o, c, x, z, y) {
  if (c.far) return;
  const n = c.flat ? 4 : c.flatFrames ? 6 : c.fine ? 20 : 6;
  if (!c.fine) {
    L(
      o,
      c,
      [
        [y, 0.17],
        [y + 0.3, 0.12],
        [y + 0.6, 0.32],
        [y + 1.03, 0.05],
      ].map(([Y, r]) => radialRing(Y, r, r, n, [x, z])),
    );
    return;
  }
  L(
    o,
    c,
    [
      [y, 0.17],
      [y + 0.18, 0.22],
      [y + 0.36, 0.1],
      [y + 0.6, 0.32],
      [y + 0.88, 0.26],
      [y + 1.03, 0.1],
    ].map(([Y, r]) => radialRing(Y, r, r, n, [x, z])),
  );
}
function railing(o, c, A, Z, y) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz);
  if (c.far) return;
  if (!c.detail) {
    Q(
      o,
      c,
      [
        [A[0], y, A[1]],
        [Z[0], y, Z[1]],
        [Z[0], y + 0.65, Z[1]],
        [A[0], y + 0.65, A[1]],
      ],
      'stone',
      C.stone,
    );
    return;
  }
  span(o, c, [A[0], y + 0.08, A[1]], [Z[0], y + 0.08, Z[1]], 0.17, 0.15);
  span(o, c, [A[0], y + 0.8, A[1]], [Z[0], y + 0.8, Z[1]], 0.18, 0.15);
  const count = Math.max(1, Math.round(len / (c.fine ? 0.8 : 1.2)));
  for (let i = 0; i <= count; i++) {
    const x = A[0] + (dx * i) / count,
      z = A[1] + (dz * i) / count;
    L(
      o,
      c,
      (c.fine
        ? [
            [y + 0.15, 0.08],
            [y + 0.3, 0.12],
            [y + 0.45, 0.065],
            [y + 0.68, 0.08],
            [y + 0.73, 0.1],
          ]
        : [
            [y + 0.15, 0.08],
            [y + 0.4, 0.12],
            [y + 0.73, 0.08],
          ]
      ).map(([Y, r]) => radialRing(Y, r, r, c.fine ? 6 : 4, [x, z])),
      'stone',
      C.stone,
      false,
    );
  }
}
function sample(line, t) {
  const lengths = [0];
  for (let i = 1; i < line.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]),
    );
  const d = t * lengths.at(-1);
  let k = 1;
  while (k < lengths.length - 1 && lengths[k] < d) k++;
  const v = (d - lengths[k - 1]) / (lengths[k] - lengths[k - 1]);
  return line[k - 1].map((p, i) => p + (line[k][i] - p) * v);
}
export function sanssouciColonnadeRows(index) {
  const p = ring(index);
  return index === 9
    ? { inner: p.slice(0, 11), outer: p.slice(11).reverse() }
    : { inner: p.slice(11).reverse(), outer: p.slice(0, 11) };
}
function colonnade(o, c, index) {
  const { inner, outer } = sanssouciColonnadeRows(index),
    lines = [inner, outer];
  for (let j = 0; j < c.stations; j++) {
    const t = j / (c.stations - 1);
    for (const line of lines) {
      const p = sample(line, t),
        other = sample(line === inner ? outer : inner, t),
        v = [other[0] - p[0], other[1] - p[1]],
        len = Math.hypot(...v),
        x = p[0] + (v[0] / len) * 0.48,
        z = p[1] + (v[1] / len) * 0.48,
        base = sanssouciGroundY(x, z) + 0.15;
      column(o, c, x, z, base, H.columnTop, 0.3);
    }
  }
  for (let j = 0; j < c.curve; j++) {
    const t = j / c.curve,
      T = (j + 1) / c.curve,
      I = sample(inner, t),
      J = sample(inner, T),
      A = sample(outer, t),
      Z = sample(outer, T),
      ps = [I, J, Z, A],
      top = ps.map(([x, z]) => [x, H.colonnadeTop, z]),
      bottom = ps.map(([x, z]) => [x, H.columnTop, z]);
    if (normalFor(...top)[1] < 0) top.reverse();
    if (normalFor(...bottom)[1] > 0) bottom.reverse();
    Q(o, c, top, 'copper', C.copper);
    Q(o, c, bottom, 'stone', C.stone);
    for (const [X, Y, D] of [
      [I, J, [I[0] - A[0], I[1] - A[1]]],
      [A, Z, [A[0] - I[0], A[1] - I[1]]],
    ]) {
      const side = [
        [X[0], H.columnTop, X[1]],
        [Y[0], H.columnTop, Y[1]],
        [Y[0], H.colonnadeTop, Y[1]],
        [X[0], H.colonnadeTop, X[1]],
      ];
      const n = normalFor(...side);
      if (n[0] * D[0] + n[2] * D[1] < 0) side.reverse();
      Q(o, c, side, 'stone', C.stone);
      let foot = [
        [X[0], sanssouciGroundY(...X) - 0.05, X[1]],
        [Y[0], sanssouciGroundY(...Y) - 0.05, Y[1]],
        [Y[0], sanssouciGroundY(...Y) + 0.15, Y[1]],
        [X[0], sanssouciGroundY(...X) + 0.15, X[1]],
      ];
      const fn = normalFor(...foot);
      if (fn[0] * D[0] + fn[2] * D[1] < 0) foot.reverse();
      Q(o, c, foot, 'stone', C.stone);
    }
    const floor = ps.map(([x, z]) => [x, sanssouciGroundY(x, z) + 0.15, z]);
    if (normalFor(...floor)[1] < 0) floor.reverse();
    Q(o, c, floor, 'stone', C.stone);
    if (!c.far)
      for (const [X, Y] of [
        [I, J],
        [A, Z],
      ])
        railing(o, c, X, Y, H.colonnadeTop + 0.1);
  }
  for (const t of [0, 1]) {
    const I = sample(inner, t),
      A = sample(outer, t),
      p = [
        [I[0], H.columnTop, I[1]],
        [A[0], H.columnTop, A[1]],
        [A[0], H.colonnadeTop, A[1]],
        [I[0], H.colonnadeTop, I[1]],
      ];
    const nearby = sample(inner, t === 0 ? 0.01 : 0.99),
      outward = [I[0] - nearby[0], I[1] - nearby[1]],
      n = normalFor(...p);
    if (n[0] * outward[0] + n[2] * outward[1] < 0) p.reverse();
    Q(o, c, p, 'stone', C.stone);
  }
  if (!c.far)
    for (let j = 0; j < (c.flat ? 2 : 5); j++) {
      const p = sample(outer, j / (c.flat ? 1 : 4));
      urn(o, c, p[0], p[1], H.colonnadeTop + 0.82);
    }
}
function dome(o, c) {
  const [x, z] = H.domeCenter,
    [rx, rz] = H.domeRadius,
    n = c.dome,
    ps = c.far
      ? [
          [H.cornice, 1.02],
          [11.5, 0.88],
          [13.2, 0.55],
          [H.domeTop, 0.28],
        ]
      : [
          [H.cornice, 1.02],
          [10, 1.02],
          [10.6, 0.98],
          [11.4, 0.87],
          [12.4, 0.71],
          [13.3, 0.5],
          [14, 0.32],
          [H.domeTop, 0.28],
        ];
  L(
    o,
    c,
    ps.map(([y, s]) => radialRing(y, rx * s, rz * s, n, [x, z])),
    'copper',
    C.copper,
  );
  const r = rx * 0.28,
    d = rz * 0.28;
  L(
    o,
    c,
    [radialRing(H.domeTop, r, d, n, [x, z]), radialRing(H.domeTop + 0.13, r, d, n, [x, z])],
    'stone',
    C.stone,
  );
  L(
    o,
    c,
    [radialRing(H.crownTop - 0.13, r, d, n, [x, z]), radialRing(H.crownTop, r, d, n, [x, z])],
    'stone',
    C.stone,
  );
  for (let j = 0; j < (c.far ? 4 : 12); j++) {
    const t = (j / (c.far ? 4 : 12)) * Math.PI * 2,
      X = x + r * Math.cos(t),
      Z = z + d * Math.sin(t);
    B(
      o,
      c,
      [X - 0.09, H.domeTop + 0.12, Z - 0.09],
      [X + 0.09, H.crownTop - 0.1, Z + 0.09],
      'stone',
      C.stone,
    );
  }
  if (!c.far) {
    for (const t of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      const X = x + rx * 0.87 * Math.cos(t),
        Z = z + rz * 0.87 * Math.sin(t),
        v = [Math.cos(t) / rx, Math.sin(t) / rz],
        len = Math.hypot(...v),
        N = v.map((v) => v / len),
        P = plane(X + N[0] * 0.7, Z + N[1] * 0.7, N),
        r = 0.5,
        y = 11.7,
        n = c.flat ? 8 : c.sides,
        outer = [],
        inside = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        outer.push([0.7 * Math.cos(a), y + 0.78 * Math.sin(a)]);
        inside.push([r * Math.cos(a), y + r * Math.sin(a)]);
      }
      face(o, c, (u, y, d = 0) => P(u, y, d + 0.03), inside);
      for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        Q(
          o,
          c,
          [P(...outer[j]), P(...outer[k]), P(...inside[k], 0.05), P(...inside[j], 0.05)],
          'stone',
          C.dark,
        );
        Q(
          o,
          c,
          [P(...outer[j]), P(...outer[j], -1.3), P(...outer[k], -1.3), P(...outer[k])],
          'copper',
          C.copper,
        );
      }
      const p = P(0, y + 0.98);
      if (!c.flat) urn(o, c, p[0], p[2], p[1]);
    }
    if (c.detail)
      for (let j = 0; j < 12; j++) {
        const t = (j / 12) * Math.PI * 2;
        for (let k = 1; k < ps.length; k++)
          span(
            o,
            c,
            [
              x + rx * ps[k - 1][1] * Math.cos(t),
              ps[k - 1][0],
              z + rz * ps[k - 1][1] * Math.sin(t),
            ],
            [x + rx * ps[k][1] * Math.cos(t), ps[k][0], z + rz * ps[k][1] * Math.sin(t)],
            0.025,
            0.025,
            'copper',
            C.copper,
          );
      }
    for (let j = 0; j < (c.flat ? 4 : 8); j++) {
      const t = (j / (c.flat ? 4 : 8)) * Math.PI * 2;
      urn(o, c, x + rx * 1.01 * Math.cos(t), z + rz * 1.01 * Math.sin(t), H.cornice + 0.1);
    }
  }
}
function frontDomeWindows(o, c) {
  if (c.far) return;
  const [x, z] = H.domeCenter,
    [rx, rz] = H.domeRadius;
  for (let j = 0; j < 5; j++) {
    const t = ((20 + j * 35) * Math.PI) / 180,
      X = x + rx * 0.98 * Math.cos(t),
      Z = z + rz * 0.98 * Math.sin(t),
      N = [Math.cos(t) / rx, Math.sin(t) / rz],
      len = Math.hypot(...N),
      v = N.map((v) => v / len),
      P = plane(X + v[0] * 0.16, Z + v[1] * 0.16, v);
    arch(o, c, P, 0, H.floor + 0.45, 1.85, 6.4);
    for (const sign of [-1, 1]) herm(o, c, P, sign * 1.25, H.floor + 0.3, H.eave - 0.15);
  }
}
function facades(o, c) {
  if (c.far) return;
  for (const index of [188, 189, 190, 191, 192, 193]) {
    const p = cw(ring(index));
    for (let j = 0; j < p.length; j++) {
      const A = p[j],
        Z = p[(j + 1) % p.length],
        dx = Z[0] - A[0],
        dz = Z[1] - A[1],
        len = Math.hypot(dx, dz);
      if (len < 4) continue;
      const N = [-dz / len, dx / len],
        count = Math.max(1, Math.round(len / (c.flat ? 7 : H.bayMeters)));
      // The native main bar's re-entrant edges touch the central dome/vestibule.
      if (index === 189 && Math.abs((A[0] + Z[0]) / 2) < 9) continue;
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count,
          X = A[0] + dx * t + N[0] * 0.05,
          W = A[1] + dz * t + N[1] * 0.05,
          P = plane(X, W, N);
        if (index >= 192) {
          rectWindow(o, c, P, 0, H.floor + 0.5, 1.25, 2.3);
          rectWindow(o, c, P, 0, H.floor + 4.2, 1.25, 2.4);
        } else {
          arch(o, c, P, 0, H.floor + 0.45, 1.7, 6.25);
          if (N[1] > 0.65 && index === 189)
            for (const sign of [-1, 1]) herm(o, c, P, sign * 1.25, H.floor + 0.3, H.eave - 0.15);
          else if (c.frames) {
            const q = P((len / count) * 0.44, H.floor, 0.15);
            column(o, { ...c, secondary: true }, q[0], q[2], H.floor + 0.15, H.eave - 0.2, 0.22);
          }
        }
      }
      if (c.detail && len > 9) {
        for (let k = 0; k <= Math.round(len / 5); k++) {
          const t = k / Math.round(len / 5),
            x = A[0] + dx * t,
            z = A[1] + dz * t;
          urn(o, c, x, z, H.cornice + 0.08);
        }
      }
      if (index === 189 && Math.abs(N[1]) > 0.6) railing(o, c, A, Z, H.cornice + 0.1);
    }
  }
}
function endBay(o, c, [x, z, rx, rz]) {
  const n = c.far ? 4 : c.flat ? 8 : c.sides;
  const lo = x > 0 ? 34 : x,
    hi = x > 0 ? x : -34,
    foot =
      Math.min(...[lo, hi].flatMap((X) => [z - 3.5, z + 3.5].map((Z) => sanssouciGroundY(X, Z)))) -
      0.3;
  B(o, c, [lo, foot, z - 3.5], [hi, H.eave, z + 3.5]);
  let base = H.floor - 0.3;
  for (let j = 0; j < n; j++) {
    const t = (j / n) * Math.PI * 2;
    base = Math.min(base, sanssouciGroundY(x + rx * Math.cos(t), z + rz * Math.sin(t)) - 0.3);
  }
  L(
    o,
    c,
    [radialRing(base, rx, rz, n, [x, z]), radialRing(H.eave, rx, rz, n, [x, z])],
    'wall',
    C.wall,
  );
  L(
    o,
    c,
    [
      radialRing(H.eave, rx + 0.12, rz + 0.12, n, [x, z]),
      radialRing(H.cornice, rx + 0.12, rz + 0.12, n, [x, z]),
    ],
    'stone',
    C.stone,
  );
  L(
    o,
    c,
    [
      radialRing(H.cornice, rx + 0.15, rz + 0.15, n, [x, z]),
      radialRing(H.roofRidge, rx * 0.8, rz * 0.8, n, [x, z]),
    ],
    'copper',
    C.copper,
  );
  if (!c.far)
    for (const t of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      const N = [Math.cos(t), Math.sin(t)],
        P = plane(x + (rx + 0.06) * N[0], z + (rz + 0.06) * N[1], N);
      arch(o, c, P, 0, H.floor + 0.5, 1.3, 5.9);
    }
}
function gazebo(o, c, [x, z, r]) {
  const base = sanssouciGroundY(x, z) + 0.15,
    n = c.far ? 4 : c.flat ? 4 : 12;
  for (let j = 0; j < n; j++) {
    const t = (j / n) * Math.PI * 2,
      X = x + r * Math.cos(t),
      Z = z + r * Math.sin(t);
    B(o, c, [X - 0.07, base, Z - 0.07], [X + 0.07, base + 4.1, Z + 0.07], 'trellis', C.trellis);
    if (c.detail) {
      const T = ((j + 1) / n) * Math.PI * 2;
      for (const y of [1.1, 2.3, 3.5])
        span(
          o,
          c,
          [X, base + y, Z],
          [x + r * Math.cos(T), base + y, z + r * Math.sin(T)],
          0.04,
          0.04,
          'trellis',
          C.trellis,
        );
    }
  }
  const profiles = c.far
    ? [
        [base + 4.1, 1],
        [base + 5.5, 0.05],
      ]
    : [
        [base + 4.1, 1],
        [base + 4.8, 0.8],
        [base + 5.4, 0.4],
        [base + 5.8, 0.05],
      ];
  L(
    o,
    c,
    profiles.map(([y, s]) => radialRing(y, r * s, r * s, n, [x, z])),
    'copper',
    C.copper,
  );
  if (!c.far)
    L(
      o,
      c,
      [
        radialRing(base, r + 0.15, r + 0.15, n, [x, z]),
        radialRing(base + 0.2, r + 0.15, r + 0.15, n, [x, z]),
      ],
      'stone',
      C.stone,
    );
}
function trellisWalk(o, c, index) {
  if (c.far) return;
  const r = ring(index),
    A = [(r[0][0] + r[3][0]) / 2, (r[0][1] + r[3][1]) / 2],
    Z = [(r[1][0] + r[2][0]) / 2, (r[1][1] + r[2][1]) / 2],
    dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz),
    N = [-dz / len, dx / len],
    width = 1.6,
    n = c.flat ? 2 : Math.round(len / 2.5),
    top = Math.max(sanssouciGroundY(...A), sanssouciGroundY(...Z)) + 4;
  for (const sign of [-1, 1]) {
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = A[0] + dx * t + N[0] * width * sign,
        z = A[1] + dz * t + N[1] * width * sign,
        b = sanssouciGroundY(x, z) + 0.1;
      B(o, c, [x - 0.07, b, z - 0.07], [x + 0.07, top, z + 0.07], 'trellis', C.trellis);
    }
    span(
      o,
      c,
      [A[0] + N[0] * width * sign, top, A[1] + N[1] * width * sign],
      [Z[0] + N[0] * width * sign, top, Z[1] + N[1] * width * sign],
      0.12,
      0.12,
      'trellis',
      C.trellis,
    );
  }
  if (!c.flat)
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = A[0] + dx * t,
        z = A[1] + dz * t;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI,
          b = ((k + 1) / 6) * Math.PI;
        span(
          o,
          c,
          [
            x + N[0] * width * Math.cos(a),
            top + 0.65 * Math.sin(a),
            z + N[1] * width * Math.cos(a),
          ],
          [
            x + N[0] * width * Math.cos(b),
            top + 0.65 * Math.sin(b),
            z + N[1] * width * Math.cos(b),
          ],
          0.045,
          0.045,
          'trellis',
          C.trellis,
        );
      }
    }
}
export function buildSanssouciLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error(level);
  for (const i of H.solidParts) shape(o, c, ring(i));
  for (const b of H.roundEndBays) endBay(o, c, b);
  for (const i of H.colonnades) colonnade(o, c, i);
  dome(o, c);
  frontDomeWindows(o, c);
  facades(o, c);
  for (const p of H.gazebos) gazebo(o, c, p);
  for (const i of H.trellises) trellisWalk(o, c, i);
}
export const buildSanssouciSkyline = (o) => buildSanssouciLevel(o, 'skyline');
export const buildSanssouciDistrict = (o) => buildSanssouciLevel(o, 'district');
export const buildSanssouciStreet = (o) => buildSanssouciLevel(o, 'street');
export const buildSanssouciCloseup = (o) => buildSanssouciLevel(o, 'closeup');
