/** Whole low summit station; body, placement, sections and rubble layout are explicit estimates. */
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
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  soil: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
  screen: { slot: 'trim', graph: 'metal_painted', roughness: 0.96, metallic: 0.1 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.15 },
};
const colors = {
  concrete: rgb('a5a18c'),
  foundation: rgb('8b8c7c'),
  roof: rgb('aaa58f'),
  stone: rgb('777e70'),
  soil: rgb('9f7952'),
  screen: rgb('292f2c'),
  steel: rgb('61594e'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
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
    throw Error('Invalid station cap');
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
function prism(o, k, r, y0, y1) {
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
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
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function rock(o, x, z, w, d, h, y, seed) {
  const n = 5,
    phase = (seed % 11) * 0.15,
    r0 = Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n,
        scale = 0.85 + ((seed * 13 + i * 7) % 11) / 55;
      return [x + Math.cos(a) * w * 0.5 * scale, z + Math.sin(a) * d * 0.5 * scale];
    }),
    r1 = r0.map(([a, b], i) => [x + (a - x) * (0.62 + (i % 2) * 0.16), z + (b - z) * 0.7]),
    bottom = r0.map(([a, b]) => [a, y, b]),
    shoulder = r0.map(([a, b]) => [a, y + h * 0.65, b]),
    top = r1.map(([a, b]) => [a, y + h, b]);
  cap(o, 'stone', r0, y, -1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(o, 'stone', [bottom[i], bottom[j], shoulder[j], shoulder[i]]);
    face(o, 'stone', [shoulder[i], shoulder[j], top[j], top[i]]);
  }
  cap(o, 'stone', r1, y + h, 1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    sg = Math.sign(
      R.reduce((s, a, i) => {
        const b = R[(i + 1) % R.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    );
  prism(o, 'foundation', R, P.foundationBottom, P.floor);
  prism(o, 'concrete', R, P.floor, P.wallBottomTop);
  prism(o, 'concrete', R, P.slitTop, P.soffit);
  const roof = R.map(([x, z]) => [
    x + Math.sign(x) * P.roofOverhang,
    z + Math.sign(z) * P.roofOverhang,
  ]);
  prism(o, 'roof', roof, P.soffit, P.roofTop);
  let panels = 0,
    reveals = 0,
    mullions = 0,
    latticeLines = 0;
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [((b[1] - a[1]) / L) * sg, 0, (-(b[0] - a[0]) / L) * sg],
      at = (t, y, off = 0) => [
        a[0] + ((b[0] - a[0]) * t) / L + n[0] * off,
        y,
        a[1] + ((b[1] - a[1]) * t) / L + n[2] * off,
      ];
    if (i === 0) {
      face(
        o,
        'concrete',
        [at(0, P.wallBottomTop), at(L, P.wallBottomTop), at(L, P.slitTop), at(0, P.slitTop)],
        n,
      );
      continue;
    }
    const depth = lod > 0 ? -P.screenDepth : 0;
    face(
      o,
      'screen',
      [
        at(0, P.wallBottomTop, depth),
        at(L, P.wallBottomTop, depth),
        at(L, P.slitTop, depth),
        at(0, P.slitTop, depth),
      ],
      n,
    );
    panels++;
    if (lod > 0) {
      face(
        o,
        'concrete',
        [
          at(0, P.wallBottomTop),
          at(L, P.wallBottomTop),
          at(L, P.wallBottomTop, -P.wallThickness),
          at(0, P.wallBottomTop, -P.wallThickness),
        ],
        [0, 1, 0],
      );
      face(
        o,
        'concrete',
        [
          at(0, P.slitTop),
          at(0, P.slitTop, -P.wallThickness),
          at(L, P.slitTop, -P.wallThickness),
          at(L, P.slitTop),
        ],
        [0, -1, 0],
      );
      reveals += 2;
      const count = i === 3 ? P.screenPanelsPerFront : Math.max(2, Math.round(L / 0.95));
      for (let j = 0; j <= count; j++) {
        const t = (L * j) / count;
        beam(
          o,
          'steel',
          at(t, P.wallBottomTop, -0.01),
          at(t, P.slitTop, -0.01),
          0.055,
          0.065,
          colors.steel,
        );
        mullions++;
      }
      for (const y of [P.wallBottomTop + 0.025, P.slitTop - 0.025])
        beam(o, 'steel', at(0, y, -0.005), at(L, y, -0.005), 0.055, 0.07, colors.steel);
      if (lod > 1) {
        const spacing = lod === 2 ? 0.26 : 0.15,
          dy = P.slitTop - P.wallBottomTop;
        for (let t = -dy; t < L; t += spacing) {
          const lo = Math.max(0, t),
            hi = Math.min(L, t + dy);
          if (hi - lo < 0.02) continue;
          beam(
            o,
            'steel',
            at(lo, P.wallBottomTop + lo - t, -0.075),
            at(hi, P.wallBottomTop + hi - t, -0.075),
            0.014,
            0.014,
            colors.steel,
          );
          const l2 = Math.max(0, t),
            h2 = Math.min(L, t + dy);
          beam(
            o,
            'steel',
            at(l2, P.slitTop - l2 + t, -0.075),
            at(h2, P.slitTop - h2 + t, -0.075),
            0.014,
            0.014,
            colors.steel,
          );
          latticeLines += 2;
        }
      }
    }
  }
  // Closed rear access is an unobserved original estimate; it never cuts a guessed interior.
  face(
    o,
    'screen',
    [
      [-0.5, P.floor, -3.215],
      [0.5, P.floor, -3.215],
      [0.5, 1.8, -3.215],
      [-0.5, 1.8, -3.215],
    ],
    [0, 0, -1],
  );
  if (lod > 1) {
    for (const x of [-0.51, 0.51])
      beam(o, 'steel', [x, P.floor, -3.23], [x, 1.81, -3.23], 0.05, 0.05, colors.steel);
    beam(o, 'steel', [-0.51, 1.81, -3.23], [0.51, 1.81, -3.23], 0.05, 0.05, colors.steel);
  }
  const berm0 = R.map((p) => p.map((v) => v * 0.96)),
    berm1 = R.map((p) => p.map((v) => v * 0.6));
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length;
    face(o, 'soil', [
      [berm0[i][0], P.roofTop + 0.05, berm0[i][1]],
      [berm0[j][0], P.roofTop + 0.05, berm0[j][1]],
      [berm1[j][0], P.coverTop, berm1[j][1]],
      [berm1[i][0], P.coverTop, berm1[i][1]],
    ]);
  }
  cap(o, 'soil', berm0, P.roofTop + 0.05, -1);
  cap(o, 'soil', berm1, P.coverTop, 1);
  let stones = 0;
  for (let row = 0; row < (lod > 1 ? 2 : 1); row++) {
    for (let i = 0; i < R.length; i++) {
      const a = R[i],
        b = R[(i + 1) % R.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.ceil(L / [2.4, 1.7, 1.5, 1.15][lod]);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          shrink = row === 0 ? 0.94 : 0.77,
          x = (a[0] + (b[0] - a[0]) * t) * shrink,
          z = (a[1] + (b[1] - a[1]) * t) * shrink,
          h = row === 0 ? 0.65 : 0.45,
          y = row === 0 ? P.roofTop + 0.02 : P.roofTop + 0.44;
        rock(
          o,
          x,
          z,
          Math.max(0.7, L / count) * 0.9,
          row === 0 ? 1.15 : 0.85,
          h,
          y,
          i * 73 + j * 13 + row * 19,
        );
        stones++;
      }
    }
  }
  componentEvidence.push({
    lod,
    wholeIndependentStation: true,
    estimatedPlanControls: 6,
    originalMappedFootprint: false,
    bodyCoordinateSurveyed: false,
    completeLowerBody: true,
    closedRear: true,
    panoramicScreenFaces: panels,
    projectingConcreteSlab: true,
    wholeBoundedStoneSoilCover: true,
    stoneCount: stones,
    slitReveals: reveals,
    screenMullions: mullions,
    latticeLines,
    rearEntryEstimated: true,
    noNaturalHillMesh: true,
    noSeparatePlatformOrCasemateProxy: true,
    heightMeasured: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/9q/9q8/hawk_hill_battery_commander_station',
  camera = [19, 10, 19],
  look = [0, 1.3, 0];
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
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'stone_basalt_raw',
    'stone_sandstone_raw',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-station-screened-panorama-and-camouflage-cap', position: camera, lookAt: look },
    {
      name: 'opposite-closed-rear-and-complete-stone-roof',
      position: [-19, 10, -19],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-low-station-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Two individually credited public-domain NPS agency photographs, with exact original bytes/native credits and explicit agency policy. Original OSM summit/footway numerical context © OpenStreetMap contributors, ODbL-1.0; not a body footprint. Whole station coordinate, facing, plan, sections, detailed census and precise2013appearance are original estimates. No photographic texture, contractor plan, report graphic or natural hill mesh.',
};
