/** Whole Cape May Lighthouse; native base and entrance with original photographic upper sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  TAU = Math.PI * 2;
const C = {
  wall: rgb('e5e2cb'),
  trim: rgb('f1eddd'),
  red: rgb('823a3a'),
  rail: rgb('663034'),
  cap: rgb('963e3b'),
  glass: rgb('627d80'),
  door: rgb('344b48'),
  roof: rgb('707c70'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.08 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    baseColorFactor: [1, 1, 1, 1],
    roughness: 0.25,
    metallic: 0.1,
    alphaMode: 'OPAQUE',
  },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mean = (q) => q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length),
  norm = (a) => ((a % TAU) + TAU) % TAU,
  P = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r];
function T(o, k, q, n, col) {
  q = q.map((v) => [Math.fround(v[0]), Math.fround(v[1] + F), Math.fround(v[2])]);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) throw Error('Collapsed Cape May face');
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col ?? C.wall,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function solid(o, k, front, back, col) {
  const centre = mean([...front, ...back]),
    emit = (q) => T(o, k, q, sub(mean(q), centre), col);
  for (let i = 1; i < front.length - 1; i++) {
    emit([front[0], front[i], front[i + 1]]);
    emit([back[0], back[i + 1], back[i]]);
  }
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    emit([front[i], front[j], back[j]]);
    emit([front[i], back[j], back[i]]);
  }
}
function B(o, k, a, b, w, d, col) {
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
function lathe(o, k, profile, N, col) {
  for (let j = 0; j < profile.length - 1; j++) {
    const [y0, r0] = profile[j],
      [y1, r1] = profile[j + 1];
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N;
      Q(
        o,
        k,
        [P(a, y0, r0), P(b, y0, r0), P(b, y1, r1), P(a, y1, r1)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        col,
      );
    }
  }
  for (const [j, up] of [
    [0, -1],
    [profile.length - 1, 1],
  ]) {
    const [y, r] = profile[j];
    for (let i = 0; i < N; i++)
      T(o, k, [[0, y, 0], P((i * TAU) / N, y, r), P(((i + 1) * TAU) / N, y, r)], [0, up, 0], col);
  }
}
function ring(o, k, r, y, w, h, N, col) {
  const prof = [
    [y - h / 2, r - w / 2],
    [y - h / 2, r + w / 2],
    [y + h / 2, r + w / 2],
    [y + h / 2, r - w / 2],
  ];
  for (let j = 0; j < 4; j++) {
    const a = prof[j],
      b = prof[(j + 1) % 4];
    for (let i = 0; i < N; i++) {
      const t = (i * TAU) / N,
        u = ((i + 1) * TAU) / N,
        n =
          j === 0
            ? [0, -1, 0]
            : j === 2
              ? [0, 1, 0]
              : [
                  Math.cos((t + u) / 2) * (j === 3 ? -1 : 1),
                  0,
                  Math.sin((t + u) / 2) * (j === 3 ? -1 : 1),
                ];
      Q(o, k, [P(t, a[0], a[1]), P(u, a[0], a[1]), P(u, b[0], b[1]), P(t, b[0], b[1])], n, col);
    }
  }
}
const controls = p.nativeShaftControls
    .map(([x, z]) => ({ a: norm(Math.atan2(z, x)), r: Math.hypot(x, z) }))
    .sort((a, b) => a.a - b.a),
  entry = p.nativeEntryControls,
  entryOuter = mean(entry.slice(1, 4)),
  entryAngle = Math.atan2(entryOuter[1], entryOuter[0]);
function baseRadius(a) {
  a = norm(a);
  let j = controls.findIndex((q) => q.a > a);
  if (j < 0) j = 0;
  const b = controls[j],
    c = controls[(j + controls.length - 1) % controls.length],
    lo = c.a,
    hi = b.a + (b.a < lo ? TAU : 0),
    t = a + (a < lo ? TAU : 0);
  return c.r + ((b.r - c.r) * (t - lo)) / (hi - lo);
}
export function shaftRadius(a, y) {
  return baseRadius(a) + ((A.shaftTopRadius - baseRadius(a)) * y) / A.shaftTop;
}
export const windowEvidence = [],
  nativeBaseEvidence = [],
  bracketEvidence = [];
const windowPlan = [
  { a: entryAngle + Math.PI * 0.85, y0: 7.2, y1: 8.75 },
  { a: entryAngle + Math.PI * 0.85, y0: 30.4, y1: 31.95 },
  { a: entryAngle - Math.PI * 0.18, y0: 15.3, y1: 16.85 },
  { a: entryAngle + Math.PI * 0.32, y0: 23.1, y1: 24.65 },
  { a: entryAngle - Math.PI * 0.62, y0: 11.4, y1: 12.95 },
  { a: entryAngle + Math.PI * 0.36, y0: 35.2, y1: 36.75 },
].map((w) => ({ ...w, a: norm(w.a), da: 0.55 / shaftRadius(w.a, (w.y0 + w.y1) / 2) }));
function shaft(o, lod) {
  const windows = lod === 0 ? [] : windowPlan.slice(0, lod === 1 ? 4 : 6),
    angles = [
      0,
      ...controls.map((q) => q.a),
      ...Array.from({ length: [8, 20, 48, 96][lod] }, (_, i) => (i * TAU) / [8, 20, 48, 96][lod]),
      ...windows.flatMap((w) => [norm(w.a - w.da), norm(w.a + w.da)]),
    ]
      .sort((a, b) => a - b)
      .filter((a, i, s) => i === 0 || a - s[i - 1] > 1e-7);
  angles.push(TAU);
  const ys = [0, A.shaftTop, ...windows.flatMap((w) => [w.y0, w.y1])].sort((a, b) => a - b);
  const pt = (a, y, offset = 0) => P(a, y, shaftRadius(a, y) + offset);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1],
        y = ys[j],
        z = ys[j + 1],
        mid = (a + b) / 2;
      if (
        windows.some(
          (w) =>
            Math.abs(Math.atan2(Math.sin(mid - w.a), Math.cos(mid - w.a))) < w.da - 1e-8 &&
            (y + z) / 2 > w.y0 &&
            (y + z) / 2 < w.y1,
        )
      )
        continue;
      Q(
        o,
        'wall',
        [pt(a, y), pt(b, y), pt(b, z), pt(a, z)],
        [Math.cos(mid), 0.05, Math.sin(mid)],
        C.wall,
      );
    }
  for (const [y, up] of [
    [0, -1],
    [A.shaftTop, 1],
  ])
    for (let i = 0; i < angles.length - 1; i++)
      T(o, 'wall', [[0, y, 0], pt(angles[i], y), pt(angles[i + 1], y)], [0, up, 0]);
  for (const w of windows) {
    const a = w.a - w.da,
      b = w.a + w.da,
      front = [pt(a, w.y0), pt(b, w.y0), pt(b, w.y1), pt(a, w.y1)],
      back = [
        pt(a, w.y0, -A.windowDepth),
        pt(b, w.y0, -A.windowDepth),
        pt(b, w.y1, -A.windowDepth),
        pt(a, w.y1, -A.windowDepth),
      ],
      n = [Math.cos(w.a), 0, Math.sin(w.a)];
    Q(o, 'glass', back, n, C.glass);
    for (let k = 0; k < 4; k++) {
      const l = (k + 1) % 4;
      Q(
        o,
        'wall',
        [front[k], front[l], back[l], back[k]],
        sub(mean(front), mean([front[k], back[k]])),
        C.trim,
      );
      B(
        o,
        'wall',
        pt(k === 0 || k === 3 ? a : b, k < 2 ? w.y0 : w.y1, 0.025),
        pt(l === 0 || l === 3 ? a : b, l < 2 ? w.y0 : w.y1, 0.025),
        0.11,
        0.12,
        C.trim,
      );
    }
    B(
      o,
      'wall',
      pt(a, (w.y0 + w.y1) / 2, -0.12),
      pt(b, (w.y0 + w.y1) / 2, -0.12),
      0.06,
      0.075,
      C.trim,
    );
    if (lod === 3) B(o, 'wall', pt(w.a, w.y0, -0.12), pt(w.a, w.y1, -0.12), 0.045, 0.07, C.trim);
    windowEvidence.push({ ...w, front, back, depth: A.windowDepth });
  }
  for (const c of controls) nativeBaseEvidence.push(P(c.a, 0, c.r));
}
function entrance(o, lod) {
  const e = entry.map((q) => [q[0], 0, q[1]]),
    top = e.map((q) => [q[0], A.entryEave, q[2]]);
  solid(o, 'wall', top, e, C.wall);
  const u = [Math.cos(entryAngle), 0, Math.sin(entryAngle)],
    v = [-u[2], 0, u[0]],
    project = (q, axis) => q[0] * axis[0] + q[2] * axis[2],
    outer = Math.max(...top.map((q) => project(q, u))),
    inner = Math.min(...top.map((q) => project(q, u))),
    left = Math.min(...top.map((q) => project(q, v))),
    right = Math.max(...top.map((q) => project(q, v))),
    m = (left + right) / 2,
    E = (a, b, y) => [u[0] * a + v[0] * b, y, u[2] * a + v[2] * b];
  const g0 = [
      E(inner - 0.12, left - 0.15, A.entryEave),
      E(inner - 0.12, right + 0.15, A.entryEave),
      E(inner - 0.12, m, A.entryRidge),
    ],
    g1 = [
      E(outer + 0.16, left - 0.15, A.entryEave),
      E(outer + 0.16, right + 0.15, A.entryEave),
      E(outer + 0.16, m, A.entryRidge),
    ];
  solid(o, 'metal', g0, g1, C.roof);
  T(
    o,
    'wall',
    [
      E(outer + 0.12, left, A.entryEave),
      E(outer + 0.12, right, A.entryEave),
      E(outer + 0.12, m, A.entryRidge - 0.12),
    ],
    u,
    C.trim,
  );
  const door = [
      E(outer + 0.018, m - 0.56, 0.1),
      E(outer + 0.018, m + 0.56, 0.1),
      E(outer + 0.018, m + 0.56, 2.48),
      E(outer + 0.018, m - 0.56, 2.48),
    ],
    back = door.map((q) =>
      sub(
        q,
        u.map((t) => t * 0.14),
      ),
    );
  solid(o, 'metal', door, back, C.door);
  for (let i = 0; i < 3; i++) B(o, 'wall', door[i], door[i + 1], 0.14, 0.14, C.trim);
  if (lod > 0) {
    B(o, 'wall', door[3], door[0], 0.14, 0.14, C.trim);
    B(
      o,
      'metal',
      E(outer + 0.1, m + 0.35, 1.05),
      E(outer + 0.1, m + 0.35, 1.25),
      0.035,
      0.04,
      C.red,
    );
  }
  if (lod > 1)
    for (const y of [0.52, 1.32, 2.1])
      B(o, 'metal', E(outer + 0.04, m - 0.45, y), E(outer + 0.04, m + 0.45, y), 0.04, 0.05, C.door);
}
function lantern(o, lod) {
  const N = [8, 16, 32, 64][lod],
    railN = [8, 12, 24, 48][lod],
    brackets = [4, 8, 12, 16][lod];
  lathe(
    o,
    'wall',
    [
      [A.collarBottom, 2.47],
      [A.collarTop, 2.49],
    ],
    N,
    C.trim,
  );
  lathe(
    o,
    'wall',
    [
      [A.shaftTop - 0.24, 2.35],
      [A.galleryBottom, 2.78],
    ],
    N,
    C.trim,
  );
  lathe(
    o,
    'metal',
    [
      [A.galleryBottom, A.galleryRadius],
      [A.galleryTop, A.galleryRadius],
    ],
    N,
    C.red,
  );
  lathe(
    o,
    'metal',
    [
      [A.galleryTop, A.watchroomRadius],
      [A.watchroomTop, A.watchroomRadius],
    ],
    N,
    C.red,
  );
  for (let i = 0; i < brackets; i++) {
    const a = (i * TAU) / brackets,
      c = Math.cos(a),
      s = Math.sin(a),
      v = [-s, 0, c],
      front = [
        [2.3, 39.72],
        [2.85, 40.55],
        [3.1, 40.65],
        [2.32, 40.65],
      ].map(([r, y]) => [r * c + v[0] * 0.17, y, r * s + v[2] * 0.17]),
      back = front.map((q) =>
        sub(
          q,
          v.map((t) => t * 0.34),
        ),
      );
    solid(o, 'wall', front, back, C.trim);
    bracketEvidence.push({ angle: a, front, back });
  }
  for (const y of [A.galleryTop + 0.15, A.galleryTop + 1.43])
    ring(o, 'metal', A.galleryRadius - 0.06, y, 0.07, 0.075, railN, C.rail);
  for (let i = 0; i < railN; i++) {
    const a = (i * TAU) / railN;
    B(
      o,
      'metal',
      P(a, A.galleryTop, A.galleryRadius - 0.06),
      P(a, A.galleryTop + 1.43, A.galleryRadius - 0.06),
      0.055,
      0.055,
      C.rail,
    );
  }
  if (lod > 0) {
    const count = [0, 24, 80, 160][lod];
    for (let i = 0; i < count; i++) {
      const a = (i * TAU) / count;
      B(
        o,
        'metal',
        P(a, A.galleryTop + 0.13, A.galleryRadius - 0.065),
        P(a, A.galleryTop + 1.4, A.galleryRadius - 0.065),
        0.018,
        0.022,
        C.rail,
      );
    }
    for (let j = 1; j <= [0, 1, 4, 7][lod]; j++)
      ring(
        o,
        'metal',
        A.galleryRadius - 0.065,
        A.galleryTop + 0.13 + (j * 1.27) / ([0, 1, 4, 7][lod] + 1),
        0.018,
        0.02,
        railN,
        C.rail,
      );
  }
  lathe(
    o,
    'metal',
    [
      [A.watchroomTop - 0.12, 2.25],
      [A.watchroomTop + 0.05, 2.25],
    ],
    N,
    C.red,
  );
  lathe(
    o,
    'glass',
    [
      [A.watchroomTop + 0.03, A.lanternRadius],
      [A.lanternTop, A.lanternRadius],
    ],
    N,
    C.glass,
  );
  const panes = [8, 12, 16, 16][lod];
  for (let i = 0; i < panes; i++) {
    const a = (i * TAU) / panes;
    B(
      o,
      'metal',
      P(a, A.watchroomTop, A.lanternRadius + 0.025),
      P(a, A.lanternTop, A.lanternRadius + 0.025),
      0.06,
      0.07,
      C.red,
    );
  }
  if (lod > 0)
    for (const y of [A.watchroomTop + 1.06, A.watchroomTop + 2.12])
      ring(o, 'metal', A.lanternRadius + 0.025, y, 0.07, 0.055, N, C.red);
  if (lod > 0) {
    for (let i = 0; i < railN; i++) {
      const a = (i * TAU) / railN;
      B(
        o,
        'metal',
        P(a, A.watchroomTop, 2.17),
        P(a, A.watchroomTop + 1.05, 2.17),
        0.035,
        0.035,
        C.rail,
      );
    }
    ring(o, 'metal', 2.17, A.watchroomTop + 1.05, 0.045, 0.05, railN, C.rail);
  }
  lathe(
    o,
    'metal',
    [
      [A.lanternTop - 0.07, A.capRimRadius],
      [A.lanternTop + 0.08, A.capRimRadius],
      [A.capCrown, 0.22],
    ],
    N,
    C.cap,
  );
  lathe(
    o,
    'metal',
    [
      [A.capCrown, 0.15],
      [A.ventilatorBallTop - 0.38, 0.15],
    ],
    Math.min(N, 16),
    C.red,
  );
  sphere(
    o,
    'metal',
    [0, F + A.ventilatorBallTop - 0.19, 0],
    [0.19, 0.19, 0.19],
    C.red,
    [6, 10, 16, 24][lod],
    [4, 6, 8, 12][lod],
  );
  if (lod > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      const r = shaftRadius(a, 39.1) + 0.006,
        c = P(a, 39.1, r),
        v = [-Math.sin(a), 0, Math.cos(a)],
        pts = Array.from({ length: 12 }, (_, k) =>
          c.map(
            (t, j) =>
              t +
              v[j] * 0.09 * Math.cos((k * TAU) / 12) +
              (j === 1 ? 0.09 * Math.sin((k * TAU) / 12) : 0),
          ),
        );
      for (let k = 1; k < pts.length - 1; k++)
        T(o, 'metal', [pts[0], pts[k], pts[k + 1]], [Math.cos(a), 0, Math.sin(a)], C.door);
    }
  }
  if (lod > 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        da = 0.11;
      Q(
        o,
        'glass',
        [
          P(a - da, 41.5, A.watchroomRadius + 0.012),
          P(a + da, 41.5, A.watchroomRadius + 0.012),
          P(a + da, 42.5, A.watchroomRadius + 0.012),
          P(a - da, 42.5, A.watchroomRadius + 0.012),
        ],
        [Math.cos(a), 0, Math.sin(a)],
        C.glass,
      );
    }
}
export function buildCapeMayLighthouse(o, _frame, lod = 3) {
  windowEvidence.length = 0;
  nativeBaseEvidence.length = 0;
  bracketEvidence.length = 0;
  shaft(o, lod);
  entrance(o, lod);
  lantern(o, lod);
}
export const capeMayLighthouseSkyline = (o) => buildCapeMayLighthouse(o, null, 0),
  capeMayLighthouseDistrict = (o) => buildCapeMayLighthouse(o, null, 1),
  capeMayLighthouseStreet = (o) => buildCapeMayLighthouse(o, null, 2),
  capeMayLighthouseCloseup = (o) => buildCapeMayLighthouse(o, null, 3);
export const capeMayLighthouseModel = {
  id: 'cape_may_lighthouse',
  key: 'cape_may_lighthouse',
  cell: 'dq/dqf',
  title: 'Cape May Lighthouse',
  wikidataId: 'Q5034933',
  category: p.category,
  recipe: 'cape-may-lighthouse-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCapeMayLighthouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Cape May Lighthouse: native twenty-control pale conical masonry shaft-and-entrance footprint, actual recessed opaque sash windows/white frames, upper collar/small vents/physical radial support brackets, red watchroom and genuinely open gallery rails/mesh, glazed lantern with mullions/open upper rail, red roof and ventilator ball. Cleared published2013SmallbonesCC0 first plus explicit Highsmith public-domain official photo; no copied pixels. Operator48.006m overallground-to-ball height; all upper sections/window facing/hidden census/entryroof estimates. Separate keeperhouses/oilhouse/grounds/beach/bunker/interiors/art/signs/trees excluded. Native plan and original field retained; exact grade contact unverified.',
  camera: [65, 42, 73],
  lookAt: [0, 23, 0],
  portableGroundY: F - 0.14,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['stucco', 'metal_painted'],
  qaCameras: [
    { name: 'whole-opposite-tower-and-native-entry', position: [-68, 38, -70], lookAt: [0, 23, 0] },
    {
      name: 'red-gallery-brackets-open-mesh-and-lantern',
      position: [15, 46, 18],
      lookAt: [0, 43, 0],
    },
    {
      name: 'physical-recessed-sash-and-tapered-masonry',
      position: [-12, 31, -13],
      lookAt: [0, 30.8, 0],
    },
    {
      name: 'native-attached-entry-and-closed-door',
      position: [13, 6, 16],
      lookAt: [1.2, 2.2, 3.7],
    },
    { name: 'red-polygonal-cap-and-ventilator-ball', position: [7, 51, 8], lookAt: [0, 46.4, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/cape-may-lighthouse-runtime-overlay.mjs',
    level: 'skyline',
    export: 'capeMayLighthouseSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'capeMayLighthouseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'capeMayLighthouseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'capeMayLighthouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Exact published SmallbonesCC0 original and official HighsmithPD rendition individually inspected; native original/localSHA1 matched for published photo; Highsmith uses exact catalog-listed JPEG and existing explicit primary photographer public-domain dedication, not no-known-restrictions alone. NonPD, wrong-lighthouse, unbound-author/NARA imagery excluded; no source repair or policy changes. Upper architectural sections/hidden elevations/window census/facing/watchroom panel layout/entryroof/current finish original estimates. No photographic texture/artwork/inscriptions/interiors/grounds/people.',
    'Original independent256m129x12916641sample/four rawtiles/fixedSW2.4847m provider-relative datum frozen before all floors/sections/geometry. Native whole tower/entrance retained; no terrainfit/flatten/reacquire/modelraising. Exact construction ground/threshold contact unverified; geographic preview/replaceFootprint=false. Flat ground/synthetic neighbors are review fixtures.',
  ],
};
