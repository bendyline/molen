/** Current1900 Matiu/Somes lighthouse: native round masonry and attached entrance porch. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, beamPath, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/rb/rbs/matiu_somes_island_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
    white: rgb('d2d7cf'),
    frame: rgb('c6cec2'),
    roof: rgb('6d7972'),
    porchRoof: rgb('c9d1c8'),
    glass: rgb('47615e'),
  },
  surfaces = {
    white: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.1 },
    roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87, metallic: 0.25 },
    porchRoof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.91, metallic: 0.15 },
    glass: { slot: 'window', localRef: ref, roughness: 0.7, metallic: 0 },
  };
function tri(o, s, p, n, color = C[s]) {
  p = p.map((q) => q.map(Math.fround));
  if (n && normalFor(...p).reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
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
// Fit only the concealed continuation beneath the porch; every mapped arc point remains unchanged.
function circle(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])),
    sq = (p) => p[0] * p[0] + p[1] * p[1],
    x = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d,
    z = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d;
  return { c: [x, z], r: Math.hypot(a[0] - x, a[1] - z) };
}
const control = plan.outline,
  fit = circle(control[0], control[10], control[17]),
  center = fit.c,
  first = Math.atan2(control[0][0] - center[0], control[0][1] - center[1]),
  last = Math.atan2(control[3][0] - center[0], control[3][1] - center[1]);
let arc = last - first;
while (arc > 0) arc -= 2 * Math.PI;
while (arc < -Math.PI) arc += 2 * Math.PI;
const hidden = Array.from({ length: 4 }, (_, i) => {
    const a = first + (arc * (i + 1)) / 5;
    return [center[0] + fit.r * Math.sin(a), center[1] + fit.r * Math.cos(a)];
  }),
  tower = cw([control[0], ...hidden, ...control.slice(3)]),
  porch = cw(plan.porchFootprint);
function radial(n, r, c = center) {
  return Array.from({ length: n }, (_, i) => [
    c[0] + r * Math.sin((i * 2 * Math.PI) / n),
    c[1] + r * Math.cos((i * 2 * Math.PI) / n),
  ]);
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
function loft(o, s, r0, r1, y0, y1) {
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length;
    Q(
      o,
      s,
      [
        [r0[i][0], y0, r0[i][1]],
        [r0[j][0], y0, r0[j][1]],
        [r1[j][0], y1, r1[j][1]],
        [r1[i][0], y1, r1[i][1]],
      ],
      [r0[i][0] + r0[j][0] - 2 * center[0], 0, r0[i][1] + r0[j][1] - 2 * center[1]],
    );
  }
}
function cylinder(o, s, n, r, lo, hi, c = center) {
  const ring = radial(n, r, c);
  loft(o, s, ring, ring, lo, hi);
  cap(o, s, ring, lo, false);
  cap(o, s, ring, hi);
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = b.map((v, k) => (v - a[k]) / len),
    n = [-u[1], 0, u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, r, holes, f, z = 0) {
  const all = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((v, q) => v + q.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
function reveal(o, s, r, f, front, back) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
function trim(o, f, x, y, w, h, d) {
  if (d > 1) {
    for (const xx of [x - w / 2 - 0.035, x + w / 2 + 0.035])
      beam(o, 'frame', f.P(xx, y, 0.025), f.P(xx, y + h, 0.025), 0.075, 0.07, C.frame);
    for (const yy of [y - 0.025, y + h + 0.025])
      beam(
        o,
        'frame',
        f.P(x - w / 2 - 0.08, yy, 0.025),
        f.P(x + w / 2 + 0.08, yy, 0.025),
        0.075,
        0.07,
        C.frame,
      );
  } else {
    for (const xx of [x - w / 2 - 0.035, x + w / 2 + 0.035])
      panel(o, 'frame', rect(xx, y, 0.065, h), [], f, 0.018);
    for (const yy of [y, y + h]) panel(o, 'frame', rect(x, yy, w + 0.12, 0.065), [], f, 0.018);
  }
}
function base(o, d) {
  loft(o, 'white', tower, tower, 0, 5);
  cap(o, 'white', tower, 0, false);
  cap(o, 'white', tower, 5);
  if (d) {
    const expanded = tower.map((p) => {
      const l = Math.hypot(p[0] - center[0], p[1] - center[1]);
      return p.map((v, k) => v + ((v - center[k]) * 0.045) / l);
    });
    loft(o, 'white', expanded, expanded, 0.1, 0.22);
    cap(o, 'white', expanded, 0.22);
  }
  // Three external porch walls retain their exact native corners. The fourth joins the tower.
  for (let i = 0; i < porch.length; i++) {
    const a = porch[i],
      b = porch[(i + 1) % porch.length],
      f = frame(a, b),
      front = Math.abs(a[1] - control[1][1]) < 0.001 && Math.abs(b[1] - control[2][1]) < 0.001,
      side = Math.max(a[1], b[1]) > 3 && !front,
      r = rect(f.len / 2, 0, f.len, 2.2),
      opening = front
        ? { x: f.len * 0.52, y: 0.12, w: 0.85, h: 1.78 }
        : side
          ? { x: f.len * 0.55, y: 0.85, w: 0.6, h: 0.85 }
          : null;
    panel(
      o,
      'white',
      r,
      d > 1 && opening ? [rect(opening.x, opening.y, opening.w, opening.h)] : [],
      f,
    );
    if (opening && d) {
      const w = opening,
        hole = rect(w.x, w.y, w.w, w.h);
      if (d > 1) {
        reveal(o, 'white', hole, f, 0, -0.16);
        panel(o, front ? 'frame' : 'glass', hole, [], f, -0.16);
      } else panel(o, front ? 'frame' : 'glass', hole, [], f, 0.012);
      trim(o, f, w.x, w.y, w.w, w.h, d);
      if (d > 1 && !front) {
        beam(o, 'frame', f.P(w.x, w.y, -0.1), f.P(w.x, w.y + w.h, -0.1), 0.035, 0.035, C.frame);
        beam(
          o,
          'frame',
          f.P(w.x - w.w / 2, w.y + w.h / 2, -0.1),
          f.P(w.x + w.w / 2, w.y + w.h / 2, -0.1),
          0.035,
          0.035,
          C.frame,
        );
      }
      if (d > 2 && front) {
        beam(
          o,
          'frame',
          f.P(w.x + w.w * 0.28, w.y + 0.8, -0.12),
          f.P(w.x + w.w * 0.28, w.y + 0.92, -0.12),
          0.025,
          0.025,
          C.roof,
        );
      }
    }
  }
  cap(o, 'white', porch, 0, false);
  const x = (control[1][0] + control[2][0]) / 2,
    frontZ = control[1][1] + 0.1,
    backZ = (control[0][1] + control[3][1]) / 2 - 0.08,
    lx = control[2][0] - 0.12,
    rx = control[1][0] + 0.12;
  for (const z of [frontZ, backZ]) {
    tri(
      o,
      'white',
      [
        [lx, 2.2, z],
        [rx, 2.2, z],
        [x, 2.9, z],
      ],
      [0, 0, z === frontZ ? 1 : -1],
    );
  }
  for (const [edge, sg] of [
    [lx, -1],
    [rx, 1],
  ]) {
    const r = [
      [edge, 2.23, backZ],
      [edge, 2.23, frontZ],
      [x, 2.93, frontZ],
      [x, 2.93, backZ],
    ];
    Q(o, 'porchRoof', r, [sg, 2, 0]);
    if (d) beam(o, 'frame', [edge, 2.2, frontZ], [x, 2.9, frontZ], 0.075, 0.07, C.frame);
  }
  if (d > 1) beam(o, 'porchRoof', [x, 2.95, backZ], [x, 2.95, frontZ], 0.07, 0.1, C.porchRoof);
}
const seaward = [-0.98, -0.19];
function lantern(o, d) {
  const n = 12,
    levels = [
      [5.12, 2.12],
      [6.28, 1.93],
      [7.5, 2.16],
    ],
    rings = levels.map(([_, r]) => radial(n, r));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = ((i + 0.5) * 2 * Math.PI) / n,
      glass = Math.sin(a) * seaward[0] + Math.cos(a) * seaward[1] > 0.04,
      slot = glass ? 'glass' : 'frame';
    for (let k = 1; k < levels.length; k++) {
      const p = [
        [rings[k - 1][i][0], levels[k - 1][0], rings[k - 1][i][1]],
        [rings[k - 1][j][0], levels[k - 1][0], rings[k - 1][j][1]],
        [rings[k][j][0], levels[k][0], rings[k][j][1]],
        [rings[k][i][0], levels[k][0], rings[k][i][1]],
      ];
      Q(o, slot, p, [Math.sin(a), 0, Math.cos(a)]);
      if (d > 1) {
        for (const [u, v] of [
          [0, 3],
          [1, 2],
          [0, 2],
        ])
          beam(o, 'frame', p[u], p[v], glass ? 0.04 : 0.055, 0.045, C.frame);
        if (!glass) beam(o, 'frame', p[1], p[3], 0.055, 0.045, C.frame);
      } else if (d && !glass) {
        const p0 = p[0],
          p2 = p[2],
          offset = [Math.cos(a) * 0.025, 0, -Math.sin(a) * 0.025];
        Q(o, 'white', [
          p0.map((v, k) => v - offset[k]),
          p0.map((v, k) => v + offset[k]),
          p2.map((v, k) => v + offset[k]),
          p2.map((v, k) => v - offset[k]),
        ]);
      }
    }
  }
  if (d > 1)
    for (let k = 0; k < levels.length; k++) {
      const r = rings[k];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        beam(
          o,
          'frame',
          [...r[i].slice(0, 1), levels[k][0], r[i][1]],
          [r[j][0], levels[k][0], r[j][1]],
          0.065,
          0.055,
          C.frame,
        );
      }
    }
  cap(o, 'frame', rings[0], 5.12, false);
  cap(o, 'frame', rings.at(-1), 7.5);
}
function dome(o, d) {
  const n = [12, 24, 36, 48][d],
    profile = [
      [7.48, 2.29],
      [7.6, 2.29],
      [7.65, 2.18],
      [7.95, 2.02],
      [8.22, 1.72],
      [8.48, 1.24],
      [8.65, 0.6],
      [8.68, 0.4],
    ];
  for (let i = 1; i < profile.length; i++)
    loft(
      o,
      'roof',
      radial(n, profile[i - 1][1]),
      radial(n, profile[i][1]),
      profile[i - 1][0],
      profile[i][0],
    );
  cap(o, 'roof', radial(n, 0.4), 8.68);
  cylinder(o, 'roof', d ? 16 : 8, 0.37, 8.67, 8.85);
  cylinder(o, 'glass', d ? 12 : 6, 0.2, 8.85, 8.99);
  const low = radial(d ? 16 : 8, 0.3),
    high = radial(d ? 16 : 8, 0.045);
  loft(o, 'porchRoof', low, high, 8.99, 9.16);
  cap(o, 'porchRoof', high, 9.16);
  cylinder(o, 'frame', d ? 8 : 4, 0.018, 9.16, 10.1);
  if (d > 1) {
    beam(
      o,
      'frame',
      [center[0] - 0.18, 9.84, center[1]],
      [center[0] + 0.18, 9.84, center[1]],
      0.018,
      0.018,
      C.frame,
    );
    beam(
      o,
      'frame',
      [center[0], 9.76, center[1] - 0.12],
      [center[0], 9.95, center[1] + 0.12],
      0.018,
      0.018,
      C.frame,
    );
  }
  // Raised access loops lie on two dome meridians, rather than on an invented platform.
  if (d) {
    for (const a of [0.88, 3.9])
      for (const [y, r] of [
        [7.83, 2.1],
        [8.1, 1.88],
        [8.36, 1.47],
      ]) {
        const P = (x, h, offset) => [
            center[0] + (r + offset) * Math.sin(a) + x * Math.cos(a),
            y + h,
            center[1] + (r + offset) * Math.cos(a) - x * Math.sin(a),
          ],
          pts = [P(-0.1, 0, 0), P(-0.1, 0.11, 0.04), P(0.1, 0.11, 0.04), P(0.1, 0, 0)];
        if (d > 1) beamPath(o, 'roof', pts, 0.025, 0.025, C.roof);
        else Q(o, 'roof', pts);
      }
    if (d > 2)
      for (let j = 0; j < 12; j++) {
        const a = (j * 2 * Math.PI) / 12;
        for (const [y, r] of [
          [7.7, 2.15],
          [8.02, 1.96],
          [8.32, 1.56],
          [8.58, 0.83],
        ])
          sphere(
            o,
            'roof',
            [center[0] + r * Math.sin(a), y, center[1] + r * Math.cos(a)],
            [0.018, 0.018, 0.018],
            C.roof,
            6,
            4,
          );
      }
  }
}
function ladder(o, d) {
  const a = 1.1,
    r = 2.56,
    u = [Math.cos(a), -Math.sin(a)],
    normal = [Math.sin(a), Math.cos(a)],
    P = (x, y, rad = 0) => [
      center[0] + (r + rad) * normal[0] + x * u[0],
      y,
      center[1] + (r + rad) * normal[1] + x * u[1],
    ];
  for (const x of [-0.23, 0.23])
    if (d) beam(o, 'frame', P(x, 0.12), P(x, 7.62), 0.043, 0.055, C.frame);
    else
      Q(o, 'frame', [P(x - 0.03, 0.12), P(x + 0.03, 0.12), P(x + 0.03, 7.62), P(x - 0.03, 7.62)]);
  const step = d > 0.0 ? 0.31 : 0.63;
  for (let y = 0.35; y < 7.6; y += step)
    if (d > 1) beam(o, 'frame', P(-0.25, y), P(0.25, y), 0.027, 0.035, C.frame);
    else
      Q(o, 'frame', [P(-0.25, y - 0.02), P(0.25, y - 0.02), P(0.25, y + 0.02), P(-0.25, y + 0.02)]);
  if (d > 1) {
    for (const y of [1.2, 3.3, 5.6, 7.3])
      for (const x of [-0.23, 0.23])
        beam(o, 'frame', P(x, y, -0.42), P(x, y), 0.035, 0.035, C.frame);
    for (const y of [5.25, 6.25, 7.3]) {
      const pts = Array.from({ length: 9 }, (_, j) => {
        const t = (j * Math.PI) / 8;
        return P(0.38 * Math.cos(t), y, 0.38 * Math.sin(t));
      });
      beamPath(o, 'frame', pts, 0.025, 0.025, C.frame);
    }
    for (const x of [-0.38, 0, 0.38])
      beam(
        o,
        'frame',
        P(x, 5.25, x === 0 ? 0.38 : 0),
        P(x, 7.3, x === 0 ? 0.38 : 0),
        0.022,
        0.025,
        C.frame,
      );
  }
}
function build(o, _f, d = 3) {
  base(o, d);
  const n = [12, 24, 36, 48][d];
  cylinder(o, 'white', n, 2.5, 4.88, 5.08);
  cylinder(o, 'white', n, 2.22, 4.72, 4.9);
  lantern(o, d);
  dome(o, d);
  ladder(o, d);
}
export const matiuSkyline = (o, f) => build(o, f, 0);
export const matiuDistrict = (o, f) => build(o, f, 1);
export const matiuStreet = (o, f) => build(o, f, 2);
export const matiuSomesModel = {
  id: 'matiu_somes_island_lighthouse',
  key: 'matiu_somes_island_lighthouse',
  recipe: 'structure-matiu-somes-island-lighthouse.mjs',
  cell: 'rb/rbs',
  title: 'Matiu / Somes Island Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete surviving1900 white round lighthouse and native attached gabled porch. Sector lantern with landward diamond panels and seaward glass, broad gallery lip, domed metal roof/vent/access loops, tall external ladder/cage and own entry door. Full native22-vertex tower/porch boundary; no relocated1866 tower or surrounding island/site.',
  camera: [13, 9, 16],
  lookAt: [0, 4.9, 0.3],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.5, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole1900-tower-and-native-gabled-porch',
      position: [12, 8, 15],
      lookAt: [0, 4.9, 0.5],
    },
    {
      name: 'porch-real-door-side-casements-and-gallery-base',
      position: [4, 3.5, 8],
      lookAt: [0, 2.5, 2.5],
    },
    {
      name: 'landward-diamond-panels-open-ladder-cage-and-dome',
      position: [7, 7.3, 6],
      lookAt: [0, 6.7, 0],
    },
    {
      name: 'seaward-sector-glass-dome-vent-and-roof-access-loops',
      position: [-7, 8.7, -6],
      lookAt: [0, 7.1, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent64m source terrain frozen before geometry; exact foundation/threshold/host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-matiu-somes-island-lighthouse.mjs',
    level: 'skyline',
    export: 'matiuSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'matiuDistrict', errorMeters: 0.24, surfaces },
      street: { export: 'matiuStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete surviving1900 tower and attached gabled porch only. Every native outer arc/porch point retained; a short hidden circular tower continuation is estimated beneath the porch. No relocated1866 tower, keeper cottages, island/sea/shore/vegetation/city, paths/site stairs, signs, people or interior.',
    'One exact published2008 Matt Lamont1944x2592 public-domain original only, native SHA1/named own photographer/PD-self matched; nine source families inventoried without conflicts. Other attribution and unrelated imagery unused; no supplemental photography/copied pixels/generated bitmap. Primary DOC and harbour operator text only establish the1900 replacement and present navigation use.',
    'Native round base/own porch positions and ESE entrance bearing retained. White plain masonry, own gabled porch/closed door/casements, broad round gallery, folded white landward lantern panels/diamond frames, muted seaward glass, domed dark metal roof/access loops/vent cowl/finial and exterior ladder/cage follow the photo. Exact9m roof/cowl proportion, lantern sector angle/pane count, concealed windows, roof/ladder/rivet census and finish after2008 are estimates. Native29m seamark height is focal elevation above sea level, never building height.',
    'Independent64m129x129at0.5m terrain and original raw tile frozen before geometry. Fixed porch-side approach[0,6.5], provider21.9885m, full relative field[-14.763,14.8693] unchanged without clipping/fitting/flattening. Coarse composite data cannot establish building floor, threshold, steps, wall footing or precise host contact. Geographic preview; replaceFootprint=false.',
  ],
};
