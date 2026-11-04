/** Whole HEAT enclosure in level daytime parked pose, or its adjacent service container. */
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
  wall: { slot: 'wall', graph: 'metal_painted', roughness: 0.81, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.78, metallic: 0.25 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.63, metallic: 0.6 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('d8dcd4'),
  roof: rgb('b8c0bb'),
  steel: rgb('8a9891'),
  foundation: rgb('a6a494'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up, tint = colors[k]) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      (p) => (typeof y === 'function' ? y(p) : y),
      [0, up, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Invalid HEAT cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
      tint,
    );
}
function prism(o, k, r, y0, y1, tint = colors[k]) {
  const sg = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      top = (p) => (typeof y1 === 'function' ? y1(p) : y1);
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  box = (o, k, x, z, w, d, y0, y1, tint) =>
    prism(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1, tint),
  strut = (o, k, a, b, w = 0.05, tint = colors[k]) => beam(o, k, a, b, w, w, tint);
function cylinderX(o, x, y, z, L, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      o,
      'steel',
      [
        [x - L / 2, y + r * Math.cos(a), z + r * Math.sin(a)],
        [x + L / 2, y + r * Math.cos(a), z + r * Math.sin(a)],
        [x + L / 2, y + r * Math.cos(b), z + r * Math.sin(b)],
        [x - L / 2, y + r * Math.cos(b), z + r * Math.sin(b)],
      ],
      [0, Math.cos((a + b) / 2), Math.sin((a + b) / 2)],
    );
  }
  for (const s of [-1, 1])
    face(
      o,
      'steel',
      Array.from({ length: n }, (_, i) => [
        x + (s * L) / 2,
        y + r * Math.cos((i * 2 * Math.PI) / n),
        z + r * Math.sin((i * 2 * Math.PI) / n),
      ]),
      [s, 0, 0],
    );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeRing,
    x0 = Math.min(...r.map((p) => p[0])),
    x1 = Math.max(...r.map((p) => p[0])),
    z0 = Math.min(...r.map((p) => p[1])),
    z1 = Math.max(...r.map((p) => p[1])),
    w = x1 - x0,
    d = z1 - z0,
    roof = (p) => P.roofBack + ((P.roofFront - P.roofBack) * (p[1] - z0)) / d,
    isTelescope = P.kind === 'tiltable-telescope';
  prism(o, 'foundation', r, P.foundationBottom, P.foundationTop);
  if (isTelescope) {
    prism(
      o,
      'steel',
      r.map((p) => p.map((v) => v * 0.98)),
      0.68,
      P.plateTop,
    );
    for (const s of [-1, 1]) {
      const x = s * (w / 2 + 0.1);
      cylinderX(o, x, 0.78, z1 - 0.75, 0.24, 0.23, [6, 8, 12, 16][lod]);
      strut(o, 'steel', [x, 0.3, z0 + 0.9], [x, 0.78, z1 - 1.0], [0.14, 0.12, 0.1, 0.09][lod]);
      strut(o, 'steel', [x, 0.77, z1 - 1.0], [x, 0.8, z1 - 0.6], 0.065);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      sg = Math.sign(
        r.reduce((s, p, j) => {
          const q = r[(j + 1) % 4];
          return s + p[0] * q[1] - p[1] * q[0];
        }, 0),
      );
    face(
      o,
      'wall',
      [
        [a[0], P.casingBottom, a[1]],
        [b[0], P.casingBottom, b[1]],
        [b[0], roof(b), b[1]],
        [a[0], roof(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
    if (lod >= 1)
      strut(o, 'steel', [a[0], roof(a) + 0.035, a[1]], [b[0], roof(b) + 0.035, b[1]], 0.075);
  }
  cap(o, 'wall', r, P.casingBottom, -1);
  cap(o, 'roof', r, roof, 1);
  if (isTelescope) {
    box(o, 'steel', 0, z1 + 0.06, 3.2, 0.12, 1.2, 4.36, rgb('809087'));
    for (const s of [-1, 1])
      box(o, 'wall', s * 0.77, z1 + 0.15, 1.51, 0.1, 1.28, 4.28, rgb('cbd2ca'));
    if (lod >= 2) {
      for (const s of [-1, 1])
        strut(o, 'steel', [s * 0.12, 2.55, z1 + 0.22], [s * 0.12, 2.85, z1 + 0.22], 0.045);
      for (let j = 1; j < 6; j++)
        strut(
          o,
          'steel',
          [-1.51, 1.28 + j * 0.5, z1 + 0.22],
          [1.51, 1.28 + j * 0.5, z1 + 0.22],
          0.018,
        );
    }
  }
  const doorX = isTelescope ? -0.8 : 0,
    doorBottom = P.casingBottom;
  box(o, 'steel', doorX, z0 - 0.055, 1.05, 0.11, doorBottom, doorBottom + 2.1, rgb('74877c'));
  if (lod >= 1) {
    box(
      o,
      'steel',
      w * 0.27,
      z0 - 0.06,
      0.75,
      0.12,
      doorBottom + 0.8,
      doorBottom + 1.45,
      rgb('728277'),
    );
    if (!isTelescope) box(o, 'steel', -w * 0.29, z0 - 0.25, 0.7, 0.5, 0.4, 1.25, rgb('9ba79f'));
    for (const s of [-1, 1])
      strut(
        o,
        'steel',
        [(s * w) / 2, P.casingBottom, z0],
        [(s * w) / 2, roof([(s * w) / 2, z0]), z0],
        0.075,
      );
  }
  if (isTelescope)
    for (let i = 0; i < 3; i++)
      box(o, 'foundation', doorX, z0 - 0.3 - i * 0.24, 1.25, 0.26, 0.05, 0.85 - i * 0.27);
  if (lod >= 2) {
    for (let i = 1; i < Math.ceil(d / 0.8); i++) {
      const z = z0 + (i * d) / Math.ceil(d / 0.8);
      for (const s of [-1, 1])
        strut(
          o,
          'steel',
          [(s * w) / 2, P.casingBottom + 0.04, z],
          [(s * w) / 2, roof([(s * w) / 2, z]) - 0.08, z],
          0.018,
          rgb('a9b6ac'),
        );
    }
    strut(
      o,
      'steel',
      [doorX + 0.3, doorBottom + 0.85, z0 - 0.125],
      [doorX + 0.3, doorBottom + 1.08, z0 - 0.125],
      0.035,
    );
  }
  componentEvidence.push({
    lod,
    nativeCorners: 4,
    wholeBody: true,
    fullRoof: true,
    allWalls: true,
    foundation: true,
    closedRearEntry: true,
    kind: P.kind,
    closedOpticalShutters: isTelescope,
    stowedTiltDegrees: isTelescope ? 0 : null,
    concreteAndHeavySteelBase: isTelescope,
    estimatedPivotAndHydraulicSupport: isTelescope,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [12, 8, 14],
  look = [0, 2.0, 0];
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
  brief:
    'Whole independent native HEAT enclosure or service container. Level parked telescope/closed shutters, complete steel housing/roof/base, estimated hydraulic/pivot support or closed service entry/ventilation. Written construction facts and numerical original footprint; every image unused.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.63,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_painted',
    'metal_corrugated',
    'metal_stainless_beadblasted',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'whole-front-shutter-body-and-base', position: [10, 4.5, 13], lookAt: [0, 2.0, 0.4] },
    {
      name: 'whole-rear-entry-roof-and-side-support',
      position: [-10, 5, -13],
      lookAt: [0, 2.0, -0.5],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-enclosure-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.15,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.03, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Native OSM numerical footprints ODbL attribution retained. Operator written engineering facts only; all photographs/figures/plans unused.',
};
