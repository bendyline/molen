/** Whole pre-upgrade detector assembly from written operator facts; no image input. */
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
  shell: { slot: 'wall', graph: 'metal_painted', roughness: 0.91, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.67, metallic: 0.65 },
  solar: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.1 },
};
const colors = { shell: rgb('d3c5a5'), steel: rgb('aeb6b4'), solar: rgb('233b55') };
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
      () => y,
      [0, up, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Invalid detector cap');
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
function profile(o, k, x, z, sections, n, tint = colors[k]) {
  const rings = sections.map(([r, y]) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      y,
      z + r * Math.sin((i * 2 * Math.PI) / n),
    ]),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const q = (i + 1) % n,
        a = ((i + 0.5) * 2 * Math.PI) / n;
      face(
        o,
        k,
        [rings[j - 1][i], rings[j - 1][q], rings[j][q], rings[j][i]],
        [Math.cos(a), 0, Math.sin(a)],
        tint,
      );
    }
  cap(
    o,
    k,
    rings[0].map((p) => [p[0], p[2]]),
    sections[0][1],
    -1,
    tint,
  );
  cap(
    o,
    k,
    rings.at(-1).map((p) => [p[0], p[2]]),
    sections.at(-1)[1],
    1,
    tint,
  );
}
function box(o, k, x, z, w, d, y0, y1, tint = colors[k]) {
  const r = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
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
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const strut = (o, k, a, b, w = 0.035, tint = colors[k]) => beam(o, k, a, b, w, w, tint);
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const n = P.segmentCounts[lod],
    floor = P.floor;
  profile(
    o,
    'shell',
    0,
    0,
    [
      [1.71, floor],
      [1.8, floor + 0.08],
      [1.8, 1.39],
      [1.73, 1.54],
      [1.58, P.bodyTop],
    ],
    n,
  );
  // Three genuinely raised access lids, one larger electronics station.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3,
      x = P.hatchCentreRadius * Math.cos(a),
      z = P.hatchCentreRadius * Math.sin(a),
      r = i === 0 ? P.largeHatchRadius : P.hatchRadius;
    profile(
      o,
      'shell',
      x,
      z,
      [
        [r, 1.54],
        [r, 1.77],
        [r * 0.93, 1.8],
      ],
      Math.max(8, n / 2),
    );
    if (i === 0)
      profile(
        o,
        'steel',
        x,
        z,
        [
          [0.33, 1.8],
          [0.33, 1.88],
          [0.28, 2.03],
          [0.15, 2.13],
          [0.035, 2.16],
        ],
        Math.max(8, n / 2),
      );
  }
  // Two individual flat photovoltaic panels. North edge is lower; rear face is closed.
  const angle = (P.panelTiltDegrees * Math.PI) / 180,
    L = P.panelLength,
    c = Math.cos(angle),
    s = Math.sin(angle),
    Y = 2.4,
    Z = -1.24;
  const point = (x, t, back = 0) => [x, Y + t * s - back * c, Z + t * c + back * s];
  for (const x of [-0.55, 0.55]) {
    const w = P.panelWidth / 2,
      r = [point(x - w, -L / 2), point(x + w, -L / 2), point(x + w, L / 2), point(x - w, L / 2)],
      b = [
        point(x - w, -L / 2, 0.045),
        point(x + w, -L / 2, 0.045),
        point(x + w, L / 2, 0.045),
        point(x - w, L / 2, 0.045),
      ];
    face(o, 'solar', r, [0, c, -s]);
    face(o, 'steel', b, [0, -c, s]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      face(o, 'steel', [r[j], r[k], b[k], b[j]]);
      strut(o, 'steel', r[j], r[k], 0.035);
    }
    for (const dx of [-0.37, 0.37]) {
      strut(o, 'steel', [x + dx, 1.3, -1.47], point(x + dx, -L / 2, 0.06), 0.045);
      strut(o, 'steel', [x + dx, 1.48, -0.93], point(x + dx, L / 2, 0.06), 0.045);
    }
    if (lod >= 2) {
      for (let j = 1; j < 6; j++) {
        const xx = x - w + (j * P.panelWidth) / 6;
        strut(
          o,
          'steel',
          point(xx, -L / 2 - 0.001, -0.005),
          point(xx, L / 2 + 0.001, -0.005),
          0.006,
          rgb('70828b'),
        );
      }
      for (let j = 1; j < 3; j++) {
        const t = -L / 2 + (j * L) / 3;
        strut(o, 'steel', point(x - w, t, -0.006), point(x + w, t, -0.006), 0.006, rgb('70828b'));
      }
    }
  }
  profile(
    o,
    'steel',
    0,
    -1.56,
    [
      [0.039, 1.3],
      [0.039, P.mastTop],
    ],
    Math.max(6, n / 4),
  );
  strut(o, 'steel', [-1, 1.52, -1.1], [0, 3, -1.56], 0.035);
  strut(o, 'steel', [1, 1.52, -1.1], [0, 3, -1.56], 0.035);
  // Radio boom and simple rod array are illustrative, not an asserted antenna model.
  strut(o, 'steel', [0, 3.8, -1.45], [0, 3.8, -2.05], 0.025);
  const rods = lod >= 2 ? 5 : 2;
  for (let j = 0; j < rods; j++) {
    const z = -1.48 - (j * 0.5) / (rods - 1),
      half = 0.15 + j * 0.025;
    strut(o, 'steel', [-half, 3.8, z], [half, 3.8, z], lod === 0 ? 0.025 : 0.012);
  }
  profile(
    o,
    'shell',
    0,
    -1.56,
    [
      [0.09, 4.05],
      [0.09, 4.12],
      [0.055, 4.16],
    ],
    Math.max(8, n / 4),
    rgb('e1e2d6'),
  );
  box(o, 'shell', 0, 2.0, 0.85, 0.51, floor, 0.67);
  box(o, 'shell', 0, 2.0, 0.89, 0.55, 0.67, 0.74, rgb('bcb192'));
  strut(o, 'shell', [0.4, 0.4, 1.6], [0.4, 0.4, 1.78], 0.045);
  if (lod >= 1) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        x = 1.79 * Math.cos(a),
        z = 1.79 * Math.sin(a);
      box(o, 'shell', x, z, 0.12, 0.12, 1.2, 1.38);
    }
    for (const x of [-0.95, 0.95])
      for (const z of [-1.3, -0.88]) box(o, 'shell', x, z, 0.11, 0.11, 1.39, 1.57);
  }
  componentEvidence.push({
    lod,
    wholeTank: true,
    diameter: P.diameter,
    exteriorHeight: P.exteriorHeight,
    serviceHatches: 3,
    electronicsCover: true,
    solarPanels: 2,
    mastAndAntennas: true,
    batteryBoxAndConduit: true,
    closedUnderside: true,
    notWholeObservatoryProxy: true,
    instances: P.instanceCount,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/63/63w/auger_surface_detector',
  camera = [6, 4.8, 6],
  look = [0, 1.7, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: '63/63w',
  title: 'Pierre Auger water-Cherenkov surface detector',
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
    'Whole pre-upgrade3.6m beige water-Cherenkov tank, raised hatches/electronics cover, two solar panels, mast/radio/GPS and battery box. Written operator facts and dated numerical station records; no imagery used.',
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
  embeddedCanonicalGraphs: ['metal_painted', 'metal_stainless_beadblasted'],
  qaCameras: [
    {
      name: 'three-hatches-electronics-cover-and-battery',
      position: [3.6, 4.5, 4.6],
      lookAt: [0, 1.6, 0.1],
    },
    { name: 'solar-panels-mast-and-tank', position: [4, 3.8, -5], lookAt: [0, 2, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-detector-' + reviewLod,
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
    'Original procedural geometry under repository license. Operator original numerical records credited with DOI10.5281/zenodo.10488964; numerical facts only. All photographs/figures/diagrams unused.',
};
