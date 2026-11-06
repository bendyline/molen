/** Original 4 Times Square exterior. Meters; +X ESE, +Z SSW. No downloaded mesh. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

// structure-mesh.box uses minimum/maximum corners; this helper accepts center and dimensions.
function centerBox(o, slot, center, size, color) {
  if (size.some((v) => !(v > 0))) throw Error('Positive box dimensions required');
  boundsBox(
    o,
    slot,
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}

import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: lin('8296a1'),
    stone: lin('c4c2b7'),
    silver: lin('aeb7bb'),
    dark: lin('424c54'),
    panel: lin('394354'),
    roof: lin('8e999d'),
    ground: lin('a4a39a'),
  };
export const fourTimesSquareSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.26, metallic: 0.17 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.57, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
};
export const fourTimesSquareControls = a;
export function fourTimesSquareGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const config = {
  skyline: { far: true, bay: 20, rows: 1, cylinder: 10, mast: 2 },
  district: { bay: 9, rows: 12, cylinder: 16, mast: 4, bands: true },
  street: { bay: 3.3, rows: 24, cylinder: 24, mast: 8, bands: true, entry: true },
  closeup: {
    bay: 2.6,
    rows: 44,
    cylinder: 40,
    mast: 14,
    bands: true,
    entry: true,
    frames: true,
    plant: true,
  },
  master: {
    bay: 1.65,
    rows: 44,
    cylinder: 64,
    mast: 22,
    bands: true,
    entry: true,
    frames: true,
    returns: true,
    plant: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => (area(r) < 0 ? r : r.toReversed());
function tri(o, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((v, k, i) => v + k * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    color,
  );
}
function patch(o, c, s, p, color, n) {
  tri(o, S(c, s), p.slice(0, 3), color, n);
  tri(o, S(c, s), [p[0], p[2], p[3]], color, n);
}
function cap(o, c, r, y, s = 'roof', color = C.roof) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      S(c, s),
      ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      color,
      [0, 1, 0],
    );
}
function face(p, q) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  return { p, q, L, t, n: [-t[1], t[0]] };
}
const P = (f, u, y, d = 0) => [
  f.p[0] + f.t[0] * u + f.n[0] * d,
  y,
  f.p[1] + f.t[1] * u + f.n[1] * d,
];
export const fourTimesSquareEntryPoint = (u, y, d = 0) =>
  P(face(a.entrance.p, a.entrance.q), u, y, d);
function panel(o, c, f, u0, u1, y0, y1, d, s, color) {
  if (u1 <= u0 || y1 <= y0) return;
  patch(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
function B(o, c, p, q, w = 0.16, color = C.silver, d = w) {
  if (Math.hypot(...p.map((v, i) => v - q[i])) > 0.001) beam(o, S(c, 'metal'), p, q, w, d, color);
}
function shell(o, c, outline, y0, y1, s, color) {
  const r = cw(outline);
  for (let i = 0; i < r.length; i++)
    panel(
      o,
      c,
      face(r[i], r[(i + 1) % r.length]),
      0,
      Math.hypot(r[(i + 1) % r.length][0] - r[i][0], r[(i + 1) % r.length][1] - r[i][1]),
      y0,
      y1,
      0,
      s,
      color,
    );
  cap(o, c, r, y1);
}
function foundation(o, c) {
  const r = cw(a.wholeOutline);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      bottom = Math.min(
        -1.4,
        fourTimesSquareGroundY(...f.p) - 0.4,
        fourTimesSquareGroundY(...f.q) - 0.4,
      );
    panel(o, c, f, 0, f.L, bottom, 0.35, 0, 'ground', C.ground);
  }
}
function tower(o, c) {
  const r = cw(a.mainOutline),
    H = 200 - 35;
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      masonry = f.n[0] > 0.7 || f.n[1] > 0.7,
      N = Math.max(1, Math.ceil(f.L / c.bay));
    panel(o, c, f, 0, f.L, 35, 200, -0.09, 'glass', C.glass);
    if (!c.far)
      for (let j = 0; j < c.rows; j++) {
        const y = 35 + (j * H) / c.rows;
        panel(
          o,
          c,
          f,
          0,
          f.L,
          y,
          y + (masonry ? 0.65 : 0.22),
          0.015,
          masonry ? 'ground' : 'metal',
          masonry ? C.stone : C.dark,
        );
      }
    if (!c.far)
      for (let k = 0; k <= N; k++) {
        const u = (k * f.L) / N,
          w = masonry ? 0.3 : 0.11;
        panel(
          o,
          c,
          f,
          Math.max(0, u - w / 2),
          Math.min(f.L, u + w / 2),
          35,
          200,
          0.015,
          masonry ? 'ground' : 'metal',
          masonry ? C.stone : C.silver,
        );
      }
    if (c.frames)
      for (let j = 0; j < c.rows; j++)
        for (let k = 0; k < N; k++) {
          const y0 = 35 + (j * H) / c.rows + 0.68,
            y1 = 35 + ((j + 1) * H) / c.rows - 0.1,
            u0 = (k * f.L) / N + 0.2,
            u1 = ((k + 1) * f.L) / N - 0.2;
          if (c.returns) {
            for (const [u0x, u1x] of [
              [u0 - 0.08, u0],
              [u1, u1 + 0.08],
            ])
              panel(o, c, f, u0x, u1x, y0, y1, 0.06, 'metal', C.silver);
            patch(
              o,
              c,
              'metal',
              [P(f, u0, y0, 0.06), P(f, u0, y0, -0.09), P(f, u0, y1, -0.09), P(f, u0, y1, 0.06)],
              C.dark,
            );
            patch(
              o,
              c,
              'metal',
              [P(f, u1, y0, -0.09), P(f, u1, y0, 0.06), P(f, u1, y1, 0.06), P(f, u1, y1, -0.09)],
              C.dark,
            );
          }
          panel(
            o,
            c,
            f,
            u0,
            u1,
            (y0 + y1) / 2 - 0.045,
            (y0 + y1) / 2 + 0.045,
            0.025,
            'metal',
            C.dark,
          );
        }
  }
  cap(o, c, r, 200);
  // Actual narrow80/120/160m trim wings are separate from the200m main floor plate.
  for (const [ring, top] of [
    [a.lowWing, 80],
    [a.middleWing, 120],
    [a.outerWing, 160],
  ]) {
    shell(o, c, ring, 35, top, 'glass', C.glass);
    if (c.bands) {
      const rr = cw(ring);
      for (let i = 0; i < rr.length; i++) {
        const f = face(rr[i], rr[(i + 1) % rr.length]);
        for (let y = 39; y < top; y += c.frames ? 3.75 : 15)
          panel(o, c, f, 0, f.L, y, y + 0.3, 0.025, 'metal', C.silver);
      }
    }
  }
  // Rounded mechanical neck and four orthogonal sign arms leave the upper corners open.
  shell(o, c, a.neckOutline, 200, 220, 'metal', C.dark);
  if (c.bands) {
    const rr = cw(a.neckOutline);
    for (let i = 0; i < rr.length; i++) {
      const f = face(rr[i], rr[(i + 1) % rr.length]);
      for (let y = 201; y < 220; y += c.frames ? 1.25 : 4)
        panel(o, c, f, 0, f.L, y, y + 0.16, 0.06, 'metal', C.silver);
    }
  }
  for (const arm of a.arms) shell(o, c, arm, 200, 225, 'metal', C.dark);
  // The photographed upper cage is open: the mapped245m envelope is not a solid box.
  shell(o, c, a.centralOutline, 220, 225, 'metal', C.dark);
  if (c.bands) {
    const rr = cw(a.centralOutline);
    for (let i = 0; i < rr.length; i++) {
      const f = face(rr[i], rr[(i + 1) % rr.length]);
      for (let y = 221; y < 225; y += c.frames ? 1.2 : 4)
        panel(o, c, f, 0, f.L, y, y + 0.13, 0.05, 'metal', C.silver);
    }
  }
}
function podium(o, c) {
  for (const ring of [a.baseOutlineA, a.baseOutlineB, a.mainOutline]) {
    const r = cw(ring);
    for (let i = 0; i < r.length; i++) {
      const f = face(r[i], r[(i + 1) % r.length]),
        entry = c.entry && Math.abs(f.n[1]) > 0.7 && Math.min(...[f.p[1], f.q[1]]) > 29;
      if (entry) {
        const U = (x) => (x - f.p[0]) / f.t[0],
          u0 = Math.max(0, Math.min(U(12.85), U(0.05))),
          u1 = Math.min(f.L, Math.max(U(12.85), U(0.05)));
        if (u1 > u0) {
          panel(o, c, f, 0, u0, 0.35, 35, 0, 'glass', C.glass);
          panel(o, c, f, u1, f.L, 0.35, 35, 0, 'glass', C.glass);
          panel(o, c, f, u0, u1, 13.5, 35, 0, 'glass', C.glass);
        } else panel(o, c, f, 0, f.L, 0.35, 35, 0, 'glass', C.glass);
      } else panel(o, c, f, 0, f.L, 0.35, 35, 0, 'glass', C.glass);
      if (c.bands) {
        for (const y of [5, 10, 15, 20, 25, 30, 34.7]) {
          if (entry && y < 13.5) continue;
          panel(o, c, f, 0, f.L, y, y + 0.25, 0.09, 'metal', C.silver);
        }
        const N = Math.max(1, Math.ceil(f.L / (c.frames ? 2.3 : 6)));
        for (let k = 1; k < N; k++) {
          const u = (k * f.L) / N;
          const x = P(f, u, 0)[0];
          if (entry && x > 0.05 && x < 12.85) continue;
          panel(o, c, f, u - 0.05, u + 0.05, 0.35, 35, 0.1, 'metal', C.silver);
        }
      }
      // Restrained, unbranded display bands on the Broadway shopfronts.
      if (c.bands && f.n[0] < -0.6 && f.L > 9)
        panel(o, c, f, 1, f.L - 1, 10.5, 18, 0.17, 'metal', C.panel);
    }
    cap(o, c, r, 35);
  }
}
function cylinder(o, c) {
  const cy = a.cylinder,
    rr = radialRing(0, cy.lowerRadius, cy.lowerRadius, c.cylinder, cy.center).map((p) => [
      p[0],
      p[2],
    ]);
  shell(o, c, rr, 0.35, 10, 'glass', C.glass);
  const r = radialRing(0, cy.rx, cy.rz, c.cylinder, cy.center).map((p) => [p[0], p[2]]);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      visible = f.n[0] < -0.2 || f.n[1] < -0.3;
    if (!c.entry || !visible) {
      panel(o, c, f, 0, f.L, 10, 40, 0, 'metal', C.panel);
      continue;
    }
    const rows = [18, 23, 28, 33, 38],
      selected = i % Math.max(2, Math.round(c.cylinder / 8)) === 0;
    if (!selected) {
      panel(o, c, f, 0, f.L, 10, 40, 0, 'metal', C.panel);
      continue;
    }
    let y = 10;
    for (const top of rows) {
      const bottom = top - 1.45;
      panel(o, c, f, 0, f.L, y, bottom, 0, 'metal', C.panel);
      const u0 = f.L * 0.2,
        u1 = f.L * 0.8;
      panel(o, c, f, 0, u0, bottom, top, 0, 'metal', C.panel);
      panel(o, c, f, u1, f.L, bottom, top, 0, 'metal', C.panel);
      panel(o, c, f, u0, u1, bottom, top, -0.3, 'glass', C.glass);
      for (const u of [u0, u1])
        patch(
          o,
          c,
          'metal',
          [P(f, u, bottom, 0), P(f, u, bottom, -0.3), P(f, u, top, -0.3), P(f, u, top, 0)],
          C.silver,
        );
      for (const h of [bottom, top])
        patch(
          o,
          c,
          'metal',
          [P(f, u0, h, 0), P(f, u1, h, 0), P(f, u1, h, -0.3), P(f, u0, h, -0.3)],
          C.silver,
        );
      y = top;
    }
    panel(o, c, f, 0, f.L, y, 40, 0, 'metal', C.panel);
  }
  cap(o, c, r, 40);
  if (c.bands)
    for (let i = 0; i < rr.length; i++) {
      const f = face(rr[i], rr[(i + 1) % rr.length]);
      for (const y of [3.5, 7, 9.85]) panel(o, c, f, 0, f.L, y, y + 0.16, 0.08, 'metal', C.silver);
      B(o, c, P(f, 0, 0.35, 0.08), P(f, 0, 10, 0.08), 0.1);
    }
}
function signs(o, c) {
  // Four independent planar frames; advertising lettering is deliberately not baked in.
  const faces = [
    face([-19, -7.75], [-19, 13.25]),
    face([19.25, -21.8], [-2.75, -21.8]),
    face([37, 13.25], [37, -7.75]),
    face([-2.75, 29], [19.25, 29]),
  ];
  for (const f of faces) {
    panel(o, c, f, 0, f.L, 204, 226, 1, 'metal', C.panel);
    if (c.far) continue;
    for (const y of [203.7, 226.3]) B(o, c, P(f, -0.3, y, 1.1), P(f, f.L + 0.3, y, 1.1), 0.42);
    for (const u of [-0.3, f.L + 0.3]) B(o, c, P(f, u, 203.7, 1.1), P(f, u, 226.3, 1.1), 0.42);
    const N = c.frames ? 7 : 3;
    for (let k = 1; k < N; k++)
      B(
        o,
        c,
        P(f, 0, 204 + (k * 22) / N, 1.12),
        P(f, f.L, 204 + (k * 22) / N, 1.12),
        0.13,
        C.silver,
      );
    for (const u of [1, f.L - 1]) {
      B(o, c, P(f, u, 201, -1.1), P(f, u, 226, 1.1), 0.24);
      if (c.frames) B(o, c, P(f, u, 204, 1), P(f, u, 221, -1.1), 0.15);
    }
  }
}
function mast(o, c) {
  const m = a.mast,
    [x, z] = m.center;
  {
    const ps = [
      [-9, -9],
      [-9, 9],
      [9, 9],
      [9, -9],
    ].map((p) => [x + p[0], z + p[1]]);
    for (let i = 0; i < 4; i++) {
      const p = ps[i],
        q = ps[(i + 1) % 4];
      B(o, c, [p[0], 225, p[1]], [p[0], 246.5, p[1]], 0.4);
      B(o, c, [p[0], 246.5, p[1]], [q[0], 246.5, q[1]], 0.5);
      if (!c.far) B(o, c, [p[0], 225, p[1]], [q[0], 246.5, q[1]], 0.22);
      B(o, c, [p[0], 246.5, p[1]], [x, 252, z], 0.28);
    }
  }
  const segs = m.sections;
  for (let j = 1; j < segs.length; j++) {
    const [y0, r0] = segs[j - 1],
      [y1, r1] = segs[j],
      N = Math.max(1, Math.round((c.mast * (y1 - y0)) / 40));
    if (c.far || j >= 4) {
      loft(
        o,
        S(c, 'metal'),
        [
          radialRing(y0, r0, r0, c.far ? 4 : 8, [x, z]),
          radialRing(y1, r1, r1, c.far ? 4 : 8, [x, z]),
        ],
        j % 2 ? C.silver : C.dark,
      );
    } else
      for (let k = 0; k < N; k++) {
        const t = k / N,
          u = (k + 1) / N,
          low = y0 + t * (y1 - y0),
          high = y0 + u * (y1 - y0),
          r = r0 + t * (r1 - r0),
          R = r0 + u * (r1 - r0),
          p = radialRing(low, r, r, 4, [x, z], Math.PI / 4),
          q = radialRing(high, R, R, 4, [x, z], Math.PI / 4);
        for (let i = 0; i < 4; i++) {
          const next = (i + 1) % 4;
          B(o, c, p[i], q[i], 0.18);
          B(o, c, p[i], p[next], 0.12);
          B(o, c, p[i], q[next], 0.1);
        }
      }
    if (c.frames && j < 5)
      for (let y = y0 + 2; y < y1; y += 2.5) {
        const R = (r0 + ((y - y0) / (y1 - y0)) * (r1 - r0)) * 1.55;
        for (let k = 0; k < 4; k++) {
          const t = (k * Math.PI) / 2;
          B(o, c, [x, y, z], [x + R * Math.cos(t), y, z + R * Math.sin(t)], 0.1);
        }
      }
  }
  if (c.plant) {
    for (const [dx, dz, w, d, h] of [
      [-7, 4, 3.4, 2.4, 2],
      [7, -4, 3, 3, 2.6],
      [0, 7, 4, 2, 1.8],
    ]) {
      centerBox(o, S(c, 'metal'), [x + dx, 225 + h / 2, z + dz], [w, h, d], C.dark);
      if (c.returns)
        for (let yy = 225.5; yy < 225 + h; yy += 0.25)
          centerBox(
            o,
            S(c, 'metal'),
            [x + dx, yy, z + dz + d / 2 + 0.02],
            [w, 0.05, 0.06],
            C.silver,
          );
    }
  }
}
function entry(o, c) {
  if (!c.entry) return;
  const e = a.entrance,
    f = face(e.p, e.q),
    u0 = e.centerU - e.halfWidth,
    u1 = e.centerU + e.halfWidth;
  panel(o, c, f, 0, u0, 0.35, 13.5, 0, 'ground', C.stone);
  panel(o, c, f, u1, f.L, 0.35, 13.5, 0, 'ground', C.stone);
  for (const u of [u0, u1])
    patch(
      o,
      c,
      'ground',
      [P(f, u, 0.35, 0), P(f, u, 0.35, -e.recess), P(f, u, 13.5, -e.recess), P(f, u, 13.5, 0)],
      C.stone,
    );
  patch(
    o,
    c,
    'ground',
    [P(f, u0, 0.35, 1), P(f, u1, 0.35, 1), P(f, u1, 0.35, -e.recess), P(f, u0, 0.35, -e.recess)],
    C.ground,
    [0, 1, 0],
  );
  // Recessed three revolving drums, fixed side bays and tall glazing leave the portal open.
  panel(o, c, f, u0, u1, 0.35, 13.5, -e.recess, 'glass', C.glass);
  for (const u of [u0, u0 + 3.1, e.centerU, u1 - 3.1, u1])
    B(o, c, P(f, u, 3.4, -0.8), P(f, u, 13.5, -0.8), 0.1, C.dark);
  for (const y of [3.4, 5.9, 8.4, 10.9, 13.5])
    B(o, c, P(f, u0, y, -0.8), P(f, u1, y, -0.8), 0.11, C.dark);
  for (const u of [e.centerU - 4.05, e.centerU, e.centerU + 4.05]) {
    const ctr = P(f, u, 0.35, -0.7),
      r = 0.95,
      N = c.returns ? 24 : 12;
    for (let i = 0; i < N; i++) {
      const t = (i * 2 * Math.PI) / N,
        T = ((i + 1) * 2 * Math.PI) / N,
        p = [ctr[0] + r * Math.cos(t), ctr[2] + r * Math.sin(t)],
        q = [ctr[0] + r * Math.cos(T), ctr[2] + r * Math.sin(T)],
        f2 = face(p, q);
      panel(o, c, f2, 0, f2.L, 0.35, 3.35, 0, 'glass', C.glass);
      if (i % Math.max(1, N / 6) === 0) B(o, c, [p[0], 0.35, p[1]], [p[0], 3.35, p[1]], 0.055);
    }
    for (let k = 0; k < 3; k++) {
      const t = (k * 2 * Math.PI) / 3;
      B(o, c, [ctr[0], 0.35, ctr[2]], [ctr[0], 3.35, ctr[2]], 0.07);
      patch(
        o,
        c,
        'glass',
        [
          [ctr[0], 0.35, ctr[2]],
          [ctr[0] + r * Math.cos(t), 0.35, ctr[2] + r * Math.sin(t)],
          [ctr[0] + r * Math.cos(t), 3.35, ctr[2] + r * Math.sin(t)],
          [ctr[0], 3.35, ctr[2]],
        ],
        C.glass,
      );
    }
    centerBox(o, S(c, 'metal'), [ctr[0], 3.4, ctr[2]], [2.1, 0.14, 2.1], C.silver);
  }
  patch(
    o,
    c,
    'ground',
    [P(f, u0, 13.5, 0), P(f, u1, 13.5, 0), P(f, u1, 13.5, -3.5), P(f, u0, 13.5, -3.5)],
    C.stone,
    [0, -1, 0],
  );
  if (c.frames)
    for (let u = u0 + 0.2; u < u1; u += 0.85)
      B(o, c, P(f, u, 13.37, -0.3), P(f, u + 0.5, 13.37, -1.7), 0.07, C.silver);
}
export function buildFourTimesSquareLevel(o, level = 'master') {
  const c = config[level];
  if (!c) throw Error('Unknown level ' + level);
  foundation(o, c);
  podium(o, c);
  tower(o, c);
  cylinder(o, c);
  signs(o, c);
  mast(o, c);
  entry(o, c);
}
export const buildFourTimesSquareSkyline = (o) => buildFourTimesSquareLevel(o, 'skyline');
export const buildFourTimesSquareDistrict = (o) => buildFourTimesSquareLevel(o, 'district');
export const buildFourTimesSquareStreet = (o) => buildFourTimesSquareLevel(o, 'street');
export const buildFourTimesSquareCloseup = (o) => buildFourTimesSquareLevel(o, 'closeup');
