/** Surviving Brisbane Windmill Tower, original native base and signal-station crown. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/r7/r7h/the_old_windmill_brisbane/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    render: rgb('c6c4b6'),
    stone: rgb('c0bba9'),
    timber: rgb('c3b990'),
    iron: rgb('754d49'),
    roof: rgb('66736a'),
    copper: rgb('4d6257'),
    glass: rgb('485c53'),
  };
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.99, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.2 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.85, metallic: 0.5 },
  glass: { slot: 'window', localRef: ref, roughness: 0.7, metallic: 0 },
};
function tri(o, s, p, n, color = C[s]) {
  p = p.map((q) => q.map(Math.fround));
  const nn = normalFor(...p);
  if (n && nn.reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    color,
  );
}
function Q(o, s, p, n, color) {
  tri(o, s, [p[0], p[1], p[2]], n, color);
  tri(o, s, [p[0], p[2], p[3]], n, color);
}
const area = (r) =>
    r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - p[1] * r[(i + 1) % r.length][0], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
const ring = cw(plan.outline),
  scale = (y) =>
    y <= 3.19 ? 1 - (y * 0.11) / 3.19 : y <= 10.5 ? 0.89 - ((y - 3.19) * 0.32) / 7.31 : 0.57;
function face(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]],
    c = a.map((v, k) => (v + b[k]) / 2);
  return {
    len,
    u,
    n,
    c,
    P: (x, y, z = 0) => [
      c[0] * scale(y) + u[0] * x + n[0] * z,
      y,
      c[1] * scale(y) + u[1] * x + n[2] * z,
    ],
  };
}
const faces = ring.map((a, i) => face(a, ring[(i + 1) % ring.length]));
function nearestFace(angle) {
  const v = [Math.sin(angle), Math.cos(angle)];
  return faces.reduce(
    (best, f, i) =>
      f.n[0] * v[0] + f.n[2] * v[1] > best.dot ? { i, dot: f.n[0] * v[0] + f.n[2] * v[1] } : best,
    { i: 0, dot: -Infinity },
  ).i;
}
const entrance = nearestFace(0),
  casements = [
    { i: entrance, y: 5.65, w: 0.9, h: 1.65 },
    { i: nearestFace(Math.PI), y: 2.0, w: 0.88, h: 1.6 },
    { i: nearestFace(Math.PI), y: 6.7, w: 0.88, h: 1.65 },
    { i: nearestFace(Math.PI / 2), y: 8.7, w: 0.75, h: 1.55 },
    { i: nearestFace(-Math.PI / 2), y: 8.7, w: 0.75, h: 1.55 },
  ],
  upperFaces = new Set(Array.from({ length: 6 }, (_, i) => nearestFace((i * Math.PI) / 3)));
function panel(o, s, r, holes, f, z = 0, color) {
  const all = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((v, q) => v + q.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
      color,
    );
}
function reveal(o, s, r, f, front, back) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
function trim(o, r, f, d) {
  const xs = r.map((p) => p[0]),
    ys = r.map((p) => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys),
    a = Math.min(...xs),
    b = Math.max(...xs),
    z = 0.035;
  if (d > 1) {
    for (const x of [a - 0.055, b + 0.055])
      beam(o, 'timber', f.P(x, lo, z), f.P(x, hi, z), 0.08, 0.075, C.timber);
    for (const y of [lo - 0.035, hi + 0.035])
      beam(o, 'timber', f.P(a - 0.1, y, z), f.P(b + 0.1, y, z), 0.1, 0.09, C.timber);
  } else {
    for (const x of [a - 0.055, b + 0.055])
      panel(o, 'timber', rect(x, lo, 0.085, hi - lo), [], f, z);
    for (const y of [lo, hi])
      panel(o, 'timber', rect((a + b) / 2, y, b - a + 0.16, 0.075), [], f, z);
  }
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function roundRing(n, r, c = [0, 0]) {
  return Array.from({ length: n }, (_, i) => [
    c[0] + r * Math.sin((i * 2 * Math.PI) / n),
    c[1] + r * Math.cos((i * 2 * Math.PI) / n),
  ]);
}
function loft(o, s, r0, r1, y0, y1, outward = 1) {
  for (let i = 0; i < r0.length; i++) {
    const k = (i + 1) % r0.length;
    Q(
      o,
      s,
      [
        [r0[i][0], y0, r0[i][1]],
        [r0[k][0], y0, r0[k][1]],
        [r1[k][0], y1, r1[k][1]],
        [r1[i][0], y1, r1[i][1]],
      ],
      [(r0[i][0] + r0[k][0]) * outward, 0, (r0[i][1] + r0[k][1]) * outward],
    );
  }
}
function ribbon(o, s, r, y, half, n) {
  const a = roundRing(n, r - half),
    b = roundRing(n, r + half);
  loft(o, s, b, b, y - half, y + half);
  loft(o, s, a, a, y + half, y - half, -1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [
        [a[i][0], y + half, a[i][1]],
        [b[i][0], y + half, b[i][1]],
        [b[j][0], y + half, b[j][1]],
        [a[j][0], y + half, a[j][1]],
      ],
      [0, 1, 0],
    );
  }
}
function ringBand(o, s, factor, y, h, out = 0.018) {
  const a = ring.map((q) => q.map((v) => v * factor)),
    b = ring.map((q) => {
      const l = Math.hypot(...q);
      return q.map((v) => v * factor + (v / l) * out);
    });
  loft(o, s, b, b, y, y + h);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    Q(
      o,
      s,
      [
        [a[i][0], y + h, a[i][1]],
        [b[i][0], y + h, b[i][1]],
        [b[j][0], y + h, b[j][1]],
        [a[j][0], y + h, a[j][1]],
      ],
      [0, 1, 0],
    );
  }
}
function masonry(o, d) {
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i],
      lights = casements.filter((w) => w.i === i),
      door = i === entrance ? { y: 0.15, w: 1.15, h: 2.4 } : null,
      openings = [...lights, ...(door ? [door] : [])];
    for (const [lo, hi] of [
      [0, 3.19],
      [3.19, 10.5],
      [10.5, 13.35],
    ]) {
      const r = [
          [(-f.len * scale(lo)) / 2, lo],
          [(f.len * scale(lo)) / 2, lo],
          [(f.len * scale(hi)) / 2, hi],
          [(-f.len * scale(hi)) / 2, hi],
        ],
        holes =
          d > 1
            ? openings
                .filter((w) => w.y < hi && w.y + w.h > lo)
                .map((w) => {
                  const bottom = Math.max(lo, w.y),
                    top = Math.min(hi, w.y + w.h);
                  return rect(0, bottom, w.w, top - bottom);
                })
            : [];
      if (lo === 10.5 && upperFaces.has(i) && d > 1)
        holes.push(rect(0, 10.9, f.len * 0.57 - 0.16, 1.8));
      panel(o, 'render', r, holes, f);
    }
    for (const w of openings) {
      const r = rect(0, w.y, w.w, w.h),
        isDoor = w === door,
        back = isDoor ? -0.32 : -0.28;
      if (d > 1) {
        reveal(o, 'stone', r, f, 0, back);
        panel(o, isDoor ? 'timber' : 'glass', r, [], f, back);
      } else if (d) panel(o, isDoor ? 'timber' : 'glass', r, [], f, 0.018);
      if (d) {
        trim(o, r, f, d);
        panel(o, 'stone', rect(0, w.y + w.h + 0.1, w.w + 0.28, 0.12), [], f, 0.055);
      }
      if (d > 1 && !isDoor) {
        beam(o, 'timber', f.P(0, w.y, -0.2), f.P(0, w.y + w.h, -0.2), 0.045, 0.045, C.timber);
        for (const y of [w.y + w.h / 3, w.y + (w.h * 2) / 3])
          beam(o, 'timber', f.P(-w.w / 2, y, -0.2), f.P(w.w / 2, y, -0.2), 0.04, 0.045, C.timber);
      }
      if (d > 1 && isDoor) {
        beam(
          o,
          'timber',
          f.P(0, w.y, back + 0.03),
          f.P(0, w.y + w.h, back + 0.03),
          0.045,
          0.035,
          C.timber,
        );
        if (d > 2)
          for (const x of [-0.28, 0.28])
            for (const y of [0.45, 1.5]) {
              panel(o, 'timber', rect(x, y, 0.38, 0.8), [], f, back + 0.027);
              reveal(o, 'timber', rect(x, y, 0.38, 0.8), f, back + 0.027, back + 0.005);
            }
      }
    }
    if (upperFaces.has(i)) {
      const r = rect(0, 10.9, f.len * 0.57 - 0.16, 1.8),
        h = rect(0, 11.65, 0.24, 0.33);
      if (d > 1) {
        reveal(o, 'render', r, f, 0, -0.055);
        panel(o, 'render', r, [h], f, -0.055);
        reveal(o, 'stone', h, f, -0.055, -0.32);
        panel(o, 'glass', h, [], f, -0.32);
      } else if (d) {
        panel(o, 'stone', r, [], f, 0.012);
        panel(o, 'glass', h, [], f, 0.02);
      }
    }
    if (d > 2)
      for (let y = 0.42; y < 10.5; y += 0.35) {
        let spans = [[(-f.len * scale(y)) / 2, (f.len * scale(y)) / 2]];
        for (const w of openings)
          if (y >= w.y - 0.04 && y <= w.y + w.h + 0.04)
            spans = spans.flatMap(([a, b]) =>
              [
                [a, Math.min(b, -w.w / 2 - 0.06)],
                [Math.max(a, w.w / 2 + 0.06), b],
              ].filter(([a, b]) => b - a > 0.03),
            );
        for (const [a, b] of spans)
          panel(o, 'render', rect((a + b) / 2, y, b - a, 0.012), [], f, 0.007, rgb('b7b5a8'));
      }
  }
  cap(o, 'render', ring, 0, false);
  cap(
    o,
    'render',
    ring.map((p) => p.map((v) => v * 0.57)),
    13.35,
  );
  ringBand(o, 'render', scale(3.19), 3.17, 0.08, 0.055);
  if (d) ringBand(o, 'render', scale(0.2), 0.18, 0.09, 0.04);
}
function crown(o, d) {
  const n = [14, 28, 42, 56][d],
    r = roundRing(n, 3.02);
  loft(o, 'roof', r, r, 13.33, 13.55);
  cap(o, 'roof', r, 13.55);
  cap(o, 'roof', r, 13.33, false);
  const brackets = d ? 18 : 7;
  for (let i = 0; i < brackets; i++) {
    const a = (i * 2 * Math.PI) / brackets,
      P = (radius, y) => [radius * Math.sin(a), y, radius * Math.cos(a)];
    if (d > 1) {
      const f = {
          P: (x, y, z) => [
            (2.4 + x) * Math.sin(a) + Math.cos(a) * z,
            y,
            (2.4 + x) * Math.cos(a) - Math.sin(a) * z,
          ],
          n: [Math.cos(a), 0, -Math.sin(a)],
        },
        shape = [
          [0, 12.65],
          [0.15, 12.65],
          [0.26, 13.02],
          [0.6, 13.23],
          [0.6, 13.35],
          [0, 13.35],
        ];
      panel(o, 'timber', shape, [], f, 0.075);
      panel(o, 'timber', shape, [], f, -0.075);
      reveal(o, 'timber', shape, f, 0.075, -0.075);
    } else Q(o, 'timber', [P(2.35, 12.8), P(2.5, 12.8), P(2.94, 13.3), P(2.35, 13.3)]);
  }
  if (!d) {
    for (const y of [13.62, 14.7]) loft(o, 'iron', r, r, y, y + 0.045);
    for (let i = 0; i < 14; i++) {
      const a = (i * 2 * Math.PI) / 14,
        u = [Math.cos(a) * 0.035, -Math.sin(a) * 0.035],
        p = [3.02 * Math.sin(a), 3.02 * Math.cos(a)];
      Q(o, 'iron', [
        [p[0] - u[0], 13.55, p[1] - u[1]],
        [p[0] + u[0], 13.55, p[1] + u[1]],
        [p[0] + u[0], 14.75, p[1] + u[1]],
        [p[0] - u[0], 14.75, p[1] - u[1]],
      ]);
    }
  } else {
    for (const y of [13.64, 14.7]) ribbon(o, 'iron', 3.0, y, 0.024, n);
    const count = d === 1 ? 24 : 36;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count,
        P = (x, y) => [Math.sin(a) * 3 + Math.cos(a) * x, y, Math.cos(a) * 3 - Math.sin(a) * x];
      if (d > 1) beam(o, 'iron', P(0, 13.55), P(0, 14.73), 0.035, 0.035, C.iron);
      else Q(o, 'iron', [P(-0.02, 13.55), P(0.02, 13.55), P(0.02, 14.73), P(-0.02, 14.73)]);
      const points = Array.from({ length: d === 1 ? 7 : 11 }, (_, j) => {
        const t = (j / (d === 1 ? 6 : 10)) * 2 * Math.PI;
        return P(0.11 * Math.sin(t), 14.16 + 0.46 * Math.cos(t));
      });
      for (let j = 1; j < points.length; j++) {
        if (d > 1) beam(o, 'iron', points[j - 1], points[j], 0.022, 0.024, C.iron);
        else {
          const p = points[j - 1],
            q = points[j],
            v = [Math.cos(a) * 0.011, 0, -Math.sin(a) * 0.011];
          Q(o, 'iron', [
            p.map((w, k) => w - v[k]),
            p.map((w, k) => w + v[k]),
            q.map((w, k) => w + v[k]),
            q.map((w, k) => w - v[k]),
          ]);
        }
      }
    }
  }
  // The cabin is a separate hexagon, leaving the observation walk open all around.
  const c = [0, -0.4],
    cab = cw(roundRing(6, 1.48, c));
  for (let i = 0; i < 6; i++) {
    const a = cab[i],
      b = cab[(i + 1) % 6],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = b.map((v, k) => (v - a[k]) / len),
      f = {
        n: [-u[1], 0, u[0]],
        P: (x, y, z = 0) => [a[0] + u[0] * x - u[1] * z, y, a[1] + u[1] * x + u[0] * z],
      },
      window = rect(len / 2, 14.18, len - 0.24, 1.25),
      outer = rect(len / 2, 13.55, len, 2.07);
    panel(o, 'timber', outer, d > 1 ? [window] : [], f);
    if (d) {
      if (d > 1) {
        reveal(o, 'timber', window, f, 0, -0.085);
        panel(o, 'glass', window, [], f, -0.085);
      } else panel(o, 'glass', window, [], f, 0.015);
      for (const x of [len * 0.5, len * 0.25, len * 0.75])
        if (d > 1)
          beam(o, 'timber', f.P(x, 14.18, -0.035), f.P(x, 15.43, -0.035), 0.045, 0.045, C.timber);
      if (d > 1)
        beam(
          o,
          'timber',
          f.P(0.1, 14.75, -0.035),
          f.P(len - 0.1, 14.75, -0.035),
          0.045,
          0.04,
          C.timber,
        );
    }
    if (d > 2)
      for (let y = 13.68; y < 14.15; y += 0.12)
        panel(o, 'timber', rect(len / 2, y, len, 0.025), [], f, 0.012);
  }
  const eave = cw(roundRing(6, 1.66, c)),
    top = cw(roundRing(6, 0.15, c));
  loft(o, 'roof', eave, top, 15.64, 16);
  cap(o, 'roof', top, 16);
  if (d) loft(o, 'timber', eave, eave, 15.58, 15.64);
  const ball = [0, 16.82, -0.4];
  sphere(o, 'copper', ball, [0.68, 0.68, 0.68], C.copper, [8, 16, 24, 32][d], [6, 8, 12, 16][d]);
  const mast = roundRing(d ? 12 : 6, 0.075, c);
  loft(o, 'timber', mast, mast, 15.95, 20);
  cap(o, 'timber', mast, 20);
  if (d > 1) {
    beam(o, 'iron', [0.13, 16, -0.4], [0.13, 19.95, -0.4], 0.018, 0.018, C.iron);
    if (d > 2)
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 6;
        beam(
          o,
          'copper',
          [0.677 * Math.sin(a), 16.8, -0.4 + 0.677 * Math.cos(a)],
          [0.677 * Math.sin(a), 16.85, -0.4 + 0.677 * Math.cos(a)],
          0.014,
          0.012,
          C.copper,
        );
      }
  }
}
function build(o, _f, d = 3) {
  masonry(o, d);
  crown(o, d);
}
export const oldWindmillSkyline = (o, f) => build(o, f, 0);
export const oldWindmillDistrict = (o, f) => build(o, f, 1);
export const oldWindmillStreet = (o, f) => build(o, f, 2);
export const oldWindmillModel = {
  id: 'the_old_windmill_brisbane',
  key: 'the_old_windmill_brisbane',
  recipe: 'structure-old-windmill-brisbane.mjs',
  cell: 'r7/r7h',
  title: 'The Old Windmill, Brisbane',
  category: 'historic-windmill',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving rendered tapered windmill/signal tower on its full native base; real casement and entrance recesses/drip moulds, six framed upper apertures, circular cantilevered balcony/timber corbels/open loop iron railing, offset hexagonal glazed cabin/low metal roof, patinated copper time ball and mast. No historical sails, treadmill or neighboring park structures.',
  camera: [23, 15, 30],
  lookAt: [0, 9, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.7, groundY: -0.15 },
  qaCameras: [
    { name: 'whole-surviving-tower-and-time-ball', position: [18, 17, 26], lookAt: [0, 10, 0] },
    {
      name: 'recessed-double-door-casement-and-reefing-lip',
      position: [5, 4.7, 12],
      lookAt: [0, 3.8, 2.3],
    },
    {
      name: 'framed-upper-apertures-corbelled-balcony-open-loop-iron',
      position: [8, 12.4, 10],
      lookAt: [0, 12.8, 0],
    },
    {
      name: 'hexagonal-glazed-cabin-copper-time-ball-and-mast',
      position: [7, 17.7, 9],
      lookAt: [0, 16.1, -0.4],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent64m terrain frozen before geometry; exact wall foot/floor/threshold/host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-old-windmill-brisbane.mjs',
    level: 'skyline',
    export: 'oldWindmillSkyline',
    errorMeters: 0.75,
    surfaces,
    authoredLevels: {
      district: { export: 'oldWindmillDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'oldWindmillStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete surviving masonry tower and signal-station crown only. Full native14-vertex base retained; upper taper, minor panel dimensions and hidden aperture positions are estimates. No lost sails/treadmill, demolished cottages, reconstructed flagstaff/site wall/archway, reservoir roofs, nearby hotel, roads, cars, trees or interior.',
    'Two exact already-published Figaro2005 public-domain originals only, native SHA1/photographer and PD-user-en grant matched;28 source families inventoried. Historical/unknown-author/attribution/unrelated images unused, no supplemental photos/copied pixels/generated bitmap. Architectural text only supplies approximate16m roof height excluding ball/mast,8.4m base/4.5m top and five casements/six small upper windows/hexagonal offset cabin.',
    'Pale rendered mock ashlar masonry/reefing lip, closed double door and casements, small recessed upper lights, cantilevered platform/carved timber corbels/open red-brown iron loop railing, offset pale glazed cabin/chamferboards/metal hip roof and copper time ball/mast retained. Exact finish after2005, aperture angles, small roof facets, cabin offset, iron/corbel census, time-ball raised state and height are bounded exterior estimates; no surveyed interiors.',
    'Chosen street-facing entrance is an approximate visualization bearing, angular uncertainty60degrees, not a measured doorway azimuth. Original native tower/street positions remain. Fixed north/street-side approach[0,6.4] before independent64m129x129at0.5m field; provider59.8753m, full relative field[-12.3966,3.0033] retained without flattening/fitting. Exact host ground contact, threshold, steps and floors unverified; geographicpreview/replaceFootprint=false.',
  ],
};
