/** Written archaeological court/niche controls; explicit estimated historical exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  normalFor,
  beam,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  metal: { slot: 'trim', graph: 'metal_stainless', roughness: 0.6, metallic: 0.8 },
  paint: { slot: 'wall', graph: 'metal_painted', roughness: 0.85, metallic: 0 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
  pad: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  solar: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.1 },
};
const colors = {
  metal: rgb('818a8b'),
  paint: rgb('d4d9d6'),
  dark: rgb('465352'),
  pad: rgb('a5a59b'),
  solar: rgb('213b59'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
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
    throw Error('Invalid sanctuary cap');
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
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const ring = (r, n) =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * Math.PI * 2) / n),
    r * Math.sin((i * Math.PI * 2) / n),
  ]);
function box(o, k, x0, z0, x1, z1, y0, y1) {
  prism(o, k, rect(x0, z0, x1, z1), y0, y1);
}
function rod(o, k, a, b, w = P.visibleWireProfile) {
  beam(o, k, a, b, w, w, colors[k]);
}
function solarPanel(o, lod) {
  const [x, y, z] = P.solarCentre,
    slope = Math.tan((P.solarTiltDegrees * Math.PI) / 180),
    hx = P.solarSize[0] / 2,
    hz = P.solarSize[1] / 2,
    Y = (zz) => P.floor + y + (zz - z) * slope,
    ps = [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ].map(([a, b]) => [x + a, Y(z + b) + 0.025, z + b]);
  face(o, 'solar', ps, [0, 1, -slope]);
  face(o, 'dark', ps.map((p) => [p[0], p[1] - 0.05, p[2]]).reverse(), [0, -1, slope]);
  for (let i = 0; i < 4; i++) {
    const a = ps[i],
      b = ps[(i + 1) % 4];
    face(
      o,
      'metal',
      [a, b, [b[0], b[1] - 0.05, b[2]], [a[0], a[1] - 0.05, a[2]]],
      [b[2] - a[2], 0, a[0] - b[0]],
    );
  }
  for (const xx of [x - 0.35, x + 0.35])
    rod(o, 'metal', [xx, P.floor, z], [xx, P.floor + y - 0.05, z], 0.045);
  if (lod > 1) {
    for (let i = 1; i < 6; i++) {
      const xx = x - hx + (i * P.solarSize[0]) / 6;
      face(
        o,
        'paint',
        [
          [xx - 0.003, Y(z - hz) + 0.028, z - hz],
          [xx + 0.003, Y(z - hz) + 0.028, z - hz],
          [xx + 0.003, Y(z + hz) + 0.028, z + hz],
          [xx - 0.003, Y(z + hz) + 0.028, z + hz],
        ],
        [0, 1, -slope],
      );
    }
    for (let i = 1; i < 4; i++) {
      const zz = z - hz + (i * P.solarSize[1]) / 4;
      face(
        o,
        'paint',
        [
          [x - hx, Y(zz) + 0.028, zz - 0.003],
          [x + hx, Y(zz) + 0.028, zz - 0.003],
          [x + hx, Y(zz) + 0.028, zz + 0.003],
          [x - hx, Y(zz) + 0.028, zz + 0.003],
        ],
        [0, 1, -slope],
      );
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const F = P.floor;
  box(o, 'pad', -0.22, -0.22, 0.22, 0.22, P.foundationBottom, F);
  prism(o, 'metal', ring(P.mastRadius, [6, 8, 12, 16][lod]), F, F + P.feedY);
  box(o, 'paint', -0.09, -0.09, 0.09, 0.09, F + P.feedY - 0.08, F + P.feedY + 0.08);
  let dipoles = 0,
    triangles = 0;
  if (P.antennaFamily === 'lpda') {
    for (const plane of [0, 1]) {
      const point = (x, y) => (plane === 0 ? [x, F + y, 0] : [0, F + y, x]);
      for (let i = 0; i < P.lpdaElements; i++) {
        const len = 4 * Math.pow(0.82, i),
          y = 1 + (3.5 * i) / (P.lpdaElements - 1);
        rod(o, 'metal', point(-len / 2, y), point(len / 2, y));
        dipoles++;
      }
      for (const side of [-1, 1])
        rod(o, 'paint', point(side * 2, 1), point(side * 0.5, 4.5), 0.045);
    }
    for (const [x, z] of [
      [-1.9, -1.9],
      [1.9, -1.9],
      [1.9, 1.9],
      [-1.9, 1.9],
    ])
      rod(o, 'dark', [0, F + 3.1, 0], [x, F + 0.02, z], 0.012);
  } else {
    for (const plane of [0, 1])
      for (const side of [-1, 1]) {
        const point = (x, y) => (plane === 0 ? [x, F + y, 0] : [0, F + y, x]),
          a = point(0, 1.6),
          b = point(side, 1.1),
          c = point(side, 2.1);
        rod(o, 'metal', a, b);
        rod(o, 'metal', b, c);
        rod(o, 'metal', c, a);
        rod(o, 'paint', point(0, 1.3), point(side, 1.6), 0.025);
        triangles++;
      }
  }
  box(o, 'paint', -1.65, 0.95, -1.05, 1.45, F + 0.08, F + 0.8);
  prism(
    o,
    'paint',
    ring(0.018, [4, 6, 8, 10][lod]).map((p) => [p[0] - 1.48, p[1] + 1.18]),
    F + 0.8,
    F + 1.25,
  );
  prism(
    o,
    'paint',
    ring(0.045, [4, 6, 8, 10][lod]).map((p) => [p[0] - 1.48, p[1] + 1.18]),
    F + 1.25,
    F + 1.29,
  );
  rod(o, 'dark', [-1.15, F + 0.8, 1.2], [-1.15, F + 1.65, 1.2], 0.02);
  solarPanel(o, lod);
  const h = P.fenceHalf,
    posts = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ];
  for (const [x, z] of posts) {
    box(o, 'pad', x - 0.08, z - 0.08, x + 0.08, z + 0.08, P.foundationBottom, F);
    rod(o, 'metal', [x, F, z], [x, F + P.fenceTop, z], 0.035);
  }
  for (let i = 0; i < 4; i++)
    for (const y of [0.38, 0.76, P.fenceTop])
      rod(
        o,
        'dark',
        [posts[i][0], F + y, posts[i][1]],
        [posts[(i + 1) % 4][0], F + y, posts[(i + 1) % 4][1]],
        0.012,
      );
  if (lod >= 2) {
    rod(o, 'dark', [0, F + 0.2, 0], [-1.35, F + 0.3, 1.2], 0.016);
    box(o, 'dark', -0.12, -0.12, 0.12, 0.12, F + P.feedY - 0.095, F + P.feedY - 0.08);
  }
  componentEvidence.push({
    lod,
    wholeRadioStation: true,
    antennaFamily: P.antennaFamily,
    perpendicularPolarizations: 2,
    lpdaDipoles: dipoles,
    butterflyTriangularArms: triangles,
    sourceAntennaDimensions: P.antennaDimensions,
    sourceFeedHeight: P.feedY,
    mast: true,
    solarPanel: true,
    electronics: true,
    gpsAndCommunication: true,
    protectiveFence: true,
    stationLocationEstimated: true,
    allImagesUnused: true,
    rodThicknessExaggerationDisclosed: true,
  });
}

export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/63/63y/aera_log_periodic_station',
  camera = [8, 6, 9],
  look = [0, 1.8, 0];
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
  embeddedCanonicalGraphs: ['metal_stainless', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-two-polarization-antenna-and-station-hardware',
      position: [6, 4.8, 6],
      lookAt: look,
    },
    {
      name: 'opposite-antenna-solar-panel-electronics-and-fence',
      position: [-7, 5, -8],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-radio-station-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.08,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.04, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.02, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic radio-station geometry under repository license from written antenna dimensions and hardware census. All photos, figures and plotted layouts unused. Section details, thin-wire visibility profiles, service hardware, absolute yaw and station positions are explicit original estimates. No actual GPS table or experimental-antenna census claimed.',
};
