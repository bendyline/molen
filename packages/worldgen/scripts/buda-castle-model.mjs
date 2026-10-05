/** Buda Castle: six palace wings, Lions Court and the documented postwar dome; 2021 reference exterior. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2m/n0255_buda_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const plaster = [0.82, 0.73, 0.59],
  trim = [0.87, 0.82, 0.68],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  glass = [0.095, 0.115, 0.105];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  const ry = Math.min(w / 2, h * 0.65),
    spring = y + h - ry;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + Math.sin(angle) * ry]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'limestone', c = plaster) {
  const valid = !fine(o) ? [] : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], master(o) ? 10 : 6)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  if (o.detail === 'district' || o.detail === 'street')
    for (const v of windows.filter((v) => !v[5])) {
      face(
        o,
        'glass',
        [
          [v[0] - v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1] + v[3], 0.025],
          [v[0] - v[2] / 2, v[1] + v[3], 0.025],
        ],
        glass,
      );
    }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      if (!v[5]) tri(o, 'glass', p, glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        if (master(o) && !(v[5] && j === 0)) line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1 && !v[5]) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o) && !v[5])
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}

function edges(o, p, fn, closed = true) {
  for (let i = 0; i < p.length - (closed ? 0 : 1); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.02)
      fn(edgeFrame(o, closed ? b : a, closed ? a : b), len, i, closed ? b : a, closed ? a : b);
  }
}
function solid(o, p, lo, hi, slot = 'limestone', c = plaster) {
  edges(o, p, (f, len) => panel(f, len, lo, hi, [], slot, c));
  cap(o, p, hi, slot, c);
}
const copper = [0.24, 0.46, 0.39];
const low = (o) => o.detail === 'skyline';
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const inside = (p, r) => {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
};
function disk(o, x, z, r, y0, y1, slot = 'carved', c = trim, n = 12) {
  loft(o, slot, [radialRing(y0, r, r, n, [x, z]), radialRing(y1, r, r, n, [x, z])], c);
}
function plate(o, p, y, holes = [], slot = 'stone', c = stone) {
  const ps = [p, ...holes],
    flat = ps.flat(),
    ix = earcut(
      flat.flat(),
      holes.map((_, i) => ps.slice(0, i + 1).reduce((n, p) => n + p.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((k) => [flat[k][0], y, flat[k][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function level(p) {
  if (p[0] < -117) return 24;
  if (p[0] < -42) return p[0] > -107 && p[0] < -47 ? 30 : 27;
  if (p[0] > 23 && p[0] < 85 && p[1] < -37) return 30;
  if (p[0] > 109) return 25;
  if (p[1] > 18) return 29;
  return 27;
}
function bands(o, w, hi) {
  if (low(o)) return;
  for (const [y, t, d] of [
    [4.3, 0.6, 0.45],
    [10.6, 0.4, 0.3],
    [hi - 0.6, 0.65, 0.65],
    [hi, 0.25, 0.85],
  ]) {
    if (!near(o)) continue;
    box(o, 'carved', [0, y - t / 2, -0.12], [w, y + t / 2, d], trim);
  }
  if (master(o))
    for (let y = 4.8; y < 10.5; y += 0.65)
      face(
        o,
        'recess',
        [
          [0, y, 0.015],
          [w, y, 0.015],
          [w, y + 0.026, 0.015],
          [0, y + 0.026, 0.015],
        ],
        [0.42, 0.38, 0.3],
      );
}
function facade(o, a, b, hi) {
  const f = edgeFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.05) return;
  const bays = Math.max(1, Math.round(len / 4.05)),
    spacing = len / bays,
    ws = [];
  const floors = hi > 28 ? [5.9, 12.7, 20.4] : [5.3, 11.8, 18.1];
  for (let k = 0; k < bays; k++) {
    const x = (k + 0.5) * spacing;
    if (spacing < 1.25) continue;
    for (let j = 0; j < floors.length; j++) {
      const h = j === 1 ? 4.15 : j === 0 ? 3.25 : 3.15;
      ws.push([
        x,
        floors[j],
        Math.min(2.05, spacing * 0.57),
        Math.min(h, hi - floors[j] - 1),
        j !== 2,
      ]);
    }
  }
  panel(f, len, 4, hi, ws, 'limestone', plaster);
  bands(f, len, hi);
  if (near(o))
    for (let k = 1; k < bays; k++) {
      const x = k * spacing;
      if (fine(o)) {
        box(f, 'carved', [x - 0.35, 11, -0.02], [x + 0.35, hi - 1, 0.3], trim);
        box(f, 'carved', [x - 0.52, hi - 1.4, -0.04], [x + 0.52, hi - 0.93, 0.47], trim);
      }
    }
  if (master(o))
    for (const v of ws) {
      const [x, y, w, h] = v;
      box(f, 'carved', [x - w * 0.63, y - 0.25, -0.1], [x + w * 0.63, y - 0.1, 0.45], trim);
      if (y > 11 && y < 17) {
        const yy = y + h + 0.4;
        tri(
          f,
          'carved',
          [
            [x - w * 0.68, yy, 0.15],
            [x + w * 0.68, yy, 0.15],
            [x, yy + 0.8, 0.15],
          ],
          trim,
        );
        line(f, [x - w * 0.72, yy, 0.2], [x, yy + 0.85, 0.2], 0.14);
        line(f, [x, yy + 0.85, 0.2], [x + w * 0.72, yy, 0.2], 0.14);
      }
    }
}
function shell(o) {
  const p = map.outline.slice(0, -1),
    holes = map.holes.map((p) => p.slice(0, -1));
  const outer = area(p) > 0 ? p : [...p].reverse();
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    const cuts = [0, 1];
    for (const x of [-107, -47]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      if (t > 0 && t < 1) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const aa = mix(a, b, cuts[j - 1]),
        bb = mix(a, b, cuts[j]);
      facade(o, bb, aa, level(mix(aa, bb, 0.5)));
    }
  }
  for (const h of holes) {
    const p = area(h) > 0 ? h : [...h].reverse();
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      facade(o, a, b, level(mix(a, b, 0.5)));
    }
  }
  plate(o, outer, 24, holes, 'copper', copper);
}
function roof(o, x, z, w, d, y, rise, inset = 4, slot = 'copper', c = copper) {
  if (w > 10 && y > 24) {
    const pp = rect(x - w / 2 + 0.18, z - d / 2 + 0.18, x + w / 2 - 0.18, z + d / 2 - 0.18);
    solid(o, pp, 24, y, 'limestone', plaster);
  }
  const p = rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2).reverse();
  const q = rect(
    x - w / 2 + inset,
    z - d / 2 + inset,
    x + w / 2 - inset,
    z + d / 2 - inset,
  ).reverse();
  loft(o, slot, [p.map((v) => [v[0], y, v[1]]), q.map((v) => [v[0], y + rise, v[1]])], c);
  if (!fine(o)) return;
  // Standing seams are actual roof geometry in the master; close-up keeps only the major divisions.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = p[i],
      b = p[j],
      cc = q[j],
      dd = q[i],
      n = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / (master(o) ? 0.72 : 4.5)));
    for (let k = 1; k < n; k++) {
      const t = k / n,
        u = mix(a, b, t),
        v = mix(dd, cc, t);
      beam(
        o,
        slot,
        [u[0], y + 0.035, u[1]],
        [v[0], y + rise + 0.035, v[1]],
        master(o) ? 0.022 : 0.045,
        0.035,
        color(c, 0.84),
      );
    }
  }
}
function dormer(o, x, y, z, a = 0) {
  const f = frame(o, x, y, z, a),
    w = 1.65,
    h = 2.15;
  box(f, 'carved', [-w / 2, 0, -0.9], [w / 2, h, 0.22], trim);
  face(
    f,
    'glass',
    [
      [-0.54, 0.3, 0.231],
      [0.54, 0.3, 0.231],
      [0.54, 1.7, 0.231],
      [-0.54, 1.7, 0.231],
    ],
    glass,
  );
  roof(f, 0, -0.25, 2, 1.6, h, 0.5, 0.35);
  if (master(o)) {
    line(f, [0, 0.3, 0.255], [0, 1.7, 0.255], 0.06, 'wood', wood);
    line(f, [-0.54, 1, 0.255], [0.54, 1, 0.255], 0.06, 'wood', wood);
  }
}
function column(o, x, z, y0, y1, r = 0.55) {
  const n = master(o) ? 12 : 8;
  box(o, 'carved', [x - r * 1.3, y0, z - r * 1.3], [x + r * 1.3, y0 + 0.45, z + r * 1.3], trim);
  loft(
    o,
    'carved',
    [radialRing(y0 + 0.45, r, r, n, [x, z]), radialRing(y1 - 0.75, r * 0.84, r * 0.84, n, [x, z])],
    trim,
  );
  box(o, 'carved', [x - r * 1.5, y1 - 0.75, z - r * 1.5], [x + r * 1.5, y1, z + r * 1.5], trim);
  if (master(o)) {
    for (const [y, rr] of [
      [y0 + 0.6, r * 1.1],
      [y1 - 0.8, r],
      [y1 - 0.58, r * 1.3],
    ])
      disk(o, x, z, rr, y, y + 0.15);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      disk(
        o,
        x + Math.cos(a) * r,
        z + Math.sin(a) * r,
        r * 0.15,
        y1 - 0.75,
        y1 - 0.35,
        'carved',
        color(trim, 0.92),
        6,
      );
    }
  }
}
function railing(o, a, b, y, stoneRail = true) {
  if (!near(o)) return;
  const f = edgeFrame(o, a, b),
    l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const slot = stoneRail ? 'carved' : 'metal',
    c = stoneRail ? trim : [0.16, 0.19, 0.17];
  box(f, slot, [0, y, -0.16], [l, y + 0.22, 0.16], c);
  box(f, slot, [0, y + 1.35, -0.2], [l, y + 1.55, 0.2], c);
  const step = master(o) ? 0.85 : fine(o) ? 1.5 : 4;
  for (let x = 0.3; x < l - 0.2; x += step) {
    if (master(o) && stoneRail)
      loft(
        f,
        slot,
        [
          [y + 0.22, 0.08],
          [y + 0.43, 0.15],
          [y + 0.68, 0.1],
          [y + 1.05, 0.12],
          [y + 1.35, 0.07],
        ].map(([yy, r]) => radialRing(yy, r, r, 6, [x, 0])),
        c,
      );
    else box(f, slot, [x - 0.075, y + 0.22, -0.075], [x + 0.075, y + 1.35, 0.075], c);
  }
}
function pediment(o, x, z, width, base, rise) {
  const f = frame(o, x, 0, z, Math.PI);
  tri(
    f,
    'carved',
    [
      [-width / 2, base, 0],
      [width / 2, base, 0],
      [0, base + rise, 0],
    ],
    trim,
  );
  if (near(o)) {
    line(f, [-width / 2, base, 0.2], [width / 2, base, 0.2], 0.32);
    line(f, [-width / 2, base, 0.2], [0, base + rise, 0.2], 0.32);
    line(f, [0, base + rise, 0.2], [width / 2, base, 0.2], 0.32);
  }
}
function dome(o) {
  const x = -12,
    z = -34,
    n = low(o) ? 12 : master(o) ? 64 : fine(o) ? 40 : 24;
  roof(o, x, z, 34, 34, 27, 5, 6);
  const r = 10.1;
  if (low(o))
    loft(o, 'carved', [radialRing(32, r, r, n, [x, z]), radialRing(48, r, r, n, [x, z])], trim);
  else {
    // The 1964 circular drum is behind the river facade, not on its cornice.
    const ring = radialRing(0, r, r, 16, [x, z]).map((p) => [p[0], p[2]]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        f = edgeFrame(o, a, b),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      panel(
        f,
        len,
        32,
        48,
        [
          [len / 2, 35, 1.65, 5.1, true],
          [len / 2, 43.25, 1.1, 1.45, false],
        ],
        'carved',
        trim,
      );
      if (near(o)) column(o, a[0], a[1], 34, 46, 0.34);
    }
  }
  for (const [y, rr] of [
    [32, r + 0.9],
    [33, r + 0.55],
    [46.8, r + 0.65],
    [47.6, r + 0.8],
  ]) {
    if (low(o) && y !== 47.6) continue;
    disk(o, x, z, rr, y, y + 0.3, 'carved', trim, n);
  }
  const stages = low(o) ? 5 : master(o) ? 24 : 12,
    rings = [];
  for (let i = 0; i <= stages; i++) {
    const a = (i / stages) * Math.PI * 0.48;
    rings.push(
      radialRing(48 + Math.sin(a) * 11.4, Math.cos(a) * (r + 0.2), Math.cos(a) * (r + 0.2), n, [
        x,
        z,
      ]),
    );
  }
  loft(o, 'copper', rings, copper);
  if (near(o))
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      for (let j = 1; j <= stages; j++) {
        const p = (i) => {
          const t = (i / stages) * Math.PI * 0.48;
          return [
            x + Math.cos(a) * Math.cos(t) * (r + 0.28),
            48 + Math.sin(t) * 11.4,
            z + Math.sin(a) * Math.cos(t) * (r + 0.28),
          ];
        };
        beam(o, 'copper', p(j - 1), p(j), 0.12, 0.12, color(copper, 0.74));
      }
    }
  disk(o, x, z, 1.05, 59.35, 59.65, 'copper', copper, low(o) ? 8 : 16);
  disk(o, x, z, 0.35, 59.65, 61.5, 'copper', copper, low(o) ? 8 : 12);
  loft(
    o,
    'bronze',
    [radialRing(61.4, 0.32, 0.32, 8, [x, z]), radialRing(62, 0.05, 0.05, 8, [x, z])],
    [0.5, 0.41, 0.19],
  );
  if (fine(o)) {
    const ring = radialRing(33.5, r + 1.2, r + 1.2, 32, [x, z]);
    for (let i = 0; i < 32; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 32];
      beam(o, 'metal', [a[0], 34.8, a[2]], [b[0], 34.8, b[2]], 0.06, 0.06, [0.18, 0.2, 0.18]);
      beam(o, 'metal', a, [a[0], 34.8, a[2]], 0.05, 0.05, [0.18, 0.2, 0.18]);
    }
  }
}
function roofs(o) {
  // Distinct A, B, C, D, E, F roof masses. Dimensions follow the mapped palace envelope.
  roof(o, -143, -29.5, 51.5, 53, 24, 2.8, 6);
  roof(o, -111, -47.8, 10, 17.5, 26, 2.5, 4);
  roof(o, -77, -56.65, 60, 36, 30, 5.5, 4.2);
  roof(o, -42, -49.5, 12, 20, 27, 2.5, 4);
  roof(o, -12, -32.5, 48, 53.5, 27, 3.5, 6);
  roof(o, 17.5, -48.5, 11, 22, 27, 2.5, 4);
  roof(o, 54, -56, 62, 37, 30, 5.5, 4.2);
  roof(o, 97, -45.7, 24, 15.5, 26, 2.5, 4);
  roof(o, 126, -29.2, 34, 48, 25, 4.3, 5);
  roof(o, 156, -36.2, 27, 19, 25, 2.2, 4);
  roof(o, 5, 7, 14, 29, 27, 2.2, 4);
  roof(o, 101, 7, 15, 29, 27, 2.2, 4);
  roof(o, 54, 47.6, 108, 46.2, 29, 6, 6);
  // The central library pavilion projects into Lions Court and toward the western terrace.
  roof(o, 52.5, 46.8, 31.5, 54.8, 30, 6.2, 6);
  if (near(o)) {
    for (const [x, z, w, y] of [
      [-77, -74.4, 60, 30],
      [54, -74.4, 62, 30],
      [-77, -38.6, 60, 30],
      [54, -37.5, 62, 30],
      [54, 70.5, 108, 29],
      [54, 25.2, 108, 29],
    ]) {
      const count = Math.floor(w / 5.6),
        dir = z < -60 || z === 25.2 ? Math.PI : 0;
      for (let i = 0; i < count; i++) {
        const xx = x + (i - (count - 1) / 2) * 5.6;
        if (z === 25.2 && xx > 34 && xx < 70) continue;
        dormer(o, xx, y + 0.8, z + (dir === Math.PI ? 1 : -1), dir);
      }
    }
    for (const x of [-157, -129]) roof(o, x, -19, 11, 15, 26, 2.3, 2.5);
    for (const x of [-98, -57, 34, 74, 17, 91]) {
      const z = x < 0 ? -54 : x < 80 ? -54 : 48;
      box(o, 'limestone', [x - 0.55, 27, z - 0.6], [x + 0.55, 38, z + 0.6], plaster);
      box(o, 'carved', [x - 0.72, 37.8, z - 0.8], [x + 0.72, 38.1, z + 0.8], trim);
    }
  }
}
function front(o) {
  if (!near(o)) return;
  for (const [cx, z] of [
    [-77, -75],
    [54, -75],
  ]) {
    if (near(o))
      for (let k = 0; k < 8; k++) column(o, cx + (k - 3.5) * 4.3, z - 0.3, 11.2, 27.7, 0.54);
    box(o, 'carved', [cx - 17, 27.7, z - 1.3], [cx + 17, 28.45, z + 0.4], trim);
    railing(o, [cx - 17, z - 1], [cx + 17, z - 1], 28.5);
  }
  // Central pediment and river terrace portico, aligned to the C wing.
  pediment(o, -12, -64.5, 23.5, 25.6, 3.9);
  if (near(o)) {
    for (const x of [-22, -18, -6, -2]) column(o, x, -65, 11, 25.3, 0.5);
    box(o, 'carved', [-24, 10.4, -66], [0, 11.1, -63], trim);
    railing(o, [-24, -65.8], [0, -65.8], 11.1);
  }
  // Refined entrance and paired columns on the restored South Range (native +X side).
  const f = frame(o, 109.2, 0, 8, Math.PI / 2);
  if (near(o)) {
    for (const x of [-4.4, -3.1, 3.1, 4.4]) column(f, x, 0.55, 11, 25.5, 0.38);
    box(f, 'carved', [-3, 10.6, -0.1], [3, 11.2, 1.9], trim);
    railing(f, [-3, 1.8], [3, 1.8], 11.2);
    for (const x of [-4.6, 4.6]) box(f, 'carved', [x - 0.8, 4, -0.1], [x + 0.8, 5.5, 1.5], trim);
    // Ornamental architectural cartouche; figurative sculpture is not represented by stand-ins.
    box(f, 'carved', [-2, 26.6, 0], [2, 28.1, 0.3], trim);
  }
}
function terraces(o) {
  const p = [
    [-174, -60],
    [-108, -60],
    [-108, -79],
    [-43, -79],
    [-43, -66],
    [20, -66],
    [20, -79],
    [88, -79],
    [88, -58],
    [175, -58],
    [175, 5],
    [114, 10],
    [114, 78],
    [-5, 78],
    [-7, 23],
    [-42, 23],
    [-43, -35],
    [-112, -35],
    [-112, 1],
    [-174, 4],
  ];
  solid(o, p, 0, 4, 'stone', [0.53, 0.5, 0.43]);
  const river = [
    [-174, -60],
    [-174, -86],
    [-111, -86],
    [-111, -94],
    [92, -94],
    [92, -72],
    [175, -64],
    [175, -57],
  ];
  solid(o, river, 0, 3.98, 'stone', [0.58, 0.55, 0.48]);
  plate(o, map.holes[0].slice(0, -1), 4, [], 'stone', [0.62, 0.59, 0.52]);
  if (near(o)) {
    railing(o, [-110, -94], [91, -94], 4);
    railing(o, [-174, -86], [-111, -86], 4);
    railing(o, [-5, 78], [114, 78], 4);
    railing(o, [175, -64], [93, -72], 4);
    // Broad paired stairs descend from the central terrace, without filling Lions Court.
    for (const cx of [-33, 9])
      for (let i = 0; i < 12; i++)
        box(
          o,
          'stone',
          [cx - 4.2, i / 3, -93 + i * 0.55],
          [cx + 4.2, (i + 1) / 3, -86.4],
          [0.62, 0.59, 0.51],
        );
  }
  if (master(o)) {
    const court = map.holes[0].slice(0, -1);
    for (let x = 14; x < 94; x += 2.6)
      for (let z = -35; z < 25; z += 2.6) {
        const p = rect(x, z, x + 2.53, z + 2.53);
        if (p.every((q) => inside(q, court))) cap(o, p, 4.013, 'stone', [0.63, 0.6, 0.53]);
      }
  }
}
export function buildBudaRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  terraces(o);
  shell(o);
  roofs(o);
  dome(o);
  front(o);
}
export const buildBudaSkyline = (o) => buildBudaRuntime(o, 'skyline');
export const budaStudy = {
  id: 'N0255',
  key: 'buda_castle',
  title: 'Buda Castle',
  category: 'castle',
  wikidataId: 'Q46313',
  mapFrame: 'map-frame.json',
  build: (o) => buildBudaRuntime(o),
  brief:
    'Six-wing Royal Palace exterior with long stepped Danube frontage, two tall river pavilions, the ribbed green postwar dome, open Lions Court, library wing, South Range and immediate stone terraces; documented 2021 reference state.',
  sourceFacts: {
    identity: 'Q46313, exact palace building relation/6486918',
    mappedEnvelopeMeters: [339.728, 149.092],
    referenceState: '2021, before A/B reconstruction begun in 2022',
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'Attributed OSM palace outline and courtyard; official National Hauszmann Program existing-state photographs, wing plan and 2020 drone still.',
    state:
      'Representative 2021 completed exterior including restored South Range. Future Hauszmann north-wing renderings are not treated as existing buildings.',
    verticalDatum:
      'Provisional local terrace base Y=0, palace/court Y=4, dome tip Y=62. Heights and fine facade details are visual estimates, not a survey.',
  },
  scaleBasis:
    'Horizontal meters from exact mapped identity. Roof profiles, elevations and facade bay counts are reconstructed with explicit uncertainty.',
  refs: [
    'https://nemzetihauszmannprogram.hu/nhp-strategy-2021.pdf',
    'https://info.budavaripalotanegyed.hu/',
    'https://commons.wikimedia.org/wiki/File:Floor_plans_of_Buda_Castle_en.svg',
    'https://www.pestbuda.hu/en/cikk/20201117_a_bird_s_eye_view_of_the_royal_palace_of_buda_castle',
    'https://pestbuda.hu/en/cikk/20201121_masterpieces_with_a_view_a_visit_to_the_royal_palace_of_buda_castle',
    'https://www.openstreetmap.org/relation/6486918',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Original deterministic geometry; reference photos and third-party meshes are not embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X 48.909 degrees south of east',
    front: 'Danube frontage toward native -Z; north A pavilion toward -X',
    origin: 'Exact palace map anchor; provisional local terrace base',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft: 2021 state, vertical datum and in-world directional fit pending',
    notes:
      'Open Lions Court, A-F palace wings and immediate terraces only. Do not replace the entire castle hill or treat planned 2022+ reconstruction as completed architecture.',
  }),
  geographicNote:
    'Exact mapped palace anchor and signed frame; current construction-state alignment and terrain fit remain pending.',
  limitations: [
    'Maximum exterior fidelity remains pending: exact window rhythms, sculptural works, heraldry, roof junctions and library/A-wing roof details require additional bespoke reference work. Architectural ornament is modeled; figurative statues are not substituted with generic objects.',
    'The temporal reference is 2021. North-wing A/B reconstruction began in 2022; this asset is not a claim about the current construction site or a completed future restoration.',
    'Heights, dome profile and terrace elevations are inferred. In-world terrain fit and facade orientation review remain pending; replaceFootprint=false.',
    'Palace interiors, separate Guardhouse, Riding Hall, Mace/Karakash towers, Castle Garden Bazaar and whole Castle Hill terrain are outside this palace exterior asset.',
    'Master and four independent LODs share central stone, copper, wood and metal surface graphs without embedded images. Physical laptop/phone approval remains pending.',
  ],
  camera: { position: [-260, 190, -300], lookAt: [0, 17, 0], fov: 43 },
  qaCameras: [
    { name: 'six-wings-and-open-lions-court', position: [0, 470, 0.2], lookAt: [0, 0, 0] },
    { name: 'danube-frontage', position: [0, 47, -310], lookAt: [0, 23, -35] },
    { name: 'postwar-dome-and-ribs', position: [-61, 73, -101], lookAt: [-12, 45, -34] },
    { name: 'north-a-and-b-pavilions', position: [-196, 48, -128], lookAt: [-115, 19, -40] },
    { name: 'lions-court-and-library', position: [48, 45, -29], lookAt: [53, 20, 47] },
    { name: 'restored-south-range', position: [171, 34, 29], lookAt: [105, 17, 9] },
    { name: 'library-west-front', position: [42, 49, 175], lookAt: [48, 20, 54] },
    { name: 'south-history-museum-wing', position: [222, 61, -87], lookAt: [130, 18, -28] },
    { name: 'terrace-and-central-portico', position: [-9, 13, -128], lookAt: [-12, 17, -60] },
  ],
};
