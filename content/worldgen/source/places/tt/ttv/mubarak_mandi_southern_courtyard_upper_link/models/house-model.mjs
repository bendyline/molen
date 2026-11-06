/** Complete inferred elevated connection; all sections/details explicitly estimated. */
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
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const colors = {
  wall: rgb('c8b9aa'),
  stone: rgb('dfd2b5'),
  roof: rgb('a59d8c'),
  wood: rgb('4c4139'),
};
export const componentEvidence = [];
const lerp = (a, b, t) => a + (b - a) * t;
export const floorAt = (u) => lerp(P.interfaces[0].floor, P.interfaces[1].floor, u),
  roofAt = (u) => lerp(P.interfaces[0].roof, P.interfaces[1].roof, u),
  parapetAt = (u) => lerp(P.interfaces[0].parapet, P.interfaces[1].parapet, u);
export function archAt(u) {
  const t = Math.max(0, Math.min(1, u)),
    spring = lerp(P.interfaces[0].archSpring, P.interfaces[1].archSpring, u),
    rise = floorAt(u) - P.archCrownBelowFloor - spring;
  return spring + rise * Math.sin(Math.PI * t);
}
export function mapPlan(u, v) {
  const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
  return [0, 1].map((k) => P.gapQuad.reduce((s, p, i) => s + p[k] * w[i], 0));
}
export const point = (u, y, v) => {
  const [x, z] = mapPlan(u, v);
  return [x, y, z];
};
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function uvCap(o, k, r, h, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => 0,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid link cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3)).map((j) =>
      point(m.positions[j * 3], h(m.positions[j * 3]), m.positions[j * 3 + 2]),
    );
    face(o, k, ps, [0, up, 0]);
  }
}
function solid(o, k, r, lo, hi) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = mapPlan(...a),
      B = mapPlan(...b);
    face(
      o,
      k,
      [
        point(a[0], lo(a[0]), a[1]),
        point(b[0], lo(b[0]), b[1]),
        point(b[0], hi(b[0]), b[1]),
        point(a[0], hi(a[0]), a[1]),
      ],
      [B[1] - A[1], 0, A[0] - B[0]],
    );
  }
  uvCap(o, k, r, lo, -1);
  uvCap(o, k, r, hi, 1);
}
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
function gateway(o, lod) {
  const a = -P.bearingFraction,
    b = 1 + P.bearingFraction,
    n = [4, 8, 12, 20][lod],
    profile = Array.from({ length: n + 1 }, (_, i) => {
      const u = lerp(a, b, i / n);
      return [u, archAt(u)];
    });
  profile.push([b, floorAt(b)], [a, floorAt(a)]);
  for (let i = 0; i < profile.length; i++) {
    const A = profile[i],
      B = profile[(i + 1) % profile.length];
    face(o, i < n ? 'stone' : 'wall', [
      point(A[0], A[1], 0),
      point(B[0], B[1], 0),
      point(B[0], B[1], 1),
      point(A[0], A[1], 1),
    ]);
  }
  for (const [v, sign] of [
    [0, -1],
    [1, 1],
  ]) {
    const t = new MeshBufferBuilder();
    if (
      !t.addCap(
        'wall',
        'palette:#ffffff',
        profile,
        [],
        () => v,
        [0, 1, 0],
        (p) => p,
        colors.wall,
      )
    )
      throw Error('Invalid gateway profile');
    const m = t.finalize();
    for (let i = 0; i < m.indices.length; i += 3)
      face(
        o,
        'wall',
        Array.from(m.indices.slice(i, i + 3)).map((j) =>
          point(m.positions[j * 3], m.positions[j * 3 + 2], m.positions[j * 3 + 1]),
        ),
        [0, 0, sign],
      );
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const a = -P.bearingFraction,
    b = 1 + P.bearingFraction,
    r = rect(a, 0, b, 1),
    du = 0.22 / P.span,
    dv = P.wallThickness / P.depthOffset;
  gateway(o, lod);
  solid(o, 'wall', r, floorAt, (u) => roofAt(u) - P.roofThickness);
  solid(o, 'roof', r, (u) => roofAt(u) - P.roofThickness, roofAt);
  for (const q of [
    rect(a, 0, b, dv),
    rect(a, 1 - dv, b, 1),
    rect(a, dv, a + du, 1 - dv),
    rect(b - du, dv, b, 1 - dv),
  ])
    solid(o, 'wall', q, roofAt, parapetAt);
  const front = P.windowProjection / P.depthOffset,
    wr =
      lod === 0
        ? rect(0.33, -front, 0.67, 0.015)
        : [
            [0.33, -front * 0.65],
            [0.38, -front],
            [0.62, -front],
            [0.67, -front * 0.65],
            [0.67, 0.015],
            [0.33, 0.015],
          ];
  solid(
    o,
    'wall',
    wr,
    (u) => floorAt(u) + 0.95,
    (u) => floorAt(u) + 3.25,
  );
  solid(
    o,
    'stone',
    wr,
    (u) => floorAt(u) + 0.8,
    (u) => floorAt(u) + 0.95,
  );
  solid(
    o,
    'stone',
    wr,
    (u) => floorAt(u) + 3.25,
    (u) => floorAt(u) + 3.42,
  );
  face(
    o,
    'wood',
    [
      point(0.395, floorAt(0.395) + 1.15, -front - 0.001),
      point(0.605, floorAt(0.605) + 1.15, -front - 0.001),
      point(0.605, floorAt(0.605) + 3.02, -front - 0.001),
      point(0.395, floorAt(0.395) + 3.02, -front - 0.001),
    ],
    [0, 0, -1],
  );
  face(
    o,
    'wood',
    [
      point(0.35, floorAt(0.35) + 1, 1.001),
      point(0.65, floorAt(0.65) + 1, 1.001),
      point(0.65, floorAt(0.65) + 3.05, 1.001),
      point(0.35, floorAt(0.35) + 3.05, 1.001),
    ],
    [0, 0, 1],
  );
  let brackets = 0;
  if (lod > 1) {
    for (const u of [0.395, 0.5, 0.605])
      beam(
        o,
        'stone',
        point(u, floorAt(u) + 1.05, -front - 0.004),
        point(u, floorAt(u) + 3.12, -front - 0.004),
        0.055,
        0.055,
        colors.stone,
      );
    for (const u of [0.36, 0.64]) {
      beam(
        o,
        'stone',
        point(u, floorAt(u) + 0.3, -0.004),
        point(u, floorAt(u) + 0.8, -front * 0.9),
        0.14,
        0.14,
        colors.stone,
      );
      brackets++;
    }
    for (const d of [-0.08, 0.06])
      for (const q of [
        rect(a - 0.008, -0.025, b + 0.008, 0.025),
        rect(a - 0.008, 0.975, b + 0.008, 1.025),
        rect(a - 0.008, 0.025, a + 0.018, 0.975),
        rect(b - 0.018, 0.025, b + 0.008, 0.975),
      ])
        solid(
          o,
          'stone',
          q,
          (u) => roofAt(u) + d,
          (u) => roofAt(u) + d + 0.07,
        );
  }
  componentEvidence.push({
    lod,
    wholeEnclosedUpperLink: true,
    wholeDeckAndRoof: true,
    completeGatewayArch: true,
    closedEndInterfaces: true,
    frontProjectingWindowVolumes: 1,
    rearClosedWindowPanels: 1,
    standaloneSupportPiers: 0,
    slopedInputInterfacesRetained: true,
    allAppearanceImagesUnused: true,
    exactPairIdentityIndependentlyVerified: false,
    allSectionsEstimated: true,
    acceptedHallInputsUnchanged: true,
    archSegments: [4, 8, 12, 20][lod],
    estimatedWindowBrackets: brackets,
    parentPalaceNotCompleted: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tt/ttv/mubarak_mandi_southern_courtyard_upper_link',
  camera = [18, 15, 18],
  look = [0, 8.4, 0];
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
    { name: 'whole-upper-link-gateway-arch-and-projecting-window', position: camera, lookAt: look },
    {
      name: 'opposite-enclosure-roof-and-sloped-end-interfaces',
      position: [-18, 15, -18],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-upper-link-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Original numerical adjacent hall context © OpenStreetMap contributors, ODbL-1.0; inferred connector footprint and all link sections/details are original estimates from primary written upper-connection/deorhi fact. Every appearance image/plan/figure unused. No exact historic gateway name or surveyed link pairing claimed. Accepted hall inputs unchanged; no whole-palace completion/current-world activation.',
};
