/** Entire separate mapped western MRO support building; estimated exterior, no imagery. */
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
export const entryX = xmax - xmin < 4 ? -0.45 : -1.25,
  ventX = xmax - xmin < 4 ? 0.72 : 1.3,
  ventWidth = xmax - xmin < 4 ? 0.86 : 1.3;
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', R, P.foundationBottom, P.floor);
  polygon(o, 'wall', R, P.floor, P.eaves);
  polygon(o, 'roof', R, P.eaves, P.roofTop);
  // Full original outline and roof remain at every distance; rim follows all four original edges.
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    beam(
      o,
      'trim',
      [a[0], P.parapetTop - 0.045, a[1]],
      [b[0], P.parapetTop - 0.045, b[1]],
      0.09,
      0.09,
      colors.trim,
    );
  }
  // Bounded exterior estimates, sized to the narrow body rather than copied outside its walls.
  box(o, 'door', entryX, zmax + 0.035, 0.88, 0.08, P.floor, P.floor + 2.1);
  for (const x of [entryX - 0.49, entryX + 0.49])
    box(o, 'trim', x, zmax + 0.055, 0.07, 0.1, P.floor, P.floor + 2.18);
  box(o, 'trim', entryX, zmax + 0.055, 1.05, 0.1, P.floor + 2.1, P.floor + 2.2);
  box(o, 'foundation', entryX, zmax + 0.38, 1.2, 0.76, -0.03, P.floor);
  box(o, 'trim', ventX, zmax + 0.03, ventWidth + 0.15, 0.08, 1.0, 2.2);
  box(o, 'door', ventX, zmax + 0.075, ventWidth, 0.06, 1.1, 2.1);
  for (const side of [-1, 1]) {
    const x = (side < 0 ? xmin : xmax) + side * 0.03;
    box(o, 'trim', x, 0, 0.08, 1.5, 1.0, 2.2);
    box(o, 'door', x + side * 0.04, 0, 0.06, 1.35, 1.1, 2.1);
  }
  if (lod > 0) {
    const bars = [0, 3, 5, 8][lod],
      spacing = [Infinity, 1.8, 1.2, 0.75][lod];
    for (let i = 0; i < bars; i++) {
      const y = 1.14 + (i * 0.88) / Math.max(1, bars - 1);
      box(o, 'trim', ventX, zmax + 0.12, ventWidth, 0.07, y, y + 0.045);
      for (const side of [-1, 1])
        box(o, 'trim', (side < 0 ? xmin : xmax) + side * 0.12, 0, 0.07, 1.35, y, y + 0.045);
    }
    const nx = Math.ceil((xmax - xmin) / spacing),
      nz = Math.ceil((zmax - zmin) / spacing);
    for (let i = 1; i < nx; i++) {
      const x = xmin + ((xmax - xmin) * i) / nx;
      for (const z of [zmin - 0.014, zmax + 0.014])
        box(o, 'trim', x, z, 0.022, 0.03, P.floor + 0.08, P.eaves - 0.1);
    }
    for (let i = 1; i < nz; i++) {
      const z = zmin + ((zmax - zmin) * i) / nz;
      for (const x of [xmin - 0.014, xmax + 0.014])
        box(o, 'trim', x, z, 0.03, 0.022, P.floor + 0.08, P.eaves - 0.1);
      beam(
        o,
        'roof',
        [xmin + 0.06, P.roofTop + 0.012, z],
        [xmax - 0.06, P.roofTop + 0.012, z],
        0.022,
        0.022,
        colors.roof,
      );
    }
  }
  componentEvidence.push({
    lod,
    nativeControls: 4,
    wholeIndependentSupportBuilding: true,
    allFourElevations: true,
    wholeRoof: true,
    closedEntry: true,
    externalVents: true,
    baseAndEntryPad: true,
    notWholeObservatoryProxy: true,
    fullFlatRoofAndPerimeterRim: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_mwa_central_service_building',
  camera = [10.123, 9, 10.776],
  look = [0, 1.5, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'Murchison MWA central support building',
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
    'Whole independently mapped buildingway629792386 near the original MWA core. All originalfourcorners/walls/full flat roof/base/closedentry/exteriorvents retained. Descriptive geographicaltitle; actualprecisefunction unknown. Height/flat roof/doors/ventilation/metal finish/2013 phase estimates explicit. Every image unused.',
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
    { name: 'whole-entry-vents-and-roof', position: [14, 6, 10], lookAt: look },
    { name: 'rear-whole-roof-and-side-vents', position: [-13, 8, -12], lookAt: look },
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
