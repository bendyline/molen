/** Current eight-span Poniatowski river bridge, with surviving bank architecture. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0029_poniatowski_bridge', 'map-frame.json')),
);
const iron = [0.42, 0.48, 0.5],
  darkIron = [0.09, 0.115, 0.12],
  stone = [0.54, 0.52, 0.46],
  pale = [0.8, 0.77, 0.67],
  trim = [0.89, 0.86, 0.77];
const ends = [-251.87, 251.87],
  halfWidth = 12.4;
const pierX = frame.geometry.piers.map((p) => p.center[0]);
const stations = [ends[0], ...pierX, ends[1]];
const verticalOrigin = 77;
// GUGiK road-lane medians; the broad plateau removes centimetric raster noise.
const roadKnots = [
  [-251.87, 95.55],
  [-240, 95.7],
  [-200, 96.25],
  [-160, 96.79],
  [-120, 96.86],
  [40, 96.86],
  [80, 96.68],
  [120, 96.3],
  [160, 95.83],
  [200, 95.25],
  [240, 94.63],
  [251.87, 94.48],
];
const roadSlopes = roadKnots.map((p, i) => {
  if (i === 0) return (roadKnots[1][1] - p[1]) / (roadKnots[1][0] - p[0]);
  if (i === roadKnots.length - 1)
    return (p[1] - roadKnots[i - 1][1]) / (p[0] - roadKnots[i - 1][0]);
  const a = (p[1] - roadKnots[i - 1][1]) / (p[0] - roadKnots[i - 1][0]),
    b = (roadKnots[i + 1][1] - p[1]) / (roadKnots[i + 1][0] - p[0]);
  return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
});
const road = (x) => {
  if (x <= roadKnots[0][0]) return roadKnots[0][1] - verticalOrigin;
  if (x >= roadKnots.at(-1)[0]) return roadKnots.at(-1)[1] - verticalOrigin;
  const i = roadKnots.findIndex(
      (p, j) => j < roadKnots.length - 1 && x >= p[0] && x <= roadKnots[j + 1][0],
    ),
    a = roadKnots[i],
    b = roadKnots[i + 1],
    h = b[0] - a[0],
    t = (x - a[0]) / h;
  return (
    (2 * Math.pow(t, 3) - 3 * t * t + 1) * a[1] +
    (Math.pow(t, 3) - 2 * t * t + t) * h * roadSlopes[i] +
    (-2 * Math.pow(t, 3) + 3 * t * t) * b[1] +
    (Math.pow(t, 3) - t * t) * h * roadSlopes[i + 1] -
    verticalOrigin
  );
};
const samples = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
const shade = (seed, c = stone) => c.map((v) => v + Math.sin(seed * 5.217) * 0.5 * 0.065);
function extrude(out, slot, xy, z0, z1, c) {
  let points = xy.filter(
    (p, i, a) =>
      Math.hypot(
        p[0] - a[(i + a.length - 1) % a.length][0],
        p[1] - a[(i + a.length - 1) % a.length][1],
      ) > 1e-6,
  );
  if (points.length < 3) return;
  if (
    points.reduce(
      (s, p, i) =>
        s + p[0] * points[(i + 1) % points.length][1] - p[1] * points[(i + 1) % points.length][0],
      0,
    ) < 0
  )
    points = points.toReversed();
  const ids = earcut(points.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const [z, reverse] of [
      [z0, true],
      [z1, false],
    ]) {
      const t = ids.slice(i, i + 3).map((k) => [...points[k], z]);
      if (reverse) t.reverse();
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        c,
      );
    }
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length,
      p = [
        [...points[i], z0],
        [...points[j], z0],
        [...points[j], z1],
        [...points[i], z1],
      ];
    quad(out, slot, p, normalFor(...p), c);
  }
}
function line(out, slot, points, r, c) {
  for (let i = 1; i < points.length; i++)
    if (Math.hypot(...points[i].map((v, j) => v - points[i - 1][j])) > 1e-5)
      beam(out, slot, points[i - 1], points[i], r * 2, r * 2, c);
}
function roundedLine(out, slot, points, r, c, sides = 10) {
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, j) => v - a[j]));
    const across = normalize(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0])),
      other = cross(axis, across);
    const incoming = p.map((v, j) => v - a[j]),
      outgoing = b.map((v, j) => v - p[j]),
      la = Math.hypot(...incoming),
      lb = Math.hypot(...outgoing);
    const turn =
      la > 1e-8 && lb > 1e-8
        ? Math.sqrt(
            Math.max(0, (1 - incoming.reduce((s, v, j) => s + v * outgoing[j], 0) / (la * lb)) / 2),
          )
        : 0;
    const rr = turn > 1e-6 ? Math.min(r, (0.35 * Math.min(la, lb)) / (2 * turn)) : r;
    return Array.from({ length: sides }, (_, j) => {
      const t = (j / sides) * Math.PI * 2;
      return p.map((v, k) => v + rr * (across[k] * Math.cos(t) + other[k] * Math.sin(t)));
    });
  });
  loft(out, slot, rings, c);
}
function smoothPath(points, steps = 8) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++)
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        p0 = points[Math.max(0, i - 1)],
        p1 = points[i],
        p2 = points[i + 1],
        p3 = points[Math.min(points.length - 1, i + 2)];
      result.push(
        p1.map(
          (v, k) =>
            0.5 *
            (2 * v +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * v + 4 * p2[k] - p3[k]) * t * t +
              (-p0[k] + 3 * v - 3 * p2[k] + p3[k]) * t * t * t),
        ),
      );
    }
  result.push(points.at(-1));
  return result;
}
function transform(out, angle, center) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    rot = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    pt = (p) => rot(p).map((v, i) => v + center[i]);
  return {
    addQuad: (k, r, p, n, u, t) => out.addQuad(k, r, p.map(pt), rot(n), u, t),
    addTriangle: (k, r, p, n, u, t) => out.addTriangle(k, r, p.map(pt), rot(n), u, t),
    addConvexPolygon: (k, r, p, n, u, t) => out.addConvexPolygon(k, r, p.map(pt), rot(n), u, t),
  };
}
function cylinder(out, slot, x, y, z, r, h, c, n = 24) {
  loft(out, slot, [radialRing(y, r, r, n, [x, z]), radialRing(y + h, r, r, n, [x, z])], c);
}
function ringXY(out, slot, x, y, z, rx, ry, r, c, n = 48) {
  line(
    out,
    slot,
    samples(n, (t) => [x + rx * Math.cos(t * Math.PI * 2), y + ry * Math.sin(t * Math.PI * 2), z]),
    r,
    c,
  );
}
function iBeam(out, a, b, w, h, c = iron) {
  // Native longitudinal members have webs in XY and flanges across Z.
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    nx = -dy / len,
    ny = dx / len;
  const rect = (depth, width, offset = 0) => {
    const at = (p) =>
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ].map(([u, v]) => [
        p[0] + nx * (offset + (v * depth) / 2),
        p[1] + ny * (offset + (v * depth) / 2),
        p[2] + (u * width) / 2,
      ]);
    loft(out, 'iron', [at(a), at(b)], c);
  };
  rect(h, 0.075);
  rect(0.075, w, -h / 2);
  rect(0.075, w, h / 2);
}
function rivets(out, x, y, z, count, dx, dy, c = iron) {
  for (let i = 0; i < count; i++)
    sphere(out, 'iron', [x + i * dx, y + i * dy, z], [0.031, 0.031, 0.022], c, 8, 4);
}
function steelSpans(out) {
  for (let s = 0; s < 8; s++) {
    const left = stations[s] + (s ? 2.2 : 0.6),
      right = stations[s + 1] - (s < 7 ? 2.2 : 0.6),
      len = right - left;
    const outer = s < 2 || s > 5,
      shoulder = outer ? 5.8 : 5.1,
      top = (x) => road(x) - 1.05;
    const bottom = (t) => shoulder + (top(left + len * t) - shoulder - 0.65) * (4 * t * (1 - t));
    const ribs = Array.from({ length: 7 }, (_, i) => -9.45 + i * 3.15),
      steps = Math.max(56, Math.ceil(len * 2));
    for (const z of ribs) {
      for (let i = 0; i < steps; i++) {
        const t = i / steps,
          u = (i + 1) / steps;
        iBeam(
          out,
          [left + len * t, bottom(t), z],
          [left + len * u, bottom(u), z],
          0.62,
          0.75,
          iron,
        );
      }
      iBeam(out, [left, top(left), z], [right, top(right), z], 0.45, 0.82);
      const bays = Math.round(len / 4.1);
      for (let i = 0; i <= bays; i++) {
        const t = i / bays,
          x = left + len * t,
          y = bottom(t) + 0.38,
          yt = top(x) - 0.41;
        if (yt - y > 0.2) {
          iBeam(out, [x, y, z], [x, yt, z], 0.26, 0.19);
          if (outer && i < bays) {
            const xn = left + (len * (i + 1)) / bays,
              yn = bottom((i + 1) / bays) + 0.35;
            beam(out, 'iron', [x, y, z], [xn, top(xn) - 0.4, z], 0.2, 0.22, iron);
            if (i === 0 || i === bays - 1)
              beam(out, 'iron', [x, yt, z], [xn, yn, z], 0.14, 0.15, iron);
          }
        }
        if (Math.abs(z) > 9 && yt - y > 0.25)
          for (const side of [-1, 1]) {
            extrude(
              out,
              'iron',
              [
                [x - 0.31, y - 0.13],
                [x + 0.31, y - 0.13],
                [x + 0.13, y + 0.54],
                [x - 0.13, y + 0.54],
              ],
              z + side * 0.36 - 0.015,
              z + side * 0.36 + 0.015,
              shade(i, iron),
            );
            rivets(out, x - 0.15, y + 0.04, z + side * 0.39, 3, 0.15, 0);
            rivets(out, x, y + 0.2, z + side * 0.39, 3, 0, 0.11);
          }
      }
      for (const x of [left, right]) {
        box(
          out,
          'iron',
          [x - 0.55, shoulder - 0.3, z - 0.48],
          [x + 0.55, shoulder - 0.05, z + 0.48],
          darkIron,
        );
        cylinder(out, 'iron', x, shoulder - 0.06, z, 0.2, 0.17, iron, 16);
      }
    }
    for (let x = left + 1; x < right; x += 3.15) {
      const t = (x - left) / len,
        y = bottom(t);
      beam(out, 'iron', [x, top(x) - 0.2, -10.15], [x, top(x) - 0.2, 10.15], 0.23, 0.56, iron);
      if (x + 3.15 < right)
        for (let j = 0; j < 6; j++) {
          const z = ribs[j];
          beam(
            out,
            'iron',
            [x, y, z],
            [x + 3.15, bottom((x + 3.15 - left) / len), z + 3.15],
            0.09,
            0.105,
            iron,
          );
          beam(
            out,
            'iron',
            [x, y, z + 3.15],
            [x + 3.15, bottom((x + 3.15 - left) / len), z],
            0.09,
            0.105,
            iron,
          );
        }
      for (const side of [-1, 1]) {
        beam(
          out,
          'iron',
          [x, top(x) - 0.17, side * 9.45],
          [x, road(x) - 0.42, side * 12.2],
          0.18,
          0.24,
          iron,
        );
        beam(
          out,
          'iron',
          [x, top(x) - 0.77, side * 9.45],
          [x, road(x) - 0.42, side * 12.1],
          0.13,
          0.15,
          iron,
        );
      }
    }
    // Inspection catwalk and handrails follow the arch through the low-level bay.
    for (const side of [-1, 1]) {
      const z = side * 7.9;
      for (let i = 0; i < steps; i++) {
        const t = i / steps,
          u = (i + 1) / steps,
          x = left + len * t,
          xx = left + len * u,
          y = bottom(t) + 0.5,
          yy = bottom(u) + 0.5;
        beam(out, 'iron', [x, y, z], [xx, yy, z], 0.55, 0.08, [0.36, 0.38, 0.36]);
        line(
          out,
          'iron',
          [
            [x, y + 0.95, z + side * 0.27],
            [xx, yy + 0.95, z + side * 0.27],
          ],
          0.023,
          iron,
        );
      }
      for (let x = left + 1; x < right; x += 2.6) {
        const y = bottom((x - left) / len) + 0.5;
        beam(
          out,
          'iron',
          [x, y, z + side * 0.27],
          [x, y + 0.95, z + side * 0.27],
          0.045,
          0.045,
          iron,
        );
      }
    }
  }
}
function pierRing(x, y, w, length, n = 48) {
  // Rounded stone cutwaters, whose long axis follows the river across the bridge.
  return Array.from({ length: n }, (_, i) => {
    const a = (-i / n) * Math.PI * 2;
    return [x + Math.cos(a) * w, y, Math.sin(a) * w + Math.sign(Math.sin(a)) * (length / 2 - w)];
  });
}
function crest(out, x, baseY, z, kind) {
  const local = transform(out, z < 0 ? Math.PI : 0, [x, baseY, z]);
  const p = [
    [-2.35, 0],
    [-2.35, 1.45],
    [-1.5, 1.98],
    [-0.8, 2.23],
    [0.8, 2.23],
    [1.5, 1.98],
    [2.35, 1.45],
    [2.35, 0],
  ];
  extrude(local, 'stone', p, -0.65, 0.15, stone);
  for (const y of [0.38, 0.8, 1.22, 1.64]) {
    const limit = y < 1.45 ? 2.34 : 2.35 - ((y - 1.45) / 0.53) * 0.85;
    for (const s of [-1, 1]) {
      beam(
        local,
        'stone',
        [s * 0.81, y, 0.158],
        [s * limit, y, 0.158],
        0.016,
        0.014,
        [0.37, 0.365, 0.32],
      );
      for (let u = 1.14 + (Math.round(y / 0.4) % 2) * 0.42; u < limit - 0.1; u += 0.83)
        beam(
          local,
          'stone',
          [s * u, y - 0.36, 0.159],
          [s * u, y, 0.159],
          0.015,
          0.014,
          [0.37, 0.365, 0.32],
        );
    }
  }
  for (const s of [-1, 1])
    roundedLine(
      local,
      'stone',
      samples(32, (t) => [s * (2.34 - 1.02 * t), 1.46 + 0.66 * Math.sin((t * Math.PI) / 2), 0.18]),
      0.055,
      pale,
      12,
    );
  for (const side of [-1, 1]) {
    const pts = samples(60, (t) => {
      const a = t * Math.PI * 2.1,
        r = 0.43 * (1 - t) + 0.03;
      return [side * (1.4 + r * Math.cos(a)), 1.72 + r * Math.sin(a), 0.22];
    });
    roundedLine(local, 'stone', pts, 0.065, pale, 12);
    sphere(local, 'stone', [side * 2.12, 1.63, 0], [0.18, 0.18, 0.18], pale, 24, 12);
  }
  const shield = [
    [-0.79, 2.34],
    [0.79, 2.34],
    [0.79, 0.39],
    ...samples(32, (t) => [0.79 * Math.cos(t * Math.PI), 0.39 - 0.55 * Math.sin(t * Math.PI)]),
    [-0.79, 2.34],
  ];
  extrude(local, 'stone', shield, 0.16, 0.34, pale);
  box(local, 'stone', [-0.93, 2.36, -0.12], [0.93, 2.51, 0.5], trim);
  cylinder(local, 'stone', 0, 2.52, 0, 0.55, 0.55, pale, 40);
  cylinder(local, 'stone', 0, 3.04, 0, 0.63, 0.11, trim, 40);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2,
      side = transform(local, a, [0, 0, 0]);
    extrude(
      side,
      'iron',
      [
        [-0.06, 2.67],
        [0.06, 2.67],
        [0.06, 2.89],
        ...samples(12, (t) => [0.06 * Math.cos(t * Math.PI), 2.89 + 0.08 * Math.sin(t * Math.PI)]),
        [-0.06, 2.67],
      ],
      0.551,
      0.553,
      [0.2, 0.205, 0.18],
    );
  }
  const relief = (pts, r = 0.043) =>
    roundedLine(local, 'stone', smoothPath(pts.map(([u, v]) => [u, v, 0.42])), r, trim);
  const ell = (u, v, rx, ry) => sphere(local, 'stone', [u, v, 0.405], [rx, ry, 0.08], trim, 24, 12);
  if (kind === 'mermaid') {
    ell(-0.15, 1.61, 0.135, 0.16);
    ell(-0.15, 1.29, 0.165, 0.22);
    ell(-0.13, 1.1, 0.115, 0.14);
    ell(-0.1, 0.99, 0.17, 0.14);
    ell(-0.25, 1.63, 0.045, 0.036);
    ell(-0.276, 1.6, 0.043, 0.023);
    ell(-0.18, 1.48, 0.065, 0.08);
    sphere(local, 'stone', [-0.23, 1.669, 0.48], [0.018, 0.012, 0.012], [0.52, 0.51, 0.44], 12, 6);
    relief(
      [
        [-0.14, 1.755],
        [0.08, 1.81],
        [0.27, 1.75],
        [0.52, 1.78],
      ],
      0.024,
    );
    relief(
      [
        [-0.26, 1.43],
        [-0.48, 1.62],
        [-0.53, 1.96],
        [-0.42, 2.03],
      ],
      0.065,
    );
    relief(
      [
        [-0.45, 2.04],
        [0.46, 2.16],
      ],
      0.035,
    );
    relief(
      [
        [-0.39, 1.96],
        [-0.43, 2.15],
      ],
      0.026,
    );
    ell(0.31, 1.31, 0.29, 0.37);
    ringXY(local, 'stone', 0.31, 1.31, 0.49, 0.265, 0.345, 0.017, pale);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      sphere(
        local,
        'stone',
        [0.31 + 0.23 * Math.cos(a), 1.31 + 0.3 * Math.sin(a), 0.51],
        [0.022, 0.022, 0.021],
        pale,
        8,
        4,
      );
    }
    relief(
      [
        [-0.16, 1.01],
        [-0.05, 0.85],
        [0.14, 0.71],
        [0.23, 0.54],
        [0.16, 0.37],
        [-0.07, 0.33],
        [-0.26, 0.43],
        [-0.22, 0.59],
        [-0.03, 0.68],
      ],
      0.085,
    );
    extrude(
      local,
      'stone',
      [
        [-0.22, 0.68],
        [-0.5, 0.91],
        [-0.59, 0.72],
        [-0.45, 0.52],
        [-0.22, 0.56],
      ],
      0.35,
      0.46,
      trim,
    );
    for (let i = 0; i < 7; i++)
      relief(
        [
          [-0.08 + i * 0.018, 1.75],
          [0.17 + i * 0.02, 1.8],
          [0.45 + i * 0.018, 1.69],
          [0.61, 1.73 - i * 0.027],
        ],
        0.013,
      );
  } else if (kind === 'suvalki') {
    relief(
      [
        [0, 1.44],
        [0, 2.2],
      ],
      0.035,
    );
    for (let i = 0; i < 5; i++) {
      const y = 1.64 + i * 0.1,
        w = 0.32 - i * 0.055;
      relief(
        [
          [-w, y - 0.07],
          [0, y + 0.04],
          [w, y - 0.07],
        ],
        0.032,
      );
    }
    for (let j = 0; j < 3; j++)
      relief(
        samples(60, (t) => [-0.58 + 1.16 * t, 0.71 + j * 0.13 + 0.035 * Math.sin(t * Math.PI * 5)]),
        0.022,
      );
    relief(
      [
        [-0.6, 1.32],
        [0.6, 1.32],
      ],
      0.03,
    );
    relief(
      [
        [-0.57, 0.44],
        [0.55, 0.44],
      ],
      0.027,
    );
  } else if (kind === 'kalisz' || kind === 'lublin') {
    const y = kind === 'lublin' ? 1.62 : 1.24;
    ell(0, y, 0.35, 0.15);
    ell(-0.34, y + 0.16, 0.13, 0.23);
    ell(-0.49, y + 0.27, 0.16, 0.08);
    for (const s of [-1, 1]) {
      relief(
        [
          [s * 0.22, y - 0.05],
          [s * 0.32, y - 0.32],
          [s * 0.47, y - 0.38],
        ],
        0.04,
      );
      relief(
        [
          [s * 0.12, y - 0.02],
          [s * 0.03, y - 0.27],
          [s * 0.17, y - 0.38],
        ],
        0.035,
      );
    }
    relief(
      [
        [-0.32, y + 0.29],
        [-0.31, y + 0.52],
        [-0.17, y + 0.62],
      ],
      0.03,
    );
    relief(
      [
        [-0.3, y + 0.46],
        [-0.51, y + 0.54],
      ],
      0.024,
    );
    relief(
      [
        [0.28, y + 0.03],
        [0.43, y + 0.24],
        [0.52, y + 0.31],
      ],
      0.032,
    );
    if (kind === 'lublin')
      for (const u of [-0.41, 0, 0.41]) {
        relief(
          [
            [u, 0.12],
            [u, 0.72],
          ],
          0.028,
        );
        for (const [dx, dy] of [
          [0, 0.74],
          [-0.13, 0.64],
          [0.13, 0.62],
          [-0.08, 0.48],
          [0.09, 0.44],
        ])
          ell(u + dx, dy, 0.125, 0.12);
      }
    else
      for (const s of [-1, 1]) {
        relief(
          [
            [s * 0.48, 0.45],
            [s * 0.56, 1.8],
            [s * 0.51, 2.14],
          ],
          0.027,
        );
        for (let j = 0; j < 7; j++) ell(s * (0.5 + (j % 2) * 0.07), 0.61 + j * 0.2, 0.066, 0.13);
      }
  } else {
    ell(0, 1.83, 0.15, 0.23);
    for (const s of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const u = s * (0.13 + i * 0.063),
          v = 1.94 - i * 0.056;
        relief(
          [
            [s * 0.11, 2.08],
            [u, v],
            [s * (0.18 + i * 0.07), v - 0.2],
          ],
          0.042,
        );
      }
    for (let j = 0; j < 3; j++)
      relief(
        samples(48, (t) => [-0.57 + t * 1.14, 0.86 + j * 0.1 + 0.04 * Math.sin(t * Math.PI * 6)]),
        0.026,
      );
    relief(
      [
        [-0.32, 0.47],
        [0.32, 0.47],
        [0.19, 0.37],
        [-0.21, 0.37],
        [-0.32, 0.47],
      ],
      0.029,
    );
  }
  // The back is an actual stone bench facing the sidewalk.
  box(local, 'stone', [-1.85, 0.15, -1.05], [1.85, 0.37, -0.45], stone);
  for (const u of [-1.5, 1.5])
    box(local, 'stone', [u - 0.14, -0.25, -0.96], [u + 0.14, 0.2, -0.56], stone);
}
function piers(out) {
  for (let i = 0; i < 7; i++) {
    const x = pierX[i],
      full = [0, 1, 5, 6].includes(i),
      capY = full ? 5.4 : 4.65;
    loft(
      out,
      'stone',
      [
        pierRing(x, 0, 3.08, 29.6),
        pierRing(x, 0.45, 3.0, 29.4),
        pierRing(x, capY - 0.4, 2.65, 28.7),
        pierRing(x, capY, 2.97, 29.3),
      ],
      stone,
    );
    for (let y = 0.4, row = 0; y < capY - 0.4; y += 0.42, row++) {
      const pts = pierRing(x, y, 2.98 - (y - 0.4) * 0.1, 29.3 - (y - 0.4) * 0.15, 80);
      line(out, 'stone', pts.concat([pts[0]]), 0.016, [0.32, 0.31, 0.27]);
      for (let k = 0; k < 80; k += 3) {
        const p = pts[(k + (row % 2)) % 80];
        beam(
          out,
          'stone',
          p,
          [p[0], Math.min(y + 0.4, capY - 0.4), p[2]],
          0.018,
          0.018,
          [0.32, 0.31, 0.27],
        );
      }
    }
    if (full) {
      const y = road(x) - 0.6;
      loft(
        out,
        'stone',
        [
          pierRing(x, capY, 2.38, 26.3),
          pierRing(x, y - 0.75, 1.93, 25.7),
          pierRing(x, y - 0.25, 2.25, 26.2),
          pierRing(x, y, 2.58, 26.6),
        ],
        shade(i),
      );
      for (let yy = capY + 0.35, row = 0; yy < y - 0.7; yy += 0.46, row++) {
        const w = 2.38 - ((yy - capY) / (y - 0.75 - capY)) * 0.45,
          pts = pierRing(x, yy, w, 26.3 - ((yy - capY) / (y - 0.75 - capY)) * 0.6, 64);
        line(out, 'stone', pts.concat([pts[0]]), 0.014, [0.36, 0.345, 0.3]);
        for (let k = 0; k < 64; k += 4) {
          const p = pts[(k + 2 * (row % 2)) % 64];
          beam(out, 'stone', p, [p[0], yy + 0.42, p[2]], 0.017, 0.017, [0.36, 0.345, 0.3]);
        }
      }
      for (const side of [-1, 1])
        crest(
          out,
          x,
          road(x) - 0.35,
          side * 12.45,
          i === 0 || i === 6
            ? 'mermaid'
            : i === 1
              ? side < 0
                ? 'suvalki'
                : 'kalisz'
              : side < 0
                ? 'warsaw'
                : 'lublin',
        );
    } else {
      for (const z of [-9.45, -6.3, -3.15, 0, 3.15, 6.3, 9.45]) {
        beam(out, 'iron', [x - 1.65, capY, z], [x - 0.55, road(x) - 1.2, z], 0.32, 0.37, iron);
        beam(out, 'iron', [x + 1.65, capY, z], [x + 0.55, road(x) - 1.2, z], 0.32, 0.37, iron);
      }
      for (const yy of [6.2, 9.2, 12.1]) {
        beam(out, 'iron', [x, yy, -10], [x, yy, 10], 0.24, 0.29, iron);
        for (let j = 0; j < 6; j++)
          beam(
            out,
            'iron',
            [x, yy, -9.45 + j * 3.15],
            [x, Math.min(yy + 2.8, road(x) - 1), -6.3 + j * 3.15],
            0.16,
            0.16,
            iron,
          );
      }
    }
  }
}
function deck(out) {
  for (let x = ends[0]; x < ends[1]; x += 1) {
    const xx = Math.min(x + 1, ends[1]),
      ring = (u, y0, y1, z0, z1) => [
        [u, y1, z0],
        [u, y1, z1],
        [u, y0, z1],
        [u, y0, z0],
      ];
    loft(
      out,
      'concrete',
      [
        ring(x, road(x) - 0.48, road(x) - 0.12, -halfWidth, halfWidth),
        ring(xx, road(xx) - 0.48, road(xx) - 0.12, -halfWidth, halfWidth),
      ],
      [0.58, 0.57, 0.52],
    );
    loft(
      out,
      'road',
      [
        ring(x, road(x) - 0.12, road(x), -10.2, 10.2),
        ring(xx, road(xx) - 0.12, road(xx), -10.2, 10.2),
      ],
      [0.205, 0.215, 0.21],
    );
    loft(
      out,
      'paving',
      [ring(x, road(x), road(x) + 0.24, -3.2, 3.2), ring(xx, road(xx), road(xx) + 0.24, -3.2, 3.2)],
      [0.53, 0.43, 0.29],
    );
    for (const side of [-1, 1]) {
      const zs = [10.2, 12.4].map((z) => z * side).sort((a, b) => a - b);
      loft(
        out,
        'paving',
        [ring(x, road(x), road(x) + 0.18, ...zs), ring(xx, road(xx), road(xx) + 0.18, ...zs)],
        [0.62, 0.61, 0.55],
      );
      beam(
        out,
        'iron',
        [x, road(x) - 0.1, side * 12.41],
        [xx, road(xx) - 0.1, side * 12.41],
        0.14,
        0.58,
        [0.66, 0.095, 0.145],
      );
    }
  }
  for (const center of [-1.6, 1.6])
    for (const rail of [-0.7175, 0.7175])
      for (let x = ends[0]; x < ends[1]; x += 2) {
        const xx = Math.min(x + 2, ends[1]);
        beam(
          out,
          'iron',
          [x, road(x) + 0.25, center + rail],
          [xx, road(xx) + 0.25, center + rail],
          0.057,
          0.08,
          [0.39, 0.41, 0.39],
        );
      }
  for (const z of [-10, -6.7, -3.25, 3.25, 6.7, 10])
    for (let x = ends[0] + 1; x < ends[1] - 1; x += Math.abs(z) === 6.7 ? 8 : 3) {
      const l = Math.abs(z) === 6.7 ? 3 : 2.9;
      beam(
        out,
        'marking',
        [x, road(x) + 0.013, z],
        [Math.min(x + l, ends[1]), road(Math.min(x + l, ends[1])) + 0.013, z],
        0.13,
        0.012,
        [0.87, 0.86, 0.78],
      );
    }
  for (const x of stations.slice(1, -1))
    for (let i = -1; i <= 1; i++)
      beam(
        out,
        'iron',
        [x + i * 0.07, road(x) + 0.014, -10.2],
        [x + i * 0.07, road(x) + 0.014, 10.2],
        0.035,
        0.018,
        darkIron,
      );
}
function railings(out) {
  for (const side of [-1, 1])
    for (let x = ends[0]; x < ends[1]; x += 2.25) {
      const xx = Math.min(x + 2.25, ends[1]),
        c = (x + xx) / 2,
        z = side * 12.31,
        y = road(c) + 0.18;
      if (pierX.some((p, i) => [0, 1, 5, 6].includes(i) && Math.abs(c - p) < 2.45)) continue;
      for (const h of [0.09, 0.21, 1.14])
        beam(
          out,
          'iron',
          [x, road(x) + 0.18 + h, z],
          [xx, road(xx) + 0.18 + h, z],
          0.052,
          0.048,
          darkIron,
        );
      beam(out, 'iron', [x, y, z], [x, y + 1.17, z], 0.075, 0.075, darkIron);
      for (let u = x + 0.17; u < xx; u += 0.18)
        beam(out, 'iron', [u, y + 0.15, z], [u, y + 0.98, z], 0.022, 0.025, darkIron);
      for (let u = x + 0.22; u < xx - 0.1; u += 0.42)
        line(
          out,
          'iron',
          samples(24, (t) => [
            u + 0.17 * Math.cos(Math.PI + t * Math.PI),
            y + 1.125 + 0.12 * Math.sin(Math.PI + t * Math.PI),
            z + side * 0.025,
          ]),
          0.018,
          darkIron,
        );
      for (const sign of [-1, 1]) {
        const plane = z + side * 0.035;
        line(
          out,
          'iron',
          smoothPath([
            [x + sign * 0.045, y + 0.17, plane],
            [x + sign * 0.14, y + 0.46, plane],
            [x + sign * 0.26, y + 0.67, plane],
          ]),
          0.017,
          darkIron,
        );
        ringXY(out, 'iron', x + sign * 0.34, y + 0.81, plane, 0.15, 0.15, 0.02, darkIron, 32);
        line(
          out,
          'iron',
          smoothPath([
            [x + sign * 0.22, y + 0.52, plane],
            [x + sign * 0.3, y + 0.54, plane],
            [x + sign * 0.32, y + 0.61, plane],
          ]),
          0.018,
          darkIron,
        );
        line(
          out,
          'iron',
          smoothPath([
            [x + sign * 0.12, y + 0.4, plane],
            [x + sign * 0.08, y + 0.59, plane],
            [x + sign * 0.17, y + 0.72, plane],
            [x + sign * 0.2, y + 0.91, plane],
          ]),
          0.016,
          darkIron,
        );
        ringXY(out, 'iron', x + sign * 0.09, y + 1.055, plane, 0.048, 0.06, 0.013, darkIron, 20);
        ringXY(out, 'iron', x + sign * 0.085, y + 0.1, plane, 0.046, 0.049, 0.013, darkIron, 20);
        extrude(
          out,
          'iron',
          [
            [x + sign * 0.22, y + 0.67],
            [x + sign * 0.17, y + 0.59],
            [x + sign * 0.3, y + 0.64],
          ],
          plane - 0.019,
          plane + 0.019,
          darkIron,
        );
      }
    }
}
function lamp(out, x, side) {
  const z = side * 10.63,
    y = road(x) + 0.18;
  loft(
    out,
    'iron',
    [
      radialRing(y, 0.18, 0.18, 16, [x, z]),
      radialRing(y + 0.65, 0.105, 0.105, 16, [x, z]),
      radialRing(y + 7.3, 0.065, 0.065, 16, [x, z]),
      radialRing(y + 7.48, 0.035, 0.035, 16, [x, z]),
    ],
    darkIron,
  );
  for (const h of [1.1, 2.7, 4.4, 5.6, 6.9])
    cylinder(out, 'iron', x, y + h, z, 0.12, 0.11, darkIron, 16);
  const arm = samples(24, (t) => [
    x,
    y + 6.27 + 0.46 * Math.sin((t * Math.PI) / 2),
    z - side * (0.05 + t * 1.55),
  ]);
  line(out, 'iron', arm, 0.035, darkIron);
  beam(out, 'iron', [x, y + 5.98, z], [x, y + 6.68, z - side * 1.1], 0.037, 0.037, darkIron);
  sphere(
    out,
    'iron',
    [x, y + 6.69, z - side * 1.59],
    [0.25, 0.09, 0.12],
    [0.48, 0.48, 0.43],
    24,
    12,
  );
  sphere(
    out,
    'marking',
    [x, y + 6.65, z - side * 1.61],
    [0.18, 0.035, 0.086],
    [0.92, 0.9, 0.71],
    20,
    8,
  );
}
function catenary(out) {
  const xs = [];
  for (let x = -239; x < 249; x += 26) {
    xs.push(x);
    for (const side of [-1, 1]) lamp(out, x, side);
    line(
      out,
      'iron',
      [
        [-0 + x, road(x) + 6.75, -10.6],
        [x, road(x) + 6.36, -3],
        [x, road(x) + 6.36, 3],
        [x, road(x) + 6.75, 10.6],
      ],
      0.009,
      darkIron,
    );
  }
  for (const z of [-1.6, 1.6])
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      line(
        out,
        'iron',
        samples(24, (t) => {
          const x = a + (b - a) * t;
          return [x, road(x) + 5.9 - 0.1 * Math.sin(Math.PI * t), z];
        }),
        0.0065,
        darkIron,
      );
      line(
        out,
        'iron',
        samples(24, (t) => {
          const x = a + (b - a) * t;
          return [x, road(x) + 6.5 - 0.22 * Math.sin(Math.PI * t), z];
        }),
        0.0065,
        darkIron,
      );
      for (let t = 0.1; t < 1; t += 0.2) {
        const x = a + (b - a) * t;
        beam(
          out,
          'iron',
          [x, road(x) + 5.9 - 0.1 * Math.sin(Math.PI * t), z],
          [x, road(x) + 6.5 - 0.22 * Math.sin(Math.PI * t), z],
          0.009,
          0.009,
          darkIron,
        );
      }
    }
}
function archedWindow(out, u, y, z, w, h, { bars = false, blind = false } = {}) {
  const r = w / 2,
    head = y + h - r,
    outline = [
      [-r, y],
      [r, y],
      [r, head],
      ...samples(32, (t) => [r * Math.cos(t * Math.PI), head + r * Math.sin(t * Math.PI)]),
      [-r, y],
    ].map(([x, yy]) => [u + x, yy]);
  extrude(
    out,
    blind ? 'rawlimestone' : 'iron',
    outline,
    z - 0.015,
    z + 0.012,
    blind ? [0.66, 0.64, 0.55] : [0.14, 0.16, 0.145],
  );
  for (const xx of [-r, r])
    box(
      out,
      'rawlimestone',
      [u + xx - 0.065, y - 0.08, z - 0.05],
      [u + xx + 0.065, head, z + 0.09],
      trim,
    );
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI,
      b = ((i + 1) / 32) * Math.PI;
    extrude(
      out,
      'rawlimestone',
      [
        [u + r * Math.cos(a), head + r * Math.sin(a)],
        [u + (r + 0.13) * Math.cos(a), head + (r + 0.13) * Math.sin(a)],
        [u + (r + 0.13) * Math.cos(b), head + (r + 0.13) * Math.sin(b)],
        [u + r * Math.cos(b), head + r * Math.sin(b)],
      ],
      z - 0.03,
      z + 0.1,
      trim,
    );
  }
  box(
    out,
    'rawlimestone',
    [u - r - 0.14, y - 0.13, z - 0.06],
    [u + r + 0.14, y - 0.035, z + 0.14],
    trim,
  );
  if (bars)
    for (const slope of [-1, 1])
      for (let b = -h - w; b < h + w; b += 0.29) {
        const pts = [];
        for (let i = 0; i <= 120; i++) {
          const xx = -r + (i / 120) * w,
            yy = y + b + slope * xx;
          if (yy > y + 0.025 && yy < head + Math.sqrt(Math.max(0, r * r - xx * xx)) - 0.015)
            pts.push([u + xx, yy, z + 0.044]);
        }
        if (pts.length > 1) line(out, 'iron', [pts[0], pts.at(-1)], 0.013, [0.35, 0.27, 0.16]);
      }
}
function crown(out, x, y, z, width, depth) {
  for (const [a, w, d] of [
    [0, width, depth],
    [Math.PI / 2, depth, width],
    [Math.PI, width, depth],
    [-Math.PI / 2, depth, width],
  ]) {
    const side = transform(out, a, [x, y, z]),
      n = Math.max(3, Math.round(w / 1.12)),
      pitch = w / n;
    box(
      side,
      'rawlimestone',
      [-w / 2 - 0.2, -0.22, d / 2 - 0.25],
      [w / 2 + 0.2, 0, d / 2 + 0.15],
      trim,
    );
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + (i + 0.5) * pitch;
      const curve = samples(20, (t) => [
        u - pitch / 2 + t * pitch,
        0.45 - 0.28 * Math.sin(Math.PI * t),
      ]);
      extrude(
        side,
        'rawlimestone',
        [[u - pitch / 2, 0], [u + pitch / 2, 0], ...curve.toReversed()],
        d / 2 - 0.16,
        d / 2 + 0.075,
        pale,
      );
      line(
        side,
        'rawlimestone',
        curve.map((p) => [...p, d / 2 + 0.09]),
        0.045,
        trim,
      );
      cylinder(side, 'rawlimestone', u - pitch / 2, 0.4, d / 2 - 0.02, 0.1, 0.15, trim, 16);
      sphere(
        side,
        'rawlimestone',
        [u - pitch / 2, 0.62, d / 2 - 0.02],
        [0.13, 0.13, 0.13],
        trim,
        20,
        10,
      );
    }
  }
  box(
    out,
    'road',
    [x - width / 2, y - 0.22, z - depth / 2],
    [x + width / 2, y - 0.17, z + depth / 2],
    [0.3, 0.32, 0.28],
  );
}
function tower(out, side, bank) {
  const way = frame.geometry.bankStructures.find(
      (p) =>
        p.osmWay ===
        (bank < 0 ? (side < 0 ? '331948054' : '331948055') : side < 0 ? '331948810' : '331948809'),
    ),
    p = way.points;
  const min = [0, 1].map((i) => Math.min(...p.map((p) => p[i]))),
    max = [0, 1].map((i) => Math.max(...p.map((p) => p[i])));
  const xOuter = bank < 0 ? min[0] + 2.25 : max[0] - 2.25,
    xInner = bank < 0 ? max[0] : min[0],
    z = (min[1] + max[1]) / 2;
  const w = 4.45,
    d = 4.4,
    y = road(bank * 251.87) + 0.2,
    base = bank < 0 ? 9.1 : 9.5;
  const lo = Math.min(xOuter - w / 2, xInner),
    hi = Math.max(xOuter + w / 2, xInner),
    shaftTop = y + 13.8;
  box(out, 'stone', [lo, base, z - d / 2], [hi, y - 0.3, z + d / 2], stone);
  for (let yy = base, row = 0; yy < y - 0.3; yy += 0.53, row++)
    for (let x = lo; x < hi; x += 1.07) {
      const xx = Math.min(x + 1.03, hi - 0.015);
      if (xx <= x) continue;
      for (const s of [-1, 1])
        box(
          out,
          'stone',
          [x + 0.014, yy + 0.012, z + s * (d / 2 + 0.018) - 0.025],
          [xx, Math.min(yy + 0.51, y - 0.3), z + s * (d / 2 + 0.018) + 0.025],
          shade(row * 17 + x),
        );
    }
  for (const [h, extra] of [
    [y - 0.6, 0.15],
    [y - 0.32, 0.28],
    [y, 0.14],
  ])
    box(
      out,
      'rawlimestone',
      [lo - extra, h, z - d / 2 - extra],
      [hi + extra, h + 0.17, z + d / 2 + extra],
      pale,
    );
  box(
    out,
    'rawlimestone',
    [xOuter - w / 2, y, z - d / 2],
    [xOuter + w / 2, shaftTop, z + d / 2],
    pale,
  );
  const wingLo = Math.min(xOuter, xInner),
    wingHi = Math.max(xOuter, xInner);
  box(out, 'rawlimestone', [wingLo, y, z - d / 2], [wingHi, y + 5.0, z + d / 2], pale);
  for (const s of [-1, 1]) {
    const wall = transform(out, s < 0 ? Math.PI : 0, [xOuter, y, z + (s * d) / 2]);
    for (const yy of [2.9, 6.5]) archedWindow(wall, 0, yy, 0.018, 0.6, 1.55);
    ringXY(wall, 'rawlimestone', 0, 10.16, 0.1, 0.36, 0.36, 0.075, trim);
    extrude(
      wall,
      'iron',
      samples(40, (t) => [
        0.25 * Math.cos(t * Math.PI * 2),
        10.16 + 0.25 * Math.sin(t * Math.PI * 2),
      ]),
      -0.008,
      0.028,
      [0.16, 0.17, 0.15],
    );
    for (let yy = 0.55; yy < 10.7; yy += 0.55)
      beam(
        wall,
        'rawlimestone',
        [-w / 2, yy, 0.014],
        [w / 2, yy, 0.014],
        0.014,
        0.012,
        [0.67, 0.65, 0.57],
      );
    for (let j = 0; j < 3; j++) {
      const x = xOuter - bank * (3.15 + j * 2.15);
      if (x > lo + 0.35 && x < hi - 0.35) {
        const plane = transform(out, s < 0 ? Math.PI : 0, [x, y, z + (s * d) / 2]);
        archedWindow(plane, 0, 1.08, 0.028, 1.18, 2.55, { bars: true });
      }
    }
    for (let xx = lo + 0.45; xx < hi; xx += 2.15) {
      box(
        out,
        'rawlimestone',
        [xx - 0.15, y + 4.15, z + s * (d / 2 + 0.025) - 0.09],
        [xx + 0.15, y + 4.62, z + s * (d / 2 + 0.025) + 0.09],
        trim,
      );
    }
  }
  // The open-looking top arcade has inset arches on all four elevations.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const wall = transform(out, angle, [xOuter, y + 11.1, z]);
    for (const u of [-1.28, 0, 1.28]) archedWindow(wall, u, 0.34, d / 2 + 0.025, 0.56, 1.62);
    for (const yy of [0, 2.4])
      box(
        wall,
        'rawlimestone',
        [-w / 2 - 0.26, yy - 0.1, -d / 2 - 0.26],
        [w / 2 + 0.26, yy + 0.12, d / 2 + 0.26],
        trim,
      );
    for (const u of [-1.93, -0.65, 0.65, 1.93])
      box(wall, 'rawlimestone', [u - 0.07, 0.15, d / 2], [u + 0.07, 2.2, d / 2 + 0.13], trim);
  }
  crown(out, xOuter, y + 13.78, z, w + 0.35, d + 0.35);
  crown(out, (wingLo + wingHi) / 2, y + 5.0, z, wingHi - wingLo, d);
  // Cast brackets and hanging lanterns attached to the tower shaft.
  for (const s of [-1, 1]) {
    const plane = transform(out, s < 0 ? Math.PI : 0, [xOuter, y + 7.8, z + (s * d) / 2]);
    line(
      plane,
      'iron',
      [
        [0, 0, 0],
        [0, 2.0, 0],
        [0, 2.35, 0.18],
        [0, 2.4, 0.65],
        [0, 2.05, 0.94],
      ],
      0.035,
      darkIron,
    );
    for (const sign of [-1, 1])
      line(
        plane,
        'iron',
        samples(50, (t) => [
          sign * 0.25 * Math.sin(t * Math.PI * 2),
          0.95 + t * 0.9,
          0.15 + 0.65 * t,
        ]),
        0.023,
        darkIron,
      );
    loft(
      plane,
      'iron',
      [
        radialRing(1.5, 0.12, 0.12, 8, [0, 0.94]),
        radialRing(1.72, 0.25, 0.25, 8, [0, 0.94]),
        radialRing(1.82, 0.03, 0.03, 8, [0, 0.94]),
      ],
      darkIron,
    );
  }
  return { x: xOuter, z, base, top: y };
}
function stairs(out, bank, side, info) {
  const way = frame.geometry.bankStructures.find(
      (p) =>
        p.osmWay ===
        (bank < 0 ? (side < 0 ? '589900430' : '589900431') : side < 0 ? '589204906' : '589204912'),
    ),
    p = way.points;
  const lo = [0, 1].map((i) => Math.min(...p.map((p) => p[i]))),
    hi = [0, 1].map((i) => Math.max(...p.map((p) => p[i]))),
    cx = (lo[0] + hi[0]) / 2,
    cz = (lo[1] + hi[1]) / 2,
    r = Math.min(hi[0] - lo[0], hi[1] - lo[1]) / 2;
  const n = 48,
    total = bank * side * Math.PI,
    start = (-side * Math.PI) / 2 - total,
    base = info.base,
    top = info.top;
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * total,
      b = start + ((i + 1) / n) * total,
      y = base + ((top - base) * (i + 1)) / n;
    const wedge = [
      ...samples(3, (t) => [
        cx + (r - 0.24) * Math.cos(a + (b - a) * t),
        cz + (r - 0.24) * Math.sin(a + (b - a) * t),
      ]),
      ...samples(3, (t) => [
        cx + 0.05 * Math.cos(b + (a - b) * t),
        cz + 0.05 * Math.sin(b + (a - b) * t),
      ]),
    ];
    if (normalFor(...wedge.map(([x, z]) => [x, y, z]))[1] < 0) wedge.reverse();
    const indices = earcut(wedge.flat());
    for (let k = 0; k < indices.length; k += 3) {
      const q = indices.slice(k, k + 3).map((j) => [wedge[j][0], y, wedge[j][1]]);
      if (normalFor(...q)[1] < 0) q.reverse();
      out.addTriangle(
        'rawlimestone',
        'palette:#ffffff',
        q,
        [0, 1, 0],
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        pale,
      );
    }
    for (let j = 0; j < wedge.length; j++) {
      const k = (j + 1) % wedge.length,
        p = [
          [wedge[j][0], base, wedge[j][1]],
          [wedge[k][0], base, wedge[k][1]],
          [wedge[k][0], y, wedge[k][1]],
          [wedge[j][0], y, wedge[j][1]],
        ];
      quad(out, 'rawlimestone', p, normalFor(...p), pale);
    }
    for (const rr of [r, r - 1.85]) {
      const aa = a + (b - a) * 0.5,
        x = cx + rr * Math.cos(aa),
        z = cz + rr * Math.sin(aa);
      beam(
        out,
        'rawlimestone',
        [cx + rr * Math.cos(a), y + 0.63, cz + rr * Math.sin(a)],
        [cx + rr * Math.cos(b), y + 0.63, cz + rr * Math.sin(b)],
        0.27,
        1.2,
        pale,
      );
      if (i % 8 === 0)
        sphere(out, 'rawlimestone', [x, y + 1.31, z], [0.12, 0.12, 0.12], trim, 20, 10);
    }
  }
  // The stone volume follows the stair rise; a full-height cylinder would cover the flights.
  const doorAngle = start + total * 0.6,
    door = transform(out, Math.PI / 2 - doorAngle, [
      cx + r * Math.cos(doorAngle),
      base,
      cz + r * Math.sin(doorAngle),
    ]);
  archedWindow(door, 0, 0.12, 0.02, 1.25, 2.55);
  const tx = cx + (r - 1.05) * Math.cos(start + total),
    tz = cz + (r - 1.05) * Math.sin(start + total);
  box(
    out,
    'rawlimestone',
    [Math.min(tx, info.x) - 0.8, top - 0.22, Math.min(tz, info.z) - 0.8],
    [Math.max(tx, info.x) + 0.8, top, Math.max(tz, info.z) + 0.8],
    pale,
  );
}
export function buildPoniatowski(out) {
  steelSpans(out);
  piers(out);
  deck(out);
  railings(out);
  catenary(out);
  for (const bank of [-1, 1])
    for (const side of [-1, 1]) {
      const info = tower(out, side, bank);
      stairs(out, bank, side, info);
    }
}
function geographicProposal() {
  const radius = 6378137,
    factor = Math.cos((frame.anchor[1] * Math.PI) / 180);
  const cx = ((frame.anchor[0] * Math.PI) / 180) * radius * factor;
  const cz = -radius * Math.asinh(Math.tan((frame.anchor[1] * Math.PI) / 180)) * factor;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const corners = [
    [-410, -160],
    [-410, 160],
    [410, -160],
    [410, 160],
  ].map(([x, z]) => [
    (((cx + c * x + s * z) / factor / radius) * 180) / Math.PI,
    (Math.atan(Math.sinh(-(cz - s * x + c * z) / factor / radius)) * 180) / Math.PI,
  ]);
  return {
    anchor: frame.anchor,
    heading: frame.heading,
    elevationMode: 'sea-level',
    elevationMeters: verticalOrigin,
    bounds: [
      Math.min(...corners.map((p) => p[0])),
      Math.min(...corners.map((p) => p[1])),
      Math.max(...corners.map((p) => p[0])),
      Math.max(...corners.map((p) => p[1])),
    ],
    replaceRoads: {
      length: ends[1] - ends[0],
      width: halfWidth * 2,
      outline: [
        [ends[0], -halfWidth],
        [ends[1], -halfWidth],
        [ends[1], halfWidth],
        [ends[0], halfWidth],
      ],
      deckHeights: ends.map(road),
    },
    notes:
      'Directed current road axis and seven mapped pier footprints. The asymmetric road grade and bank bases follow independently preserved GUGiK NMPT/NMT in PL-EVRF2007-NH. Model origin 77.0 m is a declared river-adjacent reconstruction, about 0.17 m below sampled modeled water, not a measured underwater foundation. Host terrain must use this datum or convert elevations explicitly. The exact native deck polygon replaces only successfully loaded, covered bridge-road fragments; native endpoint heights join surrounding approaches while lower riverbank roads remain independent. The separate western approach viaduct is not included in this asset. Current terrain and road-context image review is required.',
  };
}
export const poniatowskiStudy = {
  id: 'N0029',
  key: 'poniatowski_bridge',
  title: 'Poniatowski Bridge',
  wikidataId: 'Q2340139',
  mapFrameDocument: 'map-frame.json',
  build: buildPoniatowski,
  normalSmoothing: { slots: ['wall', 'foundation'], angle: 36 },
  brief:
    'The present eight-span Warsaw river crossing: four N-truss outer spans and four rebuilt arch spans, seven ribs across, short central pier caps and four tall surviving stone pylons, eight distinct heraldic benches, four Renaissance bank towers and curved stairs, red fascia, ornate iron railings and twin tram tracks with overhead wires.',
  refs: [
    'https://commons.wikimedia.org/wiki/Category:Most_i_wiadukt_imienia_ks._J%C3%B3zefa_Poniatowskiego_przez_rzek%C4%99_Wis%C5%82%C4%99_w_Warszawie_(1927)',
    'https://mbc.cyfrowemazowsze.pl/Content/83246/PDF/00090666_-_Zycie-Srodmiescia-bezpl-2021-nr-6-43-czerwiec-_-.pdf',
    'https://commons.wikimedia.org/wiki/File:Most_Poniatowskiego_w_Warszawie_2021.jpg',
    'https://bedeker.waw.pl/index.php/2020/07/18/most-ksiecia-jozefa-poniatowskiego-plaskorzezby/',
    'https://www.warszawa1939.pl/galeria-powiazany/most-poniatowskiego-f/galeria-powiazana-1960-kartusze-zdobiace-most',
    'https://www.openstreetmap.org/way/368095449',
  ],
  sourceFacts: {
    publishedLengthMeters: 506.13,
    historicalClearSpansMeters: [32, 58, 68, 80, 68, 58, 58, 38],
    historicalWidthMeters: 21.4,
    currentNominalWidthMeters: 24.8,
    girdersAcross: 7,
    currentMiddleArchSpans: [3, 4, 5, 6],
    bankTowers: 4,
    survivingHeraldicBenches: 8,
    openingYear: 1914,
    reconstructionYear: 1946,
  },
  reconstruction: {
    mappedDeckLengthMeters: 503.74,
    modelDeckWidthMeters: 24.8,
    pierCentersMeters: pierX,
    deckAboveModelOriginMeters: [17.48, 19.86],
    roadProfileAbsoluteMeters: roadKnots,
    verticalDatum: 'PL-EVRF2007-NH',
    modelOriginAbsoluteMeters: verticalOrigin,
    bankPlinthBaseMeters: { west: 9.1, east: 9.5 },
    notes:
      'Actual pier positions and all four tower/stair plans come from current mapped footprints. The asymmetric road profile follows independent GUGiK NMPT lane medians in PL-EVRF2007-NH; a monotone cubic curve smooths the broad crown. River-adjacent origin77m and bank bases86.1/86.5m use independent NMT terrain. Current middle-span section types and short center caps are based on direct photographs; historical plans are not applied to destroyed spans. Tower vertical dimensions, bearing heights, arch curves, member sections, carved reliefs and stairs remain photographic reconstructions. The surface raster cannot see beneath the bridge and does not measure bathymetry. No historical gauge conversion is assumed.',
  },
  nativeAxes: {
    x: 'east-northeast across the river from the city center to Praga',
    y: 'up from77mPL-EVRF2007-NH river-adjacent reference',
    z: 'south-southeast/upstream face',
  },
  geographic: geographicProposal,
  limitations: [
    'GUGiK NMT/NMPT fixes current road and bank elevations; bearings hidden beneath the deck remain photograph-based. Runtime terrain and approach captures are required before geographic approval.',
    'The separate 701m western approach viaduct lies outside this river-bridge asset.',
    'Current steel section thicknesses, connection schedules and tower elevations are photograph-based reconstructions, not fabrication or conservation survey dimensions.',
    'Detailed reliefs depict the eight surviving heraldic subjects; carving depths and stair sections are original photographic reconstructions, not scans.',
  ],
  camera: { position: [330, 180, 360], lookAt: [0, 14, 0], fov: 45 },
  qaCameras: [
    { name: 'eight-spans-upstream', position: [0, 50, 570], lookAt: [0, 14, 0] },
    { name: 'eight-spans-downstream', position: [0, 50, -570], lookAt: [0, 14, 0] },
    { name: 'outer-n-truss', position: [-183, 10, 54], lookAt: [-181, 10, 0] },
    { name: 'rebuilt-middle-arch', position: [-34, 12, 67], lookAt: [-35, 11, 0] },
    { name: 'seven-rib-soffit', position: [-120, 4, 1], lookAt: [-90, 16, 0] },
    { name: 'short-central-pier', position: [27, 10, 32], lookAt: [7.45, 11, 0] },
    { name: 'stone-pylon', position: [-198, 13, 24], lookAt: [-216.58, 13, 12] },
    {
      name: 'mermaid-crest',
      position: [-214, road(-216.58) + 2.7, 20],
      lookAt: [-216.58, road(-216.58) + 1.5, 12.45],
    },
    {
      name: 'suvalki-crest',
      position: [-154, road(-152.59) + 2.7, -20],
      lookAt: [-152.59, road(-152.59) + 1.5, -12.45],
    },
    {
      name: 'ornamental-railing',
      position: [-180, road(-180) + 2.2, 17],
      lookAt: [-183, road(-183) + 0.8, 12.3],
    },
    { name: 'west-bank-towers', position: [-282, 36, 43], lookAt: [-256, 27, 0] },
    { name: 'east-bank-towers', position: [287, 36, -43], lookAt: [258, 27, 0] },
    { name: 'tower-crown', position: [-277, 40, 28], lookAt: [-262.6, 31.4, 12.2] },
    { name: 'spiral-bank-stairs', position: [-275, 22, 38], lookAt: [-259, 13, 20] },
    { name: 'tram-and-current-road', position: [210, 24, 4], lookAt: [-80, 20, 0] },
    { name: 'riveted-junction', position: [-178, 14, 13], lookAt: [-182, 14, 9.45] },
    { name: 'deck-plan', position: [0, 720, 0.01], lookAt: [0, 0, 0] },
  ],
};
