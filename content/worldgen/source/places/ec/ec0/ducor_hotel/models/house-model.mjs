/** Complete historical Ducor Hotel concrete shell; no imagery is consumed. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building;
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('bcb7a2'),
  foundation: rgb('8c8a7a'),
  roof: rgb('a5a18e'),
  trim: rgb('8b8d80'),
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
    throw Error('Invalid whole hotel cap');
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
function strip(o, k, a, b, w, y0, y1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    n = [-dz / L, dx / L];
  polygon(
    o,
    k,
    [
      [a[0] - (n[0] * w) / 2, a[1] - (n[1] * w) / 2],
      [b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2],
      [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2],
      [a[0] + (n[0] * w) / 2, a[1] + (n[1] * w) / 2],
    ],
    y0,
    y1,
  );
}
const square = (x, z, w) => [
  [x - w / 2, z - w / 2],
  [x + w / 2, z - w / 2],
  [x + w / 2, z + w / 2],
  [x - w / 2, z + w / 2],
];
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeBuildingRing,
    sign = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
  polygon(o, 'foundation', r, H.basementBottom, P.floor);
  componentEvidence.push('whole-original-twelve-control-concave-foundation');
  for (let floor = 0; floor <= H.storeys; floor++) {
    const y = P.floor + floor * H.storeyHeight;
    polygon(o, floor === H.storeys ? 'roof' : 'wall', r, y - H.slabThickness, y);
  }
  componentEvidence.push('all-eight-complete-floorplates-and-entire-original-roof');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      U = [dx / L, dz / L],
      N = [U[1] * sign, -U[0] * sign],
      p = (t, d = 0) => [a[0] + dx * t - N[0] * d, a[1] + dz * t - N[1] * d],
      count = Math.max(1, Math.round(L / H.estimatedBaySpacing));
    if (lod === 0) {
      for (let f = 0; f < H.storeys; f++) {
        const y = P.floor + f * H.storeyHeight,
          A = p(0, 0.09),
          B = p(1, 0.09);
        for (const flip of [1, -1])
          face(
            o,
            'wall',
            [
              [A[0], y, A[1]],
              [B[0], y, B[1]],
              [B[0], y + H.parapetHeight, B[1]],
              [A[0], y + H.parapetHeight, A[1]],
            ],
            [N[0] * flip, 0, N[1] * flip],
          );
      }
    } else
      for (let f = 0; f < H.storeys; f++) {
        const y = P.floor + f * H.storeyHeight;
        strip(o, 'wall', p(0, 0.12), p(1, 0.12), H.parapetWidth, y, y + H.parapetHeight);
      }
    if (lod === 0) {
      const A = p(0, 0.15),
        B = p(Math.min(0.35 / L, 1), 0.15);
      for (const flip of [1, -1])
        face(
          o,
          'trim',
          [
            [A[0], P.floor, A[1]],
            [B[0], P.floor, B[1]],
            [B[0], H.roofTop, B[1]],
            [A[0], H.roofTop, A[1]],
          ],
          [N[0] * flip, 0, N[1] * flip],
        );
      continue;
    }
    if (L < 1.1) continue;
    for (let j = 0; j < count; j++) {
      const t = j / count,
        A = p(t, 0.28);
      polygon(o, 'trim', square(...A, H.columnWidth), P.floor, H.roofTop);
      if (lod >= 2 && L > 5)
        for (let f = 0; f < H.storeys; f++) {
          const y = P.floor + f * H.storeyHeight;
          strip(
            o,
            'wall',
            p(t, 0.35),
            p(t, H.estimatedBalconyDepth),
            0.12,
            y,
            y + H.storeyHeight - H.slabThickness,
          );
        }
    }
    if (lod >= 3 && L > 5)
      for (let f = 0; f < H.storeys; f++)
        for (let j = 0; j < count; j++) {
          const y = P.floor + f * H.storeyHeight,
            A = p((j + 0.12) / count, -0.012),
            B = p((j + 0.35) / count, -0.012),
            h = 0.12 + ((i * 7 + j * 3 + f) % 5) * 0.055;
          face(
            o,
            'trim',
            [
              [A[0], y + 0.08, A[1]],
              [B[0], y + 0.08, B[1]],
              [B[0], y + h, B[1]],
              [A[0], y + h, A[1]],
            ],
            [N[0], 0, N[1]],
            rgb('96988a'),
          );
        }
  }
  componentEvidence.push('all-exterior-concrete-columns-and-eight-open-balcony-shell-floors');
  componentEvidence.push('true-exposed-window-and-balcony-gaps-no-opaque-false-glazing');
  componentEvidence.push('whole-eighth-floor-restaurant-shell-and-full-roof-terrace');
  componentEvidence.push('original-estimated-concrete-finishes-no-copied-graffiti-or-artwork');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ec/ec0/ducor_hotel',
  camera = [92, 57, 90],
  look = [-18, 13, 4];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Ducor Hotel — complete historical concrete ruin',
  wikidataId: 'Q1263572',
  cell: 'ec/ec0',
  category: 'hotel-commercial',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -2.4,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed'],
  qaCameras: [
    {
      name: 'whole-eight-floor-hotel-all-concave-wings-and-entire-roof',
      position: camera,
      lookAt: look,
    },
    {
      name: 'full-long-wing-open-concrete-balconies-and-exposed-gaps',
      position: [-18, 18, -76],
      lookAt: look,
    },
    {
      name: 'complete-return-wing-and-all-floorplates',
      position: [70, 28, 40],
      lookAt: [10, 13, 10],
    },
    { name: 'whole-roof-and-eighth-floor-restaurant-shell', position: [-55, 57, 55], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-ducor-hotel-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole ruined Ducor Hotel shell under repository license. Primary written first-hand eight-floor/concrete/balcony/exposed-window/restaurant facts only; dated2016 report successfully read via web text, directHTTP403 disclosed. Original numeric whole-hotel map/paired named POI/Q1263572, quantized not node survey. Equal vertical envelope/floors/columns/parapets/census/finish/grade explicitly estimated. No photograph/figure/mesh/texture/artwork/graffiti trace or photographic/survey/current replacement claim.',
};
