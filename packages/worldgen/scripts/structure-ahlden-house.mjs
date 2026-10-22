/** Ahlden House: exact open U, timber/brick wings and two real western through-passages. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u1/u1q/ahlden_house/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  p = plan.outline,
  ref = 'palette:#ffffff',
  L = plan.levels,
  C = {
    brick: rgb('bd8a6c'),
    wood: rgb('493e31'),
    roof: rgb('c18a66'),
    glass: rgb('819293'),
    white: rgb('deddd0'),
    stone: rgb('bcb49b'),
  };
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.31, metallic: 0.06 },
  white: { slot: 'trim', localRef: ref, roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
};
const area = (p) =>
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  sign = area(p) > 0 ? 1 : -1;
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  const n = normalFor(...p),
    a = n.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, n, p.map(uv), col);
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function face(a, b, side = sign) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [side * t[1], -side * t[0]];
  return {
    len,
    t,
    n: [n[0], 0, n[1]],
    P: (u, y, dep = 0) => [a[0] + t[0] * u + n[0] * dep, y, a[1] + t[1] * u + n[1] * dep],
  };
}
function panel(o, s, f, u, y, w, h, dep = 0.015, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(u - w / 2, y, dep),
      f.P(u + w / 2, y, dep),
      f.P(u + w / 2, y + h, dep),
      f.P(u - w / 2, y + h, dep),
    ],
    f.n,
    col,
  );
}
function F(o, s, f, a, b, width, dep = 0.07, d = 3, col = C[s]) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-7) return;
  const n = [((-(b[1] - a[1]) / len) * width) / 2, (((b[0] - a[0]) / len) * width) / 2],
    pts = [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ];
  Q(
    o,
    s,
    pts.map((p) => f.P(...p, dep)),
    f.n,
    col,
  );
  if (d === 3 && width > 0.12)
    for (const [i, j, sn] of [
      [0, 1, 1],
      [3, 2, -1],
    ])
      Q(
        o,
        s,
        [f.P(...pts[i], dep), f.P(...pts[j], dep), f.P(...pts[j], 0), f.P(...pts[i], 0)],
        [sn * f.t[0] * n[0], sn * n[1], sn * f.t[1] * n[0]],
        col,
      );
}
function rectWall(o, f, u0, u1, y0, y1) {
  if (u1 - u0 > 0.001 && y1 - y0 > 0.001)
    panel(o, 'brick', f, (u0 + u1) / 2, y0, u1 - u0, y1 - y0, 0);
}
const gates = [
  { z: 0, w: 3.5, spring: 2.15, rise: 1.25 },
  { z: -3.1, w: 1.15, spring: 2.1, rise: 0.58 },
];
function path(g, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const z = g.z - g.w / 2 + (g.w * i) / n;
    return [z, g.spring + g.rise * Math.sqrt(Math.max(0, 1 - Math.pow((z - g.z) / (g.w / 2), 2)))];
  });
}
function walls(o, d) {
  for (let i = 0; i < p.length; i++) {
    const f = face(p[i], p[(i + 1) % p.length]);
    if (i !== 8 && i !== 2) {
      rectWall(o, f, 0, f.len, L.foundationBottom, L.eave);
      continue;
    }
    const toU = (z) => (z - p[i][1]) / f.t[1],
      holes = gates
        .map((g) => ({
          g,
          a: Math.min(toU(g.z - g.w / 2), toU(g.z + g.w / 2)),
          b: Math.max(toU(g.z - g.w / 2), toU(g.z + g.w / 2)),
        }))
        .sort((a, b) => a.a - b.a);
    let last = 0;
    for (const h of holes) {
      rectWall(o, f, last, h.a, L.foundationBottom, L.eave);
      const ps = path(h.g, [4, 6, 10, 14][d]);
      for (let k = 1; k < ps.length; k++) {
        const a = ps[k - 1],
          b = ps[k];
        Q(
          o,
          'brick',
          [
            f.P(toU(a[0]), a[1], 0),
            f.P(toU(b[0]), b[1], 0),
            f.P(toU(b[0]), L.eave, 0),
            f.P(toU(a[0]), L.eave, 0),
          ],
          f.n,
        );
      }
      last = h.b;
    }
    rectWall(o, f, last, f.len, L.foundationBottom, L.eave);
  }
  cap(o, 'brick', p, L.firstFloor);
  cap(o, 'brick', p, L.eave);
  // Intrinsic arched vault surfaces connect front and courtyard openings across the western wing.
  const x0 = plan.bounds.min[0],
    x1 = (p[2][0] + p[3][0]) / 2;
  for (const g of gates) {
    const ps = path(g, [4, 6, 10, 14][d]);
    for (let k = 1; k < ps.length; k++) {
      const a = ps[k - 1],
        b = ps[k];
      Q(
        o,
        'brick',
        [
          [x0, a[1], a[0]],
          [x1, a[1], a[0]],
          [x1, b[1], b[0]],
          [x0, b[1], b[0]],
        ],
        [0, -1, 0],
      );
    }
    for (const s of [-1, 1]) {
      const z = g.z + (s * g.w) / 2;
      Q(
        o,
        'brick',
        [
          [x0, 0, z],
          [x1, 0, z],
          [x1, g.spring, z],
          [x0, g.spring, z],
        ],
        [0, 0, -s],
      );
    }
  }
  box(o, 'stone', [x0, -0.12, -3.7], [x1, 0, 1.8], C.stone);
}
const main = {
    axis: 'z',
    x0: plan.bounds.min[0],
    x1: (p[2][0] + p[3][0]) / 2,
    z0: plan.bounds.min[1],
    z1: plan.bounds.max[1],
    ridge: L.mainRidge,
  },
  north = {
    axis: 'x',
    x0: (plan.bounds.min[0] + p[2][0]) / 2,
    x1: p[0][0],
    z0: p[0][1],
    z1: p[1][1],
    ridge: L.sideRidge,
  },
  south = {
    axis: 'x',
    x0: (plan.bounds.min[0] + p[3][0]) / 2,
    x1: p[4][0],
    z0: p[4][1],
    z1: p[5][1],
    ridge: L.sideRidge,
  };
function gable(o, f, y, w, h, d) {
  const center = f.len / 2,
    points = [f.P(center - w / 2, y, 0), f.P(center + w / 2, y, 0), f.P(center, y + h, 0)];
  tri(o, 'brick', points, f.n);
  for (const s of [-1, 1])
    F(o, 'wood', f, [center + (s * w) / 2, y], [center, y + h], 0.18, 0.09, d);
  F(o, 'wood', f, [center - w / 2, y], [center + w / 2, y], 0.22, 0.09, d);
  if (d === 0) return;
  for (const yy of [1.4, 2.9, 4.2]) {
    if (yy >= h - 0.6) continue;
    const half = (w / 2) * (1 - yy / h);
    F(o, 'wood', f, [center - half, y + yy], [center + half, y + yy], 0.15, 0.08, d);
  }
  for (const dx of [-3, -1.5, 0, 1.5, 3]) {
    const top = h * (1 - Math.abs(dx) / (w / 2));
    if (top < 0.8) continue;
    F(o, 'wood', f, [center + dx, y], [center + dx, y + top], 0.14, 0.07, d);
    if (d >= 2 && Math.abs(dx) > 1)
      F(
        o,
        'wood',
        f,
        [center + dx, y + 0.2],
        [center + dx - Math.sign(dx) * 1.3, y + Math.min(top - 0.2, 2.5)],
        0.14,
        0.07,
        d,
      );
  }
  if (h > 3.5) window(o, f, center, y + 1.65, 1.5, 1.6, d);
}
function roof(o, r, d) {
  const xm = (r.x0 + r.x1) / 2,
    zm = (r.z0 + r.z1) / 2,
    y = L.eave;
  if (r.axis === 'z') {
    Q(
      o,
      'roof',
      [
        [r.x0, y, r.z0],
        [xm, r.ridge, r.z0],
        [xm, r.ridge, r.z1],
        [r.x0, y, r.z1],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'roof',
      [
        [xm, r.ridge, r.z0],
        [r.x1, y, r.z0],
        [r.x1, y, r.z1],
        [xm, r.ridge, r.z1],
      ],
      [0, 1, 0],
    );
    gable(o, face([r.x0, r.z0], [r.x1, r.z0], 1), y, r.x1 - r.x0, r.ridge - y, d);
    gable(o, face([r.x1, r.z1], [r.x0, r.z1], 1), y, r.x1 - r.x0, r.ridge - y, d);
  } else {
    Q(
      o,
      'roof',
      [
        [r.x0, y, r.z0],
        [r.x1, y, r.z0],
        [r.x1, r.ridge, zm],
        [r.x0, r.ridge, zm],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'roof',
      [
        [r.x0, r.ridge, zm],
        [r.x1, r.ridge, zm],
        [r.x1, y, r.z1],
        [r.x0, y, r.z1],
      ],
      [0, 1, 0],
    );
    gable(o, face([r.x1, r.z0], [r.x1, r.z1], 1), y, r.z1 - r.z0, r.ridge - y, d);
  }
  if (d >= 1) {
    const a = r.axis === 'z' ? [xm, r.ridge, r.z0] : [r.x0, r.ridge, zm],
      b = r.axis === 'z' ? [xm, r.ridge, r.z1] : [r.x1, r.ridge, zm];
    beam(o, 'roof', a, b, 0.13, 0.13, C.roof);
  }
}
function window(o, f, u, y, w, h, d) {
  panel(o, 'glass', f, u, y, w, h, 0.025);
  if (d === 0) {
    panel(o, 'white', f, u, y, w, 0.07, 0.045);
    return;
  }
  for (const dx of [-w / 2, w / 2])
    F(o, 'white', f, [u + dx, y - 0.06], [u + dx, y + h + 0.06], 0.08, 0.09, d);
  for (const yy of [y - 0.04, y + h + 0.04])
    F(o, 'white', f, [u - w / 2 - 0.06, yy], [u + w / 2 + 0.06, yy], 0.1, 0.09, d);
  F(o, 'white', f, [u, y], [u, y + h], 0.055, 0.095, d);
  if (d >= 2)
    for (let j = 1; j < 4; j++)
      F(o, 'white', f, [u - w / 2, y + (h * j) / 4], [u + w / 2, y + (h * j) / 4], 0.035, 0.095, d);
}
function facade(o, d) {
  for (let i = 0; i < p.length; i++) {
    const f = face(p[i], p[(i + 1) % p.length]),
      front = i === 8;
    if (f.len < 3) continue;
    const count = Math.max(1, Math.round(f.len / (d === 0 ? 5.5 : 2.9))),
      bay = f.len / count;
    for (const yy of front ? [L.firstFloor, L.eave - 0.08] : [0.25, L.firstFloor, L.eave - 0.08]) {
      if (i !== 2 || yy > 3.4) F(o, 'wood', f, [0, yy], [f.len, yy], 0.22, 0.07, d);
      else {
        const holes = gates
          .map((g) => [g.z - g.w / 2, g.z + g.w / 2])
          .map((a) => a.map((z) => (z - p[i][1]) / f.t[1]))
          .sort((a, b) => a[0] - b[0]);
        let last = 0;
        for (const [a, b] of holes) {
          F(o, 'wood', f, [last, yy], [a, yy], 0.22, 0.07, d);
          last = b;
        }
        F(o, 'wood', f, [last, yy], [f.len, yy], 0.22, 0.07, d);
      }
    }
    for (let j = 0; j <= count; j++) {
      const u = j * bay,
        point = f.P(u, 0),
        nearGate = Math.abs(point[2]) < 4.0;
      F(o, 'wood', f, [u, L.firstFloor], [u, L.eave], 0.18, 0.08, d);
      if (!front && !(i === 2 && nearGate))
        F(o, 'wood', f, [u, 0.2], [u, L.firstFloor], 0.18, 0.08, d);
    }
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) * bay,
        q = f.P(u, 0),
        gate = (i === 8 || i === 2) && gates.some((g) => Math.abs(q[2] - g.z) < g.w / 2 + 0.75),
        crest = front && Math.abs(q[2]) < 1.7;
      if (!crest) window(o, f, u, 4.45, Math.min(1.25, bay * 0.59), 1.75, d);
      if (!gate) window(o, f, u, 1.1, Math.min(1.12, bay * 0.56), 1.5, d);
      if (d >= 1) {
        const y = L.firstFloor + 0.15,
          h = 0.75,
          left = j * bay + 0.1,
          right = (j + 1) * bay - 0.1;
        if (!(front && Math.abs(q[2]) < 1.7)) {
          F(o, 'wood', f, [left, y], [right, y + h], 0.12, 0.07, d);
          F(o, 'wood', f, [right, y], [left, y + h], 0.12, 0.07, d);
        }
        if (!front && !gate && j % 2 === 0)
          F(o, 'wood', f, [left, 0.35], [right, L.firstFloor - 0.1], 0.13, 0.075, d);
      }
      // Small original herringbone-like brick fields beneath selected upper casements.
      if (d === 3 && !crest)
        for (const s of [-1, 1])
          for (let k = 0; k < 4; k++) {
            const xx = u + s * bay * 0.23,
              yy = 6.35 + k * 0.17;
            F(
              o,
              'brick',
              f,
              [xx - 0.14, yy],
              [xx + 0.14, yy + s * 0.1],
              0.055,
              0.02,
              0,
              k % 2 ? rgb('be8364') : rgb('a66b50'),
            );
          }
    }
  }
}
function archTrim(o, d) {
  if (d === 0) return;
  for (const i of [8, 2]) {
    const f = face(p[i], p[(i + 1) % p.length]),
      toU = (z) => (z - p[i][1]) / f.t[1];
    for (const g of gates) {
      const ps = path(g, d === 1 ? 6 : d === 2 ? 10 : 16);
      for (let j = 1; j < ps.length; j++) {
        const a = ps[j - 1],
          b = ps[j],
          outerA = [a[0], a[1] + 0.25],
          outerB = [b[0], b[1] + 0.25];
        Q(
          o,
          'brick',
          [
            f.P(toU(a[0]), a[1], 0.07),
            f.P(toU(b[0]), b[1], 0.07),
            f.P(toU(outerB[0]), outerB[1], 0.07),
            f.P(toU(outerA[0]), outerA[1], 0.07),
          ],
          f.n,
          j % 2 ? rgb('c19575') : rgb('ab7355'),
        );
      }
      for (const s of [-1, 1])
        F(
          o,
          'brick',
          f,
          [toU(g.z + s * (g.w / 2 + 0.12)), 0],
          [toU(g.z + s * (g.w / 2 + 0.12)), g.spring],
          0.22,
          0.065,
          d,
        );
    }
  }
}
function crest(o, d) {
  if (d === 0) return;
  const f = face(p[8], p[9]),
    u = (0 - p[8][1]) / f.t[1],
    y = 3.6;
  panel(o, 'stone', f, u, y, 2.45, 1.65, 0.13);
  for (const dx of [-1.27, 1.27])
    F(o, 'stone', f, [u + dx, y - 0.1], [u + dx, y + 1.73], 0.12, 0.21, d);
  for (const yy of [y - 0.08, y + 1.7])
    F(o, 'stone', f, [u - 1.34, yy], [u + 1.34, yy], 0.14, 0.2, d);
  for (const dx of [-0.8, 0.8]) window(o, f, u + dx, 5.4, 1.05, 1.4, d);
  if (d === 1) return;
  const shield = [
      [u - 0.46, y + 0.32],
      [u - 0.48, y + 1.1],
      [u + 0.48, y + 1.1],
      [u + 0.46, y + 0.32],
      [u, y + 0.11],
    ],
    ix = earcut(shield.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'stone',
      ix.slice(i, i + 3).map((j) => f.P(...shield[j], 0.25)),
      f.n,
      rgb('c9c1a8'),
    );
  F(o, 'stone', f, [u, y + 0.25], [u, y + 1.08], 0.04, 0.28, d);
  F(o, 'stone', f, [u - 0.45, y + 0.63], [u + 0.45, y + 0.63], 0.04, 0.28, d);
  for (const s of [-1, 1]) {
    const a = f.P(u + s * 0.94, y + 0.16, 0.28);
    loft(
      o,
      'stone',
      [
        radialRing(a[1], 0.15, 0.1, 6, [a[0], a[2]]),
        radialRing(a[1] + 0.9, 0.11, 0.08, 6, [a[0], a[2]]),
      ],
      C.stone,
    );
    sphere(o, 'stone', [a[0], a[1] + 1.07, a[2]], [0.1, 0.13, 0.09], C.stone, 8, 4);
    beam(
      o,
      'stone',
      f.P(u + s * 0.94, y + 0.95, 0.29),
      f.P(u + s * 0.56, y + 1.1, 0.37),
      0.09,
      0.09,
      C.stone,
    );
    if (d === 3) {
      for (let j = 0; j < 9; j++) {
        const a0 = (j * Math.PI * 1.5) / 9,
          a1 = ((j + 1) * Math.PI * 1.5) / 9,
          xx = u + s * 0.66,
          yy = y + 0.7;
        F(
          o,
          'stone',
          f,
          [xx + Math.cos(a0) * 0.18, yy + Math.sin(a0) * 0.28],
          [xx + Math.cos(a1) * 0.18, yy + Math.sin(a1) * 0.28],
          0.04,
          0.25,
          d,
        );
      }
    }
  }
  if (d === 3)
    for (let j = -2; j <= 2; j++) {
      const a = f.P(u + j * 0.18, y + 1.3 + (0.1 - Math.abs(j) * 0.03), 0.27);
      sphere(o, 'stone', a, [0.095, 0.13, 0.065], C.stone, 8, 4);
    }
}
function dormers(o, d) {
  if (d === 0) return;
  const xm = (main.x0 + main.x1) / 2,
    half = (main.x1 - main.x0) / 2;
  for (const s of [-1, 1])
    for (const z of [-10, 9]) {
      const x = xm + s * half * 0.57,
        y = L.eave + (L.mainRidge - L.eave) * 0.43,
        w = 2.05,
        h = 1.65,
        front = x + s * 0.15,
        back = x - s * 1.6;
      box(
        o,
        'brick',
        [Math.min(front, back), y - 0.25, z - w / 2],
        [Math.max(front, back), y + h, z + w / 2],
        C.brick,
      );
      const f =
        s < 0
          ? face([front, z + w / 2], [front, z - w / 2], 1)
          : face([front, z - w / 2], [front, z + w / 2], 1);
      gable(o, f, y + h, w, 1.05, d);
      window(o, f, w / 2, y + 0.15, 1.15, 1.2, d);
      Q(
        o,
        'roof',
        [
          [front, y + h, z - w / 2],
          [front, y + h + 1.05, z],
          [back, y + h + 1.05, z],
          [back, y + h, z - w / 2],
        ],
        [0, 1, 0],
      );
      Q(
        o,
        'roof',
        [
          [front, y + h + 1.05, z],
          [front, y + h, z + w / 2],
          [back, y + h, z + w / 2],
          [back, y + h + 1.05, z],
        ],
        [0, 1, 0],
      );
    }
}
function build(o, _frame, d = 3) {
  walls(o, d);
  for (const r of [main, north, south]) roof(o, r, d);
  facade(o, d);
  archTrim(o, d);
  crest(o, d);
  dormers(o, d);
  for (const z of [-13, 12]) {
    const x = (main.x0 + main.x1) / 2;
    box(o, 'brick', [x - 0.32, 13, z - 0.46], [x + 0.32, 15.0, z + 0.46], C.brick);
    if (d > 0) box(o, 'stone', [x - 0.4, 14.92, z - 0.54], [x + 0.4, 15.12, z + 0.54], C.stone);
  }
}
export const ahldenSkyline = (o, f) => build(o, f, 0),
  ahldenDistrict = (o, f) => build(o, f, 1),
  ahldenStreet = (o, f) => build(o, f, 2);
export const ahldenHouseModel = {
  id: 'ahlden_house',
  key: 'ahlden_house',
  recipe: 'structure-ahlden-house.mjs',
  cell: 'u1/u1q',
  title: 'Ahlden House',
  category: 'historic-house',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native U-shaped brick/half-timber residence with east-open court, three joined steep red-tile gabled roof ranges/timbered gables/dormers/chimneys, brick western lower facade/dark oak upper and rear framing/red brick infill/white divided casements, true western vehicle and pedestrian through-arches/barrel vaults and attached sandstone heraldic relief with paired figures. Four cleared native Qualla creator originals only; sections/hidden bays/roof joints approximate. No river/park/bridge/fences/freestanding garden monuments/interiors/copied text.',
  camera: [68, 46, 76],
  lookAt: [0, 5, 0],
  portableGroundY: -0.52,
  mediumFiContext: { scale: 1.8, groundY: -0.52 },
  qaCameras: [
    {
      name: 'native-u-open-court-three-roof-ranges-and-timber-gables',
      position: [65, 57, 60],
      lookAt: [-2, 6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'western-twin-arches-casements-and-sandstone-heraldic-panel',
      position: [-38, 8, 4],
      lookAt: [-17.5, 4.1, -1],
    },
    {
      name: 'rear-timber-brick-infill-gables-and-roof-joins',
      position: [38, 14, -13],
      lookAt: [-5, 7, -6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixedwesternapproach before independent raw160mterrain; roof/threshold/hiddenfootings/hostcontact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ahlden-house.mjs',
    level: 'skyline',
    export: 'ahldenSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'ahldenDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'ahldenStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Four native published Qualla2008AxelHindemith/AxelHHcreatorPD-selfphotographs actually inspected and nativeSHA1matched to primary original photo-by-author/release/upload records. Exact front/rear/river-side/crest originals only; uncertain1747plan and attribution/other images excluded. No external image, generatedbitmap, copiedphotographictexture or lettering.',
    'Exact original ten-vertex U boundary and genuine east-open court retained. Through vehicle/pedestrian archways have open front/court faces, full internal jambs/barrel surfaces and low intrinsic threshold only. Three intersecting gabled roof ranges follow native wing axes, with bounded ridge/valley joins. No courtyard/site slab or park/bridge/moat/river/trees/fences/freestanding garden statue included.',
    'Firstfloor3.55m/eave7.35m/mainridge13.8m/sideridges13.35m/gateway3.4m/smallarch2.68mare photograph-informed section estimates; native map has no height tags. Tree-obscured window/brace/dormer/chimney census, historical timber joints, minor conservation and concealed roofdetails are interpreted. Representative dark oak framing/brick and selected herringbone-like fields/white divided casements reflect the native photos.',
    'Attached heraldic panel uses original simplified sandstone shield/crests/paired robed figures/scrollwork, rather than copied coat-of-arms imagery or inscription. Closed portable glazing is an opaque color approximation. Hidden interiors/auction exhibits excluded. Decorative frame depth and fine brick/framing detail simplify with distance while both passage voids and the open court persist.',
    'Independent160mrawTerrariumfield frozenbeforegeometry at fixed western gateway approach. Original source tiles/grid/PNGunchanged, not flattened/fitted; source urban/riverbank/bridge sampling may not match exact pavement. Thresholds/footings/host contact approximate; flatstage is an inspection surface, not geographic grade certification.',
  ],
};
