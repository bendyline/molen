/** Whole native six-corner L-shaped eastern courtyard hall. Sections and facade are original estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
};
const colors = {
  wall: rgb(P.wallTint),
  stone: rgb('e1d8c3'),
  roof: rgb('aca595'),
  wood: rgb('39372e'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let N = normalFor(...p);
  if (n && N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    N = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, N, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const t = new MeshBufferBuilder();
  if (
    !t.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole cap');
  const m = t.finalize();
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
function solid(o, k, r, lo, hi) {
  const area = r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sg = area < 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [-sg * (b[1] - a[1]), 0, sg * (b[0] - a[0])],
    );
  }
  cap(o, k, r, lo, -1);
  cap(o, k, r, hi, 1);
}
const area = P.nativeRing.reduce((s, a, i) => {
  const b = P.nativeRing[(i + 1) % P.nativeRing.length];
  return s + a[0] * b[1] - b[0] * a[1];
}, 0);
export function edgeFrame(i) {
  const a = P.nativeRing[i],
    b = P.nativeRing[(i + 1) % P.nativeRing.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    e = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    n = area > 0 ? [e[1], -e[0]] : [-e[1], e[0]];
  return {
    a,
    b,
    L,
    e,
    n,
    point: (t, y, d = 0) => [a[0] + e[0] * t + n[0] * d, y, a[1] + e[1] * t + n[1] * d],
  };
}
function opening(o, f, t, sill, lod, w = P.windowWidth, h = P.windowHeight) {
  const r = w / 2,
    spring = sill + h - r,
    N = [2, 2, 4, 10][lod],
    p = [
      [-r, sill],
      [r, sill],
      [r, spring],
    ];
  for (let j = 1; j <= N; j++) {
    const a = (Math.PI * j) / N;
    p.push([r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  const points = p.map(([x, y]) => f.point(t + x, y, 0.033));
  face(o, 'wood', points, [...f.n.slice(0, 1), 0, f.n[1]]);
  if (lod > 1)
    for (let i = 0; i < points.length; i++)
      beam(o, 'stone', points[i], points[(i + 1) % points.length], 0.11, 0.12, colors.stone);
  if (lod > 1) {
    beam(
      o,
      'wood',
      f.point(t, sill, 0.08),
      f.point(t, spring + r - 0.07, 0.08),
      0.075,
      0.075,
      colors.wood,
    );
    beam(
      o,
      'wood',
      f.point(t - r, sill + h * 0.45, 0.08),
      f.point(t + r, sill + h * 0.45, 0.08),
      0.07,
      0.075,
      colors.wood,
    );
    beam(
      o,
      'stone',
      f.point(t - r - 0.15, sill - 0.1, 0.13),
      f.point(t + r + 0.15, sill - 0.1, 0.13),
      0.17,
      0.24,
      colors.stone,
    );
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeRing;
  solid(o, 'stone', r, P.foundationBottom, P.floor);
  solid(o, 'wall', r, P.floor, P.roof - 0.2);
  solid(o, 'roof', r, P.roof - 0.2, P.roof);
  let windows = 0,
    doors = 0;
  for (let i = 0; i < P.nativeRing.length; i++) {
    const f = edgeFrame(i),
      inner = [
        f.a,
        [f.a[0] - f.n[0] * 0.3, f.a[1] - f.n[1] * 0.3],
        [f.b[0] - f.n[0] * 0.3, f.b[1] - f.n[1] * 0.3],
        f.b,
      ];
    if (lod > 0) solid(o, 'wall', inner, P.roof, P.parapetTop);
    const bays = P.bayCounts[i];
    for (let j = 0; j < bays; j++)
      for (let floor = 0; floor < 2; floor++) {
        const t = (f.L * (j + 0.5)) / bays,
          isDoor = i === P.frontEdge && j === Math.floor(bays / 2) && floor === 0;
        opening(
          o,
          f,
          t,
          isDoor ? P.floor : floor ? P.upperFloor + 0.75 : P.floor + 0.8,
          lod,
          isDoor ? 2.1 : P.windowWidth,
          isDoor ? 3.25 : P.windowHeight,
        );
        if (isDoor) doors++;
        else windows++;
      }
    if (lod > 0)
      for (const [y, w, h, d] of [
        [P.upperFloor - 0.25, 0.22, 0.18, 0.03],
        [P.roof - 0.35, 0.28, 0.24, 0.06],
        [P.parapetTop - 0.08, 0.38, 0.16, 0.015],
      ])
        beam(o, 'stone', f.point(0, y, d), f.point(f.L, y, d), w, h, colors.stone);
    if (lod > 1 && bays > 0)
      for (let j = 0; j <= bays; j++) {
        const t = 0.18 + ((f.L - 0.36) * j) / bays;
        beam(
          o,
          'wall',
          f.point(t, P.floor + 0.1, 0.07),
          f.point(t, P.roof - 0.4, 0.07),
          0.28,
          0.18,
          colors.wall,
        );
        if (lod > 2)
          for (const y of [P.upperFloor - 0.42, P.roof - 0.5])
            beam(
              o,
              'stone',
              f.point(t - 0.22, y, 0.14),
              f.point(t + 0.22, y, 0.14),
              0.15,
              0.14,
              colors.stone,
            );
      }
  }
  componentEvidence.push({
    lod,
    wholeOriginalPalaceRange: true,
    originalNativeCorners: P.nativeRing.length,
    nativeFeatureId: P.nativeFeatureId,
    closedWholeRoof: true,
    closedRearAndEnds: true,
    estimatedStoreys: 2,
    estimatedBayCounts: P.bayCounts,
    totalEstimatedRoundWindows: windows,
    estimatedClosedDoors: doors,
    roofParapets: lod > 0 ? P.nativeRing.length : 0,
    allOriginalConcaveReturnsRetained: true,
    balconyOrDomesInvented: false,
    allAppearanceImagesUnused: true,
    allSectionsEstimated: true,
    exactHistoricBlockNameVerified: false,
    parentPalaceNotCompleted: true,
    archSegments: [2, 2, 4, 10][lod],
    originalHeightEstimateMeters: P.roof - P.floor,
    heightNumericalEstimate: false,
    physicalSurvivalAndDateVerified: false,
    palaceMembershipEstimated: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tt/ttv/mubarak_mandi_southeastern_residential_range',
  camera = [74, 44, 70],
  look = [0, 5.5, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone_raw', 'concrete_plain', 'wood_plain'],
  qaCameras: [
    { name: 'whole-eastern-L-court-face', position: camera, lookAt: look },
    { name: 'whole-eastern-L-rear-and-roof', position: [-108, 63, -98], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-eastern-L-hall-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic estimated palace-range architecture under repository license using original numerical roof and written complex-wide architectural facts. All appearance imagery unused. Exact royal residence identity, survival/date, height/storeys, facade/roof/finish and terrain ties remain original estimates; no measured historic survey or current-world activation claimed.',
};
