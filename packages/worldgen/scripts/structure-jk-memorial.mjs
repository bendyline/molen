/** JK Memorial: sloped marble museum, open rooftop chamber and thin curled concrete monument. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, cross, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/6v/6vj/jk_memorial/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  marble: rgb('d3d1bc'),
  concrete: rgb('c5c2a6'),
  white: rgb('e0e0d6'),
  bronze: rgb('686e61'),
  relief: rgb('747969'),
  joint: rgb('a8aa9b'),
};
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.89, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  white: { slot: 'roof', graph: 'plaster_lime', roughness: 0.86, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.78, metallic: 0.45 },
  joint: { slot: 'trim', graph: 'stone_marble', roughness: 0.94, metallic: 0 },
};
function tri(o, s, p, n, col = C[s]) {
  const v = p.map((q) => q.map(Math.fround)),
    cr = cross(
      v[1].map((x, i) => x - v[0][i]),
      v[2].map((x, i) => x - v[0][i]),
    );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((a, x, i) => a + x * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    col,
  );
}
function quad(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
function museum(o, d) {
  const lo = plan.outline,
    hi = lo.map(([x, z]) => [x + (x < 0 ? 5 : -5), z + (z < 0 ? 5 : -5)]),
    y = 5.24;
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    quad(
      o,
      'marble',
      [
        [...lo[i].slice(0, 1), -0.6, lo[i][1]],
        [lo[k][0], -0.6, lo[k][1]],
        [lo[k][0], 0, lo[k][1]],
        [lo[i][0], 0, lo[i][1]],
      ],
      normalFor([lo[i][0], 0, lo[i][1]], [hi[k][0], y, hi[k][1]], [lo[k][0], 0, lo[k][1]]),
    );
    quad(
      o,
      'marble',
      [
        [lo[i][0], 0, lo[i][1]],
        [lo[k][0], 0, lo[k][1]],
        [hi[k][0], y, hi[k][1]],
        [hi[i][0], y, hi[i][1]],
      ],
      normalFor([lo[i][0], 0, lo[i][1]], [hi[k][0], y, hi[k][1]], [lo[k][0], 0, lo[k][1]]),
    );
    if (d > 1) {
      const a = lo[i],
        b = lo[k],
        aa = hi[i],
        bb = hi[k],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        rows = d > 2 ? 10 : 4;
      for (let row = 1; row < rows; row++) {
        const t = row / rows;
        const A = [a[0] * (1 - t) + aa[0] * t, y * t, a[1] * (1 - t) + aa[1] * t],
          B = [b[0] * (1 - t) + bb[0] * t, y * t, b[1] * (1 - t) + bb[1] * t];
        beam(o, 'joint', A, B, 0.018, 0.018, C.joint);
        if (d > 2) {
          for (let x = (row % 2) * 1.6 + 1.6; x < len; x += 3.2) {
            const u = x / len,
              t1 = (row - 1) / rows,
              edge = (t0) => [
                (a[0] * (1 - u) + b[0] * u) * (1 - t0) + (aa[0] * (1 - u) + bb[0] * u) * t0,
                y * t0,
                (a[1] * (1 - u) + b[1] * u) * (1 - t0) + (aa[1] * (1 - u) + bb[1] * u) * t0,
              ];
            beam(o, 'joint', edge(t1), edge(t), 0.012, 0.012, C.joint);
          }
        }
      }
    }
  }
  quad(
    o,
    'marble',
    hi.map(([x, z]) => [x, y, z]),
    [0, 1, 0],
  );
}
function chamber(o, d) {
  const n = [20, 36, 64, 96][d],
    rings = [3, 5, 9, 13][d],
    rows = [3, 5, 8, 12][d],
    r = 11.1,
    cx = -15,
    cz = -1.95,
    base = 5.24,
    lower = (x) => base + (Math.abs(x) < 5 ? 2.65 * Math.sqrt(Math.max(0, 1 - (x * x) / 25)) : 0),
    P = (rad, a) => [
      cx + rad * Math.cos(a),
      8.4 + 1.85 * Math.sqrt(Math.max(0, 1 - (rad * rad) / (r * r))),
      cz + rad * Math.sin(a),
    ],
    wall = (a, t) => {
      const rr = r + 3.6 * t * (1 - t);
      return [
        cx + rr * Math.cos(a),
        lower(r * Math.cos(a)) * (1 - t) + 8.4 * t,
        cz + rr * Math.sin(a),
      ];
    };
  for (let j = 0; j < rings; j++) {
    const r0 = (r * j) / rings,
      r1 = (r * (j + 1)) / rings;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      if (j === 0) tri(o, 'white', [P(0, a), P(r1, a), P(r1, b)], [0, 1, 0]);
      else quad(o, 'white', [P(r0, a), P(r1, a), P(r1, b), P(r0, b)], [0, 1, 0]);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    for (let j = 0; j < rows; j++)
      quad(
        o,
        'white',
        [wall(a, j / rows), wall(b, j / rows), wall(b, (j + 1) / rows), wall(a, (j + 1) / rows)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      );
  }
  const xs = [-r, ...Array.from({ length: n + 1 }, (_, i) => -5 + (10 * i) / n), r];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      za = Math.sqrt(Math.max(0, r * r - a * a)),
      zb = Math.sqrt(Math.max(0, r * r - b * b));
    quad(
      o,
      'white',
      [
        [cx + a, lower(a), cz - za],
        [cx + a, lower(a), cz + za],
        [cx + b, lower(b), cz + zb],
        [cx + b, lower(b), cz - zb],
      ],
      [0, -1, 0],
    );
  }
}
function monument(o, d) {
  const [x, z] = plan.statue;
  box(o, 'concrete', [x - 0.78, -0.8, z - 0.8], [x + 0.78, 20, z + 0.8], C.concrete);
  const n = [12, 22, 38, 64][d],
    P = (t) => {
      const u = 1 - t;
      return [
        -1 * u * u * u + 18 * u * u * t + 24 * u * t * t - t * t * t,
        20 * u * u * u + 59.4 * u * u * t + 75.6 * u * t * t + 28 * t * t * t,
      ];
    },
    rows = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      p = P(t),
      a = P(Math.max(0, t - 0.0001)),
      b = P(Math.min(1, t + 0.0001)),
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = -(b[1] - a[1]) / L,
      ny = (b[0] - a[0]) / L,
      w = 0.3 - 0.12 * t;
    rows.push(
      [
        [-w, -2.6],
        [w, -2.6],
        [w, 2.6],
        [-w, 2.6],
      ].map(([u, v]) => [x + p[0] + nx * u, p[1] + ny * u, z + v]),
    );
  }
  loft(o, 'concrete', rows, C.concrete);
  figure(o, d, [x, 20.32, z]);
  if (d > 1) {
    for (let y = 3; y < 20; y += 3)
      for (const zz of [-0.805, 0.805])
        beam(o, 'joint', [x - 0.78, y, z + zz], [x + 0.78, y, z + zz], 0.014, 0.014, C.joint);
  }
}
function figure(o, d, origin) {
  const [x, y, z] = origin,
    S = 0.98,
    p = (q) => [x + q[0] * S, y + q[1] * S, z + q[2] * S],
    sides = [5, 8, 12, 18][d],
    ball = (c, r, col = C.bronze) =>
      sphere(
        o,
        'bronze',
        p(c),
        r.map((v) => v * S),
        col,
        sides,
        Math.max(4, Math.floor(sides / 2)),
      ),
    limb = (points, radii) => {
      for (let i = 1; i < points.length; i++) {
        const a = p(points[i - 1]),
          b = p(points[i]);
        beam(o, 'bronze', a, b, radii[i - 1] * 2, radii[i - 1] * 1.85, C.bronze);
        if (d > 0) ball(points[i], [radii[i - 1], radii[i - 1], radii[i - 1]]);
      }
    };
  for (const side of [-1, 1]) {
    const u = side * 0.26;
    ball([u, 0.13, -0.08], [0.19, 0.13, 0.36]);
    limb(
      [
        [u, 0.25, 0],
        [u * 0.9, 0.95, 0.02],
        [u * 0.8, 1.75, 0],
      ],
      [0.19, 0.23],
    );
  }
  const rings = [
    [1.65, 0.49, 0.25],
    [2.2, 0.52, 0.27],
    [2.9, 0.61, 0.29],
    [3.13, 0.47, 0.23],
  ].map(([h, rx, rz]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * 2 * Math.PI) / sides;
      return p([Math.cos(a) * rx, h, Math.sin(a) * rz]);
    }),
  );
  loft(o, 'bronze', rings, C.bronze);
  ball([0, 3.2, 0], [0.16, 0.21, 0.16]);
  ball([0, 3.61, -0.01], [0.29, 0.39, 0.28]);
  limb(
    [
      [0.5, 2.98, 0],
      [1.03, 3.13, 0],
      [1.4, 3.87, -0.04],
    ],
    [0.23, 0.18],
  );
  limb(
    [
      [-0.5, 2.98, 0],
      [-0.7, 2.28, 0],
      [-0.78, 1.94, -0.08],
    ],
    [0.23, 0.17],
  );
  ball([1.43, 4.02, -0.06], [0.13, 0.22, 0.07]);
  ball([-0.78, 1.8, -0.08], [0.13, 0.22, 0.09]);
  if (d > 0) {
    for (let i = 0; i < 4; i++)
      limb(
        [
          [1.32 + i * 0.075, 4.12, -0.065],
          [1.3 + i * 0.09, 4.38 - Math.abs(i - 1) * 0.05, -0.065],
        ],
        [0.026],
      );
    limb(
      [
        [1.52, 3.99, -0.06],
        [1.69, 4.14, -0.065],
      ],
      [0.034],
    );
    for (const side of [-1, 1]) ball([side * 0.285, 3.61, 0], [0.055, 0.1, 0.07]);
    ball([0, 3.61, -0.282], [0.065, 0.13, 0.1]);
    ball([0, 3.39, -0.24], [0.12, 0.035, 0.048]);
    for (const side of [-1, 1]) ball([side * 0.1, 3.72, -0.26], [0.075, 0.04, 0.045]);
    const A = (ps, col = C.relief) => tri(o, 'bronze', ps.map(p), [0, 0, -1], col);
    A([
      [-0.1, 3.1, -0.255],
      [-0.42, 2.86, -0.285],
      [-0.08, 2.48, -0.305],
    ]);
    A([
      [0.1, 3.1, -0.255],
      [0.42, 2.86, -0.285],
      [0.08, 2.48, -0.305],
    ]);
    A([
      [-0.055, 3.04, -0.282],
      [0.055, 3.04, -0.282],
      [0, 2.55, -0.32],
    ]);
    if (d > 1) {
      for (const side of [-1, 1])
        beam(
          o,
          'bronze',
          p([side * 0.13, 3.65, -0.285]),
          p([side * 0.04, 3.65, -0.29]),
          0.015,
          0.015,
          C.bronze,
        );
      beam(o, 'bronze', p([-0.09, 3.46, -0.282]), p([0.1, 3.46, -0.282]), 0.018, 0.018, C.bronze);
      for (let h = 2.15; h < 2.8; h += 0.25) ball([0.06, h, -0.282], [0.025, 0.025, 0.015]);
      ball([0, 3.84, 0.03], [0.25, 0.17, 0.24], rgb('555f53'));
    }
  }
}
function build(o, _f, d = 3) {
  museum(o, d);
  chamber(o, d);
  monument(o, d);
}
export const jkMemorialSkyline = (o, f) => build(o, f, 0);
export const jkMemorialDistrict = (o, f) => build(o, f, 1);
export const jkMemorialStreet = (o, f) => build(o, f, 2);
export const jkMemorialModel = {
  id: 'jk_memorial',
  key: 'jk_memorial',
  recipe: 'structure-jk-memorial.mjs',
  cell: '6v/6vj',
  title: 'JK Memorial',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [-110, 67, -140],
  lookAt: [-5, 10, -7],
  portableGroundY: -0.8,
  mediumFiContext: { scale: 1.5, groundY: -0.8 },
  qaCameras: [
    {
      name: 'complete-marble-museum-monument-and-rooftop-chamber',
      position: [100, 38, -125],
      lookAt: [-5, 9, -8],
    },
    {
      name: 'open-curled-concrete-canopy-and-waving-bronze-figure',
      position: [-5, 25, -58],
      lookAt: [11, 24, -33.54],
    },
    { name: 'rooftop-chamber-through-arch-undercut', position: [-15, 7, -23], lookAt: [-15, 7, 0] },
    {
      name: 'rear-sloping-marble-body-and-shallow-roof',
      position: [60, 30, 77],
      lookAt: [0, 5, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent256mTerrarium field frozen at dry westapproach before geometry; precise threshold/hostgrade unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-jk-memorial.mjs',
    level: 'skyline',
    export: 'jkMemorialSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'jkMemorialDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'jkMemorialStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'All seven exact Daderot2012CC0photographs inspected; no copied pixels or generated bitmap. Museum marble/concrete/roofplaster and bronze use shared procedural materials. Current cosmetic condition, actual fine marble courses, concealed rear/roof sections and portrait likeness are bounded mediumfi approximations.',
    'Native5.24m museum-only height used. Monument shaft20m/curlto28m and4.5mnominal figure follow photographic proportions, not a surveyed dimensional section. Architect text places figure approximately30maboveground; conventional28m monument description has ambiguous height scope. No claim of exact engineering replica.',
    'The raw native building polygon overlaps separately mapped reflectingpools and is not extruded whole. Model includes120x31m photograph-controlled sloped marble body, chamber and exact mapped monument point. No invented pool/site slab/landscape/publicapproach. Subterranean museum interiors/entries and ramps, detached outbuilding, bronze seatedcouple, flags/lamps/cars/signage excluded.',
    'Chamber radius12m, centre[-15,-1.95], top10.25m/arched lower void, tower curl5.2mdepth and hidden back/undercuts are photograph-based estimates. Bronze standing suit/raisedright hand/separatelegs recreated as bounded faceted sculptural geometry, fine likeness/hair/eyes/fingers simplified at distant levels.',
    'Independent original256m129x129field/terrainPNG/raw tile retained unchanged. Dry western reference[-63,-3] fixed before geometry. Precise source grade/basement/monument foot and compatible live hostterrain contact remain unverified; preview placement only and replaceFootprint=false.',
  ],
};
