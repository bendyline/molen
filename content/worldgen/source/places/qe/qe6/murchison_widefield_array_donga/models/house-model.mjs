/** Entire named MWA Donga; original numerical plan, explicitly estimated exterior. */
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
  window: { slot: 'window', graph: 'window_punched', roughness: 0.24, metallic: 0.05 },
};
const colors = {
  wall: rgb('ccd0c3'),
  roof: rgb('89999b'),
  foundation: rgb('989b8a'),
  trim: rgb('657a7c'),
  door: rgb('b2bcb0'),
  window: rgb('607e86'),
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
    front = [(R[0][0] + R[1][0]) / 2, P.ridge, (R[0][1] + R[1][1]) / 2],
    back = [(R[2][0] + R[3][0]) / 2, P.ridge, (R[2][1] + R[3][1]) / 2];
  face(o, 'roof', [v[0], front, back, v[3]], [-1, 1, 0]);
  face(o, 'roof', [v[1], v[2], back, front], [1, 1, 0]);
  face(o, 'wall', [v[0], v[1], front], [0, 0, 1]);
  face(o, 'wall', [v[2], v[3], back], [0, 0, -1]);
  // The main entry and closed windows are bounded exterior estimates, never traced imagery.
  box(o, 'door', xmax + 0.032, 0, 0.07, 0.92, P.floor, P.floor + 2.1);
  for (const z of [-0.51, 0.51])
    box(o, 'trim', xmax + 0.055, z, 0.09, 0.09, P.floor, P.floor + 2.18);
  box(o, 'trim', xmax + 0.055, 0, 0.09, 1.12, P.floor + 2.1, P.floor + 2.2);
  box(o, 'foundation', xmax + 0.38, 0, 0.76, 1.35, -0.03, P.floor);
  for (const side of [-1, 1])
    for (const z of [-3.1, 3.1]) {
      const x = (side < 0 ? xmin : xmax) + side * 0.028;
      box(o, 'window', x, z, 0.07, 1.25, 1.15, 2.05);
      if (lod > 0) {
        for (const dz of [-0.67, 0.67])
          box(o, 'trim', x + side * 0.025, z + dz, 0.09, 0.07, 1.08, 2.12);
        for (const y of [1.1, 2.08]) box(o, 'trim', x + side * 0.025, z, 0.09, 1.4, y, y + 0.06);
        if (lod > 1) box(o, 'trim', x + side * 0.04, z, 0.09, 0.05, 1.15, 2.05);
      }
    }
  box(o, 'door', xmin - 0.23, 3.1, 0.46, 0.9, 1.05, 1.7);
  box(o, 'trim', xmin - 0.25, 3.1, 0.52, 1, 1.7, 1.77);
  if (lod > 0) {
    const n = [0, 8, 14, 22][lod];
    for (let i = 1; i < n; i++) {
      const z = zmin + ((zmax - zmin) * i) / n;
      for (const x of [xmin - 0.014, xmax + 0.014])
        box(o, 'trim', x, z, 0.028, 0.022, P.floor + 0.1, P.eaves - 0.08);
    }
    for (let i = 1; i < [1, 7, 13, 20][lod]; i++) {
      const z = zmin + ((zmax - zmin) * i) / [1, 7, 13, 20][lod];
      for (const side of [-1, 1]) {
        beam(
          o,
          'roof',
          [0, P.ridge + 0.02, z],
          [side * 1.67, P.eaves + 0.02, z],
          0.025,
          0.025,
          colors.roof,
        );
      }
    }
    for (let i = 0; i < [0, 2, 4, 6][lod]; i++)
      box(o, 'trim', xmin - 0.47, 2.76 + (i * 0.68) / [1, 2, 4, 6][lod], 0.03, 0.035, 1.13, 1.6);
  }
  componentEvidence.push({
    lod,
    nativeControls: 4,
    wholeIndependentDonga: true,
    allFourElevations: true,
    wholeRoof: true,
    closedEntry: true,
    closedWindows: 4,
    intrinsicEstimatedServiceUnit: true,
    baseAndEntryPad: true,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_widefield_array_donga',
  camera = [13, 9, 16],
  look = [0, 1.5, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'Murchison Widefield Array field donga',
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
    'Whole named MWA Donga: original four-corner numerical building footprint, all walls, entire estimated shallow gable roof/base/closed entry/four closed windows/attached service unit. Height, roof, facade, finish and2013retrospective phase estimates explicit. Independent geographic building, never a substitute for the whole observatory.',
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
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain', 'window_punched'],
  qaCameras: [
    { name: 'whole-long-entry-elevation-and-roof', position: [14, 6, 10], lookAt: look },
    { name: 'rear-service-unit-full-roof-and-windows', position: [-13, 8, -12], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-donga-${reviewLod}`,
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
    'Original deterministic procedural geometry under repository license. Original OSM numerical four-corner footprint/name/building facts, ODbL attribution retained; every image unused. External form, height, roof, facade, service and finish estimates explicit.',
};
