/** Independent browser reconstruction: mapped mixed spans and Renaissance bank towers. */

import './install-deterministic-math.mjs';
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

const frame = JSON.parse(readFileSync(structureSourcePath('poniatowski_bridge', 'map-frame.json')));
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
const _shade = (seed, c = stone) => c.map((v) => v + Math.sin(seed * 5.217) * 0.5 * 0.065);
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
function _roundedLine(out, slot, points, r, c, sides = 10) {
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
function _smoothPath(points, steps = 8) {
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
function _cylinder(out, slot, x, y, z, r, h, c, n = 24) {
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

const MEANS = {
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  rawlimestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  road: [1, 1, 1],
};
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function ribbon(out, slot, points, height, color) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      p = [
        [a[0], a[1] - height / 2, a[2]],
        [b[0], b[1] - height / 2, b[2]],
        [b[0], b[1] + height / 2, b[2]],
        [a[0], a[1] + height / 2, a[2]],
      ];
    quad(out, slot, p, normalFor(...p), color);
    quad(out, slot, p.toReversed(), normalFor(...p.toReversed()), color);
  }
}
function cutwater(x, y, w, length, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-i / n) * Math.PI * 2;
    return [x + Math.cos(a) * w, y, Math.sin(a) * w + Math.sign(Math.sin(a)) * (length / 2 - w)];
  });
}
function archWindow(out, x, y, z, width, height, n) {
  const r = width / 2,
    spring = y + height - r,
    xy = [
      [x - r, y],
      [x + r, y],
      ...samples(n, (t) => [x + r * Math.cos(t * Math.PI), spring + r * Math.sin(t * Math.PI)]),
    ];
  extrude(out, 'iron', xy, z, z + 0.035, [0.13, 0.145, 0.13]);
  if (n > 3)
    line(
      out,
      'rawlimestone',
      [
        [x - r, y, z + 0.045],
        [x - r, spring, z + 0.045],
        ...samples(n, (t) => [
          x - r * Math.cos(t * Math.PI),
          spring + r * Math.sin(t * Math.PI),
          z + 0.045,
        ]),
        [x + r, y, z + 0.045],
      ],
      0.065,
      trim,
    );
}
function crown(out, x, y, z, w, d, tier) {
  box(
    out,
    'rawlimestone',
    [x - w / 2 - 0.16, y, z - d / 2 - 0.16],
    [x + w / 2 + 0.16, y + 0.27, z + d / 2 + 0.16],
    trim,
  );
  if (tier < 3) {
    box(
      out,
      'rawlimestone',
      [x - w / 2, y + 0.25, z - d / 2],
      [x + w / 2, y + 1.1, z + d / 2],
      pale,
    );
    return;
  }
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const wall = transform(out, angle, [x, y, z]),
      n = tier === 2 ? 2 : Math.max(2, Math.round(w / 1.8));
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + ((i + 0.5) * w) / n,
        hw = w / n / 2;
      extrude(
        wall,
        'rawlimestone',
        [
          [u - hw, 0.27],
          ...samples(tier === 2 ? 3 : 6, (t) => [
            u - hw + 2 * hw * t,
            0.8 + 0.3 * Math.cos(2 * Math.PI * t),
          ]),
          [u + hw, 0.27],
        ],
        d / 2 - 0.1,
        d / 2 + 0.13,
        pale,
      );
      if (tier === 3 && i === 0)
        sphere(wall, 'rawlimestone', [u, 0.98, d / 2], [0.12, 0.12, 0.12], trim, 6, 3);
    }
  }
}
function bankTower(out, bank, side, tier) {
  const way = frame.geometry.bankStructures.find(
      (p) =>
        p.osmWay ===
        (bank < 0 ? (side < 0 ? '331948054' : '331948055') : side < 0 ? '331948810' : '331948809'),
    ),
    p = way.points,
    lo = [0, 1].map((i) => Math.min(...p.map((p) => p[i]))),
    hi = [0, 1].map((i) => Math.max(...p.map((p) => p[i]))),
    x = bank < 0 ? lo[0] + 2.25 : hi[0] - 2.25,
    inner = bank < 0 ? hi[0] : lo[0],
    z = (lo[1] + hi[1]) / 2,
    y = road(bank * 251.87) + 0.2,
    base = bank < 0 ? 9.1 : 9.5,
    a = Math.min(x - 2.225, inner),
    b = Math.max(x + 2.225, inner);
  box(out, 'stone', [a, base, z - 2.2], [b, y - 0.3, z + 2.2], stone);
  box(out, 'rawlimestone', [x - 2.225, y, z - 2.2], [x + 2.225, y + 13.8, z + 2.2], pale);
  box(
    out,
    'rawlimestone',
    [Math.min(x, inner), y, z - 2.2],
    [Math.max(x, inner), y + 5, z + 2.2],
    pale,
  );
  if (tier > 1) {
    for (const yy of [y - 0.35, y, y + 11.1, y + 13.5])
      box(
        out,
        'rawlimestone',
        [yy > y + 5 ? x - 2.35 : a - 0.1, yy, z - 2.35],
        [yy > y + 5 ? x + 2.35 : b + 0.1, yy + 0.15, z + 2.35],
        trim,
      );
    for (const s of [-1, 1]) {
      const wall = transform(out, s < 0 ? Math.PI : 0, [x, y, z + s * 2.2]);
      for (const yy of [2.9, 6.5]) archWindow(wall, 0, yy, 0.025, 0.6, 1.55, tier === 2 ? 2 : 6);
      ringXY(wall, 'rawlimestone', 0, 10.16, 0.07, 0.36, 0.36, 0.06, trim, tier < 3 ? 6 : 12);
      for (let j = 0; j < 3; j++) {
        const u = x - bank * (3.15 + j * 2.15);
        if (u > a + 0.35 && u < b - 0.35)
          archWindow(
            transform(out, s < 0 ? Math.PI : 0, [u, y, z + s * 2.2]),
            0,
            1.08,
            0.025,
            1.18,
            2.55,
            tier === 2 ? 2 : 6,
          );
      }
    }
    if (tier > 1)
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const wall = transform(out, angle, [x, y + 11.1, z]);
        for (const u of [-1.28, 0, 1.28])
          archWindow(wall, u, 0.34, 2.225, 0.56, 1.62, tier === 2 ? 2 : 6);
      }
  }
  if (tier === 0)
    box(out, 'rawlimestone', [x - 2.4, y + 13.8, z - 2.4], [x + 2.4, y + 14.8, z + 2.4], trim);
  else {
    crown(out, x, y + 13.78, z, 4.8, 4.75, tier);
    crown(out, (x + inner) / 2, y + 5, z, Math.abs(x - inner), 4.4, tier);
  }
  const stair = frame.geometry.bankStructures.find(
      (p) =>
        p.osmWay ===
        (bank < 0 ? (side < 0 ? '589900430' : '589900431') : side < 0 ? '589204906' : '589204912'),
    ),
    sp = stair.points,
    sl = [0, 1].map((i) => Math.min(...sp.map((p) => p[i]))),
    sh = [0, 1].map((i) => Math.max(...sp.map((p) => p[i]))),
    cx = (sl[0] + sh[0]) / 2,
    cz = (sl[1] + sh[1]) / 2,
    r = Math.min(sh[0] - sl[0], sh[1] - sl[1]) / 2,
    n = [1, 3, 6, 18][tier],
    total = bank * side * Math.PI,
    start = (-side * Math.PI) / 2 - total;
  for (let i = 0; i < n; i++) {
    const aa = start + (i / n) * total,
      bb = start + ((i + 1) / n) * total,
      h = base + ((y - base) * (i + 1)) / n,
      ring = (rr, angle) => [cx + rr * Math.cos(angle), h, cz + rr * Math.sin(angle)],
      q = [ring(0.05, aa), ring(r - 0.24, aa), ring(r - 0.24, bb), ring(0.05, bb)];
    if (normalFor(...q)[1] < 0) q.reverse();
    loft(out, 'rawlimestone', [q.map((p) => [p[0], base, p[2]]), q], pale);
    if (tier > 0)
      for (const rr of [r, r - 1.85])
        beam(
          out,
          'rawlimestone',
          [cx + rr * Math.cos(aa), h + 0.63, cz + rr * Math.sin(aa)],
          [cx + rr * Math.cos(bb), h + 0.63, cz + rr * Math.sin(bb)],
          0.27,
          1.2,
          pale,
        );
  }
}
function build(out, tier) {
  const w = writer(out, tier === 0),
    curve = [3, 4, 6, 12][tier],
    ribs =
      tier < 2
        ? [-9.45, 9.45]
        : tier === 2
          ? [-9.45, 0, 9.45]
          : Array.from({ length: 7 }, (_, i) => -9.45 + i * 3.15),
    n = [4, 8, 20, 40][tier];
  for (let i = 0; i < n; i++) {
    const a = ends[0] + (503.74 * i) / n,
      b = ends[0] + (503.74 * (i + 1)) / n;
    loft(
      w,
      'concrete',
      [
        [
          [a, road(a) - 0.7, -halfWidth],
          [a, road(a) - 0.7, halfWidth],
          [a, road(a), halfWidth],
          [a, road(a), -halfWidth],
        ],
        [
          [b, road(b) - 0.7, -halfWidth],
          [b, road(b) - 0.7, halfWidth],
          [b, road(b), halfWidth],
          [b, road(b), -halfWidth],
        ],
      ],
      [0.55, 0.55, 0.52],
    );
    quad(
      w,
      'road',
      [
        [a, road(a) + 0.015, -9.7],
        [a, road(a) + 0.015, 9.7],
        [b, road(b) + 0.015, 9.7],
        [b, road(b) + 0.015, -9.7],
      ],
      [0, 1, 0],
      [0.15, 0.16, 0.16],
    );
    for (const z of [-12.25, 12.25])
      beam(
        w,
        'iron',
        [a, road(a) - 0.25, z],
        [b, road(b) - 0.25, z],
        0.28,
        0.55,
        [0.5, 0.19, 0.145],
      );
  }
  for (let span = 0; span < 8; span++) {
    const a = stations[span] + (span ? 2.2 : 0.6),
      b = stations[span + 1] - (span < 7 ? 2.2 : 0.6),
      outer = span < 2 || span > 5,
      shoulder = outer ? 5.8 : 5.1,
      top = (x) => road(x) - 1.05,
      bottom = (t) => shoulder + (top(a + (b - a) * t) - shoulder - 0.65) * 4 * t * (1 - t);
    for (const z of ribs) {
      const points = samples(curve, (t) => [a + (b - a) * t, outer ? shoulder : bottom(t), z]);
      if (tier < 2) ribbon(w, 'iron', points, 0.9, iron);
      else line(w, 'iron', points, 0.27, iron);
      if (tier > 0) {
        beam(w, 'iron', [a, top(a), z], [b, top(b), z], 0.28, 0.35, iron);
        const bays = tier === 1 ? 2 : tier === 2 ? 4 : Math.round((b - a) / 4.1);
        for (let i = 0; i <= bays; i++) {
          const t = i / bays,
            x = a + (b - a) * t,
            y = outer ? shoulder : bottom(t);
          beam(w, 'iron', [x, y, z], [x, top(x), z], 0.12, 0.12, iron);
          if (outer && i < bays) {
            const next = x + (b - a) / bays;
            beam(w, 'iron', [x, top(x), z], [next, shoulder, z], 0.16, 0.16, iron);
          }
        }
      }
    }
    if (tier > 1)
      for (let i = 0; i <= curve; i++) {
        const t = i / curve,
          x = a + (b - a) * t;
        beam(w, 'iron', [x, top(x), -9.45], [x, top(x), 9.45], 0.22, 0.38, iron);
        if (tier === 3)
          beam(
            w,
            'iron',
            [x, outer ? shoulder : bottom(t), -9.45],
            [x, outer ? shoulder : bottom(t), 9.45],
            0.14,
            0.14,
            iron,
          );
      }
  }
  pierX.forEach((x, i) => {
    const full = [0, 1, 5, 6].includes(i),
      cap = full ? 5.4 : 4.65,
      segments = [6, 8, 12, 24][tier],
      rings = [cutwater(x, 0, 3.08, 29.6, segments), cutwater(x, cap, 2.97, 29.3, segments)];
    if (full)
      rings.push(
        cutwater(x, road(x) - 0.75, 1.93, 25.7, segments),
        cutwater(x, road(x), 2.58, 26.6, segments),
      );
    loft(w, 'stone', rings, stone);
    if (!full && tier > 0)
      for (const z of ribs)
        box(w, 'iron', [x - 0.35, cap, z - 0.25], [x + 0.35, road(x) - 0.7, z + 0.25], iron);
    if (full && tier > 1)
      for (const sign of [-1, 1]) {
        const local = transform(w, sign < 0 ? Math.PI : 0, [x, road(x), sign * 12.5]);
        extrude(
          local,
          'stone',
          [
            [-2.35, 0],
            [-2.35, 1.45],
            [-1.5, 1.98],
            [-0.8, 2.23],
            [0.8, 2.23],
            [1.5, 1.98],
            [2.35, 1.45],
            [2.35, 0],
          ],
          -0.65,
          0.15,
          stone,
        );
        // Eight distinct shield impressions retain the bench positions; detailed figures live in the master.
        extrude(
          local,
          'iron',
          [
            [-0.55, 0.65],
            [-0.6, 1.5],
            [0, 1.78],
            [0.6, 1.5],
            [0.55, 0.65],
            [0, 0.4],
          ],
          0.16,
          0.23,
          [0.23, 0.3, 0.29],
        );
        if (tier === 3) {
          const marks = i === 0 || i === 6 ? 2 : i === 1 ? 3 : 4;
          for (let j = 0; j < marks; j++)
            beam(
              local,
              'iron',
              [-0.35 + j * 0.2, 0.7, 0.245],
              [0.18 - j * 0.08, 1.48, 0.245],
              0.045,
              0.04,
              iron,
            );
        }
      }
  });
  for (const side of [-1, 1]) {
    const z = side * 12.18,
      bays = [4, 6, 8, 28][tier];
    for (let i = 0; i < bays; i++) {
      const x = ends[0] + (503.74 * i) / bays,
        e = ends[0] + (503.74 * (i + 1)) / bays;
      beam(w, 'iron', [x, road(x) + 1.1, z], [e, road(e) + 1.1, z], 0.055, 0.055, darkIron);
      if (tier > 0)
        box(
          w,
          'iron',
          [x - 0.06, road(x), z - 0.06],
          [x + 0.06, road(x) + 1.15, z + 0.06],
          darkIron,
        );
      if (tier > 1) {
        beam(w, 'iron', [x, road(x) + 0.18, z], [e, road(e) + 0.18, z], 0.04, 0.04, darkIron);
        ringXY(
          w,
          'iron',
          (x + e) / 2,
          road((x + e) / 2) + 0.65,
          z,
          (e - x) * 0.35,
          0.35,
          0.018,
          darkIron,
          tier === 2 ? 6 : 12,
        );
      }
    }
  }
  if (tier > 0) {
    for (let x = -240; x <= 240; x += 40) {
      const y = road(x);
      for (const side of [-1, 1]) {
        beam(w, 'iron', [x, y, side * 10.1], [x, y + 7.2, side * 10.1], 0.13, 0.13, darkIron);
        beam(
          w,
          'iron',
          [x, y + 6.9, side * 10.1],
          [x, y + 6.9, side * 1.8],
          0.075,
          0.075,
          darkIron,
        );
      }
    }
    for (const z of [-1.8, 1.8])
      line(
        w,
        'iron',
        samples(16, (t) => {
          const x = -251.87 + 503.74 * t;
          return [x, road(x) + 5.7, z];
        }),
        0.015,
        darkIron,
      );
    if (tier > 1)
      for (const z of [-3.9, -2.465, 2.465, 3.9])
        line(
          w,
          'iron',
          samples(40, (t) => {
            const x = -251.87 + 503.74 * t;
            return [x, road(x) + 0.06, z];
          }),
          0.035,
          iron,
        );
  }
  for (const bank of [-1, 1]) for (const side of [-1, 1]) bankTower(w, bank, side, tier);
}
export const buildPoniatowskiSkyline = (out) => build(out, 0);
export const buildPoniatowskiDistrict = (out) => build(out, 1);
export const buildPoniatowskiStreet = (out) => build(out, 2);
export const buildPoniatowskiCloseup = (out) => build(out, 3);
