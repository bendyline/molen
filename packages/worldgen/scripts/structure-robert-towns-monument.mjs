/** Robert Towns Monument: original Gothic tablet pedestal and foliate broken column. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/rk/rk8/robert_towns_monument/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
    plinth: rgb('9c9b8e'),
    white: rgb('d9ddd5'),
    stone: rgb('858b83'),
    tablet: rgb('c3cbc3'),
  },
  surfaces = {
    plinth: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
    white: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
    stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
    tablet: { slot: 'trim', localRef: ref, roughness: 0.97, metallic: 0 },
  };
function tri(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  if (n && normalFor(...p).reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
function ring(n, r, y, rotation = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rotation - (i * 2 * Math.PI) / n;
    return [r * Math.sin(a), y, r * Math.cos(a)];
  });
}
function square(w, y, ch = 0.06) {
  const h = w / 2;
  return [
    [-h + ch, y, h],
    [-h, y, h - ch],
    [-h, y, -h + ch],
    [-h + ch, y, -h],
    [h - ch, y, -h],
    [h, y, -h + ch],
    [h, y, h - ch],
    [h - ch, y, h],
  ];
}
function cap(o, s, r, up = true) {
  const ix = earcut(r.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => r[j]),
      [0, up ? 1 : -1, 0],
    );
}
function loft(o, s, r0, r1) {
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length;
    Q(o, s, [r0[i], r0[j], r1[j], r1[i]], [r0[i][0] + r0[j][0], 0, r0[i][2] + r0[j][2]]);
  }
}
function profile(o, s, levels, make) {
  const rings = levels.map(([y, r]) => make(r, y));
  for (let i = 1; i < rings.length; i++) loft(o, s, rings[i - 1], rings[i]);
  cap(o, s, rings[0], false);
  cap(o, s, rings.at(-1));
}
function face(a) {
  const n = [Math.sin(a), 0, Math.cos(a)],
    u = [Math.cos(a), 0, -Math.sin(a)];
  return { n, P: (x, y, z) => [u[0] * x + n[0] * z, y, u[2] * x + n[2] * z] };
}
function panel(o, s, r, f, z, holes = []) {
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
function extrusion(o, s, r, f, front, back) {
  panel(o, s, r, f, front);
  panel(o, s, r, f, back);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
const rect = (w, lo, hi) => [
  [-w / 2, lo],
  [w / 2, lo],
  [w / 2, hi],
  [-w / 2, hi],
];
function base(o, d) {
  // These own octagonal tiers are estimated from photographs, never labelled native map geometry.
  profile(
    o,
    'plinth',
    [
      [0, 1.9],
      [0.22, 1.9],
      [0.25, 1.86],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  profile(
    o,
    'plinth',
    [
      [0.25, 1.16],
      [0.69, 1.16],
      [0.72, 1.13],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  profile(
    o,
    'white',
    d
      ? [
          [0.72, 1.82],
          [1.11, 1.82],
          [1.19, 1.67],
          [1.25, 1.67],
          [1.35, 1.51],
          [1.4, 1.51],
          [1.46, 1.42],
        ]
      : [
          [0.72, 1.82],
          [1.11, 1.82],
          [1.46, 1.42],
        ],
    square,
  );
  const r0 = square(1.42, 1.46),
    r1 = square(1.42, 2.55);
  // Four main tablet faces have actual closed inset panels at near levels.
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8,
      a = r0[i],
      b = r0[j],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      len = Math.hypot(dx, dz),
      n = [dz / len, 0, -dx / len],
      u = [dx / len, 0, dz / len],
      mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2],
      f = { n, P: (x, y, z) => [mid[0] + u[0] * x + n[0] * z, y, mid[1] + u[2] * x + n[2] * z] };
    if (len > 0.8) {
      const hole = rect(0.91, 1.56, 2.43);
      panel(o, 'white', rect(len, 1.46, 2.55), f, 0, d > 1 ? [hole] : []);
      if (d > 1) {
        for (let k = 0; k < hole.length; k++) {
          const p = hole[k],
            q = hole[(k + 1) % hole.length];
          Q(o, 'white', [f.P(...p, 0), f.P(...q, 0), f.P(...q, -0.045), f.P(...p, -0.045)]);
        }
        panel(o, 'tablet', hole, f, -0.045);
      } else if (d) panel(o, 'tablet', hole, f, 0.003);
    } else Q(o, 'white', [a, b, r1[j], r1[i]], n);
  }
  cap(o, 'white', r0, false);
  cap(o, 'white', r1);
  profile(
    o,
    'white',
    [
      [2.55, 1.34],
      [3.35, 1.34],
      [3.43, 1.2],
      [3.48, 1.1],
    ],
    square,
  );
  for (let k = 0; k < 4; k++) {
    const f = face((k * Math.PI) / 2),
      gable = [
        [-0.79, 2.47],
        [0, 3.39],
        [0.79, 2.47],
      ],
      inner = [
        [-0.57, 2.5],
        [0, 3.19],
        [0.57, 2.5],
      ];
    extrusion(o, 'white', gable, f, 0.79, 0.67);
    if (d) {
      for (let i = 0; i < 2; i++)
        beam(
          o,
          'white',
          f.P(...gable[i], 0.818),
          f.P(...gable[i + 1], 0.818),
          0.055,
          0.055,
          C.white,
        );
      panel(o, 'tablet', inner, f, 0.796);
      // Original raised trefoil leaves, without inscription glyphs or copied image textures.
      const shapes = [
        [
          [0, 2.93],
          [-0.11, 2.85],
          [-0.11, 2.72],
          [0, 2.67],
          [0.11, 2.72],
          [0.11, 2.85],
        ],
        [
          [-0.03, 2.71],
          [-0.22, 2.76],
          [-0.32, 2.66],
          [-0.25, 2.55],
          [-0.09, 2.56],
        ],
        [
          [0.03, 2.71],
          [0.22, 2.76],
          [0.32, 2.66],
          [0.25, 2.55],
          [0.09, 2.56],
        ],
      ];
      for (const r of shapes) extrusion(o, 'white', r, f, 0.835, 0.798);
      if (d > 1)
        for (let i = 0; i < 2; i++)
          beam(
            o,
            'white',
            f.P(...inner[i], 0.825),
            f.P(...inner[i + 1], 0.825),
            0.032,
            0.04,
            C.white,
          );
    }
    // Rolled shoulders meet the upper block at the four Gothic tips.
    if (d > 1)
      for (const side of [-1, 1]) {
        const pts = Array.from({ length: d > 2 ? 9 : 5 }, (_, i) => {
          const a = (i * Math.PI) / ((d > 2 ? 9 : 5) - 1);
          return f.P(side * (0.52 + 0.085 * Math.cos(a)), 3.34 + 0.085 * Math.sin(a), 0.695);
        });
        for (let i = 1; i < pts.length; i++)
          beam(o, 'white', pts[i - 1], pts[i], 0.065, 0.065, C.white);
      }
  }
}
function band(o, r, y, h, d) {
  profile(
    o,
    'stone',
    [
      [y, r],
      [y + h, r],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  if (!d) return;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      f = face(a),
      count = d > 1 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.085;
      extrusion(
        o,
        'stone',
        [
          [x - 0.032, y + 0.01],
          [x + 0.032, y + 0.01],
          [x, y + h - 0.01],
        ],
        f,
        r * Math.cos(Math.PI / 8) + 0.012,
        r * Math.cos(Math.PI / 8) - 0.015,
      );
    }
  }
}
function medallions(o, r, y, h, d) {
  profile(
    o,
    'stone',
    [
      [y, r],
      [y + h, r],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  if (!d) return;
  for (let k = 0; k < 8; k++) {
    const f = face((k * Math.PI) / 4),
      cy = y + h / 2,
      z = r * Math.cos(Math.PI / 8),
      n = d > 2 ? 14 : 8,
      outer = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [0.083 * Math.cos(a), cy + 0.083 * Math.sin(a)];
      }),
      inner = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [0.062 * Math.cos(a), cy + 0.062 * Math.sin(a)];
      });
    panel(o, 'stone', outer, f, z + 0.015, [inner]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(o, 'stone', [
        f.P(...outer[i], z + 0.015),
        f.P(...outer[j], z + 0.015),
        f.P(...inner[j], z - 0.006),
        f.P(...inner[i], z - 0.006),
      ]);
    }
    panel(o, 'stone', inner, f, z - 0.006);
  }
}
function column(o, d) {
  profile(
    o,
    'stone',
    [
      [3.48, 0.44],
      [4.0, 0.405],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  band(o, 0.412, 4, 0.13, d);
  medallions(o, 0.405, 4.13, 0.38, d);
  band(o, 0.395, 4.51, 0.13, d);
  profile(
    o,
    'stone',
    [
      [4.64, 0.38],
      [5.47, 0.29],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  medallions(o, 0.31, 5.47, 0.16, d);
  band(o, 0.3, 5.63, 0.06, d);
}
function leaf(o, a, y0, h, r, d, variant) {
  const f = face(a),
    n = d > 2 ? 7 : d > 1 ? 5 : 3,
    w = d ? 0.13 : 0.12,
    front = [],
    back = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      ww =
        i === 0 || i === n
          ? 0.012
          : w * Math.sin(Math.PI * t) * (1 + (d > 1 ? 0.14 * Math.sin(t * 6 * Math.PI) : 0)),
      rr = r + 0.11 * Math.sin(t * Math.PI * 0.72) + 0.045 * t * t + variant * 0.012 * t,
      yy = y0 + h * t;
    front.push([f.P(-ww, yy, rr), f.P(0, yy, rr + 0.035 * Math.sin(Math.PI * t)), f.P(ww, yy, rr)]);
    back.push([f.P(-ww, yy, rr - 0.022), f.P(ww, yy, rr - 0.022)]);
  }
  for (let i = 1; i < front.length; i++) {
    const p = front[i - 1],
      q = front[i];
    Q(o, 'stone', [p[0], p[1], q[1], q[0]], f.n);
    Q(o, 'stone', [p[1], p[2], q[2], q[1]], f.n);
    if (d > 1) {
      Q(o, 'stone', [back[i - 1][0], p[0], q[0], back[i][0]]);
      Q(o, 'stone', [p[2], back[i - 1][1], back[i][1], q[2]]);
    }
  }
}
function capital(o, d) {
  // An irregular foliate broken capital, not a pyramid or a new cross/finial.
  profile(
    o,
    'stone',
    [
      [5.69, 0.27],
      [6.05, 0.29],
      [6.38, 0.23],
      [6.7, 0.14],
      [6.8, 0.1],
    ],
    (r, y) => ring(8, r, y, Math.PI / 8),
  );
  for (let row = 0; row < 2; row++)
    for (let k = 0; k < 8; k++)
      leaf(
        o,
        (k * Math.PI) / 4 + (row * Math.PI) / 8,
        5.72 + row * 0.39,
        0.65 - row * 0.05,
        0.27 - row * 0.04,
        d,
        (k % 3) - 1,
      );
  if (d) for (let k = 0; k < 4; k++) leaf(o, (k * Math.PI) / 2 + 0.2, 6.28, 0.48, 0.14, d, k % 2);
}
function build(o, _f, d = 3) {
  base(o, d);
  column(o, d);
  capital(o, d);
}
export const townsSkyline = (o, f) => build(o, f, 0);
export const townsDistrict = (o, f) => build(o, f, 1);
export const townsStreet = (o, f) => build(o, f, 2);
export const townsMonumentModel = {
  id: 'robert_towns_monument',
  key: 'robert_towns_monument',
  recipe: 'structure-robert-towns-monument.mjs',
  cell: 'rk/rk8',
  title: 'Robert Towns Monument, Castle Hill',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete Castle Hill Robert Towns Monument: two own octagonal stepped plinths, white chamfered Gothic tablet pedestal/four gables/trefoil relief/scroll shoulders, grey tapered octagonal shaft/medallion and toothed bands, and foliate broken capital. Exact named native point and actual southern access retained; all monument dimensions/facing photo-estimated. No natural hill or lookout grounds.',
  camera: [7, 5, 9],
  lookAt: [0, 3.5, 0],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.2, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-stepped-plinth-gothic-pedestal-and-carved-column',
      position: [6, 4.7, 8],
      lookAt: [0, 3.4, 0],
    },
    {
      name: 'two-octagonal-tiers-mouldings-and-inset-tablets',
      position: [3.7, 2.5, 5],
      lookAt: [0, 1.7, 0],
    },
    {
      name: 'gothic-gables-trefoils-and-rolled-shoulders',
      position: [2.6, 3.1, 3.8],
      lookAt: [0, 2.9, 0],
    },
    {
      name: 'tapered-shaft-medallions-and-foliate-broken-capital',
      position: [2.9, 6.2, 3.8],
      lookAt: [0, 5.6, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent32m field frozen before geometry; own plinth foot/step levels and host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-robert-towns-monument.mjs',
    level: 'skyline',
    export: 'townsSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'townsDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'townsStreet', errorMeters: 0.07, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Only this named monument within the original Castle Hill story; no castle/hill/site pad, parking, shelters, rails, vegetation, people or inscription text. Two own plinths retained as intrinsic structure.',
    'Exact two published2008 ROxBo originals, native SHA1/own-photographer/PD-user-en matched and inspected. Other imagery unused; no supplemental photographs/copied pixels/generated bitmap.',
    'No mapped monument footprint or verified vertical survey. Approximate6.8m height and all plinth/white pedestal/column profiles/ornament based on photo ratios. Hidden sides use bounded symmetric Gothic decoration; plaque orientation relative to actual native access axis is approximate by45degrees. Current finish after2008 and foliate census are estimates.',
    'Independent32m129x129at0.25m terrain field frozen before geometry; provider260.4679m, full relative range[-4.4186,1.1222]. Original raw tile/grid/PNG unchanged without fitting, clipping or flattening. This oversamples4.51m output pixels and a coarser DEM; precise plinth foot, ground/threshold and host contact unverified. Geographic preview; replaceFootprint=false.',
  ],
};
