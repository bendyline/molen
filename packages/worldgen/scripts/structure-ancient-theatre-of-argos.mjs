/** Surviving rock-cut theatre: native17-point scope, worn central rows and low stage ruins. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sw/sw8/ancient_theatre_of_argos/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('c9c7bc'),
    rock: rgb('b4b0a2'),
    earth: rgb('bcad92'),
    brick: rgb('b48e75'),
    wood: rgb('a89d86'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
    rock: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
    earth: { slot: 'wall', graph: 'gravel', roughness: 0.98, metallic: 0 },
    brick: { slot: 'trim', graph: 'brick', roughness: 0.98, metallic: 0 },
    wood: { slot: 'roof', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      s,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
}

const r = p.outline,
  P = p.parameters,
  [cx, cz] = P.orchestraCentre,
  vary = (c, t) => c.map((v) => Math.min(1, v * t)),
  seed = (i, j) => (((i + 17) * 73856093) ^ ((j + 23) * 19349663)) >>> 0;
function polar(a, R, y) {
  return [cx + Math.sin(a) * R, y, cz + Math.cos(a) * R];
}
function inside(x, z) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > z !== r[j][1] > z &&
      x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  return yes;
}
function rowStart(i) {
  return (
    P.innerSeatRadius +
    i * P.rowRun +
    P.landingsAfterRows.filter((n) => n <= i).length * P.landingWidth
  );
}
function bedY(q) {
  if (q[1] <= cz) return 0.02;
  const R = Math.hypot(q[0] - cx, q[1] - cz);
  for (let i = 0; i < P.seatRows; i++) {
    const a = rowStart(i),
      b = a + P.rowRun;
    if (R <= b)
      return Math.max(0.02, i * P.rowRise + (Math.max(0, R - a) / P.rowRun) * P.rowRise - 0.055);
    if (P.landingsAfterRows.includes(i + 1) && R < b + P.landingWidth)
      return (i + 1) * P.rowRise - 0.055;
  }
  return P.seatRows * P.rowRise + Math.max(0, R - rowStart(P.seatRows)) * 0.08 - 0.055;
}
function substrate(o, d) {
  const n = [16, 24, 40, 56][d],
    outer = r.flat(),
    hole = Array.from({ length: n }, (_, i) => [
      cx + P.orchestraRadius * Math.sin((i * Math.PI * 2) / n),
      cz + P.orchestraRadius * Math.cos((i * Math.PI * 2) / n),
    ]),
    coords = [...outer, ...hole.flat()],
    ix = earcut(coords, [r.length]),
    point = (k) => [coords[k * 2], coords[k * 2 + 1]];
  // The carved steps themselves are the uphill exposed rock surface. A broad interpolated
  // cap would cover the lower rows; retain only the excavated floor in front of the cavea.
  for (let i = 0; i < ix.length; i += 3) {
    let poly = ix.slice(i, i + 3).map(point);
    const out = [];
    for (let j = 0; j < poly.length; j++) {
      const a = poly[j],
        b = poly[(j + 1) % poly.length],
        u = cz - a[1],
        v = cz - b[1];
      if (u >= 0) out.push(a);
      if (u > 0 !== v > 0) {
        const t = u / (u - v);
        out.push(a.map((x, k) => x + (b[k] - x) * t));
      }
    }
    poly = out;
    for (let j = 1; j < poly.length - 1; j++)
      T(
        o,
        'earth',
        [poly[0], poly[j], poly[j + 1]].map((q) => [q[0], 0.02, q[1]]),
        [0, 1, 0],
      );
  }
  bands(o, 13, 14, 0.02, 0.025, d, -1, true);
  bands(o, rowStart(83), 76, 83 * P.rowRise, 83 * P.rowRise + 0.015, d, 83, true);
  // Hidden carved-substrate closure is approximate geology, not an altered host terrain field.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [b[1] - a[1], 0, a[0] - b[0]],
      h = bedY(a),
      k = bedY(b);
    Q(
      o,
      'rock',
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], k, b[1]],
        [a[0], h, a[1]],
      ],
      n,
    );
  }
  cap(o, 'rock', r, 0, false);
  const circle = Array.from({ length: n }, (_, i) => [
    cx + Math.sin((i * Math.PI * 2) / n) * 13,
    cz + Math.cos((i * Math.PI * 2) / n) * 13,
  ]);
  cap(o, 'earth', circle, 0.015);
}
function angles(R, d, stairs = true) {
  const n = [10, 20, 40, 72][d],
    a = Array.from({ length: n + 1 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / n);
  if (stairs)
    for (const t of P.radialStairAngles)
      a.push(t - P.stairWidth / (2 * R), t + P.stairWidth / (2 * R));
  return a.sort((x, y) => x - y).filter((x, i, a) => !i || x - a[i - 1] > 1e-6);
}
function confined(v) {
  if (inside(v[0], v[2])) return v;
  let distance = Infinity,
    result = v;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((v[0] - a[0]) * dx + (v[2] - a[1]) * dz) / (dx * dx + dz * dz)),
    );
    const x = a[0] + t * dx,
      z = a[1] + t * dz,
      d = Math.hypot(v[0] - x, v[2] - z);
    if (d < distance) {
      distance = d;
      result = [x, v[1], z];
    }
  }
  return result;
}
function bands(o, lo, hi, y0, y1, d, index, landing = false) {
  const aa = angles((lo + hi) / 2, d, !landing);
  for (let j = 0; j < aa.length - 1; j++) {
    const a = aa[j],
      b = aa[j + 1],
      mid = (a + b) / 2,
      at = polar(mid, (lo + hi) / 2, 0);
    if (!inside(at[0], at[2])) continue;
    if (!landing && P.radialStairAngles.some((t) => Math.abs(t - mid) < P.stairWidth / (lo + hi)))
      continue;
    const lost = !landing && d > 1 && index > 53 && seed(index, j) % 41 === 0,
      col = lost ? C.rock : vary(C.stone, 0.96 + (seed(index, j) % 9) * 0.008),
      chip = d > 1 && !landing ? ((seed(index, j) % 5) - 2) * 0.009 : 0,
      Y = y1 + chip;
    const A = confined(polar(a, lo, Y)),
      B = confined(polar(b, lo, Y)),
      D = confined(polar(a, hi, Y)),
      E = confined(polar(b, hi, Y));
    Q(o, lost ? 'rock' : 'stone', [A, B, E, D], [0, 1, 0], col);
    if (!landing)
      Q(
        o,
        'stone',
        [confined(polar(a, lo, y0)), confined(polar(b, lo, y0)), B, A],
        [Math.sin(mid), 0, Math.cos(mid)].map((v) => -v),
        col,
      );
  }
}
function cavea(o, d) {
  const group = [7, 3, 1, 1][d];
  for (let i = 0; i < P.seatRows; i += group) {
    const last = Math.min(i + group, P.seatRows),
      lo = rowStart(i),
      hi = rowStart(last - 1) + P.rowRun;
    bands(o, lo, hi, i * P.rowRise, last * P.rowRise, d, i);
  }
  for (const after of P.landingsAfterRows) {
    const lo = rowStart(after - 1) + P.rowRun;
    bands(o, lo, lo + P.landingWidth, after * P.rowRise, after * P.rowRise + 0.018, d, after, true);
  }
  for (const a of P.radialStairAngles) {
    if (d === 0) {
      const A = polar(a, rowStart(0), 0.015),
        B = polar(a, rowStart(83), 83 * P.rowRise),
        u = [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45];
      Q(
        o,
        'stone',
        [
          A.map((v, k) => v - u[k]),
          A.map((v, k) => v + u[k]),
          B.map((v, k) => v + u[k]),
          B.map((v, k) => v - u[k]),
        ],
        [0, 1, 0],
      );
      continue;
    }
    const count = d === 1 ? 28 : 166;
    for (let j = 0; j < count; j++) {
      const i = d === 1 ? Math.floor((j * 83) / 28) : Math.floor(j / 2),
        half = d === 1 ? 0 : j % 2,
        last = d === 1 ? Math.min(83, Math.floor(((j + 1) * 83) / 28)) : i + 1,
        lo = d === 1 ? rowStart(i) : rowStart(i) + (half * P.rowRun) / 2,
        hi = d === 1 ? rowStart(last - 1) + P.rowRun : lo + P.rowRun / 2,
        y = d === 1 ? last * P.rowRise : i * P.rowRise + ((half + 1) * P.rowRise) / 2,
        lower = d === 1 ? i * P.rowRise : i * P.rowRise + (half * P.rowRise) / 2,
        aa = a - 0.45 / lo,
        bb = a + 0.45 / lo,
        at = polar(a, hi, 0);
      if (!inside(at[0], at[2])) continue;
      Q(
        o,
        'stone',
        [polar(aa, lo, y), polar(bb, lo, y), polar(bb, hi, y), polar(aa, hi, y)],
        [0, 1, 0],
        C.stone,
      );
      Q(
        o,
        'stone',
        [polar(aa, lo, lower), polar(bb, lo, lower), polar(bb, lo, y), polar(aa, lo, y)],
        [-Math.sin(a), 0, -Math.cos(a)],
        C.stone,
      );
    }
    if (d > 1)
      for (const n of P.landingsAfterRows) {
        const lo = rowStart(n - 1) + P.rowRun,
          hi = lo + P.landingWidth,
          aa = a - 0.45 / lo,
          bb = a + 0.45 / lo;
        Q(
          o,
          'stone',
          [
            polar(aa, lo, n * P.rowRise + 0.02),
            polar(bb, lo, n * P.rowRise + 0.02),
            polar(bb, hi, n * P.rowRise + 0.02),
            polar(aa, hi, n * P.rowRise + 0.02),
          ],
          [0, 1, 0],
        );
      }
  }
}
function orchestra(o, d) {
  const n = [16, 24, 48, 72][d],
    segments = [
      [-2.9, -1.9],
      [-1.6, -0.45],
      [-0.15, 1.0],
      [1.5, 2.25],
      [2.55, 2.9],
    ];
  for (const [a, b] of segments) {
    const count = Math.ceil(((b - a) * n) / (Math.PI * 2));
    for (let i = 0; i < count; i++) {
      const t = a + ((b - a) * i) / count,
        u = a + ((b - a) * (i + 1)) / count;
      Q(
        o,
        'stone',
        [
          polar(t, 9.15, 0.075),
          polar(u, 9.15, 0.075),
          polar(u, 9.46, 0.075),
          polar(t, 9.46, 0.075),
        ],
        [0, 1, 0],
        rgb('d2cbb9'),
      );
    }
  }
  if (d > 0) {
    for (const z of [cz + 1.8, cz + 3.2])
      box(o, 'stone', cx + 0.1, 0.02, z, 0.82, 0.055, 0.22, rgb('ccc5b2'));
    for (const [x, z] of [
      [cx - 6, cz - 10.6],
      [cx + 5.5, cz + 10.9],
      [cx - 11.8, cz + 0.4],
    ])
      box(o, 'stone', x, 0.03, z, 0.62, 0.2, 0.52, rgb('c2beaf'));
  }
}
function drum(o, x, z, y, h, rad, d, broken = 0) {
  const n = [5, 6, 8, 10][d],
    ring = (Y) =>
      Array.from({ length: n }, (_, i) => [
        x + Math.cos((i * Math.PI * 2) / n) * rad,
        Y + (broken ? ((seed(i, broken) % 5) - 2) * 0.035 : 0),
        z + Math.sin((i * Math.PI * 2) / n) * rad,
      ]);
  const A = ring(y),
    B = ring(y + h);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      'stone',
      [A[i], A[j], B[j], B[i]],
      [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
    );
  }
  for (let i = 1; i < n - 1; i++) T(o, 'stone', [B[0], B[i], B[i + 1]], [0, 1, 0]);
}
function stage(o, d) {
  const z = P.frontStageZ - 1.4;
  box(o, 'wood', cx, 0.48, z, 24.4, 0.14, 2.5);
  const n = d === 0 ? 6 : 16;
  for (let i = 0; i < n; i++) {
    const x = cx - 11.8 + ((i + 0.5) * 23.6) / n;
    box(o, 'brick', x, 0, z + 1.14, 0.43, 0.48, 0.54, rgb('b69b82'));
  }
  // Fragmentary scene/portico foundations remain low. Historical tall columns are not reconstructed.
  for (const [x, Z, w, l, h] of [
    [cx, -19.2, 24, 0.64, 0.42],
    [cx - 11.8, -17.8, 0.75, 5.6, 0.58],
    [cx + 11.8, -17.8, 0.75, 5.6, 0.42],
    [cx - 8.2, -16.0, 4.8, 0.7, 0.5],
    [cx + 5.6, -16.1, 5.6, 0.8, 0.36],
  ])
    box(o, 'rock', x, 0, Z, w, h, l, rgb('b8ae98'));
  if (d > 0)
    for (const [x, Z] of [
      [cx - 9, -18],
      [cx - 4, -19.1],
      [cx + 2.4, -19.2],
      [cx + 9, -18.9],
    ])
      drum(o, x, Z, 0.22, 0.48, 0.32, d, Math.floor(x + 40));
  const blocks = d === 0 ? 8 : d === 1 ? 16 : d === 2 ? 30 : 52;
  for (let i = 0; i < blocks; i++) {
    const side = i % 2 ? -1 : 1,
      x = cx + side * (11.8 + (seed(i, 2) % 12) * 0.15),
      Z = -9 - (seed(i, 9) % 115) * 0.1,
      w = 0.5 + (seed(i, 7) % 8) * 0.09,
      h = 0.2 + (seed(i, 8) % 7) * 0.08,
      l = 0.45 + (seed(i, 6) % 9) * 0.1;
    box(
      o,
      i % 4 === 0 ? 'brick' : 'stone',
      x,
      0.03,
      Z,
      w,
      h,
      l,
      vary(C.stone, 0.92 + (i % 7) * 0.018),
    );
  }
  if (d > 1) {
    for (let x = cx - 11.9; x < cx + 12; x += 0.72)
      box(o, 'wood', x, 0.625, z, 0.018, 0.005, 2.46, rgb('928a77'));
    for (const [x, Z] of [
      [cx - 10, -17.8],
      [cx + 8.5, -19],
    ])
      box(o, 'stone', x, 0.15, Z, 0.75, 0.58, 0.58);
  }
}
function build(o, _f, d = 3) {
  substrate(o, d);
  cavea(o, d);
  orchestra(o, d);
  stage(o, d);
}
export const ancientTheatreOfArgosSkyline = (o, f) => build(o, f, 0),
  ancientTheatreOfArgosDistrict = (o, f) => build(o, f, 1),
  ancientTheatreOfArgosStreet = (o, f) => build(o, f, 2),
  ancientTheatreOfArgosCloseup = (o, f) => build(o, f, 3);
export const ancientTheatreOfArgosModel = {
  id: 'ancient_theatre_of_argos',
  key: 'ancient_theatre_of_argos',
  cell: 'sw/sw8',
  recipe: 'structure-ancient-theatre-of-argos.mjs',
  title: 'Ancient Theatre of Argos',
  category: 'performance-sport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [85, 79, -108],
  lookAt: [-4, 11, 27],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.1, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-surviving-theatre-worn-narrow-cavea-and-low-stage',
      position: [84, 83, -87],
      lookAt: [-4, 12, 28],
      reviewLod: 'skyline',
    },
    {
      name: 'eighty-three-rock-cut-rows-four-cunei-stairs-and-two-landings',
      position: [30, 33, 4],
      lookAt: [-5, 17, 42],
    },
    {
      name: 'orchestra-partial-guide-ring-and-low-fragmentary-scene',
      position: [31, 33, -35],
      lookAt: [-4, 1, -5],
    },
    {
      name: 'down-cavea-surviving-curved-wings-and-restored-low-proscenium',
      position: [-4, 36, 71],
      lookAt: [-4, 0, -9],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129-square2m hillside field frozen before geometry, not fitted/flattened to seating. Intrinsic cut-rock substrate closure/row rise are approximate geology/architecture; host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ancient-theatre-of-argos.mjs',
    level: 'skyline',
    export: 'ancientTheatreOfArgosSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'ancientTheatreOfArgosDistrict', errorMeters: 2, surfaces },
      street: { export: 'ancientTheatreOfArgosStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'ancientTheatreOfArgosCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole surviving excavated ruin, not an ideal ancient-complete semicircular theatre. All17native control vertices preserved;83 row positions and two landings represented at street/closeup, aggregated far away. Surviving central strip tapers uphill within native outline; lower curved wings/3radial stairs/4cunei/26morchestra/partial low guide ring and fragmentary scene/portico remains retained. Individual chips/lost courses, surviving wing/landing exact limits/row rise and bedrock foundation depth are approximate. Intrinsic carved substrate closure is not a claimed geological survey.',
    'Nine cleared published CC0 files individually inspected:3exact original-byte matches and6existing1920px Qualla renditions, kept distinct. Pitched rock seat surfaces irregular/stylized, not photogrammetry. Current photographed low proscenium/capping/deck and foundation fragments remain low; original tall Roman scene/colonnades/velarium are not reconstructed. Native37.71mstage scope and official historical24.4x2.5mproscenium/24x5.6mportico constrain estimated surviving stage scale; precise modern deck/foundation fragment/drum placement unmeasured.',
    'Independent256m129-square2mfield/all16641values/4originalTerrariumtiles/PNG frozen before geometry unchanged. Provider-relative orchestra datum33.5554m/sourcepixel3.78341m/absolute16.0497–90.1412m, not survey accuracy. Seat rise and substrate are not terrain fits; actual host grade contact unverified. Flat render fixtures are separate from real hillside; ordinary preview/replaceFootprintfalse.',
    'Separate Roman baths/odeon/nymphaeum/citadel/city and general surrounding hill/trees/grass/fences/lights/visitors/interiors excluded. No protected source photos/plans/unknown hero image/generated bitmap or photo textures adopted.',
  ],
};
