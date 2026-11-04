/** Whole original Mansión Seré house, from written facts; all plan/finish/registration estimates explicit. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.house;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  window: { slot: 'window', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
};
const colors = {
  wall: rgb('c5c0ac'),
  roof: rgb('84665a'),
  foundation: rgb('8d887d'),
  trim: rgb('dfd9c5'),
  window: rgb('3c5148'),
  door: rgb('534b3c'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole house cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
export const mainRing = [
  [-8.2, -8],
  [8.2, -8],
  [10, -6.2],
  [10, 6.2],
  [8.2, 8],
  [-8.2, 8],
  [-10, 6.2],
  [-10, -6.2],
];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  norm = (v) => v.map((q) => q / Math.hypot(...v));
function box(o, k, x, z, w, d, y0, y1) {
  polygon(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1);
}
function panel(o, k, c, U, N, w, y0, y1, depth) {
  const r = [
    [-w / 2, -depth / 2],
    [w / 2, -depth / 2],
    [w / 2, depth / 2],
    [-w / 2, depth / 2],
  ].map(([u, n]) => c.map((v, i) => v + U[i] * u + N[i] * n));
  polygon(o, k, r, y0, y1);
}
function hip(o, k, c, w, d, eave, ridge, chamfer = 0) {
  const x = c[0],
    z = c[1],
    cut = chamfer,
    r = [
      [-w / 2 + cut, -d / 2],
      [w / 2 - cut, -d / 2],
      [w / 2, -d / 2 + cut],
      [w / 2, d / 2 - cut],
      [w / 2 - cut, d / 2],
      [-w / 2 + cut, d / 2],
      [-w / 2, d / 2 - cut],
      [-w / 2, -d / 2 + cut],
    ].map(([a, b]) => [x + a, eave, z + b]),
    half = Math.max(0.2, (w - d) / 2),
    L = [x - half, ridge, z],
    R = [x + half, ridge, z];
  face(o, k, [r[0], r[1], R, L], [0, 1, 0]);
  face(o, k, [r[4], r[5], L, R], [0, 1, 0]);
  for (const [a, b] of [
    [1, 2],
    [2, 3],
    [3, 4],
  ])
    face(o, k, [r[a], r[b], R], [0, 1, 0]);
  for (const [a, b] of [
    [5, 6],
    [6, 7],
    [7, 0],
  ])
    face(o, k, [r[a], r[b], L], [0, 1, 0]);
  // A real thin eave/soffit closes the whole roof edge, including the chamfered hips.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = sub(b, a);
    if (Math.hypot(v[0], v[2]) < 1e-5) continue;
    face(o, 'trim', [[a[0], eave - 0.16, a[2]], [b[0], eave - 0.16, b[2]], b, a], [v[2], 0, -v[0]]);
  }
  cap(
    o,
    'trim',
    r
      .filter((v, i) => i === 0 || Math.hypot(v[0] - r[i - 1][0], v[2] - r[i - 1][2]) > 1e-6)
      .map((p) => [p[0], p[2]]),
    eave - 0.16,
    -1,
  );
  box(o, k, x, z, half * 2 + 0.18, 0.22, ridge - 0.03, ridge + 0.1);
}
function course(o, r, y, w = 0.13, height = 0.16) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      U = norm(sub(b, a)),
      N = [U[1], -U[0]],
      c = a.map((v, k) => (v + b[k]) / 2 + N[k] * 0.04);
    panel(o, 'trim', c, U, N, Math.hypot(...sub(b, a)) + 0.03, y, y + height, w);
  }
}
function shutter(o, c, U, N, base, w, lod) {
  const h = 2.15,
    at = (t) => c.map((v, i) => v + N[i] * t);
  panel(o, 'trim', at(0.06), U, N, w + 0.28, base - 0.13, base + h + 0.13, 0.14);
  panel(o, 'window', at(0.15), U, N, w, base, base + h, 0.14);
  panel(o, 'trim', at(0.18), U, N, w + 0.38, base - 0.19, base - 0.05, 0.32);
  if (lod > 0) {
    panel(o, 'window', at(0.25), U, N, 0.065, base, base + h, 0.08);
    for (const s of [-1, 1])
      panel(
        o,
        'window',
        at(0.25).map((v, i) => v + U[i] * s * (w / 2 - 0.055)),
        U,
        N,
        0.065,
        base,
        base + h,
        0.09,
      );
  }
  if (lod > 1) {
    const n = lod === 3 ? 9 : 4;
    for (let i = 0; i < n; i++)
      panel(
        o,
        'window',
        at(0.255),
        U,
        N,
        w - 0.13,
        base + 0.13 + ((h - 0.26) * i) / n,
        base + 0.17 + ((h - 0.26) * i) / n,
        0.13,
      );
  }
}
function paving(o) {
  const r = mainRing.map(([x, z]) => [
    x + Math.sign(x) * P.paving.width,
    z + Math.sign(z) * P.paving.width,
  ]);
  for (let i = 0; i < r.length; i++)
    face(
      o,
      'foundation',
      [
        [r[i][0], P.paving.top, r[i][1]],
        [r[(i + 1) % r.length][0], P.paving.top, r[(i + 1) % r.length][1]],
        [mainRing[(i + 1) % r.length][0], P.paving.top, mainRing[(i + 1) % r.length][1]],
        [mainRing[i][0], P.paving.top, mainRing[i][1]],
      ],
      [0, 1, 0],
    );
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', mainRing, H.foundationBottom, P.floor + 0.05);
  polygon(o, 'wall', mainRing, P.floor, H.eaves - 0.13);
  hip(o, 'roof', [0, 0], H.width + 1, H.depth + 1, H.eaves, H.ridge, H.chamfer);
  for (const y of [P.floor + 0.12, P.floor + H.floorHeight, H.eaves - 0.38])
    course(o, mainRing, y, 0.18, y > 8 ? 0.28 : 0.15);
  if (lod > 0) paving(o);
  const A = P.annex,
    L = P.link;
  box(o, 'foundation', ...A.center, A.width, A.depth, H.foundationBottom, P.floor);
  box(o, 'wall', ...A.center, A.width, A.depth, P.floor, A.eaves);
  hip(o, 'roof', A.center, A.width + 0.55, A.depth + 0.55, A.eaves, A.ridge, 0.01);
  box(o, 'wall', ...L.center, L.width, L.depth, P.floor, L.roof - 0.22);
  box(o, 'roof', ...L.center, L.width + 0.22, L.depth + 0.22, L.roof - 0.22, L.roof);
  for (let i = 0; i < mainRing.length; i++) {
    const a = mainRing[i],
      b = mainRing[(i + 1) % mainRing.length],
      U = norm(sub(b, a)),
      N = [U[1], -U[0]],
      len = Math.hypot(...sub(b, a)),
      corner = len < 3,
      n = corner ? 1 : i === 0 || i === 4 ? [3, 5, 6, 6][lod] : [2, 3, 4, 4][lod];
    for (let floor = 0; floor < 2; floor++)
      for (let j = 0; j < n; j++) {
        if (i === 7 && floor === 0) continue;
        const t = (j + 0.5) / n,
          c = a.map((v, k) => v + (b[k] - v) * t);
        if (lod === 0) {
          panel(
            o,
            'window',
            c.map((v, k) => v + N[k] * 0.11),
            U,
            N,
            corner ? 0.85 : 1.12,
            P.floor + floor * H.floorHeight + 1.0,
            P.floor + floor * H.floorHeight + 3.15,
            0.13,
          );
        } else
          shutter(o, c, U, N, P.floor + floor * H.floorHeight + 1.0, corner ? 0.85 : 1.12, lod);
      }
  }
  const a = mainRing[7],
    b = mainRing[0],
    U = norm(sub(b, a)),
    N = [U[1], -U[0]],
    c = a.map((v, i) => (v + b[i]) / 2);
  panel(
    o,
    'trim',
    c.map((v, i) => v + N[i] * 0.08),
    U,
    N,
    1.55,
    P.floor,
    P.floor + 3.15,
    0.2,
  );
  panel(
    o,
    'door',
    c.map((v, i) => v + N[i] * 0.21),
    U,
    N,
    1.2,
    P.floor,
    P.floor + 2.95,
    0.15,
  );
  if (lod > 0)
    panel(
      o,
      'trim',
      c.map((v, i) => v + N[i] * 0.32),
      U,
      N,
      0.08,
      P.floor + 0.18,
      P.floor + 2.85,
      0.06,
    );
  for (let i = 0; i < 3; i++) {
    const t = (3 - i) * 0.32,
      cc = c.map((v, k) => v + N[k] * t);
    panel(o, 'foundation', cc, U, N, 2.0, P.floor - (3 - i) * 0.08, P.floor - (2 - i) * 0.08, 0.5);
  }
  if (lod > 0) {
    const south = [0, 1];
    for (const x of [5.4, 9.4])
      shutter(o, [x, A.center[1] + A.depth / 2], [1, 0], south, P.floor + 1.0, 1.05, lod);
    panel(
      o,
      'door',
      [A.center[0] + A.width / 2 + 0.08, 16],
      [0, 1],
      [1, 0],
      1.0,
      P.floor,
      P.floor + 2.7,
      0.16,
    );
  }
  componentEvidence.push({
    kind: 'whole-original-house',
    storeys: 2,
    basementBase: true,
    fullHippedMainRoof: true,
    allElevations: true,
    chamferedCornerEntry: true,
    threeEntrySteps: true,
    fullAnnexAndLink: true,
    estimatedWholePlan: true,
    notModernChaletCanopyOrSportsHall: true,
    lod,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/69/69y/mansion_sere',
  camera = [-36, 26, -42],
  look = [0, 4, 5];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: '69/69y',
  title: 'Mansión Seré — complete original house, approximate1977',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Complete original1900French-style two-storeyMansionSere, whole hippedtile roof/chamferedcorners/tallclosedshutters/cornerentry/three steps/basementbase/perimeterpaving/fullS-SEannex andconnectinglink. Writtennational/provincial/archaeologist/testimonyfacts only; everyimageunused. Wholeplan/sizes/finish/roofandsections/siteposition explicitly estimated; no modernchalet/sportshall/canopyproxy.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.68,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map((s) => s.graph))],
  qaCameras: [
    {
      name: 'whole-corner-entry-shutters-hipped-roof',
      position: [-27, 13, -30],
      lookAt: [-2, 4, 0],
    },
    {
      name: 'whole-south-southeast-annex-link-and-roofs',
      position: [28, 24, 40],
      lookAt: [3, 4, 8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-original-house-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Allimages/photos/plans/drawingsunused; primarywrittenfacts and originalProtomaps/OSMnumericstreetcontext only. Exacthistoricplan/size/section/finish/siteposition estimated, no surveyedregistration or current-building replacement.',
};
