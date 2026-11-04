/** Whole independent electric-field station; primary written records, no source imagery. */
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
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.7, metallic: 0.65 },
  casing: { slot: 'wall', graph: 'metal_painted', roughness: 0.82, metallic: 0.2 },
  solar: { slot: 'trim', graph: 'metal_painted', roughness: 0.42, metallic: 0.25 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
  steel: rgb('a8b0af'),
  casing: rgb('d5d9d4'),
  solar: rgb('1b304d'),
  stone: rgb('8b8980'),
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
    throw Error('Invalid LIDAR cap');
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

function cylinder(o, k, x, z, r, y0, y1, n) {
  prism(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      z + r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    y0,
    y1,
  );
}
function slab(o, k, p, depth) {
  const n = normalFor(...p),
    b = p.map((q) => q.map((v, i) => v - n[i] * depth));
  face(o, k, p, n);
  face(
    o,
    k,
    [...b].reverse(),
    n.map((v) => -v),
  );
  for (let i = 0; i < 4; i++) face(o, k, [p[i], b[i], b[(i + 1) % 4], p[(i + 1) % 4]], null);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [6, 8, 10, 12][lod],
    sx = P.sensorOffset;
  cylinder(o, 'steel', 0, 0, P.mastDiameter / 2, 0.025, P.mastTop, n);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3,
      x = P.tripodRadius * Math.cos(a),
      z = P.tripodRadius * Math.sin(a);
    strut(o, 'steel', [x, 0.055, z], [0, P.tripodJoint, 0], lod ? 0.045 : 0.055);
    box(o, 'steel', x, z, 0.18, 0.12, 0.015, 0.055);
    if (P.footType === 'earth-nails-and-small-cairns') {
      box(o, 'stone', x - 0.08, z, 0.24, 0.23, -0.08, 0.12);
      if (lod >= 1) {
        box(o, 'stone', x + 0.075, z + 0.04, 0.17, 0.15, 0.03, 0.19);
        box(o, 'stone', x - 0.04, z - 0.07, 0.14, 0.13, 0.1, 0.24);
      }
      if (lod >= 2) cylinder(o, 'steel', x + 0.04, z, 0.009, -0.22, 0.075, 6);
    } else box(o, 'foundation', x, z, 0.24, 0.24, -0.25, 0.04);
    if (lod >= 1) strut(o, 'steel', [x, 0.07, z], [0, 0.35, 0], 0.025);
  }
  box(
    o,
    'casing',
    sx,
    0,
    P.sensorEnvelope[0],
    P.sensorEnvelope[1],
    P.sensorFaceHeight,
    P.sensorFaceHeight + P.sensorEnvelope[2],
  );
  strut(o, 'steel', [0, 2.23, 0], [sx, 2.23, 0], 0.035);
  cylinder(o, 'solar', sx, 0, 0.064, P.sensorFaceHeight - 0.007, P.sensorFaceHeight + 0.004, n);
  if (lod >= 2) {
    box(o, 'steel', sx, 0, 0.157, 0.157, 2.014, 2.03);
    for (const z of [-0.055, 0.055]) cylinder(o, 'steel', sx, z, 0.007, 2.432, 2.439, 6);
  }
  const [x, z] = P.boxCenter,
    [w, d, h] = P.boxSize;
  box(o, 'casing', x, z, w, d, P.boxBottom, P.boxBottom + h);
  if (lod >= 1) {
    const rr = rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    for (let i = 0; i < 4; i++)
      strut(
        o,
        'steel',
        [rr[i][0], 0.49, rr[i][1]],
        [rr[(i + 1) % 4][0], 0.49, rr[(i + 1) % 4][1]],
        0.016,
      );
    for (const dz of [-0.2, 0.2]) {
      strut(o, 'steel', [x - w / 2 - 0.025, 0.29, z + dz], [x - w / 2 - 0.025, 0.4, z + dz], 0.02);
      box(o, 'steel', x + w / 2 + 0.012, z + dz, 0.035, 0.05, 0.38, 0.46);
    }
  }
  const solarY = (z) => 0.1 + (z + 0.9) * (0.85 / 1.15),
    panel = [
      [-0.335, -0.9],
      [-0.335, 0.25],
      [0.335, 0.25],
      [0.335, -0.9],
    ].map(([dx, dz]) => [P.solarCenterX + dx, solarY(dz), dz]);
  slab(o, 'solar', panel, 0.027);
  if (lod >= 1) for (let i = 0; i < 4; i++) strut(o, 'steel', panel[i], panel[(i + 1) % 4], 0.018);
  if (lod >= 2) {
    for (let i = 1; i < 4; i++) {
      const dx = -0.335 + (i * 0.67) / 4;
      strut(
        o,
        'steel',
        [x + dx, solarY(-0.9) + 0.004, -0.9],
        [x + dx, solarY(0.25) + 0.004, 0.25],
        0.006,
      );
    }
    for (let i = 1; i < 6; i++) {
      const dz = -0.9 + (i * 1.15) / 6;
      strut(
        o,
        'steel',
        [x - 0.335, solarY(dz) + 0.004, dz],
        [x + 0.335, solarY(dz) + 0.004, dz],
        0.006,
      );
    }
  }
  for (const dx of [-0.3, 0.3]) {
    strut(o, 'steel', [x + dx, 0.08, -0.9], [x + dx, 0.95, 0.25], 0.025);
    strut(o, 'steel', [x + dx, 0.08, 0.85], [x + dx, 0.95, 0.25], 0.025);
    strut(o, 'steel', [x + dx, 0.1, 0.1], [x + dx, 0.1, 0.85], 0.025);
  }
  if (P.hasRadioDish) {
    const dish = (y, z) => [
      -0.4 - 0.12 * (((y - 1.25) * (y - 1.25)) / (0.42 * 0.42) + (z * z) / (0.3 * 0.3)),
      y,
      z,
    ];
    if (lod === 0) box(o, 'steel', -0.46, 0, 0.045, 0.58, 0.84, 1.66);
    else {
      const count = [0, 3, 5, 7][lod],
        steps = [0, 6, 8, 10][lod];
      for (const flip of [false, true])
        for (let j = -count; j <= count; j++) {
          const t = j / (count + 1),
            r = Math.sqrt(1 - t * t);
          let last;
          for (let s = 0; s <= steps; s++) {
            const u = (-1 + (2 * s) / steps) * r,
              q = flip ? dish(1.25 + 0.42 * t, 0.3 * u) : dish(1.25 + 0.42 * u, 0.3 * t);
            if (last) strut(o, 'steel', last, q, lod === 1 ? 0.015 : 0.01);
            last = q;
          }
        }
      for (let j = 0; j < 20; j++) {
        const a = (j * 2 * Math.PI) / 20,
          b = ((j + 1) * 2 * Math.PI) / 20;
        strut(
          o,
          'steel',
          dish(1.25 + 0.42 * Math.cos(a), 0.3 * Math.sin(a)),
          dish(1.25 + 0.42 * Math.cos(b), 0.3 * Math.sin(b)),
          0.018,
        );
      }
    }
    strut(o, 'steel', [0, 1.25, 0], [-0.4, 1.25, 0], 0.04);
    if (lod >= 1) {
      strut(o, 'steel', [-0.4, 0.86, 0], [-0.73, 1.25, 0], 0.016);
      strut(o, 'steel', [-0.4, 1.64, 0], [-0.73, 1.25, 0], 0.016);
      box(o, 'casing', -0.74, 0, 0.09, 0.08, 1.21, 1.29);
      box(o, 'casing', -0.05, 0, 0.07, 0.07, 0.78, 0.96);
    }
  }
  cylinder(o, 'steel', -1.6, -0.7, 0.012, -0.55, 0.07, 6);
  if (lod >= 1) {
    strut(o, 'solar', [-1.6, 0.065, -0.7], [0, 0.07, 0], 0.012);
    strut(o, 'solar', [0, 0.07, 0], [0, 2.19, 0], 0.012);
    strut(o, 'solar', [0, 0.055, 0], [x, 0.09, 0.55], 0.015);
  }
  componentEvidence.push({
    lod,
    wholeIndependentInstrumentAssembly: true,
    tripodLegs: 3,
    sensorFaceHeight: P.sensorFaceHeight,
    closedElectronicsBox: true,
    boxSize: P.boxSize,
    solarRack: true,
    groundRod: true,
    radioDish: P.hasRadioDish,
    footType: P.footType,
    noLightningRod: true,
    noGuyWires: true,
    noFenceBoundaryInvented: true,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [5.8, 3.6, 7.4],
  look = [0.55, 1.1, 0];
export const houseModel = {
  id: P.model,
  wikidataId: 'Q794886',
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
  groundContactBasis: "Reviewed nominal Y=0 contact at the original published instrument point and unchanged original elevation field. The ground rod extends0.55m below this plane; feet/cairns meet nominal grade. Sensor face2m above the plane. Historic soil grading and exact vertical registration are explicitly approximate, not surveyed.",
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
  portableGroundY: -0.03,
  mediumFiContext: {
    scale: 0.12,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_painted',
    'metal_stainless_beadblasted',
    P.footType === 'earth-nails-and-small-cairns' ? 'stone_limestone_raw' : 'concrete_plain',
  ],
  qaCameras: [
    { name: 'whole-instrument-sensor-solar-and-electronics', position: camera, lookAt: look },
    {
      name: 'whole-opposite-tripod-grid-dish-and-anchor-stones',
      position: [-5, 3.4, -6.5],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-electric-field-station-' + reviewLod,
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
      district: { export: 'houseDistrict', errorMeters: 0.06, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.025, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Researcher original numerical station records and written equipment facts; every source photograph/figure/diagram/plan unused. Original open elevation data credited separately.',
};
