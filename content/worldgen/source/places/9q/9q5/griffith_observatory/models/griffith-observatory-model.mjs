/** Whole native observatory envelope, three copper-clad domes and open terrace loggias. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  R = f.geometry.outline.slice(0, -1),
  TAU = Math.PI * 2;
const C = {
  wall: rgb('e8e3d4'),
  trim: rgb('efebdf'),
  foundation: rgb('c4c2b7'),
  roof: rgb('bdbdb3'),
  dome: rgb('6d706b'),
  rib: rgb('7c7e76'),
  green: rgb('779c93'),
  glass: rgb('546f75'),
  door: rgb('4f655f'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.72, metallic: 0.2 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.3,
    metallic: 0.07,
    alphaMode: 'OPAQUE',
  },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mean = (q) => q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
function T(o, k, q, n, col = C.wall) {
  q = q.map((v) => [Math.fround(v[0]), Math.fround(v[1] + F), Math.fround(v[2])]);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) throw Error('Collapsed Griffith face');
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
function B(o, k, a, b, w, d, col = C.trim) {
  beam(
    o,
    k,
    a.map((v, i) => v + (i === 1 ? F : 0)),
    b.map((v, i) => v + (i === 1 ? F : 0)),
    w,
    d,
    col,
  );
}
function box(o, k, lo, hi, col = C.wall) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const [q, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
        [x, Y, z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [0, -1, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
  ])
    Q(o, k, q, n, col);
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
    if (!found) throw Error('Invalid Griffith polygon');
  }
  if (Math.abs(cr(...ids.map((i) => r[i]))) > 1e-8) out.push(ids);
  return out;
}
function cap(o, k, r, y, up, col) {
  for (const ids of triangles(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
export const windowEvidence = [],
  archEvidence = [],
  nativeEvidence = [],
  domeEvidence = [];
function wall(o, a, b, y0, y1, holes = [], lod = 0, col = C.wall) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    u = [dx / L, 0, dz / L],
    n = [dz / L, 0, -dx / L],
    P = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d],
    xs = [0, L, ...holes.flatMap((h) => [h.x0, h.x1])]
      .sort((a, b) => a - b)
      .filter((a, i, s) => i === 0 || a - s[i - 1] > 1e-7),
    ys = [y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])]
      .sort((a, b) => a - b)
      .filter((a, i, s) => i === 0 || a - s[i - 1] > 1e-7);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const x = xs[i],
        X = xs[i + 1],
        y = ys[j],
        Y = ys[j + 1];
      if (
        holes.some(
          (h) =>
            (x + X) / 2 > h.x0 && (x + X) / 2 < h.x1 && (y + Y) / 2 > h.y0 && (y + Y) / 2 < h.y1,
        )
      )
        continue;
      Q(o, 'wall', [P(x, y), P(X, y), P(X, Y), P(x, Y)], n, col);
    }
  for (const h of holes) {
    const front = [P(h.x0, h.y0), P(h.x1, h.y0), P(h.x1, h.y1), P(h.x0, h.y1)],
      back = [
        P(h.x0, h.y0, -A.windowDepth),
        P(h.x1, h.y0, -A.windowDepth),
        P(h.x1, h.y1, -A.windowDepth),
        P(h.x0, h.y1, -A.windowDepth),
      ];
    Q(o, 'glass', back, n, h.door ? C.door : C.glass);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q(
        o,
        'wall',
        [front[i], front[j], back[j], back[i]],
        sub(mean(front), mean([front[i], front[j]])),
        C.trim,
      );
      if (lod > 1)
        B(
          o,
          'wall',
          front[i].map((v, k) => v + n[k] * 0.025),
          front[j].map((v, k) => v + n[k] * 0.025),
          0.1,
          0.12,
          C.trim,
        );
    }
    if (lod > 1) {
      const div = h.door ? 3 : 2;
      for (let i = 1; i < div; i++)
        B(
          o,
          'metal',
          P(h.x0 + ((h.x1 - h.x0) * i) / div, h.y0, -0.19),
          P(h.x0 + ((h.x1 - h.x0) * i) / div, h.y1, -0.19),
          0.065,
          0.065,
          h.door ? C.door : C.rib,
        );
      for (let i = 1; i <= (lod === 3 ? 4 : 1); i++)
        B(
          o,
          'metal',
          P(h.x0, h.y0 + ((h.y1 - h.y0) * i) / (lod === 3 ? 5 : 2), -0.19),
          P(h.x1, h.y0 + ((h.y1 - h.y0) * i) / (lod === 3 ? 5 : 2), -0.19),
          0.05,
          0.06,
          h.door ? C.door : C.rib,
        );
    }
    windowEvidence.push({ front, back, normal: n, door: !!h.door, depth: A.windowDepth });
  }
  return { P, L, n };
}
function solidPoly(
  o,
  k,
  r,
  y0,
  y1,
  col = C.wall,
  { bottom = true, top = true, windows = false, lod = 0 } = {},
) {
  const q = area(r) > 0 ? r : r.slice().reverse();
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      n = [(b[1] - a[1]) / L, 0, (a[0] - b[0]) / L],
      holes = [];
    const nativeEdge = R.some((v, j) => {
      const w = R[(j + 1) % R.length];
      return (
        (v[0] === a[0] && v[1] === a[1] && w[0] === b[0] && w[1] === b[1]) ||
        (v[0] === b[0] && v[1] === b[1] && w[0] === a[0] && w[1] === a[1])
      );
    });
    if (windows && lod > 0 && nativeEdge) {
      let count = 0,
        w = 1.45,
        lo = A.windowBottom,
        hi = A.windowTop;
      if (n[2] < -0.95 && L > 12 && mid[1] < -22) count = lod === 1 ? 2 : 4;
      else if (Math.abs(n[0]) > 0.95 && L > 9 && mid[1] > -10 && mid[1] < 2)
        count = lod === 1 ? 1 : 3;
      else if (
        L > 1.3 &&
        L < 2 &&
        Math.abs(mid[0]) > 34 &&
        mid[1] < -13 &&
        mid[1] > -21 &&
        lod > 1
      ) {
        count = 1;
        w = 0.72;
      }
      if (y1 < 5) {
        count = L > 5 && Math.abs(n[0]) > 0.8 ? 2 : 0;
        w = 1.2;
        lo = 0.7;
        hi = 2.6;
      }
      for (let j = 0; j < count; j++) {
        const x = (L * (j + 0.5)) / count;
        holes.push({ x0: x - w / 2, x1: x + w / 2, y0: lo, y1: hi });
      }
      if (n[2] < -0.98 && mid[1] < -24.5 && Math.abs(mid[0]) < 5.5) {
        const min = Math.min(a[0], b[0]),
          max = Math.max(a[0], b[0]),
          left = Math.max(min, -2.35),
          right = Math.min(max, 3.1);
        if (right > left + 0.1) {
          const t0 = ((left - a[0]) / n[2]) * -1,
            t1 = ((right - a[0]) / n[2]) * -1;
          holes.push({
            x0: Math.max(0, Math.min(t0, t1)),
            x1: Math.min(L, Math.max(t0, t1)),
            y0: A.entryLanding,
            y1: 5.65,
            door: true,
          });
        }
      }
    }
    const w = wall(o, a, b, y0, y1, holes, lod, col);
    if (windows && lod > 0 && n[2] < -0.95 && L > 12 && mid[1] < -22) {
      for (const y of [6.52, 7.16])
        B(o, 'wall', w.P(0.08, y, 0.065), w.P(L - 0.08, y, 0.065), 0.1, 0.12, C.trim);
      if (lod > 1) {
        const count = lod === 2 ? Math.floor(L / 1.7) : Math.floor(L / 1.1);
        for (let j = 0; j < count; j++) {
          const x = ((j + 0.5) * L) / count,
            s = Math.min(0.55, (L / count) * 0.45),
            points = [
              [x - s, 6.6],
              [x - s, 7.02],
              [x + s, 7.02],
              [x + s, 6.74],
              [x, 6.74],
              [x, 6.88],
            ];
          for (let k = 0; k < points.length - 1; k++)
            B(o, 'wall', w.P(...points[k], 0.07), w.P(...points[k + 1], 0.07), 0.07, 0.075, C.trim);
        }
      }
      if (lod > 1)
        for (let j = 0; j <= 4; j++) {
          const x = ((j + 0.5) * L) / 5;
          B(o, 'wall', w.P(x, 0.75, 0.06), w.P(x, 6.4, 0.06), 0.22, 0.18, C.trim);
        }
      if (lod === 3)
        for (const y of [1, 2.05, 3.1, 4.15, 5.2])
          B(o, 'wall', w.P(0.05, y, 0.018), w.P(L - 0.05, y, 0.018), 0.025, 0.035, C.trim);
    }
  }
  if (bottom) cap(o, k, r, y0, false, col);
  if (top) cap(o, k, r, y1, true, windows ? C.roof : col);
}
function circle(o, k, c, r, y0, y1, N, col, { bottom = false, top = true } = {}) {
  const ring = Array.from({ length: N }, (_, i) => [
    c[0] + r * Math.cos((i * TAU) / N),
    c[1] + r * Math.sin((i * TAU) / N),
  ]);
  solidPoly(o, k, ring, y0, y1, col, { bottom, top });
}
function annulus(o, k, c, ri, ro, y, N, col) {
  for (let i = 0; i < N; i++) {
    const a = (i * TAU) / N,
      b = ((i + 1) * TAU) / N,
      P = (t, r) => [c[0] + r * Math.cos(t), y, c[1] + r * Math.sin(t)];
    Q(o, k, [P(a, ri), P(b, ri), P(b, ro), P(a, ro)], [0, 1, 0], col);
  }
}
function dome(o, c, r, rise, y, N, L, col, lod, type) {
  const P = (a, t, offset = 0) => [
    c[0] + (r + offset) * Math.cos(t) * Math.cos(a),
    y + (rise + offset) * Math.sin(t),
    c[1] + (r + offset) * Math.cos(t) * Math.sin(a),
  ];
  for (let j = 0; j < L; j++)
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N,
        t = (j * Math.PI) / (2 * L),
        u = ((j + 1) * Math.PI) / (2 * L),
        col2 = lod > 0 && i % 5 === 0 ? col.map((v) => v * 0.98) : col;
      if (j === L - 1)
        T(
          o,
          'metal',
          [P(a, t), P(b, t), [c[0], y + rise, c[1]]],
          [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
          col2,
        );
      else
        Q(
          o,
          'metal',
          [P(a, t), P(b, t), P(b, u), P(a, u)],
          [Math.cos((a + b) / 2), 0.5, Math.sin((a + b) / 2)],
          col2,
        );
    }
  if (lod > 0) {
    const rows = type === 'main' ? [0, 1, 2, 9][lod] : [0, 0, 1, 4][lod],
      meridians = type === 'main' ? [0, 0, 6, 40][lod] : [0, 0, 3, 20][lod],
      ringN = N,
      ribL = L;
    for (let j = 1; j <= rows; j++) {
      const t = (Math.round((j * L) / (rows + 1)) * Math.PI) / (2 * L);
      for (let i = 0; i < ringN; i++)
        B(
          o,
          'metal',
          P((i * TAU) / ringN, t, 0.04),
          P(((i + 1) * TAU) / ringN, t, 0.04),
          0.035,
          0.045,
          type === 'crown' ? C.green : C.rib,
        );
    }
    if (lod > 1)
      for (let i = 0; i < meridians; i++) {
        const a = (i * TAU) / meridians;
        for (let j = 0; j < ribL - 1; j++)
          B(
            o,
            'metal',
            P(a, (j * Math.PI) / (2 * ribL), 0.04),
            P(a, ((j + 1) * Math.PI) / (2 * ribL), 0.04),
            0.022,
            0.032,
            type === 'crown' ? C.green : C.rib,
          );
      }
  }
  domeEvidence.push({ type, center: c, radius: r, rise, spring: y, crown: y + rise });
}
function slit(o, c, lod, index) {
  const N = [3, 7, 12, 20][lod],
    angle = index === 0 ? 0.05 : 0.23,
    u = [Math.cos(angle), 0, Math.sin(angle)],
    v = [-u[2], 0, u[0]],
    r = A.telescopeHousingRadius,
    ri = r - 0.22,
    ys = A.telescopeDomeBase,
    offsets = lod === 0 ? [0] : [-0.57, 0.57],
    width = lod === 0 ? 0.7 : 0.24,
    P = (t, R, x) => [
      c[0] + u[0] * R * Math.cos(t) + v[0] * x,
      ys + R * Math.sin(t),
      c[1] + u[2] * R * Math.cos(t) + v[2] * x,
    ];
  for (const x of offsets)
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI) / N,
        b = ((i + 1) * Math.PI) / N,
        front = [
          P(a, ri, x - width / 2),
          P(a, r, x - width / 2),
          P(b, r, x - width / 2),
          P(b, ri, x - width / 2),
        ],
        back = front.map((q) => q.map((t, j) => t + v[j] * width)),
        centre = mean([...front, ...back]);
      for (const [q, n] of [
        [front, v.map((t) => -t)],
        [back, v],
      ])
        Q(o, 'metal', q, n, C.dome);
      for (let k = 0; k < 4; k++) {
        const l = (k + 1) % 4,
          q = [front[k], front[l], back[l], back[k]];
        Q(o, 'metal', q, sub(mean(q), centre), C.rib);
      }
    }
}
function archWall(o, x, z0, z1, lod) {
  const n = [Math.sign(x), 0, 0],
    thick = 0.65,
    base = A.wingRoof,
    top = 11.15,
    span = (z1 - z0) / 3,
    w = span - 0.65,
    r = w / 2,
    spring = top - 0.65 - r,
    seg = [0, 4, 8, 14][lod];
  for (let j = 0; j <= 3; j++) {
    const z = z0 + j * span;
    box(o, 'wall', [x - thick / 2, base, z - 0.32], [x + thick / 2, top, z + 0.32], C.wall);
  }
  for (let j = 0; j < 3; j++) {
    const c = z0 + (j + 0.5) * span,
      a0 = c - r,
      a1 = c + r,
      P = (z, y, side) => [x + (side * thick) / 2, y, z];
    for (let i = 0; i < seg; i++) {
      const a = (i * Math.PI) / seg,
        b = ((i + 1) * Math.PI) / seg,
        zA = c - r * Math.cos(a),
        zB = c - r * Math.cos(b),
        yA = spring + r * Math.sin(a),
        yB = spring + r * Math.sin(b);
      for (const side of [-1, 1])
        Q(
          o,
          'wall',
          [P(zA, yA, side), P(zB, yB, side), P(zB, top, side), P(zA, top, side)],
          [side, 0, 0],
          C.wall,
        );
      Q(
        o,
        'wall',
        [P(zA, yA, -1), P(zB, yB, -1), P(zB, yB, 1), P(zA, yA, 1)],
        [0, -Math.sin((a + b) / 2), Math.cos((a + b) / 2)],
        C.trim,
      );
      Q(
        o,
        'wall',
        [P(zA, top, -1), P(zB, top, -1), P(zB, top, 1), P(zA, top, 1)],
        [0, 1, 0],
        C.trim,
      );
    }
    B(
      o,
      'wall',
      [x + n[0] * 0.38, top + 0.04, a0],
      [x + n[0] * 0.38, top + 0.04, a1],
      0.13,
      0.15,
      C.trim,
    );
    if (lod > 1)
      box(
        o,
        'wall',
        [x - thick / 2 - 0.09, top - 0.65, c - 0.18],
        [x + thick / 2 + 0.09, top + 0.14, c + 0.18],
        C.trim,
      );
    archEvidence.push({ x, centerZ: c, width: w, base, spring, top, thickness: thick });
  }
  if (lod > 1) {
    const count = Math.floor((z1 - z0) / 1.25);
    for (let j = 0; j < count; j++) {
      const z = z0 + ((j + 0.5) * (z1 - z0)) / count,
        s = 0.42,
        points = [
          [z - s, top - 0.1],
          [z - s, top + 0.22],
          [z + s, top + 0.22],
          [z + s, top + 0.05],
          [z, top + 0.05],
          [z, top + 0.15],
        ];
      for (let i = 0; i < 5; i++)
        B(
          o,
          'wall',
          [x + n[0] * 0.39, points[i][1], points[i][0]],
          [x + n[0] * 0.39, points[i + 1][1], points[i + 1][0]],
          0.05,
          0.05,
          C.trim,
        );
    }
  }
}
function stairs(o, lod) {
  const steps = lod === 0 ? 1 : 9,
    W = 9.4,
    zFront = -24.874,
    zToe = zFront - 5.4,
    profile = [[zToe, 0]];
  for (let i = 0; i < steps; i++) {
    profile.push(
      [zToe + (i * 5.4) / steps, ((i + 1) * A.entryLanding) / steps],
      [zToe + ((i + 1) * 5.4) / steps, ((i + 1) * A.entryLanding) / steps],
    );
  }
  profile.push([zFront, 0]);
  const r = profile.map(([z, y]) => [z, y]);
  for (const side of [-1, 1])
    for (const ids of triangles(r))
      T(
        o,
        'wall',
        ids.map((i) => [0.38 + (side * W) / 2, r[i][1], r[i][0]]),
        [side, 0, 0],
        C.trim,
      );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-8) continue;
    Q(
      o,
      'wall',
      [
        [0.38 - W / 2, a[1], a[0]],
        [0.38 + W / 2, a[1], a[0]],
        [0.38 + W / 2, b[1], b[0]],
        [0.38 - W / 2, b[1], b[0]],
      ],
      [0, b[0] - a[0], a[1] - b[1]],
      C.trim,
    );
  }
  if (lod > 1)
    for (const x of [-4.6, 5.35])
      B(o, 'metal', [x, 0.92, zToe + 0.3], [x, 1.9, zFront - 0.3], 0.06, 0.06, C.dome);
}
function parapets(o, lod) {
  if (lod === 0) return;
  for (const [x, z0, z1] of [
    [-17.5, 3, 12.5],
    [18.0, 3.5, 12.4],
    [30.05, -9, 3],
  ]) {
    const y = x > 25 ? A.eastLowerRoof : A.wingRoof,
      N = Math.ceil((z1 - z0) / (lod === 1 ? 3 : 1.6));
    B(o, 'wall', [x, y + 0.88, z0], [x, y + 0.88, z1], 0.22, 0.27, C.trim);
    for (let i = 0; i <= N; i++)
      box(
        o,
        'wall',
        [x - 0.13, y, z0 + (i * (z1 - z0)) / N - 0.11],
        [x + 0.13, y + 0.9, z0 + (i * (z1 - z0)) / N + 0.11],
        C.wall,
      );
  }
}
export function buildGriffithObservatory(o, _frame, lod = 3) {
  windowEvidence.length = 0;
  archEvidence.length = 0;
  nativeEvidence.length = 0;
  domeEvidence.length = 0;
  const N = [12, 24, 48, 72][lod],
    L = [3, 6, 10, 16][lod],
    z = R[13][1] + ((R[49][1] - R[13][1]) * (18 - R[13][0])) / (R[49][0] - R[13][0]),
    S = [18, z],
    front = [...R.slice(0, 14), ...R.slice(49)],
    east = [...R.slice(13, 20), S],
    rear = [S, ...R.slice(19, 50)];
  solidPoly(o, 'wall', R, A.lowerBase, 0, C.foundation, { bottom: true, top: false });
  nativeEvidence.push(...R.map((q) => [q[0], A.lowerBase, q[1]]));
  solidPoly(o, 'wall', front, 0, A.wingRoof, C.wall, {
    bottom: false,
    top: true,
    windows: true,
    lod,
  });
  solidPoly(o, 'wall', east, 0, A.eastLowerRoof, C.wall, {
    bottom: false,
    top: true,
    windows: true,
    lod,
  });
  solidPoly(o, 'wall', rear, 0, A.wingRoof, C.wall, {
    bottom: false,
    top: true,
    windows: true,
    lod,
  });
  circle(o, 'wall', A.mainCenter, A.mainDrumRadius, A.wingRoof - 0.05, A.mainDomeBase, N, C.wall, {
    top: false,
  });
  annulus(o, 'wall', A.mainCenter, A.mainDomeRadius, A.mainDrumRadius, A.mainDomeBase, N, C.trim);
  dome(
    o,
    A.mainCenter,
    A.mainDomeRadius,
    A.mainDomeRadius,
    A.mainDomeBase,
    N,
    L,
    C.dome,
    lod,
    'main',
  );
  const buttresses = [0, 8, 16, 24][lod];
  for (let i = 0; i < buttresses; i++) {
    const a = (i * TAU) / buttresses,
      c = Math.cos(a),
      s = Math.sin(a),
      r = A.mainDrumRadius;
    const pier = [
      [r - 0.1, -0.22],
      [r + 1.05, -0.22],
      [r + 1.05, 0.22],
      [r - 0.1, 0.22],
    ].map(([radius, width]) => [
      A.mainCenter[0] + radius * c - width * s,
      A.mainCenter[1] + radius * s + width * c,
    ]);
    solidPoly(o, 'wall', pier, 0.3, A.mainDomeBase + 0.25, C.trim);
    if (lod > 1)
      box(
        o,
        'wall',
        [
          A.mainCenter[0] + (r + 0.65) * c - 0.31,
          A.mainDomeBase - 0.1,
          A.mainCenter[1] + (r + 0.65) * s - 0.31,
        ],
        [
          A.mainCenter[0] + (r + 0.65) * c + 0.31,
          A.mainDomeBase + 0.34,
          A.mainCenter[1] + (r + 0.65) * s + 0.31,
        ],
        C.trim,
      );
  }
  for (let i = 0; i < 2; i++) {
    const c = A.telescopeCenters[i];
    circle(o, 'wall', c, A.telescopeDrumRadius, A.wingRoof - 0.04, A.telescopeDomeBase, N, C.wall, {
      top: false,
    });
    annulus(
      o,
      'wall',
      c,
      A.telescopeShellRadius,
      A.telescopeDrumRadius,
      A.telescopeDomeBase,
      N,
      C.trim,
    );
    dome(
      o,
      c,
      A.telescopeShellRadius,
      A.telescopeShellRadius,
      A.telescopeDomeBase,
      N,
      L,
      C.dome,
      lod,
      'telescope',
    );
    slit(o, c, lod, i);
  }
  box(o, 'wall', [-6.0, A.wingRoof, -24.874], [6.76, A.entryTop, -11.9], C.wall);
  circle(
    o,
    'metal',
    A.crownCenter,
    A.crownRadius,
    A.crownBase,
    A.crownBase + 0.15,
    [8, 12, 24, 32][lod],
    C.green,
    { top: false },
  );
  dome(
    o,
    A.crownCenter,
    A.crownRadius,
    A.crownTop - A.crownBase - 0.15,
    A.crownBase + 0.15,
    [8, 12, 24, 32][lod],
    [2, 3, 5, 8][lod],
    C.green,
    lod,
    'crown',
  );
  stairs(o, lod);
  if (lod > 0) {
    for (const x of [-2.72, 3.48])
      box(o, 'wall', [x - 0.19, A.entryLanding, -25.12], [x + 0.19, 6.02, -24.65], C.trim);
    box(o, 'wall', [-2.91, 5.66, -25.12], [3.67, 6.24, -24.65], C.trim);
    for (const [x, a, b] of [
      [-15.72, -9.15, 2.25],
      [17.96, -8.9, 2.5],
    ])
      archWall(o, x, a, b, lod);
    parapets(o, lod);
  }
}
export const griffithObservatorySkyline = (o) => buildGriffithObservatory(o, null, 0),
  griffithObservatoryDistrict = (o) => buildGriffithObservatory(o, null, 1),
  griffithObservatoryStreet = (o) => buildGriffithObservatory(o, null, 2),
  griffithObservatoryCloseup = (o) => buildGriffithObservatory(o, null, 3);
export const griffithObservatoryModel = {
  id: 'griffith_observatory',
  key: 'griffith_observatory',
  cell: '9q/9q5',
  title: 'Griffith Observatory',
  wikidataId: 'Q575901',
  category: p.category,
  recipe: 'griffith-observatory-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildGriffithObservatory,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Griffith Observatory: actual native78control envelope/closed lower construction volume and partitioned long front wings/central rear/eastern low terrace, large rear planetarium drum/radial buttresses/dark paneled copper dome, two smaller telescope domes with closed raised curved slit housings, cream recessed sash/piers/architectural Greek-key cornice, closed central entrance/intrinsic stairs/raised green crown, genuine open upper side arches and pierced parapets. Official main23.4696m and telescope16.764m heights above fixed front-lawn reference; exterior main dome25.908m diameter from enclosure engineer. Three distinct accepted creatorCC0/explicitHighsmithPD inputs only; failed local candidates excluded without repair or same-image bypass. Hidden lower east wing/sections/window census/roof/slit facing/current finish/ground contact are original estimates. No sculpture, lettered art/window designs/interiors/instruments/lamps/grounds/sourcepixels.',
  camera: [88, F + 57, -99],
  lookAt: [0, F + 8, 0],
  portableGroundY: F - 0.16,
  sunDirection: [-8, 14, -9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-rear-planetarium-and-native-east-lower-wing',
      position: [80, F + 48, 90],
      lookAt: [0, F + 8, 2],
    },
    {
      name: 'entrance-recesses-stairs-and-green-crown',
      position: [18, F + 16, -45],
      lookAt: [0.38, F + 5.6, -18],
    },
    {
      name: 'closed-telescope-slit-and-paneled-copper',
      position: [-46, F + 24, -36],
      lookAt: [-29.35, F + 12, -17.5],
    },
    {
      name: 'genuine-open-terrace-arches-and-parapet',
      position: [-32, F + 12, -3],
      lookAt: [-15.72, F + 9.3, -3.5],
    },
    {
      name: 'whole-roof-plan-and-three-domes',
      position: [0.1, F + 130, 0.1],
      lookAt: [0, F + 7, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/griffith-observatory-runtime-overlay.mjs',
    level: 'skyline',
    export: 'griffithObservatorySkyline',
    errorMeters: 5,
    surfaces,
    authoredLevels: {
      district: { export: 'griffithObservatoryDistrict', errorMeters: 1.7, surfaces },
      street: { export: 'griffithObservatoryStreet', errorMeters: 0.45, surfaces },
      closeup: { export: 'griffithObservatoryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Three distinct individually inspected sources pass unchanged public-domain/CC0 inventory: native2023BenoitPrieur own/selfCC0 front, official Highsmith6144x4096native aerial and listed1228x1840side-arch detail, bound to exact catalog/files and explicit primary photographerPD dedication. Two published source candidates rejected unchanged guard, excluded; no source repair/reclassification or same-image bypass. Original architectural geometry/colors only, no copied bronze-door/window artwork/sculpture/name text/interiors/site instruments/lamps/grounds/photo pixels.',
    'Whole native78control lower envelope/upper partitions retained. Eastern hidden low wing/service roof/sections/roomplan/window census/slit facing/fine finish and construction contact are original estimates. Published overall dimensions support native footprint; mapped35.9height/371ele not used as a survey. Original600m129x12916641samples/four rawtiles/SW325.7447m datum frozen before every floor/section/geometry choice. Main-lawn floor fixed' +
      F +
      'm from untouched entry grid before geometry; no terrainfit/flatten/reacquire/late modelraising. Exact grade/threshold contact unresolved; preview/replaceFootprint=false. Flat ground and synthetic neighbors are review fixtures.',
  ],
};
