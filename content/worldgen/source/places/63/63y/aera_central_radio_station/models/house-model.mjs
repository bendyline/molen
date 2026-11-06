/** Whole nominal40ft CRS housing and known roof sensor; explicit source/registration estimates. */
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
let bodyOffset = 0;
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(
    k,
    'palette:#ffffff',
    p.map((q) => [q[0] + bodyOffset, q[1], q[2]]),
    v,
    (q) => [q[0], q[1]],
    tint,
  );
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
    throw Error('Invalid CRS cap');
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
  strut = (o, k, a, b, w = 0.05, tint = colors[k]) =>
    beam(o, k, [a[0] + bodyOffset, a[1], a[2]], [b[0] + bodyOffset, b[1], b[2]], w, w, tint);
function buildContainer(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const w = P.nominalLengthMeters,
    d = P.assumedWidthMeters,
    x = w / 2,
    z = d / 2,
    y = P.casingBottom,
    h = P.roof;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(
        o,
        'foundation',
        sx * (x - 0.35),
        sz * (z - 0.22),
        0.7,
        0.65,
        P.foundationBottom,
        P.foundationTop,
      );
  for (let i = 0; i < 4; i++) {
    const a = P.containerRing[i],
      b = P.containerRing[(i + 1) % 4];
    face(
      o,
      'wall',
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], h, b[1]],
        [a[0], h, a[1]],
      ],
      [b[1] - a[1], 0, -(b[0] - a[0])],
    );
  }
  cap(o, 'wall', P.containerRing, y, -1);
  cap(o, 'roof', P.containerRing, h, 1);
  // Steel underframe and corner castings retain a whole shipping-container body at every LOD.
  for (const sz of [-1, 1])
    box(o, 'steel', 0, sz * (z - 0.075), w, 0.15, P.foundationTop, y + 0.08);
  for (const sx of [-1, 1])
    box(o, 'steel', sx * (x - 0.075), 0, 0.15, d, P.foundationTop, y + 0.08);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      for (const yy of [y, h - 0.16])
        box(o, 'steel', sx * (x - 0.095), sz * (z - 0.095), 0.19, 0.19, yy, yy + 0.16);
      if (lod >= 1) strut(o, 'steel', [sx * x, y, sz * z], [sx * x, h, sz * z], 0.08);
    }
  // Closed personnel door on a long side; location unverified.
  box(o, 'steel', -3, -z - 0.045, 1.02, 0.09, y, y + 2.12, rgb('b8c5bb'));
  // Closed cargo doors at the east end. Two leaves and hinge/locking detail are estimates.
  for (const s of [-1, 1])
    box(o, 'steel', x + 0.035, s * 0.58, 0.07, 1.14, y + 0.08, h - 0.14, rgb('bec9c0'));
  if (lod >= 1) {
    for (const sz of [-1, 1]) {
      strut(o, 'steel', [-x, h, sz * z], [x, h, sz * z], 0.075);
      box(o, 'steel', 3.7, sz * (z + 0.04), 0.6, 0.08, y + 1.05, y + 1.6, rgb('87988c'));
    }
    for (const sx of [-1, 1]) strut(o, 'steel', [sx * x, h, -z], [sx * x, h, z], 0.075);
    for (const sz of [-1, 1])
      strut(o, 'steel', [x + 0.09, y + 0.3, sz * 0.45], [x + 0.09, h - 0.3, sz * 0.45], 0.045);
  }
  if (lod >= 2) {
    const n = lod === 2 ? 24 : 48;
    for (let j = 1; j < n; j++)
      for (const sz of [-1, 1]) {
        const xx = -x + (j * w) / n;
        if (sz < 0 && Math.abs(xx + 3) < 0.55) continue;
        strut(
          o,
          'wall',
          [xx, y + 0.13, sz * (z + 0.022)],
          [xx, h - 0.1, sz * (z + 0.022)],
          0.035,
          rgb('bfcac1'),
        );
      }
    for (let j = 1; j < 10; j++) {
      const zz = -z + (j * d) / 10;
      strut(
        o,
        'wall',
        [-x - 0.022, y + 0.15, zz],
        [-x - 0.022, h - 0.12, zz],
        0.035,
        rgb('bfcac1'),
      );
    }
    for (const sz of [-1, 1])
      for (const yy of [y + 0.4, h - 0.5])
        box(o, 'steel', x + 0.1, sz * (z - 0.15), 0.1, 0.22, yy, yy + 0.12);
    strut(o, 'steel', [-2.63, y + 0.9, -z - 0.11], [-2.63, y + 1.1, -z - 0.11], 0.035);
    for (const sx of [-1, 1])
      for (let j = 0; j < 3; j++)
        strut(
          o,
          'steel',
          [3.45, y + 1.13 + j * 0.13, sx * (z + 0.09)],
          [3.95, y + 1.13 + j * 0.13, sx * (z + 0.09)],
          0.018,
        );
  }
  componentEvidence.push({
    lod,
    wholeBody: true,
    fullRoof: true,
    allWalls: true,
    underframe: true,
    concretePiers: 4,
    closedCargoDoors: 2,
    closedServiceEntry: true,
    closedRoofCovers: 0,
    nominalLengthMeters: w,
    assumedWidthMeters: d,
    assumedHeightMeters: P.assumedHeightMeters,
    outlineEstimated: true,
    headingEstimated: true,
    notWholeCompoundOrObservatoryProxy: true,
  });
}

function cylinderY(o, k, x, z, r, y0, y1, n, tint) {
  prism(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      z + r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    y0,
    y1,
    tint,
  );
}
export function buildHouse(o, f, lod = 3) {
  bodyOffset = P.bodyCenterX;
  buildContainer(o, f, lod);
  bodyOffset = 0;
  const n = [6, 8, 10, 12][lod],
    y = P.sensorFaceHeight,
    x = P.sensorX;
  box(o, 'steel', P.mastX, 0, 0.18, 0.18, P.roof, P.roof + 0.035);
  cylinderY(o, 'steel', P.mastX, 0, 0.025, P.roof + 0.035, P.mastTop, n);
  box(o, 'wall', x, 0, P.sensorEnvelope[0], P.sensorEnvelope[1], y, y + P.sensorEnvelope[2]);
  strut(o, 'steel', [P.mastX, y + 0.23, 0], [x, y + 0.23, 0], 0.035);
  cylinderY(o, 'steel', x, 0, 0.064, y - 0.007, y + 0.004, n, rgb('39474b'));
  if (lod >= 2) {
    box(o, 'steel', x, 0, 0.157, 0.157, y + 0.014, y + 0.03);
    for (const z of [-0.055, 0.055]) cylinderY(o, 'steel', x, z, 0.007, y + 0.432, y + 0.439, 6);
  }
  Object.assign(componentEvidence[0], {
    wholeHousing: true,
    knownRoofSensor: 1,
    sensorFaceHeight: y,
    sensorMountEstimated: true,
    bodyOffsetEstimated: true,
    otherWeatherInstrumentsSeparate: true,
    solarArraySeparate: true,
    noOpticalRoofCovers: true,
  });
}

export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);

const root = `content/worldgen/source/places/${P.cell}/${P.model}`,
  camera = [P.bodyCenterX + 18, 10, 16],
  look = [P.bodyCenterX, 1.8, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  wikidataId: 'Q794886',
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
  groundContactBasis:
    'Reviewed nominalY0ground contact at the original measured roof-reference horizontal point, using unchanged original source elevation. Four support piers extend below nominalground; .2m support top/.35m casing bottom are initial explicit estimates. Original1558.385m rooftop altitude is not a ground datum; historic grading and exact vertical registration unverified.',
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
    scale: 0.3,
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
    {
      name: 'whole-CRS-housing-cargo-doors-and-roof-EFM',
      position: [P.bodyCenterX + 17, 7, 15],
      lookAt: look,
    },
    {
      name: 'whole-opposite-service-entry-and-roof-sensor',
      position: [P.bodyCenterX - 18, 8, -16],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-radio-housing-${reviewLod}`,
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
      district: { export: 'houseDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.03, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Original researcher numerical roof point and written40ft ISO housing class/roof sensor height; all photographs, figures, plans, diagrams and image-derived descriptions unused. Width/height/body offset/facing/exterior detail/phase and grade explicit estimates.',
};
