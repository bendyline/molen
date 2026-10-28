/** Original complete town-hall exterior from three cleared published photographs and native plans. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  U = A.facadeAxis,
  V = [U[1], -U[0]],
  TAU = Math.PI * 2;
const C = {
  stone: rgb('cfcabb'),
  trim: rgb('c5c0af'),
  roof: rgb('535b61'),
  glass: rgb('263b43'),
  gold: rgb('aa8c42'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.09 },
  gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.57, metallic: 0.62 },
};
const local = (q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]],
  G = ([x, y, z]) => [x * U[0] + z * V[0], F + y, x * U[1] + z * V[1]],
  GN = ([x, y, z]) => [x * U[0] + z * V[0], y, x * U[1] + z * V[1]],
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  feature = (id) => frame.features.find((f) => f.id === `way/${id}`),
  ring = (id) => feature(id).outline.slice(0, -1).map(local);
const civic = ring(1228487152),
  rear = ring(23770973),
  towerBase = ring(721672322),
  lantern = ring(721672319),
  towerCenter = [-1.99, 18.51];
export const recessEvidence = [],
  openTowerEvidence = [],
  nativeEvidence = [],
  dormerEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((q) => q.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0])),
    N = n && GN(n);
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed authored face');
  if (N && dot(c, N) < 0) [q[1], q[2]] = [q[2], q[1]];
  const normal = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normal,
    q.map((q) => (Math.abs(normal[1]) > 0.8 ? [q[0], q[2]] : [q[0] + q[2], q[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function triangulate(r) {
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
      if (cr(r[a], r[b], r[c]) < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-9 &&
            cr(r[b], r[c], r[k]) >= -1e-9 &&
            cr(r[c], r[a], r[k]) >= -1e-9,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid source ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true, col) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function poly(o, k, r, y0, y1, col) {
  if (r.length < 3) return;
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, y0, false, col);
  cap(o, k, r, y1, true, col);
}
function clip(r, axis, value, less = true) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = (q) => (less ? q[axis] <= value + 1e-9 : q[axis] >= value - 1e-9),
      ia = inside(a),
      ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) out.push(lerp(a, b, (value - a[axis]) / (b[axis] - a[axis])));
  }
  return out.filter((p, i) => !i || Math.hypot(...sub(p, out[i - 1])) > 1e-7);
}
function box(o, k, x0, x1, y0, y1, z0, z1, col) {
  poly(
    o,
    k,
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    y0,
    y1,
    col,
  );
}
function tube(o, k, a, b, r, N = 6, R = r, col) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    rad = (i) => u.map((x, j) => x * Math.cos((i * TAU) / N) + v[j] * Math.sin((i * TAU) / N)),
    P = (at, i, r) => at.map((x, j) => x + rad(i)[j] * r);
  for (let i = 0; i < N; i++) {
    Q(o, k, [P(a, i, r), P(a, i + 1, r), P(b, i + 1, R), P(b, i, R)], rad(i + 0.5), col);
    T(
      o,
      k,
      [a, P(a, i + 1, r), P(a, i, r)],
      d.map((x) => -x),
      col,
    );
    T(o, k, [b, P(b, i, R), P(b, i + 1, R)], d, col);
  }
}
function cone(o, k, r, y0, y1, col) {
  const center = [
    r.reduce((s, q) => s + q[0], 0) / r.length,
    y1,
    r.reduce((s, q) => s + q[1], 0) / r.length,
  ];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      mid = [(a[0] + b[0]) / 2 - center[0], 0, (a[1] + b[1]) / 2 - center[2]];
    T(o, k, [[a[0], y0, a[1]], [b[0], y0, b[1]], center], mid, col);
  }
  cap(o, k, r, y0, false, col);
}
function scaled(r, s) {
  return r.map((q) => [
    towerCenter[0] + (q[0] - towerCenter[0]) * s,
    towerCenter[1] + (q[1] - towerCenter[1]) * s,
  ]);
}
function band(o, k, r, y, h = 0.18) {
  poly(o, k, r, y, y + h);
}
function archCurve(t, pointed) {
  return pointed
    ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(t, 1 - t)) * (1 - Math.min(t, 1 - t)))) /
        Math.sqrt(0.75)
    : Math.sqrt(Math.max(0, 1 - 4 * (t - 0.5) * (t - 0.5)));
}
/** Front face, physical deep reveals and a back closure only when explicitly requested. */
function archPanel(
  o,
  {
    x0,
    x1,
    y0,
    y1,
    front,
    depth,
    width,
    bottom,
    height,
    pointed = true,
    N = 6,
    glass = false,
    back = false,
    detail = false,
    label = 'opening',
    k = 'stone',
    M = (q) => q,
  },
) {
  const center = (x0 + x1) / 2,
    l = center - width / 2,
    r = center + width / 2,
    rise = width * 0.57,
    shoulder = bottom + height - rise,
    behind = front - depth,
    P = (x, y, z) => M([x, y, z]),
    direction = (n) => sub(M(n), M([0, 0, 0]));
  if (shoulder <= bottom) throw Error('Opening rise exceeds whole height');
  function solid(a, b, c, d) {
    if (d - c < 1e-6) return;
    const rr = [
        [a, c, front],
        [b, c, front],
        [b, d, front],
        [a, d, front],
      ],
      bb = rr.map((q) => [q[0], q[1], behind]);
    Q(o, k, rr.map(M), direction([0, 0, 1]));
    Q(o, k, bb.map(M), direction([0, 0, -1]));
  }
  for (const [q, n] of [
    [
      [P(x0, y0, front), P(x0, y1, front), P(x0, y1, behind), P(x0, y0, behind)],
      [-1, 0, 0],
    ],
    [
      [P(x1, y0, front), P(x1, y1, front), P(x1, y1, behind), P(x1, y0, behind)],
      [1, 0, 0],
    ],
    [
      [P(x0, y0, front), P(x1, y0, front), P(x1, y0, behind), P(x0, y0, behind)],
      [0, -1, 0],
    ],
    [
      [P(x0, y1, front), P(x1, y1, front), P(x1, y1, behind), P(x0, y1, behind)],
      [0, 1, 0],
    ],
  ])
    Q(o, k, q, direction(n));
  if (l > x0) solid(x0, l, y0, y1);
  if (r < x1) solid(r, x1, y0, y1);
  if (bottom > y0) solid(l, r, y0, bottom);
  for (let j = 0; j < N; j++) {
    const a = l + (width * j) / N,
      b = l + (width * (j + 1)) / N,
      ya = shoulder + rise * archCurve(j / N, pointed),
      yb = shoulder + rise * archCurve((j + 1) / N, pointed);
    Q(
      o,
      k,
      [P(a, ya, front), P(b, yb, front), P(b, y1, front), P(a, y1, front)],
      direction([0, 0, 1]),
    );
    Q(
      o,
      k,
      [P(a, ya, behind), P(b, yb, behind), P(b, y1, behind), P(a, y1, behind)],
      direction([0, 0, -1]),
    );
    Q(
      o,
      'trim',
      [P(a, ya, front), P(b, yb, front), P(b, yb, behind), P(a, ya, behind)],
      direction([yb - ya, -(b - a), 0]),
    );
    if (detail)
      Q(
        o,
        'trim',
        [
          P(a, ya, front + 0.025),
          P(b, yb, front + 0.025),
          P(b, yb + 0.13, front + 0.025),
          P(a, ya + 0.13, front + 0.025),
        ],
        direction([0, 0, 1]),
      );
  }
  for (const [x, sign] of [
    [l, 1],
    [r, -1],
  ])
    Q(
      o,
      'trim',
      [P(x, bottom, front), P(x, shoulder, front), P(x, shoulder, behind), P(x, bottom, behind)],
      direction([sign, 0, 0]),
    );
  if (bottom > y0)
    Q(
      o,
      'trim',
      [P(l, bottom, front), P(r, bottom, front), P(r, bottom, behind), P(l, bottom, behind)],
      direction([0, 1, 0]),
    );
  if (glass || back) {
    const q = [
      [l, bottom, behind + 0.015],
      [r, bottom, behind + 0.015],
      [r, shoulder, behind + 0.015],
    ];
    for (let j = N - 1; j >= 0; j--) {
      const x = l + (width * j) / N,
        y = shoulder + rise * archCurve(j / N, pointed);
      q.push([x, y, behind + 0.015]);
    }
    for (let i = 1; i < q.length - 1; i++)
      T(o, glass ? 'glass' : k, [q[0], q[i], q[i + 1]].map(M), direction([0, 0, 1]));
  }
  recessEvidence.push({
    label,
    center: [center, bottom + Math.min(height * 0.5, 2), front - depth * 0.5],
    width,
    depth,
    closedBack: glass || back,
    transform: M,
  });
}

function roof(o, u0, u1, v0, v1, eave, ridge, axis = 'u') {
  if (axis === 'u') {
    const m = (v0 + v1) / 2;
    for (const v of [v0, v1])
      Q(
        o,
        'roof',
        [
          [u0, eave, v],
          [u1, eave, v],
          [u1, ridge, m],
          [u0, ridge, m],
        ],
        [0, 1, 0],
      );
    for (const [x, s] of [
      [u0, -1],
      [u1, 1],
    ])
      T(
        o,
        'stone',
        [
          [x, eave, v0],
          [x, eave, v1],
          [x, ridge, m],
        ],
        [s, 0, 0],
      );
  } else {
    const m = (u0 + u1) / 2;
    for (const u of [u0, u1])
      Q(
        o,
        'roof',
        [
          [u, eave, v0],
          [u, eave, v1],
          [m, ridge, v1],
          [m, ridge, v0],
        ],
        [0, 1, 0],
      );
    for (const [z, s] of [
      [v0, -1],
      [v1, 1],
    ])
      T(
        o,
        'stone',
        [
          [u0, eave, z],
          [u1, eave, z],
          [m, ridge, z],
        ],
        [0, 0, s],
      );
  }
}
function roofDistance(q, r) {
  let d = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = sub(b, a),
      t = Math.max(0, Math.min(1, dot(sub(q, a), v) / dot(v, v))),
      c = lerp(a, b, t);
    d = Math.min(d, Math.hypot(...sub(q, c)));
  }
  return d;
}
function rearRoof(o, lod) {
  const N = [2, 3, 6, 10][lod],
    height = (q) => A.rearEave + Math.min(A.rearRoofRise, roofDistance(q, rear) * 0.9);
  for (const ids of triangulate(rear)) {
    const [a, b, c] = ids.map((i) => rear[i]),
      P = (i, j) => {
        const q = [
          a[0] + ((b[0] - a[0]) * i) / N + ((c[0] - a[0]) * j) / N,
          a[1] + ((b[1] - a[1]) * i) / N + ((c[1] - a[1]) * j) / N,
        ];
        return [q[0], height(q), q[1]];
      };
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N - i; j++) {
        T(o, 'roof', [P(i, j), P(i + 1, j), P(i, j + 1)], [0, 1, 0]);
        if (i + j < N - 1) T(o, 'roof', [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], [0, 1, 0]);
      }
  }
}
function facadeBoundaries(lod) {
  const result = [];
  for (const [a, b] of [
    [-27.3, A.passageU[0]],
    [A.passageU[1], 28.2],
  ]) {
    const n = lod === 1 ? 4 : 8;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      if (x < -6.9 || x > 3.2) result.push(x);
    }
  }
  return result;
}
function dormer(o, x, v, y, sign, lod) {
  const w = 0.85,
    h = 1.15,
    front = v + sign * 0.4,
    back = v - sign * 0.45;
  box(o, 'stone', x - w / 2, x + w / 2, y, y + h, Math.min(front, back), Math.max(front, back));
  Q(
    o,
    'glass',
    [
      [x - 0.27, y + 0.2, front + sign * 0.01],
      [x + 0.27, y + 0.2, front + sign * 0.01],
      [x + 0.27, y + 0.93, front + sign * 0.01],
      [x - 0.27, y + 0.93, front + sign * 0.01],
    ],
    [0, 0, sign],
  );
  roof(
    o,
    x - 0.55,
    x + 0.55,
    Math.min(front, back) - 0.08,
    Math.max(front, back) + 0.08,
    y + h,
    y + h + 0.5,
    'v',
  );
  if (lod === 3)
    box(
      o,
      'trim',
      x - 0.045,
      x + 0.045,
      y + 0.2,
      y + 0.95,
      front + sign * 0.01 - 0.03,
      front + sign * 0.01 + 0.03,
    );
  dormerEvidence.push([x, y, v]);
}
function body(o, lod) {
  for (const [id, r] of [
    [1228487152, civic],
    [23770973, rear],
  ]) {
    band(o, 'stone', r, id === 1228487152 ? 20.25 : A.rearEave - 0.35, 0.35);
    for (const q of r) nativeEvidence.push([id, ...q]);
  }
  const core = clip(civic, 1, A.frontBodyV);
  for (const r of [clip(core, 0, A.passageU[0]), clip(core, 0, A.passageU[1], false)])
    poly(o, 'stone', r, 0, A.arcadeTop);
  poly(o, 'stone', core, A.arcadeTop, A.gothicEave - 0.35);
  poly(o, 'stone', rear, 0, A.rearEave - 0.35);
  roof(o, ...A.gothicFrontU, ...A.gothicRoofV, A.gothicEave, A.gothicRoofRidge);
  roof(o, 10.8, 28.3, -11.8, 8.1, A.gothicEave, 31.1, 'v');
  rearRoof(o, lod);
  for (const [a, b] of [
    [-30.6, -27.3],
    [28.2, 30.8],
  ]) {
    box(o, 'stone', a, b, 0, A.arcadeTop, A.frontBodyV, A.arcadeFrontV);
    box(o, 'stone', a, b, A.arcadeTop, 20.25, A.frontBodyV, A.frontSkinV);
  }
  const starts = [
      [-27.3, A.passageU[0]],
      [A.passageU[1], 28.2],
    ],
    count = lod === 0 ? 2 : lod === 1 ? 4 : 8,
    N = [2, 2, 6, 10][lod];
  for (const [start, end] of starts) {
    const step = (end - start) / count;
    for (let i = 0; i < count; i++) {
      const x0 = start + i * step,
        x1 = x0 + step;
      archPanel(o, {
        x0,
        x1,
        y0: 0,
        y1: A.arcadeTop,
        front: A.arcadeFrontV,
        depth: 2.1,
        width: Math.min(step * 0.7, 3.2),
        bottom: 0.05,
        height: 4.8,
        N,
        pointed: true,
        label: 'ground-gallery',
        detail: lod >= 2,
      });
      if (lod >= 1 && (x1 <= -6.9 || x0 >= 3.2))
        for (const [y, h] of lod === 1
          ? [[10.4, 5.5]]
          : [
              [7.3, 4.7],
              [13.3, 5.15],
            ])
          archPanel(o, {
            x0,
            x1,
            y0: y - 0.65,
            y1: y + h + 0.55,
            front: A.frontSkinV,
            depth: 0.48,
            width: Math.min(step * 0.58, 2.25),
            bottom: y,
            height: h,
            N,
            glass: true,
            detail: lod >= 2,
            label: 'gothic-front-window',
          });
    }
  }
  archPanel(o, {
    x0: A.passageU[0] - 0.3,
    x1: A.passageU[1] + 0.3,
    y0: 0,
    y1: A.arcadeTop,
    front: A.arcadeFrontV + 0.3,
    depth: 16.4,
    width: A.passageU[1] - A.passageU[0],
    bottom: 0.05,
    height: 5.45,
    N,
    pointed: true,
    label: 'central-through-passage',
    detail: lod >= 2,
  });
  if (lod >= 1) {
    for (const y of [6.1, 12.75, 19.5]) box(o, 'trim', -30.7, 31, y, y + 0.22, 21.8, 22.5);
    for (const x of facadeBoundaries(lod)) {
      box(o, 'trim', x - 0.13, x + 0.13, 6, 20.6, 22.2, 22.6);
      if (lod >= 2) {
        box(o, 'trim', x - 0.23, x + 0.23, 19.6, 21.7, 22, 22.8);
        cone(
          o,
          'trim',
          [
            [x - 0.22, 22.05],
            [x + 0.22, 22.05],
            [x + 0.22, 22.5],
            [x - 0.22, 22.5],
          ],
          21.7,
          22.7,
        );
      }
    }
    for (const sign of [-1, 1])
      for (let row = 0; row < (lod === 1 ? 1 : 3); row++) {
        const v = (A.gothicRoofV[0] + A.gothicRoofV[1]) / 2 + sign * (5.7 - row * 1.8),
          y =
            A.gothicEave + (A.gothicRoofRidge - A.gothicEave) * (1 - Math.abs(v - 15.125) / 7.025),
          step = lod === 1 ? 14 : 4.1;
        for (let x = -28.4 + (row % 2) * 1.85; x < 30; x += step) {
          if (Math.abs(x - towerCenter[0]) < 6) continue;
          dormer(o, x, v, y, sign, lod);
        }
      }
    rearWindows(o, lod);
  }
}
function tower(o, lod) {
  const center = towerCenter,
    N = [2, 2, 6, 10][lod];
  if (lod === 0) box(o, 'stone', center[0] - 3.8, center[0] + 3.8, A.arcadeTop, 37, 14.4, 22.3);
  else {
    poly(o, 'stone', clip(towerBase, 1, 21.9), A.arcadeTop, 36.6);
    band(o, 'trim', towerBase, 36.6, 0.4);
    archPanel(o, {
      x0: -5.45,
      x1: 1.45,
      y0: 20.6,
      y1: 36.6,
      front: 23.2,
      depth: 1.25,
      width: 3.15,
      bottom: 23,
      height: 10.4,
      N,
      glass: true,
      detail: lod >= 2,
      label: 'square-tower-base-recess',
    });
  }
  const stages = lod === 0 ? [37, 72] : lod === 1 ? [37, 55, 72] : A.towerLanternStages;
  for (let j = 0; j < stages.length - 1; j++) {
    const y0 = stages[j],
      y1 = stages[j + 1],
      scale = lod === 0 ? 1 : [1, 0.92, 0.81][j],
      r = scaled(lantern, scale);
    if (lod >= 1) band(o, 'trim', scaled(lantern, scale * 1.1), y0, 0.42);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        d = sub(b, a),
        length = Math.hypot(...d),
        u = d.map((x) => x / length),
        mid = lerp(a, b, 0.5),
        n = unit(sub(mid, center)),
        M = ([x, y, z]) => [mid[0] + u[0] * x + n[0] * z, y, mid[1] + u[1] * x + n[1] * z];
      if (lod === 0) {
        const q = [
          [-0.16, -0.12],
          [0.16, -0.12],
          [0.16, 0.12],
          [-0.16, 0.12],
        ].map(([x, z]) => {
          const p = M([-length * 0.4 + x, 0, z]);
          return [p[0], p[2]];
        });
        poly(o, 'stone', q, y0, y1);
      } else {
        archPanel(o, {
          x0: -length * 0.5,
          x1: length * 0.5,
          y0: y0 + 0.42,
          y1: y1,
          front: 0,
          depth: 0.38,
          width: length * 0.67,
          bottom: y0 + 0.9,
          height: y1 - y0 - 2.2,
          N,
          pointed: true,
          detail: lod >= 2,
          label: 'open-octagonal-belfry',
          M,
        });
        openTowerEvidence.push({
          stage: j,
          side: i,
          center: M([length * 0.18, y0 + (y1 - y0) * 0.46, 0]),
          outward: n,
          innerThickness: 0.38,
        });
        if (lod >= 2) {
          const a0 = M([0, y0 + 0.95, -0.08]),
            b0 = M([0, y1 - 2.2, -0.08]);
          tube(o, 'trim', a0, b0, 0.055, 4);
        }
      }
    }
    if (lod >= 2)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) / 4,
            pos = lerp(a, b, t);
          tube(o, 'trim', [pos[0], y0 + 0.45, pos[1]], [pos[0], y0 + 1.1, pos[1]], 0.045, 4);
        }
        tube(o, 'trim', [a[0], y0 + 1.1, a[1]], [b[0], y0 + 1.1, b[1]], 0.07, 4);
      }
  }
  const tipRing = scaled(lantern, 0.78);
  cone(o, 'stone', tipRing, 72, A.spireTop);
  if (lod >= 2) {
    for (let i = 0; i < tipRing.length; i++) {
      const a = tipRing[i],
        tip = [center[0], A.spireTop, center[1]];
      tube(o, 'trim', [a[0], 72, a[1]], tip, 0.055, 4);
      for (let j = 1; j < 6; j++) {
        const q = lerp([a[0], 72, a[1]], tip, j / 7),
          n = unit([a[0] - center[0], 0, a[1] - center[1]]);
        tube(o, 'gold', q, [q[0] + n[0] * 0.24, q[1] + 0.12, q[2] + n[2] * 0.24], 0.075, 4);
      }
    }
  }
  tube(o, 'gold', [center[0], 92, center[1]], [center[0], 95.6, center[1]], lod ? 0.075 : 0.13, 4);
  const h = 95.7;
  for (const [a, b] of lod === 0
    ? [
        [
          [0, h - 0.5, 0],
          [0, A.finialTop, 0],
        ],
      ]
    : [
        [
          [-0.65, h - 0.6, 0],
          [0.65, h + 0.45, 0],
        ],
        [
          [0, h - 0.8, -0.45],
          [0, h + 0.45, 0.45],
        ],
        [
          [0, h - 0.5, 0],
          [0, A.finialTop, 0],
        ],
      ])
    tube(
      o,
      'gold',
      [center[0] + a[0], a[1], center[1] + a[2]],
      [center[0] + b[0], b[1], center[1] + b[2]],
      0.085,
      lod === 3 ? 6 : 4,
    );
  const ids =
    lod === 0
      ? [721672315, 721672318]
      : lod === 1
        ? [721672315, 721672316, 721672318, 721672324]
        : [721672315, 721672316, 721672317, 721672318, 721672320, 721672321, 721672323, 721672324];
  for (const id of ids) {
    const f = feature(id),
      r = ring(id),
      height = Number(f.properties.height),
      rise = Number(f.properties['roof:height']),
      base = 37;
    if (lod === 0) {
      const mid = r.reduce((s, q) => s.map((x, i) => x + q[i] / r.length), [0, 0]),
        square = [
          [mid[0] - 0.55, mid[1] - 0.55],
          [mid[0] + 0.55, mid[1] - 0.55],
          [mid[0] + 0.55, mid[1] + 0.55],
          [mid[0] - 0.55, mid[1] + 0.55],
        ];
      poly(o, 'stone', square, base, height - rise);
      cone(o, 'trim', square, height - rise, height);
    } else {
      poly(o, 'stone', r, base, height - rise);
      band(o, 'trim', r, height - rise - 0.55, 0.3);
      cone(o, 'trim', r, height - rise, height);
      if (lod === 3) {
        const mid = r.reduce((s, q) => s.map((x, i) => x + q[i] / r.length), [0, 0]);
        tube(o, 'gold', [mid[0], height, mid[1]], [mid[0], height + 0.8, mid[1]], 0.04, 4);
      }
    }
  }
}
function corners(o, lod) {
  if (lod === 0) return;
  for (const [x, z, h] of [
    [-28.65, 24.25, 36.7],
    [29.75, 23.9, 35.3],
    [28.2, -11.3, 29.7],
  ]) {
    const sides = lod === 1 ? 4 : 8,
      r = Array.from({ length: sides }, (_, i) => [
        x + 1.02 * Math.cos((i * TAU) / sides),
        z + 1.02 * Math.sin((i * TAU) / sides),
      ]);
    poly(o, 'stone', r, 0, h - 3.7);
    band(o, 'trim', r, h - 4.3, 0.45);
    cone(o, 'trim', r, h - 3.7, h);
    if (lod >= 2) for (let y = 8; y < h - 4; y += 5.5) band(o, 'trim', r, y, 0.25);
  }
  // Original stepped side-gable outline, independent of the fine sculptural program.
  for (const x of [-30.8, 31.1])
    for (let i = 0; i < 7; i++) {
      const z = 8.2 + i * 2,
        mid = z + 0.9,
        y = 21.1 + Math.max(0, 1 - Math.abs(mid - 15.2) / 7) * 14.9;
      box(o, 'trim', x - 0.19, x + 0.19, 20.6, y, z, z + 1.8);
    }
}
function porticos(o, lod) {
  for (const id of [1284891362, 1284891363]) {
    const sourceRing = ring(id),
      r =
        lod === 0
          ? [
              [Math.min(...sourceRing.map((q) => q[0])), Math.min(...sourceRing.map((q) => q[1]))],
              [Math.max(...sourceRing.map((q) => q[0])), Math.min(...sourceRing.map((q) => q[1]))],
              [Math.max(...sourceRing.map((q) => q[0])), Math.max(...sourceRing.map((q) => q[1]))],
              [Math.min(...sourceRing.map((q) => q[0])), Math.max(...sourceRing.map((q) => q[1]))],
            ]
          : sourceRing;
    poly(o, 'roof', r, A.courtyardPorticoRoof, A.courtyardPorticoRoof + 0.2);
    const lower = r.filter(
      (_q, i) => i % Math.max(1, Math.floor(r.length / (lod === 0 ? 1 : 5))) === 0,
    );
    for (const q of lower)
      box(
        o,
        'stone',
        q[0] - 0.16,
        q[0] + 0.16,
        0,
        A.courtyardPorticoRoof,
        q[1] - 0.16,
        q[1] + 0.16,
      );
  }
}
function rearWindows(o, lod) {
  if (lod < 1) return;
  const r = rear,
    sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      d = sub(b, a),
      L = Math.hypot(...d);
    if (L < 6) continue;
    const u = d.map((x) => x / L),
      n = [sign * u[1], -sign * u[0]],
      count = Math.max(1, Math.floor(L / (lod === 1 ? 8 : 5.6)));
    for (let j = 0; j < count; j++) {
      const c = lerp(a, b, (j + 0.5) / count),
        M = ([x, y, z]) => [c[0] + x * u[0] + z * n[0], y, c[1] + x * u[1] + z * n[1]],
        direction = (q) => sub(M(q), M([0, 0, 0]));
      for (const y of lod === 1 ? [6.1] : [3, 7.5]) {
        const w = 0.65,
          h = 2.1;
        Q(
          o,
          'glass',
          [M([-w, y, 0.018]), M([w, y, 0.018]), M([w, y + h, 0.018]), M([-w, y + h, 0.018])],
          direction([0, 0, 1]),
        );
        if (lod >= 2) {
          const outer = [
              [-w - 0.14, y - 0.14],
              [w + 0.14, y - 0.14],
              [w + 0.14, y + h + 0.14],
              [-w - 0.14, y + h + 0.14],
            ],
            inner = [
              [-w, y],
              [w, y],
              [w, y + h],
              [-w, y + h],
            ];
          for (let k = 0; k < 4; k++) {
            const z = (k + 1) % 4,
              Qp = (r, k, v) => M([r[k][0], r[k][1], v]);
            Q(
              o,
              'trim',
              [Qp(outer, k, 0.16), Qp(outer, z, 0.16), Qp(inner, z, 0.16), Qp(inner, k, 0.16)],
              direction([0, 0, 1]),
            );
            const side = [inner[z][1] - inner[k][1], -(inner[z][0] - inner[k][0]), 0];
            Q(
              o,
              'trim',
              [Qp(inner, k, 0.16), Qp(inner, z, 0.16), Qp(inner, z, 0.018), Qp(inner, k, 0.018)],
              direction(side.map((x) => -x)),
            );
            Q(
              o,
              'trim',
              [Qp(outer, k, 0.16), Qp(outer, z, 0.16), Qp(outer, z, 0.012), Qp(outer, k, 0.012)],
              direction(side),
            );
          }
        }
      }
    }
  }
}
function fineFacade(o, lod) {
  if (lod < 2) return;
  for (const a of recessEvidence.filter((a) => a.label === 'gothic-front-window')) {
    const x = a.center[0],
      base = a.center[1] - 2,
      z = A.frontSkinV - 0.34,
      h = base < 10 ? 4.7 : 5.15;
    box(o, 'trim', x - 0.035, x + 0.035, base, base + h - 0.55, z - 0.035, z + 0.035);
    box(
      o,
      'trim',
      x - a.width / 2,
      x + a.width / 2,
      base + h * 0.48 - 0.035,
      base + h * 0.48 + 0.035,
      z - 0.035,
      z + 0.035,
    );
    if (lod === 3)
      for (const sign of [-1, 1])
        for (let y = base + 0.35; y < base + h - 1; y += 0.65)
          tube(
            o,
            'trim',
            [x - a.width * 0.42, y, z],
            [x + a.width * 0.42, y + sign * 0.55, z],
            0.014,
            4,
          );
  }
  if (lod === 3)
    for (const x of facadeBoundaries(lod)) {
      if (Math.abs(x + 2) < 5) continue;
      for (const y of [9.8, 16.8]) {
        box(o, 'trim', x - 0.22, x + 0.22, y - 0.25, y, 22.25, 22.9);
        box(o, 'trim', x - 0.055, x + 0.055, y, y + 1.15, 22.36, 22.67);
        cone(
          o,
          'trim',
          [
            [x - 0.3, 22.25],
            [x + 0.3, 22.25],
            [x + 0.3, 22.93],
            [x - 0.3, 22.93],
          ],
          y + 1.2,
          y + 1.9,
        );
      }
    }
  const x = 31.36,
    y = 12.8,
    z = 16.6,
    N = lod === 3 ? 24 : 12;
  for (let i = 0; i < N; i++) {
    const a = (i * TAU) / N,
      b = ((i + 1) * TAU) / N,
      P = (r, t) => [x, y + r * Math.cos(t), z + r * Math.sin(t)];
    T(o, 'glass', [[x - 0.01, y, z], P(0.72, a), P(0.72, b)], [1, 0, 0]);
    Q(o, 'gold', [P(0.73, a), P(0.84, a), P(0.84, b), P(0.73, b)], [1, 0, 0]);
  }
  tube(o, 'gold', [x + 0.015, y, z], [x + 0.015, y + 0.5, z - 0.2], 0.025, 4);
  tube(o, 'gold', [x + 0.015, y, z], [x + 0.015, y + 0.17, z + 0.38], 0.035, 4);
}

export function buildBrusselsTownHall(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  openTowerEvidence.length = 0;
  nativeEvidence.length = 0;
  dormerEvidence.length = 0;
  body(o, lod);
  tower(o, lod);
  corners(o, lod);
  porticos(o, lod);
  fineFacade(o, lod);
}
export const brusselsSkyline = (o) => buildBrusselsTownHall(o, null, 0),
  brusselsDistrict = (o) => buildBrusselsTownHall(o, null, 1),
  brusselsStreet = (o) => buildBrusselsTownHall(o, null, 2),
  brusselsCloseup = (o) => buildBrusselsTownHall(o, null, 3);
export const brusselsTownHallModel = {
  id: 'brussels_town_hall',
  key: 'brussels_town_hall',
  cell: 'u1/u15',
  wikidataId: 'Q1255327',
  title: 'Brussels Town Hall',
  category: 'civic-institutional',
  recipe: 'brussels-town-hall-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBrusselsTownHall,
  brief:
    'Whole Brussels Town Hall: native Gothic front/side wings and intrinsic later rear wings around an open central courtyard, steep slate roofs/dense dormers/stepped side gables, off-center square tower/open octagonal belfry/turrets/tall slender spire/original simplified gilt finial, real ground-gallery/central-passage voids and deep pointed window reveals. Pale stone, original buttress/niche/balcony/tracery approximations, covered courtyard porticos. Exact native two-component built envelopes/all52ringvertices retained; property/GrandPlace/neighboring guild houses/signs/flags/people/interiors and copied detailed sculpture excluded.',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  camera: G([45, 70, 150]),
  lookAt: G([0, 38, 0]),
  portableGroundY: F - 0.2,
  mediumFiContext: { scale: '1.8', groundY: F - 0.1 },
  qaCameras: [
    {
      name: 'whole-rear-wings-and-open-courtyard',
      position: G([-85, 65, -100]),
      lookAt: G([-2, 34, 0]),
    },
    {
      name: 'gothic-ground-gallery-and-central-through-passage',
      position: G([14, 5.5, 42]),
      lookAt: G([-1, 4, 23]),
    },
    {
      name: 'deep-pointed-front-windows-and-buttresses',
      position: G([13, 16, 47]),
      lookAt: G([2, 13, 22]),
    },
    {
      name: 'open-octagonal-belfry-and-corner-turrets',
      position: G([-22, 57, 48]),
      lookAt: G([-2, 56, 18.5]),
    },
    {
      name: 'slender-spire-crockets-and-original-gilt-finial',
      position: G([18, 87, 48]),
      lookAt: G([-2, 83, 18.5]),
    },
    {
      name: 'whole-open-courtyard-native-wing-footprints',
      position: G([-4, 65, -3]),
      lookAt: G([-4, 3, -3]),
    },
    {
      name: 'steep-slate-roof-dormers-and-stepped-gable',
      position: G([50, 40, 44]),
      lookAt: G([19, 29, 15]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/brussels-town-hall-runtime-overlay.mjs',
    level: 'skyline',
    export: 'brusselsSkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'brusselsDistrict', errorMeters: 0.85, surfaces },
      street: { export: 'brusselsStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'brusselsCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Three exact published Qualla creatorPD/CC0 originals individually inspected/nativeSHA1 matched:2025JulianLupyanCC0/own tower and two2011Kareljown/PD-self whole front/side views. No supplemental imagery/protected sources/copied pixels/textures/article-media-rightsmetadata repairs. Rear courtyard elevations/ornament/dormer-window census/roof intersections/hidden profile/current finish are original bounded estimates. Original gilt finial and niche/buttress mass simplify the architectural silhouette without copying the detailed figurative sculpture program. Distant levels reduce arch/dormer/turret/tracery census.',
    'Independent500m129x12916641sample original field/fourrawtiles/fixed SW29.6266m provider datum frozen before floors/sections/geometry. No fit/flatten/reacquisition or subsequent raising to conceal contact. All geographic placement remains preview/replaceFootprint=false, exact grade/thresholds unresolved; flat isolated stage/neighborhood are synthetic review fixtures.',
  ],
};
