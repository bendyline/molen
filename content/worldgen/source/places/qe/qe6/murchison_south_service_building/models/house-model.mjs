/** Entire separate mapped eastern MRO support building; estimated exterior, no imagery. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  R = P.nativeRing;
export const surfaces = {
  wall: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.28 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.81, metallic: 0.1 },
};
const colors = {
  wall: rgb('ccd0c3'),
  roof: rgb('89999b'),
  foundation: rgb('989b8a'),
  trim: rgb('657a7c'),
  door: rgb('b2bcb0'),
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

const xmin = Math.min(...R.map((p) => p[0])),
  xmax = Math.max(...R.map((p) => p[0])),
  zmin = Math.min(...R.map((p) => p[1])),
  zmax = Math.max(...R.map((p) => p[1]));
function box(o, k, x, z, w, d, y0, y1) {
  polygon(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', R, P.foundationBottom, P.floor);
  polygon(o, 'wall', R, P.floor, P.eaves);
  const v = R.map((p) => [p[0], P.eaves, p[1]]),
    left = [(R[0][0] + R[3][0]) / 2, P.ridge, (R[0][1] + R[3][1]) / 2],
    right = [(R[1][0] + R[2][0]) / 2, P.ridge, (R[1][1] + R[2][1]) / 2];
  face(o, 'roof', [v[0], v[1], right, left], [0, 1, 1]);
  face(o, 'roof', [v[2], v[3], left, right], [0, 1, -1]);
  face(o, 'wall', [v[0], v[3], left], [-1, 0, 0]);
  face(o, 'wall', [v[1], v[2], right], [1, 0, 0]);
  // Closed entry and exterior vents are bounded estimates, without an asserted service function.
  box(o, 'door', -1.25, zmax + 0.035, 0.98, 0.08, P.floor, P.floor + 2.15);
  for (const x of [-1.8, -0.7]) box(o, 'trim', x, zmax + 0.055, 0.09, 0.1, P.floor, P.floor + 2.23);
  box(o, 'trim', -1.25, zmax + 0.055, 1.2, 0.1, P.floor + 2.15, P.floor + 2.25);
  box(o, 'foundation', -1.25, zmax + 0.42, 1.5, 0.84, -0.03, P.floor);
  box(o, 'trim', 1.3, zmax + 0.03, 1.45, 0.08, 1.0, 2.25);
  box(o, 'door', 1.3, zmax + 0.075, 1.3, 0.06, 1.1, 2.15);
  for (const side of [-1, 1]) {
    const x = (side < 0 ? xmin : xmax) + side * 0.03;
    box(o, 'trim', x, 0, 0.08, 1.5, 1.0, 2.25);
    box(o, 'door', x + side * 0.04, 0, 0.06, 1.35, 1.1, 2.15);
  }
  if (lod > 0) {
    const bars = [0, 3, 5, 8][lod];
    for (let i = 0; i < bars; i++) {
      const y = 1.14 + (i * 0.94) / Math.max(1, bars - 1);
      box(o, 'trim', 1.3, zmax + 0.12, 1.3, 0.07, y, y + 0.045);
      for (const side of [-1, 1])
        box(o, 'trim', (side < 0 ? xmin : xmax) + side * 0.12, 0, 0.07, 1.35, y, y + 0.045);
    }
    const spacing = [1, 3, 1.5, 0.9][lod],
      nx = Math.max(2, Math.ceil((xmax - xmin) / spacing)),
      nz = Math.max(2, Math.ceil((zmax - zmin) / spacing));
    for (let i = 1; i < nx; i++) {
      const x = xmin + ((xmax - xmin) * i) / nx;
      for (const z of [zmin - 0.014, zmax + 0.014])
        box(o, 'trim', x, z, 0.022, 0.03, P.floor + 0.08, P.eaves - 0.1);
      for (const side of [-1, 1])
        beam(
          o,
          'roof',
          [x, P.ridge + 0.02, 0],
          [x, P.eaves + 0.02, (side * (zmax - zmin)) / 2],
          0.025,
          0.025,
          colors.roof,
        );
    }
    for (let i = 1; i < nz; i++) {
      const z = zmin + ((zmax - zmin) * i) / nz;
      for (const x of [xmin - 0.014, xmax + 0.014])
        box(o, 'trim', x, z, 0.03, 0.022, P.floor + 0.08, P.eaves - 0.1);
    }
  }
  // Full closed exterior of an estimated service bay; no internal equipment claimed.
  box(o, 'door', P.bayCenterX, zmax + 0.035, 2.8, 0.08, P.floor, P.floor + 2.75);
  for (const x of [P.bayCenterX - 1.47, P.bayCenterX + 1.47])
    box(o, 'trim', x, zmax + 0.065, 0.1, 0.12, P.floor, P.floor + 2.84);
  box(o, 'trim', P.bayCenterX, zmax + 0.065, 3.04, 0.12, P.floor + 2.75, P.floor + 2.86);
  if (lod > 0)
    for (let i = 1; i < [1, 4, 7, 11][lod]; i++) {
      const y = P.floor + (2.7 * i) / [1, 4, 7, 11][lod];
      box(o, 'trim', P.bayCenterX, zmax + 0.09, 2.76, 0.07, y, y + 0.035);
    }

  componentEvidence.push({
    lod,
    nativeControls: 4,
    wholeIndependentSupportBuilding: true,
    fullLongAxisGableRoof: true,
    closedEstimatedServiceBay: true,
    allFourElevations: true,
    wholeRoof: true,
    closedEntry: true,
    externalVents: true,
    baseAndEntryPad: true,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_south_service_building',
  width = xmax - xmin,
  depth = zmax - zmin,
  span = Math.max(width, depth),
  camera = [Math.max(14, width * 1.1), Math.max(9, span * 0.6), Math.max(14, depth * 1.3)],
  look = [0, 2, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'Murchison southern support building',
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
    'Whole independently mapped buildingway629781189 south of the MRO control building. All originalfourcorners/walls/fullroof/base/closedentry/closedestimatedservicebay/exteriorvents retained. Descriptive geographicaltitle; actualprecisefunction unknown. Height/roof/doors/ventilation/metalfinish/2013phase estimates explicit. Every image unused.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.43,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-entry-vents-and-roof',
      position: [width * 0.9 + 9, 11, depth + 8],
      lookAt: look,
    },
    {
      name: 'rear-whole-roof-and-side-vents',
      position: [-width * 0.8 - 8, span * 0.6 + 4, -depth - 10],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-support-building-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.15,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Original OSM numerical four-corner footprint/building type facts, ODbL attribution retained; every image unused. External form, height, roof, facade, service and finish estimates explicit.',
};
