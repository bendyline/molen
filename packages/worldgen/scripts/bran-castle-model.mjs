/** Bran Castle: mapped open courtyard, five tower parts and asymmetric tiled roofscape. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u8/u84/n0248_bran_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const plaster = [0.86, 0.8, 0.66],
  trim = [0.72, 0.67, 0.56],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  tile = [0.61, 0.27, 0.13],
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
function points(id) {
  return map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
}
function ring(id) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
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
const rectangle = (x, z, w, d) => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];
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
  const spring = y + h - w / 2;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + (Math.sin(angle) * w) / 2]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'plaster', c = plaster) {
  const valid = o.detail === 'skyline' ? [] : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], o.detail === 'district' ? 6 : 12)),
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
        line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
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
function roofFacet(o, a, b, c, d) {
  const q = [a, b, c, d],
    collapsed = Math.hypot(...c.map((v, i) => v - d[i])) < 0.001;
  if (normalFor(...q)[1] < 0) q.reverse();
  if (collapsed) tri(o, 'tile', normalFor(a, b, c)[1] < 0 ? [c, b, a] : [a, b, c], tile);
  else face(o, 'tile', q, tile);
  if (!fine(o)) return;
  const rows = Math.ceil(Math.hypot(...d.map((v, i) => v - a[i])) / (master(o) ? 0.24 : 0.45));
  const n = normalFor(...q);
  for (let r = 0; r < rows; r++) {
    const t0 = (r + 0.03) / rows,
      t1 = (r + 0.97) / rows;
    const l0 = mix(a, d, t0),
      r0 = mix(b, c, t0),
      l1 = mix(a, d, t1),
      r1 = mix(b, c, t1);
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(...r0.map((v, i) => v - l0[i])) / (master(o) ? 0.23 : 0.45)),
    );
    for (let j = 0; j < count; j++) {
      const u0 = (j + 0.035) / count,
        u1 = (j + 0.965) / count;
      const p = [mix(l0, r0, u0), mix(l0, r0, u1), mix(l1, r1, u1), mix(l1, r1, u0)].map((p) =>
        p.map((v, i) => v + n[i] * 0.028),
      );
      if (normalFor(...p)[1] < 0) p.reverse();
      face(o, 'tile', p, color(tile, 0.81 + ((r * 7 + j * 11) % 13) * 0.027));
      if (master(o)) {
        const a = p[0],
          b = p[1],
          m = mix(a, b, 0.5),
          v = n.map((x) => x * 0.025);
        // Rounded lower tile lip catches grazing light without a separate texture image.
        tri(
          o,
          'tile',
          [a, b, m.map((x, i) => x + v[i] + (i === 1 ? -0.035 : 0))],
          color(tile, 1.06),
        );
      }
    }
  }
}
function hip(o, w, d, y, h) {
  const a = [-0.35, y, -0.35],
    b = [w + 0.35, y, -0.35],
    c = [w + 0.35, y, d + 0.35],
    e = [-0.35, y, d + 0.35];
  const u = w > d ? [d / 2, y + h, d / 2] : [w / 2, y + h, w / 2],
    v = w > d ? [w - d / 2, y + h, d / 2] : [w / 2, y + h, d - w / 2];
  roofFacet(o, a, b, w > d ? v : u, u);
  roofFacet(o, b, c, v, w > d ? v : u);
  roofFacet(o, c, e, w > d ? u : v, v);
  roofFacet(o, e, a, u, w > d ? u : v);
  if (near(o) && Math.hypot(...v.map((x, i) => x - u[i])) > 0.001)
    beam(o, 'tile', u, v, 0.16, 0.13, tile);
}
function polyRoof(o, p, eave, peak) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    roofFacet(o, [a[0], eave, a[1]], [b[0], eave, b[1]], peak, peak);
  }
}
function towerWalls(o, w, d, lo, hi, rows, slot = 'plaster', c = plaster) {
  for (const [f, len] of [
    [frame(o, w, 0, 0, Math.PI), w],
    [frame(o, 0, 0, d), w],
    [frame(o, w, 0, d, Math.PI / 2), d],
    [frame(o, 0, 0, 0, -Math.PI / 2), d],
  ]) {
    const holes = [];
    for (const [y, ww, hh, count, arched] of rows)
      for (let j = 0; j < count; j++)
        holes.push([((j + 1) * len) / (count + 1), y, ww, hh, arched]);
    panel(f, len, lo, hi, holes, slot, c);
  }
  cap(o, rectangle(0, 0, w, d), hi, slot, c);
}
function finial(o, x, y, z, h = 1.4) {
  box(o, 'metal', [x - 0.035, y, z - 0.035], [x + 0.035, y + h, z + 0.035], [0.17, 0.16, 0.14]);
  if (near(o)) {
    loft(
      frame(o, x, 0, z),
      'metal',
      [
        radialRing(y + 0.2, 0.04, 0.04, 8),
        radialRing(y + 0.35, 0.16, 0.16, 8),
        radialRing(y + 0.55, 0.04, 0.04, 8),
      ],
      [0.2, 0.18, 0.14],
      { cap: true },
    );
    beam(
      o,
      'metal',
      [x - 0.24, y + h - 0.35, z],
      [x + 0.24, y + h - 0.35, z],
      0.04,
      0.04,
      [0.17, 0.16, 0.14],
    );
  }
}
function chimney(o, x, z, y, h = 3, w = 0.7) {
  if (o.detail === 'skyline') return;
  box(o, 'plaster', [x - w / 2, y, z - w / 2], [x + w / 2, y + h, z + w / 2], plaster);
  if (near(o)) {
    for (const side of [-1, 1]) {
      const f = frame(o, x + (side * w) / 2, y + h - 0.8, z, (side * Math.PI) / 2);
      face(
        f,
        'recess',
        [
          [-0.17, 0, 0.01],
          [0.17, 0, 0.01],
          [0.17, 0.45, 0.01],
          [-0.17, 0.45, 0.01],
        ],
        [0.08, 0.07, 0.05],
      );
    }
    box(
      o,
      'carved',
      [x - w * 0.65, y + h - 0.16, z - w * 0.65],
      [x + w * 0.65, y + h, z + w * 0.65],
      trim,
    );
  }
  hip(frame(o, x - w * 0.7, 0, z - w * 0.7), w * 1.4, w * 1.4, y + h, 0.6);
}
function roundTower(o, x, z, r, eave, h, windows = true) {
  const f = frame(o, x, 0, z),
    n = master(o) ? 32 : fine(o) ? 32 : near(o) ? 24 : o.detail === 'district' ? 16 : 10;
  // Separate facade panels allow real recessed windows in the curved shaft.
  const ring = radialRing(0, r, r, n);
  for (let i = 0; i < n; i++) {
    const a = [ring[i][0], ring[i][2]],
      b = [ring[(i + 1) % n][0], ring[(i + 1) % n][2]],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const e = edgeFrame(f, a, b);
    const holes =
      windows && i % Math.max(1, Math.round(n / 6)) === 0 && o.detail !== 'skyline'
        ? [[len / 2, eave - 3.5, Math.min(0.62, len * 0.72), 1.25, false]]
        : [];
    panel(e, len, 4, eave, holes);
  }
  const capRing = radialRing(eave, r + 0.35, r + 0.35, n);
  loft(f, 'carved', [radialRing(eave - 0.22, r + 0.08, r + 0.08, n), capRing], trim, { cap: true });
  for (let i = 0; i < n; i++)
    roofFacet(f, capRing[i], capRing[(i + 1) % n], [0, eave + h, 0], [0, eave + h, 0]);
  finial(f, 0, eave + h, 0);
}
const outer = () => ring(179351361),
  court = () => ring(244093205);
function site(o) {
  const p = outer();
  // Local rock contact only; deliberately exclude the whole hill and park.
  cap(o, p, 4, 'stone', stone);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      lowA = [a[0] * 1.04, 0, a[1] * 1.04],
      lowB = [b[0] * 1.04, 0, b[1] * 1.04];
    const mid = [(a[0] + b[0]) * 0.51, 1.9 + (i % 3) * 0.28, (a[1] + b[1]) * 0.51];
    for (const q of [
      [[a[0], 4, a[1]], [b[0], 4, b[1]], mid],
      [[b[0], 4, b[1]], lowB, mid],
      [lowB, lowA, mid],
      [lowA, [a[0], 4, a[1]], mid],
    ])
      tri(o, 'stone', q, color(stone, 0.84 + (i % 7) * 0.032));
  }
  cap(o, court(), 4.03, 'carved', trim);
  if (master(o)) {
    const p = court(),
      inside = (x, z) => {
        let yes = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const a = p[i],
            b = p[j];
          if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
            yes = !yes;
        }
        return yes;
      };
    for (let z = -2; z < 8; z += 0.34)
      for (let x = -14 + (Math.round(z / 0.34) % 2) * 0.18; x < 6; x += 0.44)
        if (
          [
            [x, z],
            [x + 0.4, z],
            [x + 0.4, z + 0.29],
            [x, z + 0.29],
          ].every(([a, b]) => inside(a, b))
        )
          face(
            o,
            'carved',
            [
              [x, 4.05, z],
              [x, 4.05, z + 0.29],
              [x + 0.4, 4.05, z + 0.29],
              [x + 0.4, 4.05, z],
            ],
            color(trim, 0.81 + (((Math.round(x * 10 + z * 10) % 9) + 9) % 9) * 0.025),
          );
  }
}
function perimeter(o) {
  const p = outer();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    // Towers have their own mapped volumes; omit the coincident perimeter walls.
    if (x > 18 || x < -19 || (z < -12 && x > -9.5 && x < -1.5)) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      hi = x > 16 && z > 3.7 && z < 11.3 ? 14.8 : z > 6 ? 13.4 : 17;
    const f = edgeFrame(o, b, a),
      win = [];
    if (len > 2.8)
      for (const y of [6, 10, 14]) {
        if (y + 1.6 > hi) continue;
        const count = Math.max(1, Math.floor(len / 3.5));
        for (let j = 0; j < count; j++)
          win.push([((j + 1) * len) / (count + 1), y, 0.78, 1.4, false]);
      }
    if (x > 6 && x < 17 && z > 11 && len > 8) {
      for (let k = win.length - 1; k >= 0; k--)
        if (win[k][0] > 4.3 && win[k][0] < 6.9 && win[k][1] < 8) win.splice(k, 1);
      win.push([5.6, 4.2, 2, 3.3, true, true]);
    }
    panel(f, len, 4, hi, win);
    if (fine(o)) {
      // Sparse exposed masonry patches at the base, excluding openings.
      for (let y = 4.05; y < 5.6; y += 0.32)
        for (let x = 0.1 + (Math.round(y * 10) % 2) * 0.2; x + 0.35 < len; x += 0.47)
          if (!(z > 11 && len > 8 && x < 6.7 && x + 0.4 > 4.5 && y + 0.27 > 4.2))
            face(
              f,
              'stone',
              [
                [x, y, 0.01],
                [x + 0.39, y, 0.01],
                [x + 0.36, y + 0.25, 0.012],
                [x + 0.02, y + 0.27, 0.012],
              ],
              color(stone, 0.9 + (((Math.round(x * 7 + y * 5) % 7) + 7) % 7) * 0.028),
            );
    }
  }
}
function roofscape(o) {
  for (const [a, b, lo, hi] of [
    [[5.52, -2.3], [18.25, -2.8], 14.8, 17],
    [[5.69, 3.99], [17.185, 11.295], 13.4, 14.8],
    [[-19.74, 0.84], [-13.71, 2.74], 13.4, 17],
  ])
    beam(
      o,
      'plaster',
      [a[0], (lo + hi) / 2, a[1]],
      [b[0], (lo + hi) / 2, b[1]],
      0.18,
      hi - lo,
      plaster,
    );
  const n = frame(o, -1.6, 0, -13.05);
  hip(n, 19.7, 10.85, 17, 5.2);
  polyRoof(
    o,
    [
      [5.52, -2.3],
      [18.25, -2.8],
      [17.18, 11.3],
      [5.69, 3.99],
    ],
    14.8,
    [12.3, 20, 2.5],
  );
  polyRoof(
    o,
    [
      [-6.73, 7.99],
      [5.69, 3.99],
      [17.18, 11.3],
      [6.7, 13.17],
      [3.33, 9.98],
      [-7.24, 13.72],
    ],
    13.4,
    [2.5, 17.1, 9.2],
  );
  polyRoof(
    o,
    [
      [-15.36, -13.33],
      [-9.4, -13.1],
      [-10.42, -1.82],
      [-13.71, 2.74],
      [-19.74, 0.84],
    ],
    17,
    [-13.6, 22, -5],
  );
  polyRoof(
    o,
    [
      [-19.74, 0.84],
      [-13.71, 2.74],
      [-12.92, 3.76],
      [-7.29, 4.11],
      [-6.73, 7.99],
      [-7.24, 13.72],
      [-18.33, 12.62],
    ],
    13.4,
    [-16, 18.5, 6.8],
  );
  for (const [x, z, y, h] of [
    [12, -7, 22, 3.8],
    [-13, -6, 22, 3.4],
    [12, 3, 19.8, 4],
    [0.5, 9.3, 17, 3.2],
    [17, 10, 15.5, 3.2],
    [-9, 10, 15, 2.6],
  ])
    chimney(o, x, z, y, h);
}
function keep(o) {
  const f = frame(o, -9.41, 0, -13.72),
    w = 7.8,
    d = 11.85,
    lo = 4,
    front = 20.5,
    rear = 32.5;
  towerWalls(f, w, d, lo, front, [
    [7, 1, 1.7, 2, false],
    [11.5, 1, 1.7, 2, false],
    [16.2, 1.1, 2.1, 2, true],
  ]);
  // High rear parapet and two triangular gables enclose a single steep roof plane.
  panel(frame(f, w, 0, 0, Math.PI), w, front, rear, [[w / 2, 26, 1, 1.8, false]]);
  for (const [x, flip] of [
    [0, false],
    [w, true],
  ]) {
    const p = [
      [x, front, d],
      [x, rear, 0],
      [x, front, 0],
    ];
    if (flip) p.reverse();
    tri(f, 'plaster', p, plaster);
  }
  roofFacet(
    f,
    [-0.25, front, d + 0.28],
    [w + 0.25, front, d + 0.28],
    [w + 0.25, rear, -0.12],
    [-0.25, rear, -0.12],
  );
  // Distinctive rounded Renaissance parapet lobes and raised corner posts.
  const lobes = o.detail === 'skyline' ? 4 : 6;
  for (let i = 0; i < lobes; i++) {
    const x = ((i + 0.5) * w) / lobes,
      r = (w / lobes) * 0.43,
      n = near(o) ? 10 : 5;
    box(f, 'plaster', [x - r, rear - 0.08, -0.26], [x + r, rear + 0.65, 0.18], plaster);
    const p = [
      [x - r, rear + 0.65],
      [x + r, rear + 0.65],
    ];
    for (let j = 0; j <= n; j++) {
      const a = (Math.PI * j) / n;
      p.push([x + r * Math.cos(a), rear + 0.65 + r * Math.sin(a)]);
    }
    const ix = earcut(p.flat());
    for (let j = 0; j < ix.length; j += 3)
      for (const z of [-0.27, 0.19]) {
        const q = ix.slice(j, j + 3).map((k) => [p[k][0], p[k][1], z]);
        if (normalFor(...q)[2] * (z > 0 ? 1 : -1) < 0) q.reverse();
        tri(f, 'plaster', q, plaster);
      }
  }
  for (const x of [-0.08, w - 0.22])
    box(f, 'plaster', [x, rear - 0.2, -0.32], [x + 0.32, rear + 1.5, 0.24], plaster);
  const b = frame(o, -7.2, 0, -13.7);
  box(b, 'plaster', [0, 32.1, 0], [3.5, 33.1, 3.63], plaster);
  for (const x of [0.12, 1.75, 3.38])
    for (const z of [0.12, 3.51])
      box(b, 'wood', [x - 0.1, 33, z - 0.1], [x + 0.1, 36.3, z + 0.1], wood);
  if (near(o))
    for (const z of [0.12, 3.51])
      for (const x of [0.12, 1.75]) {
        beam(b, 'wood', [x, 35.2, z], [x + 0.65, 36.2, z], 0.13, 0.13, wood);
        beam(b, 'wood', [x + 1.63, 35.2, z], [x + 0.98, 36.2, z], 0.13, 0.13, wood);
      }
  hip(b, 3.5, 3.63, 36.3, 2.8);
  finial(b, 1.75, 39.1, 1.815, 1.3);
  if (near(o))
    for (const x of [1.6, 5.8]) {
      const z = 7.5,
        y = front + ((d - z) / d) * (rear - front);
      towerWalls(frame(f, x - 0.4, 0, z - 0.1), 0.8, 0.8, y - 0.6, y + 0.8, [
        [y - 0.3, 0.3, 0.7, 1, false],
      ]);
      hip(frame(f, x - 0.45, 0, z - 0.15), 0.9, 0.9, y + 0.8, 0.65);
    }
}
function eastTower(o) {
  const f = frame(o, 18.2, 0, -11.4, -0.024),
    w = 5.45,
    d = 14.55;
  towerWalls(
    f,
    w,
    d,
    4,
    21,
    [
      [7, 0.7, 1.4, 2, false],
      [12, 0.8, 1.6, 2, false],
      [17, 0.7, 1.4, 2, false],
    ],
    'stone',
    color(stone, 1.12),
  );
  const upper = frame(f, -0.35, 0, -0.35);
  towerWalls(upper, w + 0.7, d + 0.7, 21, 24.4, [[22, 0.78, 1.2, 3, false]]);
  if (near(o))
    for (const [v, len] of [
      [frame(f, 0, 0, d), w],
      [frame(f, w, 0, d, Math.PI / 2), d],
      [frame(f, w, 0, 0, Math.PI), w],
    ])
      for (let x = 0.35; x < len; x += 0.85)
        box(v, 'carved', [x - 0.1, 20.2, 0], [x + 0.1, 21.1, 0.4], trim);
  hip(upper, w + 0.7, d + 0.7, 24.4, 5.2);
  chimney(f, 1.1, 3, 28, 3.1);
  finial(f, w / 2, 29.6, d / 2, 1.5);
}
function courtyard(o) {
  const p = court();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (z < -1.7 && x < -0.8 && x > -10.5) continue; // keep front is the courtyard wall here
    const f = edgeFrame(o, a, b),
      gallery = z > 2 && len > 3;
    if (!gallery) {
      panel(
        f,
        len,
        4,
        z < 0 ? 17 : 14.8,
        len > 2
          ? [
              [len / 2, 7, 0.8, 1.4, false],
              [len / 2, 11, 0.8, 1.5, false],
            ]
          : [],
      );
      continue;
    }
    const count = Math.max(1, Math.floor(len / 3.4)),
      bay = len / count,
      arches = [];
    for (let j = 0; j < count; j++)
      arches.push([(j + 0.5) * bay, 4.18, bay * 0.73, 4.1, true, true]);
    panel(f, len, 4, 9, arches);
    if (o.detail === 'skyline') continue;
    // Recessed corridor backwall stays behind the open arches and gallery.
    panel(frame(f, 0, 0, -1.8), len, 4, 11.8, [[len / 2, 5.2, 0.8, 1.7, false]]);
    box(f, 'wood', [0, 8.95, -1.8], [len, 9.15, 0.12], wood);
    box(f, 'plaster', [0, 9.15, -0.1], [len, 10.1, 0.03], plaster);
    for (let j = 0; j <= count * 2; j++) {
      const x = (j * len) / (count * 2);
      box(f, 'wood', [x - 0.07, 9.1, -0.06], [x + 0.07, 12, 0.12], wood);
      if (near(o) && j < count * 2) {
        const x1 = ((j + 1) * len) / (count * 2);
        beam(f, 'wood', [x, 9.2, 0.13], [x1, 10.08, 0.13], 0.09, 0.1, wood);
      }
    }
    box(f, 'wood', [0, 11.8, -0.12], [len, 12, 0.15], wood);
    roofFacet(
      f,
      [-0.15, 12, 0.5],
      [len + 0.15, 12, 0.5],
      [len + 0.15, 13.2, -2],
      [-0.15, 13.2, -2],
    );
  }
  if (o.detail === 'skyline') return;
  const f = frame(o, -4.8, 0, 3.1),
    n = master(o) ? 48 : 16;
  loft(f, 'carved', [radialRing(4.1, 0.83, 0.83, n), radialRing(4.9, 0.83, 0.83, n)], trim, {
    cap: false,
  });
  loft(f, 'carved', [radialRing(4.9, 0.94, 0.94, n), radialRing(5.04, 0.94, 0.94, n)], trim, {
    cap: false,
  });
  const rim = radialRing(5.04, 0.94, 0.94, n),
    inner = radialRing(5.04, 0.67, 0.67, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(f, 'carved', [rim[i], rim[j], inner[j], inner[i]], trim);
  }
  loft(
    f,
    'carved',
    [radialRing(4.1, 0.67, 0.67, n).reverse(), radialRing(5.04, 0.67, 0.67, n).reverse()],
    color(trim, 0.75),
    { cap: false },
  );

  cap(
    f,
    radialRing(4.35, 0.67, 0.67, n).map((p) => [p[0], p[2]]),
    4.35,
    'recess',
    [0.09, 0.08, 0.06],
  );
  if (near(o)) {
    for (const x of [-0.75, 0.75])
      beam(f, 'metal', [x, 4.85, 0], [x, 6.7, 0], 0.06, 0.06, [0.14, 0.13, 0.11]);
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * i) / 16,
        b = (Math.PI * (i + 1)) / 16;
      beam(
        f,
        'metal',
        [0.75 * Math.cos(a), 6.7 + 0.75 * Math.sin(a), 0],
        [0.75 * Math.cos(b), 6.7 + 0.75 * Math.sin(b), 0],
        0.065,
        0.065,
        [0.14, 0.13, 0.11],
      );
    }
    beam(f, 'metal', [0, 5.35, 0], [0, 7.1, 0], 0.025, 0.025, [0.15, 0.14, 0.12]);
  }
}
function entrance(o) {
  const f = frame(edgeFrame(o, [6.702, 13.174], [17.185, 11.295]), 3, 0, 0);
  if (o.detail === 'skyline') return;
  // The aperture belongs to the perimeter wall; this door and stair share that frame.
  box(f, 'wood', [1.6, 4.2, -0.28], [3.6, 6.9, -0.2], wood);
  if (near(o)) {
    for (let i = 0; i < 18; i++)
      box(
        f,
        'stone',
        [1.15, (18 - i) * 0.2, -0.1 + i * 0.29],
        [4.05, (19 - i) * 0.2, 0.19 + i * 0.29],
        stone,
      );
    for (const x of [0.9, 4.3]) beam(f, 'plaster', [x, 4.7, 0], [x, 1.1, 5.3], 0.34, 1, plaster);
    for (let j = 0; j < 8; j++)
      box(
        f,
        'metal',
        [1.73 + j * 0.22, 4.35, -0.18],
        [1.76 + j * 0.22, 6.75, -0.15],
        [0.16, 0.14, 0.11],
      );
  }
}
export function buildBranRuntime(out, detail) {
  const o = { ...out, detail };
  site(o);
  perimeter(o);
  roofscape(o);
  keep(o);
  eastTower(o);
  roundTower(o, -17.56, 6.45, 4.49, 20, 10);
  roundTower(o, 5.47, 10.98, 2.4, 15.8, 6.3);
  courtyard(o);
  entrance(o);
}
export function buildBranSkyline(out) {
  buildBranRuntime(out, 'skyline');
}
export const branStudy = {
  id: 'N0248',
  key: 'bran_castle',
  title: 'Bran Castle',
  category: 'castle',
  wikidataId: 'Q390275',
  mapFrame: 'map-frame.json',
  build: (out) => buildBranRuntime(out),
  brief:
    'Asymmetric Transylvanian castle with mapped open courtyard, round western tower, steep single-slope keep roof, scalloped rear parapet and timber belfry, projecting eastern tower chamber, south stair turret, arched galleries, well and entrance stairs.',
  sourceFacts: {
    identity: 'Exact Q390275 match on OSM relation/3300200',
    constructionCompleted: 1388,
    mappedEnvelopeMeters: [47.691, 27.436],
    mappedBuildingParts: 5,
    courtyardHole: true,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'OSM outer/inner rings and five tower/roof parts; official historical chronology and visitor map; exterior and courtyard photographs.',
    verticalDatum:
      'Court 4 m above local rock contact. Main keep roof 32.5 m; belfry roof 39.1 m and finial 40.4 m. These are photograph-derived local heights, not surveyed elevations.',
    roofscape: 'Hand-authored red-tile facets; exact roof valleys and heights remain provisional.',
  },
  scaleBasis:
    'Mapped outlines in meters, native +X about 39.51 degrees south of east. Heights estimated from photographic proportions; conflicting OSM 50–73 m tags are not adopted as facade heights.',
  refs: [
    'https://bran-castle.com/pages/historical-chronology',
    'https://bran-castle.com/pages/bran-fortress',
    'https://bran-castle.com/pages/visitor-map',
    'https://www.openstreetmap.org/relation/3300200',
    'https://commons.wikimedia.org/wiki/File:Bran_Castle,_Transylvania_(2023).jpg',
    'https://commons.wikimedia.org/wiki/File:Bran_castle_courtyard.jpg',
    'https://commons.wikimedia.org/wiki/File:Bran_castle_courtyard_round_tower.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Photographs and official visitor map are references only; no pixels or third-party mesh copied.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X 39.51 degrees south of east',
    front: '+Z southwest',
    origin: 'OSM castle anchor, provisional local rock contact',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Mapped anchor, outer ring, courtyard and tower parts; terrain contact and height fit pending',
    notes:
      'Courtyard must remain open; do not replace the complete enclosing polygon with solid building volume.',
  }),
  geographicNote:
    'Draft until hill contact, vertical datum and fitted individual tower footprints are checked in the world viewer.',
  limitations: [
    'Maximum fidelity remains pending: mapped horizontal layout is retained but measured elevations, roof valleys and obscured window positions require refinement.',
    'OSM height tags from 50 to 73 m have an unresolved common datum. The authored local heights are photographic estimates, not a survey.',
    'The courtyard gallery, well ironwork, scalloped keep parapet, entrance portal, chimneys and window rhythms use photographic proportions. Interior rooms, artworks and furniture are outside this exterior asset.',
    'The four-meter rock contact is not the full hill. Park, forest, approach paths and terrain fitting remain separate.',
    'Shared procedural plaster, stone, timber, ceramic tile and metal avoid embedded images. Plaster weathering and the distinctive rounded tile pattern need further material-specific refinement.',
  ],
  camera: { position: [-64, 46, 75], lookAt: [0, 17, 0], fov: 43 },
  qaCameras: [
    { name: 'round-western-tower', position: [-46, 25, 31], lookAt: [-17, 18, 6] },
    { name: 'keep-scallops-and-belfry', position: [-25, 38, -43], lookAt: [-5, 28, -9] },
    { name: 'keep-steep-roof', position: [-3, 33, 35], lookAt: [-5, 28, -8] },
    { name: 'eastern-stone-tower', position: [55, 27, -1], lookAt: [20, 17, -4] },
    { name: 'south-stair-turret', position: [18, 20, 38], lookAt: [5, 15, 10] },
    { name: 'open-courtyard-gallery', position: [-4, 14, -1], lookAt: [-8, 8, 6] },
    { name: 'courtyard-well', position: [4, 13, 1], lookAt: [-5, 5.5, 3] },
    { name: 'southern-entry-stairs', position: [21, 8, 31], lookAt: [13, 5, 13] },
    { name: 'courtyard-roof-plan', position: [0, 90, 0.2], lookAt: [0, 0, 0] },
  ],
};
