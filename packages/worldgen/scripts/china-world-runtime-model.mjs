/** Budgeted China World Tower A; original instanced master recipe stays unchanged. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const silver = [0.72, 0.74, 0.72],
  pale = [0.82, 0.84, 0.8];
const glass = [0.25, 0.36, 0.4],
  dark = [0.1, 0.14, 0.16];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const turn = ([x, y, z], angle) => [
  Math.cos(angle) * x + Math.sin(angle) * z,
  y,
  -Math.sin(angle) * x + Math.cos(angle) * z,
];
function rotated(out, angle) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (s, r, p, n, u, c) =>
        out[name](
          s,
          r,
          p.map((p) => turn(p, angle)),
          turn(n, angle),
          u,
          c,
        ),
    ]),
  );
}

// Dimensions between the mapped base and photographed crown are working reconstructions.
const sections = [
  [0, 28.65, 25.8],
  [24, 28.65, 25.8],
  [130, 26.3, 23.5],
  [247, 23.8, 21.1],
  [294, 22.3, 19.65],
  [330, 21.1, 18.5],
];
function section(y) {
  let i = 1;
  while (i < sections.length - 1 && y > sections[i][0]) i++;
  const a = sections[i - 1],
    b = sections[i],
    t = (y - a[0]) / (b[0] - a[0]);
  return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}
function plan(y) {
  const [a, b] = section(y),
    c = 2.1;
  return [
    [-a + c, y, -b],
    [a - c, y, -b],
    [a, y, -b + c],
    [a, y, b - c],
    [a - c, y, b],
    [-a + c, y, b],
    [-a, y, b - c],
    [-a, y, -b + c],
  ];
}
const floors = [
  0.1,
  6,
  12,
  18,
  24,
  ...Array.from({ length: 70 }, (_, i) => 24 + ((i + 1) * 270) / 70),
];
const serviceBands = [
  [122.6, 134.9],
  [238.8, 251.3],
];
const serviceAt = (y) => serviceBands.some(([lo, hi]) => y >= lo && y < hi);

const shifts = (y) => {
  const i = floors.findIndex((f) => Math.abs(f - y) < 0.0001);
  return i <= 4 ? 0 : i % 2 ? 0.23 : -0.13;
};
function localPoint(u, y, short, detail) {
  const [a, b] = section(y);
  return [u * ((short ? b : a) - 2.1), y, -(short ? a : b) - (detail ? shifts(y) : 0)];
}
function ring(y, detail) {
  const [a, b] = section(y),
    depth = detail ? shifts(y) : 0,
    p = plan(y).map(([x, yy, z]) => [
      x + (Math.abs(Math.abs(x) - a) < 0.001 ? Math.sign(x) * depth : 0),
      yy,
      z + (Math.abs(Math.abs(z) - b) < 0.001 ? Math.sign(z) * depth : 0),
    ]),
    r = [];
  for (let i = 0; i < 8; i++) {
    r.push(p[i]);
    if (i % 2) {
      const n = [Math.sign(p[i][0]) * Math.SQRT1_2, 0, Math.sign(p[i][2]) * Math.SQRT1_2],
        inset = (q) => q.map((v, k) => v - n[k] * 0.4);
      r.push(inset(p[i]), inset(p[(i + 1) % 8]));
    }
  }
  return r.reverse();
}
function slab(o, y, t, detail, slot = 'concrete', color = pale) {
  const p = ring(y, detail),
    q = p.map(([x, yy, z]) => [x, yy + t, z]);
  loft(o, slot, [p, q], color, { cap: false });
  for (let i = 0; i < p.length; i++) {
    const k = (i + 1) % p.length;
    for (const [points, n] of [
      [
        [[0, y + t, 0], q[i], q[k]],
        [0, 1, 0],
      ],
      [
        [[0, y, 0], p[k], p[i]],
        [0, -1, 0],
      ],
    ])
      o.addTriangle(
        slot,
        'palette:#ffffff',
        points,
        n,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
  }
}
function splitFace(o, slot, p, color) {
  for (const a of [
    [p[0], p[1], p[2]],
    [p[0], p[2], p[3]],
  ])
    o.addTriangle(
      slot,
      'palette:#ffffff',
      a,
      normalFor(...a),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}
function horizontal(o, a, b, c, d, t0, t1, color = silver) {
  const n = normalFor(b, a, d),
    p = [mix(b, c, t0), mix(a, d, t0), mix(a, d, t1), mix(b, c, t1)].map((p) =>
      p.map((v, i) => v + n[i] * 0.04),
    );
  face(o, 'metal', p, color);
}
function ribbon(o, a, b, width, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    u = [((-dy / len) * width) / 2, ((dx / len) * width) / 2, 0],
    add = (p, s) => p.map((v, i) => v + s * u[i]);
  face(o, 'metal', [add(a, 1), add(b, 1), add(b, -1), add(a, -1)], color);
}
function diamonds(o, short, level) {
  const count = level === 3 ? (short ? 16 : 18) : level === 2 ? 8 : 6,
    p = (u, y, d = 0) => localPoint(u, y, short, false).map((v, i) => v - (i === 2 ? d : 0));
  for (let i = 0; i < count; i++) {
    const u = -1 + (2 * i) / count,
      v = -1 + (2 * (i + 1)) / count,
      m = (u + v) / 2,
      a = p(m, 0.18, 0.15),
      b = p(v, 12, 1.7),
      c = p(m, 23.95, 0.15),
      d = p(u, 12, 1.7);
    for (const [x, y] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      if (level >= 2) beam(o, 'metal', x, y, 0.23, 0.18, pale);
      else ribbon(o, x, y, 0.32, pale);
    if (level >= 2) {
      const center = p(m, 12, 0.05);
      for (const e of [b, d]) splitFace(o, 'clear_glass', [a, e, c, center], [0.79, 0.81, 0.78]);
    }
  }
}
function walls(o, level) {
  const detail = level >= 2,
    ys = detail
      ? floors
      : [
          ...new Set([
            0,
            6,
            12,
            24,
            130,
            247,
            294,
            ...serviceBands.flat(),
            ...(level === 1 ? floors.filter((_, i) => i % 4 === 0) : []),
          ]),
        ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y = ys[j - 1],
      yy = ys[j],
      p = ring(y, detail),
      q = ring(yy, detail);
    // Main glass surfaces are contiguous once; only their large floor rhythm is split.
    for (let side = 0; side < 4; side++) {
      const out = rotated(o, (side * Math.PI) / 2),
        short = side % 2 === 1,
        a = localPoint(-1, y, short, detail),
        b = localPoint(1, y, short, detail),
        c = localPoint(1, yy, short, detail),
        d = localPoint(-1, yy, short, detail),
        clear = detail && yy <= 24,
        service = serviceAt((y + yy) / 2);
      if (clear || level === 0)
        face(
          out,
          clear ? 'clear_glass' : 'glass',
          [b, a, d, c],
          service ? [0.38, 0.44, 0.45] : clear ? [0.5, 0.55, 0.54] : glass,
        );
      else {
        face(
          out,
          'glass',
          [mix(b, c, 0.08), mix(a, d, 0.08), d, c],
          service ? [0.38, 0.44, 0.45] : glass,
        );
        face(out, 'glass', [b, a, mix(a, d, 0.08), mix(b, c, 0.08)], [0.34, 0.39, 0.4]);
      }
      if (level >= 1) horizontal(out, a, b, c, d, 0.978, 1);
      if (detail && y >= 24) {
        const count = level === 3 ? (short ? 32 : 36) : short ? 7 : 10;
        for (let i = 0; i < count; i++) {
          const u = -1 + (2 * i) / count,
            a = localPoint(u, y, short, true),
            d = localPoint(u, yy, short, true),
            p = a.map((v, k) => v - (k === 2 ? 0.6 : 0)),
            q = d.map((v, k) => v - (k === 2 ? 0.6 : 0));
          face(out, 'clear_glass', [a, p, q, d], [0.77, 0.8, 0.77]);
          if (level === 3)
            face(
              out,
              'stainless',
              [
                q,
                q.map((v, k) => v + (k === 0 ? 0.035 : 0)),
                p.map((v, k) => v + (k === 0 ? 0.035 : 0)),
                p,
              ],
              silver,
            );
        }
      }
      if (detail && service)
        for (let h = y + 0.32; h < yy - 0.2; h += level === 3 ? 0.58 : 1.16) {
          const t = (h - y) / (yy - y);
          horizontal(out, a, b, c, d, t, Math.min(1, t + 0.08 / (yy - y)), [0.32, 0.36, 0.37]);
        }
    }
    // The other twelve ring edges form chamfer glass and both recess returns.
    for (let i = 0; i < p.length; i++) {
      const k = (i + 1) % p.length;
      if (Math.hypot(p[k][0] - p[i][0], p[k][2] - p[i][2]) > 5) continue;
      face(
        o,
        detail && yy <= 24 ? 'clear_glass' : 'glass',
        [p[i], p[k], q[k], q[i]],
        [0.22, 0.32, 0.35],
      );
    }
  }
  for (let s = 0; s < 4; s++) diamonds(rotated(o, (s * Math.PI) / 2), s % 2 === 1, level);
}
function crown(o, level) {
  for (let s = 0; s < 4; s++) {
    const out = rotated(o, (s * Math.PI) / 2),
      short = s % 2 === 1,
      p = (u, y, d = 0) => localPoint(u, y, short, false).map((v, i) => v - (i === 2 ? d : 0)),
      count = level === 3 ? (short ? 12 : 14) : level === 2 ? 6 : level === 1 ? 4 : 2,
      ys = level >= 2 ? [294.5, 303, 311.5, 320, 328.3] : [294.5, 311.5, 329.7],
      member = (a, b, width, depth, color) =>
        level === 0
          ? ribbon(out, a, b, width, color)
          : beam(out, 'metal', a, b, width, depth, color);
    for (let i = 0; i <= count; i++) {
      const u = -1 + (2 * i) / count;
      member(p(u, 294, 0.36), p(u, 329.8, 0.36), 0.23, 0.52, pale);
      if (level >= 1) {
        face(
          out,
          level >= 2 ? 'clear_glass' : 'glass',
          [p(u, 294, 0.36), p(u, 294, 1.35), p(u, 330, 1.35), p(u, 330, 0.36)],
          [0.79, 0.82, 0.78],
        );
      }
    }
    for (let j = 1; j < ys.length; j++) {
      const y = ys[j - 1],
        yy = ys[j];
      member(p(-1, y, -0.45), p(1, y, -0.45), 0.18, 0.25, pale);
      for (let i = 0; i < count; i++) {
        const u = -1 + (2 * i) / count,
          v = -1 + (2 * (i + 1)) / count,
          a = p(u, y, -0.45),
          b = p(v, y, -0.45),
          c = p(v, yy, -0.45),
          d = p(u, yy, -0.45);
        member(a, c, 0.12, 0.12, silver);
        member(b, d, 0.12, 0.12, silver);
        face(out, level >= 2 ? 'clear_glass' : 'glass', [b, a, d, c], [0.48, 0.55, 0.55]);
        if (level < 2) face(out, 'glass', [a, b, c, d], [0.48, 0.55, 0.55]);
      }
    }
    member(p(-1, 329.7, -0.45), p(1, 329.7, -0.45), 0.18, 0.25, pale);
  }
}
function entry(o, level, hotel) {
  const wall = -25.8,
    span = hotel ? 22.4 : 19.3,
    front = wall - (hotel ? 12.3 : 7.2),
    y = 9.2,
    bays = level === 3 ? (hotel ? 16 : 14) : level === 2 ? 8 : 1;
  if (level < 2) {
    box(o, 'metal', [-span, y - 0.2, front], [span, y + 0.2, wall], silver);
    return;
  }
  for (let i = 0; i < bays; i++) {
    const x = -span + (2 * span * i) / bays,
      xx = -span + (2 * span * (i + 1)) / bays;
    face(
      o,
      'clear_glass',
      [
        [x, y, wall],
        [xx, y, wall],
        [xx, y, front],
        [x, y, front],
      ],
      [0.67, 0.73, 0.7],
    );
    beam(o, 'metal', [x, y - 0.2, wall], [x, y - 0.2, front], 0.15, 0.38, silver);
    beam(o, 'stainless', [x, 14.9, wall], [x, y + 0.1, front + 0.5], 0.065, 0.065, silver);
    if (level === 3)
      for (let j = 1; j < 5; j++) {
        const z = wall + ((front - wall) * j) / 5;
        face(
          o,
          'stainless',
          [
            [x, y - 0.05, z - 0.03],
            [xx, y - 0.05, z - 0.03],
            [xx, y - 0.05, z + 0.03],
            [x, y - 0.05, z + 0.03],
          ].reverse(),
          silver,
        );
      }
  }
  beam(o, 'metal', [-span, y - 0.12, front], [span, y - 0.12, front], 0.48, 0.42, silver);
  for (const x of [-span, span])
    beam(o, 'metal', [x, y - 0.16, wall], [x, y - 0.16, front], 0.26, 0.4, silver);
  // Four illustrative revolving drums total. Open front/back sectors allow a passage.
  const sides = level === 3 ? 24 : 12;
  for (const x of [-9, 9]) {
    const z = wall - 1.5,
      r = 2.2;
    for (let i = 0; i < sides; i++) {
      const a = (i * 2 * Math.PI) / sides,
        b = ((i + 1) * 2 * Math.PI) / sides,
        aa = [x + r * Math.cos(a), 0.1, z + r * Math.sin(a)],
        bb = [x + r * Math.cos(b), 0.1, z + r * Math.sin(b)],
        cc = [bb[0], 5.2, bb[2]],
        dd = [aa[0], 5.2, aa[2]];
      if (Math.abs(Math.sin((a + b) / 2)) < 0.72) {
        face(o, 'clear_glass', [bb, aa, dd, cc], [0.52, 0.56, 0.54]);
        beam(o, 'stainless', aa, dd, 0.055, 0.055, silver);
      }
      beam(o, 'stainless', dd, cc, 0.21, 0.22, silver);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      face(
        o,
        'clear_glass',
        [
          [x, 0.1, z],
          [x + r * Math.cos(a), 0.1, z + r * Math.sin(a)],
          [x + r * Math.cos(a), 3.1, z + r * Math.sin(a)],
          [x, 3.1, z],
        ],
        [0.52, 0.56, 0.54],
      );
    }
    tube(o, 'stainless', [x, 0.1, z], [x, 3.2, z], 0.06, silver, 8);
  }
  box(o, 'stone', [-span - 0.5, 0, front - 0.8], [span + 0.5, 0.08, wall], [0.53, 0.54, 0.5]);
}
function roof(o, level) {
  box(o, 'recess', [-13, 294.2, -11], [13, 323, 11], [0.29, 0.32, 0.31]);
  box(o, 'metal', [-13.2, 323, -11.2], [13.2, 323.3, 11.2], silver);
  if (level >= 2)
    for (const x of [-9, -3, 3, 9]) {
      box(o, 'metal', [x - 2, 323.3, -6], [x + 2, 325, 6], [0.5, 0.53, 0.51]);
      if (level === 3)
        for (let z = -5; z <= 5; z++)
          face(
            o,
            'recess',
            [
              [x - 1.6, 325.04, z - 0.27],
              [x + 1.6, 325.04, z - 0.27],
              [x + 1.6, 325.04, z + 0.27],
              [x - 1.6, 325.04, z + 0.27],
            ].reverse(),
            dark,
          );
    }
  // Schematic supports tie the platform to the core roof in every browser level.
  for (const x of [-10, 10])
    for (const z of [-9, 9])
      box(o, 'metal', [x - 0.3, 323.3, z - 0.3], [x + 0.3, 327, z + 0.3], silver);
  box(o, 'concrete', [-14, 327, -14], [14, 327.22, 14], [0.5, 0.52, 0.49]);
  if (level >= 1) {
    const n = level === 3 ? 32 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        p = [
          [12.08 * Math.cos(a), 327.235, 12.08 * Math.sin(a)],
          [12.08 * Math.cos(b), 327.235, 12.08 * Math.sin(b)],
          [11.92 * Math.cos(b), 327.235, 11.92 * Math.sin(b)],
          [11.92 * Math.cos(a), 327.235, 11.92 * Math.sin(a)],
        ];
      face(o, 'metal', p.reverse(), [0.86, 0.84, 0.69]);
    }
    for (const x of [-2.2, 2.2])
      box(o, 'metal', [x - 0.16, 327.23, -3.5], [x + 0.16, 327.245, 3.5], [0.88, 0.86, 0.71]);
    box(o, 'metal', [-2.2, 327.23, -0.16], [2.2, 327.245, 0.16], [0.88, 0.86, 0.71]);
  }
}
function reviewed(o, level) {
  walls(o, level);
  crown(o, level);
  roof(o, level);
  slab(o, 0, 0.15, false);
  slab(o, 294, 0.15, false);
  entry(o, level, true);
  entry(rotated(o, Math.PI), level, false);
  if (level >= 2) {
    for (const y of [6, 12, 18, 24, 122.6, 134.9, 238.8, 251.3]) slab(o, y, 0.15, true);
    box(o, 'stone', [-9, 0.15, -8], [9, 12, 8], [0.53, 0.48, 0.4]);
    for (const x of [-20, -10, 10, 20])
      for (const z of [-18, 18])
        box(o, 'metal', [x - 0.36, 0.15, z - 0.36], [x + 0.36, 11.9, z + 0.36], pale);
  }
}
export const buildChinaWorldCloseup = (o) => reviewed(o, 3);
export const buildChinaWorldStreet = (o) => reviewed(o, 2);
export const buildChinaWorldDistrict = (o) => reviewed(o, 1);
export function buildChinaWorldReviewedSkyline(o) {
  const means = {
    metal: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
    stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  };
  const flat = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (s, _r, p, n, u, c) =>
        o[name](
          'glass',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  reviewed(flat, 0);
}
