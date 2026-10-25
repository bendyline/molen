/** Lúcio Costa's triangular glazed mezzanine, three curved V piers and complete open lattice tower. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/6v/6vj/brasilia_tv_tower/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  concrete: rgb('c4bba3'),
  steel: rgb('b6beb5'),
  red: rgb('a16b58'),
  glass: rgb('657570'),
  dark: rgb('49544f'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.81, metallic: 0.4 },
  red: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.46, metallic: 0.07 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.08 },
};
const TAU = 2 * Math.PI,
  outline = plan.outline,
  area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  scaled = (t) => outline.map((p) => p.map((v) => v * t));
function T(o, s, p, n) {
  const f = p.map((q) => q.map(Math.fround)),
    cr = cross(
      f[1].map((v, k) => v - f[0][k]),
      f[2].map((v, k) => v - f[0][k]),
    );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, lo, hi) {
  cap(o, s, r, lo, false);
  cap(o, s, r, hi);
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function rod(o, s, a, b, r, d) {
  const u = b.map((v, k) => v - a[k]),
    L = Math.hypot(...u);
  if (L < 1e-6) return;
  for (let k = 0; k < 3; k++) u[k] /= L;
  const v0 = cross(u, Math.abs(u[1]) < 0.98 ? [0, 1, 0] : [1, 0, 0]),
    l = Math.hypot(...v0),
    v = v0.map((x) => x / l),
    w = cross(u, v),
    N = [3, 3, 4, 6][d],
    P = (p, t) => p.map((x, k) => x + r * (v[k] * Math.cos(t) + w[k] * Math.sin(t)));
  for (let i = 0; i < N; i++) {
    const a0 = (i * TAU) / N,
      a1 = ((i + 1) * TAU) / N,
      n = v.map((x, k) => x * Math.cos((a0 + a1) / 2) + w[k] * Math.sin((a0 + a1) / 2));
    Q(o, s, [P(a, a0), P(a, a1), P(b, a1), P(b, a0)], n);
  }
}
function piers(o, d) {
  const N = [4, 8, 12, 20][d],
    profile = [
      [-4.2, -0.5],
      [4.2, -0.5],
      [7.8, 24.8],
      ...Array.from({ length: N + 1 }, (_, i) => {
        const x = 4.8 - (9.6 * i) / N;
        return [x, 8.4 + (16.4 * x * x) / (4.8 * 4.8)];
      }),
      [-7.8, 24.8],
    ],
    ix = earcut(profile.flat());
  for (const q of outline) {
    const L = Math.hypot(...q),
      u = [q[0] / L, q[1] / L],
      v = [-u[1], u[0]],
      center = q.map((x) => x * 0.45),
      P = (x, y, z) => [center[0] + v[0] * x + u[0] * z, y, center[1] + v[1] * x + u[1] * z];
    for (const side of [-1, 1])
      for (let i = 0; i < ix.length; i += 3)
        T(
          o,
          'concrete',
          ix.slice(i, i + 3).map((j) => P(...profile[j], side * 1.8)),
          [u[0] * side, 0, u[1] * side],
        );
    for (let i = 0; i < profile.length; i++) {
      const a = profile[i],
        b = profile[(i + 1) % profile.length],
        n = [v[0] * (b[1] - a[1]), a[0] - b[0], v[1] * (b[1] - a[1])];
      Q(o, 'concrete', [P(...a, -1.8), P(...b, -1.8), P(...b, 1.8), P(...a, 1.8)], n);
    }
  }
}
function mezzanine(o, d) {
  prism(o, 'concrete', outline, 24.8, 25.3);
  const inner = scaled(0.7);
  cap(o, 'concrete', inner, 22.8, false);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    Q(
      o,
      'concrete',
      [
        [outline[i][0], 24.8, outline[i][1]],
        [outline[j][0], 24.8, outline[j][1]],
        [inner[j][0], 22.8, inner[j][1]],
        [inner[i][0], 22.8, inner[i][1]],
      ],
      [0, -1, 0],
    );
  }
  const r = scaled(0.984);
  prism(o, 'glass', r, 25.3, 31.3);
  prism(o, 'concrete', outline, 31.3, 32);
  for (let i = 0; i < 3; i++) {
    const a = r[i],
      b = r[(i + 1) % 3],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      N = d === 0 ? 2 : d === 1 ? 9 : Math.round(L / 2.1);
    for (let j = 0; j <= N; j++) {
      const t = j / N,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      rod(o, 'steel', [x, 25.25, z], [x, 31.35, z], d === 0 ? 0.16 : 0.055, d);
    }
    if (d > 1)
      for (const y of [25.7, 30.65]) rod(o, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.04, d);
  }
  const core = [
    [-1.55, -1.55],
    [1.55, -1.55],
    [1.55, 1.55],
    [-1.55, 1.55],
  ];
  prism(o, 'concrete', core, -0.45, 24.8);
  if (d > 0) {
    Q(
      o,
      'dark',
      [
        [-0.72, 0, 1.565],
        [0.72, 0, 1.565],
        [0.72, 2.6, 1.565],
        [-0.72, 2.6, 1.565],
      ],
      [0, 0, 1],
    );
    rod(o, 'steel', [0, 0.15, 1.58], [0, 2.5, 1.58], 0.035, d);
  }
}
const knot = (fraction, y) => outline.map((p) => [p[0] * fraction, y, p[1] * fraction]);
function truss(o, d, y0, y1, r0, r1, bays, paint = false) {
  const radius = (y) => r0 + ((r1 - r0) * (y - y0)) / (y1 - y0),
    at = (y) => knot(radius(y), y);
  for (let j = 0; j < bays; j++) {
    const y = y0 + ((y1 - y0) * j) / bays,
      z = y0 + ((y1 - y0) * (j + 1)) / bays,
      A = at(y),
      B = at(z),
      s = paint && j % 2 === 0 ? 'red' : 'steel';
    for (let k = 0; k < 3; k++) {
      const n = (k + 1) % 3;
      rod(o, s, A[k], B[k], paint ? 0.065 : 0.15, d);
      rod(o, s, A[k], A[n], paint ? 0.04 : 0.07, d);
      rod(o, s, A[k], B[n], paint ? 0.035 : 0.065, d);
      if (d > 0) rod(o, s, A[n], B[k], paint ? 0.035 : 0.065, d);
      if (d > 2 && !paint) {
        const yy = (y + z) / 2,
          M = at(yy);
        rod(o, 'steel', M[k], M[n], 0.035, d);
      }
    }
  }
  const top = at(y1);
  for (let i = 0; i < 3; i++) rod(o, paint ? 'red' : 'steel', top[i], top[(i + 1) % 3], 0.05, d);
}
function platform(o, y, f, d, room = false) {
  const r = scaled(f);
  prism(o, 'dark', r, y - 0.55, y);
  if (d > 0)
    for (let i = 0; i < 3; i++) {
      const a = r[i],
        b = r[(i + 1) % 3],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = d === 1 ? 2 : Math.round(L / 1.8);
      rod(o, 'steel', [a[0], y + 1.15, a[1]], [b[0], y + 1.15, b[1]], 0.04, d);
      for (let j = 0; j <= n; j++) {
        const t = j / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        rod(o, 'steel', [x, y, z], [x, y + 1.15, z], 0.026, d);
      }
    }
  if (room) {
    prism(o, 'glass', scaled(f * 0.4), y, y + 2.1);
    prism(o, 'dark', scaled(f * 0.43), y + 2.1, y + 2.25);
  }
}
function stairs(o, d) {
  if (d === 0) return;
  const rr = 1.35;
  for (const x of [-rr, rr])
    for (const z of [-rr, rr]) rod(o, 'dark', [x, 32, z], [x, 154, z], 0.055, d);
  if (d === 1) return;
  const count = 40;
  for (let j = 0; j < count; j++) {
    const y = 32 + j * 3.05,
      sign = j % 2 === 0 ? 1 : -1;
    prism(
      o,
      'dark',
      [
        [-1.4, -1.4],
        [1.4, -1.4],
        [1.4, 1.4],
        [-1.4, 1.4],
      ],
      y - 0.08,
      y,
    );
    for (let half = 0; half < 2; half++) {
      const z0 = half === 0 ? -1.25 : 0.12,
        z1 = half === 0 ? -0.12 : 1.25,
        x0 = half === 0 ? -1.2 : 1.2,
        x1 = -x0,
        yy = y + half * 1.525;
      if (d === 2)
        Q(
          o,
          'steel',
          [
            [x0, yy, z0],
            [x0, yy, z1],
            [x1, yy + 1.525, z1],
            [x1, yy + 1.525, z0],
          ],
          [0, 1, 0],
        );
      else
        for (let i = 0; i < 10; i++) {
          const t = i / 10,
            u = (i + 1) / 10,
            a = x0 + (x1 - x0) * t,
            b = x0 + (x1 - x0) * u,
            h = yy + 1.525 * t;
          Q(
            o,
            'steel',
            [
              [a, h, z0],
              [a, h, z1],
              [b, h, z1],
              [b, h, z0],
            ],
            [0, 1, 0],
          );
          Q(
            o,
            'steel',
            [
              [b, h, z0],
              [b, h, z1],
              [b, h + 0.1525, z1],
              [b, h + 0.1525, z0],
            ],
            [sign, 0, 0],
          );
        }
      rod(o, 'steel', [x0, yy + 1, z0], [x1, yy + 2.525, z0], 0.025, d);
    }
    if (j % 2 === 0)
      for (const z of [-rr, rr]) rod(o, 'steel', [-rr, y + 1, z], [rr, y + 1, z], 0.025, d);
  }
}
function antenna(o, d) {
  truss(o, d, 154, 199, 0.047, 0.028, [3, 5, 7, 9][d], true);
  truss(o, d, 199, 221, 0.022, 0.006, [2, 3, 5, 7][d], true);
  rod(o, 'steel', [0, 221, 0], [0, 224, 0], d === 0 ? 0.12 : 0.045, d);
  if (d === 0) return;
  const n = d === 1 ? 3 : d === 2 ? 5 : 9;
  for (const base of [120, 138, 170, 187]) {
    const a = base * 0.29,
      r = base < 154 ? 2.1 : 1.3,
      x = r * Math.cos(a),
      z = r * Math.sin(a);
    rod(o, 'red', [x, base, z], [x, base + n * 1.05, z], 0.03, d);
    for (let j = 0; j < n; j++) {
      const y = base + j * 1.05;
      rod(o, 'red', [x - 0.75, y, z], [x + 0.75, y, z], 0.025, d);
    }
  }
  for (const [y, a, r] of [
    [129, 0.3, 0.75],
    [143, 2.5, 1],
    [178, 4.1, 0.65],
  ].slice(0, d === 1 ? 1 : 3)) {
    const rr = y < 154 ? 2.4 : 1.4,
      c = [rr * Math.cos(a), y, rr * Math.sin(a)],
      normal = [Math.cos(a), 0, Math.sin(a)],
      u = [-Math.sin(a), 0, Math.cos(a)],
      N = [0, 8, 12, 20][d],
      P = (t, k) => [
        c[0] + u[0] * r * Math.cos(t) + normal[0] * k,
        c[1] + r * Math.sin(t),
        c[2] + u[2] * r * Math.cos(t) + normal[2] * k,
      ];
    for (let j = 0; j < N; j++) {
      const f = (j * TAU) / N,
        g = ((j + 1) * TAU) / N;
      T(
        o,
        'steel',
        [P(f, 0.1), P(g, 0.1), [c[0] - normal[0] * 0.17, c[1], c[2] - normal[2] * 0.17]],
        normal,
      );
      T(
        o,
        'dark',
        [P(f, 0.08), P(g, 0.08), c],
        normal.map((v) => -v),
      );
    }
  }
}
function build(o, _f, d = 3) {
  piers(o, d);
  mezzanine(o, d);
  truss(o, d, 32, 154, 0.44, 0.047, [6, 8, 16, 16][d]);
  platform(o, 75, 0.34, d, true);
  if (d > 0) platform(o, 85, 0.205, d);
  stairs(o, d);
  antenna(o, d);
}
export const brasiliaTowerSkyline = (o, f) => build(o, f, 0);
export const brasiliaTowerDistrict = (o, f) => build(o, f, 1);
export const brasiliaTowerStreet = (o, f) => build(o, f, 2);
export const brasiliaTvTowerModel = {
  id: 'brasilia_tv_tower',
  key: 'brasilia_tv_tower',
  recipe: 'structure-brasilia-tv-tower.mjs',
  cell: '6v/6vj',
  title: 'Brasília TV Tower',
  category: 'communications-tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [-255, 120, 330],
  lookAt: [0, 105, 0],
  portableGroundY: -0.6,
  mediumFiContext: { scale: 1.1, groundY: -0.6 },
  qaCameras: [
    {
      name: 'three-curved-v-piers-and-triangular-glazed-mezzanine',
      position: [65, 23, 78],
      lookAt: [0, 19, 0],
    },
    {
      name: 'open-lattice-lift-stairs-and-observation-platform',
      position: [37, 93, 47],
      lookAt: [0, 78, 0],
    },
    { name: 'whole-tower-to-complete-224m-mast', position: [-240, 115, 290], lookAt: [0, 106, 0] },
    { name: 'red-white-antenna-mast-and-fixtures', position: [25, 198, 30], lookAt: [0, 185, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent180m terrain frozen at center access approach before geometry. Pier footings and exact compatible host contact remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-brasilia-tv-tower.mjs',
    level: 'skyline',
    export: 'brasiliaTowerSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'brasiliaTowerDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'brasiliaTowerStreet', errorMeters: 0.24, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Three exact2012 Daderot own CC0 originals individually inspected: already published Qualla DSC00092 first, two supplemental originals after bounded native category search. No government bare-PDM, attribution photo, stamps, copied texture or generated image used. Detached modern sculpture/art is excluded. Current structural forms represented with bounded cosmetic/equipment changes.',
    'Full original native triangle defines mezzanine perimeter/orientation; all three V supports with curved openings, glazed volume/structural soffit/roof, center ground access core, whole open steel lattice, lift/stair cage, observation and service decks, red/white mast and needle retained. Native imported18.09m height/min20m tags conflict; not used as whole-tower height. Operator confirms224m and75m observation deck.',
    'Mezzanine25..32m section, V curves/foot positions/thickness, main lattice top154m, upper mast199m/224m and service deck85m are photographic estimates. Hidden basement/interiors, exact antenna/dish count and current fixture alterations are not reconstructed. Optical glass is average neutral glazing; no reflected photo environment baked.',
    'Lower detail levels reduce truss bays, supports curves, mullions and antenna fixtures while preserving triangular body, open base, narrow complete mast and principal decks. No square lattice or opaque cone substitute. Interior maintenance stairs approximate the externally visible switchback pattern.',
    'Independent180m91x91 Terrariumfield and raw source tiles frozen before geometry; no flattened/fitted whole park ground. Model pier and access-core footings extend0.5m below datum; exact compatible live host terrain/contact unverified. Preview placement only, replaceFootprint=false. No fountain/market/plaza/landscape/paths/people/vehicles/signage/sculpture.',
  ],
};
