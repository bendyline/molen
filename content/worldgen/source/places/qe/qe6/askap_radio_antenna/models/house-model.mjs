/** Whole ASKAP 12 m paraboloid and intrinsic support hardware; written facts only. */
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
  reflector: { slot: 'roof', graph: 'metal_painted', roughness: 0.62, metallic: 0.25 },
  back: { slot: 'wall', graph: 'metal_painted', roughness: 0.75, metallic: 0.3 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.35 },
  receiver: { slot: 'window', graph: 'metal_painted', roughness: 0.8, metallic: 0.2 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
};
const colors = {
  reflector: rgb('e6e8df'),
  back: rgb('b9c3bf'),
  steel: rgb('798d8e'),
  receiver: rgb('35474a'),
  foundation: rgb('9a9a8a'),
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

const circle = (r, n) =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * 2 * Math.PI) / n),
    r * Math.sin((i * 2 * Math.PI) / n),
  ]);
const bowl = (r, a, back = false) => [
  r * Math.cos(a),
  P.vertexY + (r * r) / (4 * P.focalLength) - (back ? P.shellThickness : 0),
  r * Math.sin(a),
];
const strut = (o, k, a, b, w, d = w) => beam(o, k, a, b, w, d, colors[k]);
function box(o, k, x, z, w, d, y0, y1) {
  polygon(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = P.segmentCounts[lod],
    bands = P.radialBands[lod],
    radius = P.diameter / 2;
  // Both continuous sides of the curved shell; first radial band is a fan, not zero-area quads.
  for (const back of [false, true])
    for (let j = 1; j <= bands; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n,
          b = ((i + 1) * 2 * Math.PI) / n,
          r0 = (radius * (j - 1)) / bands,
          r1 = (radius * j) / bands,
          points =
            j === 1
              ? [bowl(0, 0, back), bowl(r1, a, back), bowl(r1, b, back)]
              : [bowl(r0, a, back), bowl(r1, a, back), bowl(r1, b, back), bowl(r0, b, back)],
          mid = (a + b) / 2,
          normal = [
            (-Math.cos(mid) * r1) / (2 * P.focalLength),
            1,
            (-Math.sin(mid) * r1) / (2 * P.focalLength),
          ];
        face(o, back ? 'back' : 'reflector', points, back ? normal.map((v) => -v) : normal);
      }
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      o,
      'back',
      [bowl(radius, a), bowl(radius, b), bowl(radius, b, true), bowl(radius, a, true)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
  // Radial stiffeners and concentric backing frames stay behind the aperture.
  for (let i = 0; i < P.backRibs[lod]; i++) {
    const a = (i * 2 * Math.PI) / P.backRibs[lod];
    for (let j = 1; j <= Math.max(2, bands / 2); j++) {
      const count = Math.ceil(Math.max(2, bands / 2)),
        r0 = 0.9 + (4.9 * (j - 1)) / count,
        r1 = 0.9 + (4.9 * j) / count;
      strut(
        o,
        'steel',
        bowl(r0, a, true).map((v, k) => v - (k === 1 ? 0.15 : 0)),
        bowl(r1, a, true).map((v, k) => v - (k === 1 ? 0.15 : 0)),
        0.13,
        0.21,
      );
    }
  }
  for (const r of lod === 0 ? [4.5] : [2.3, 4.5, 5.85])
    for (let i = 0; i < n; i++)
      strut(
        o,
        'steel',
        bowl(r, (i * 2 * Math.PI) / n, true).map((v, k) => v - (k === 1 ? 0.14 : 0)),
        bowl(r, ((i + 1) * 2 * Math.PI) / n, true).map((v, k) => v - (k === 1 ? 0.14 : 0)),
        0.13,
        0.18,
      );
  const focus = P.vertexY + P.focalLength;
  // The four feed legs preserve the open sky aperture around the PAF casing.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    strut(
      o,
      'steel',
      bowl(5.2, a),
      [Math.cos(a) * 0.43, focus - 0.25, Math.sin(a) * 0.32],
      0.18,
      0.23,
    );
  }
  box(
    o,
    'receiver',
    0,
    0,
    P.feed.width,
    P.feed.depth,
    focus - P.feed.height / 2,
    focus + P.feed.height / 2,
  );
  polygon(o, 'foundation', circle(2, Math.max(8, n / 2)), P.baseBottom, 0.55);
  polygon(o, 'steel', circle(0.95, Math.max(8, n / 2)), 0.55, 2.6);
  polygon(o, 'back', circle(1.5, Math.max(8, n / 2)), 2.6, 3.15);
  for (const x of [-1.2, 1.2]) {
    box(o, 'steel', x, 0, 0.5, 1.3, 3.15, 4.35);
    strut(o, 'steel', [x, 4.15, 0], [x * 2.4, 4.65, 0], 0.26, 0.34);
  }
  strut(o, 'steel', [-1.6, 4.2, 0], [1.6, 4.2, 0], 0.45, 0.5);
  for (const s of [-1, 1]) strut(o, 'steel', [s * 1.15, 3.5, 0], [s * 3.8, 4.9, 0], 0.22, 0.3);
  componentEvidence.push({
    lod,
    wholeParaboloid: true,
    diameter: 12,
    focalRatio: 0.5,
    frontAndRearShell: true,
    continuousRim: true,
    quadrupodLegs: 4,
    primeFocus: focus,
    feedCasing: true,
    rearRibs: P.backRibs[lod],
    threeAxisMountEnvelope: true,
    pedestalAndBase: true,
    instances: 36,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/askap_radio_antenna',
  camera = [16, 13, 18],
  look = [0, 5, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'ASKAP 12-metre radio antenna',
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
    'Whole 12 m prime-focus paraboloid, both reflector faces and rim, quadrupod/receiver, rear ribs, three-axis support envelope, pedestal and concrete base. Written mechanical facts and numerical native antenna positions only. Reusable equipment with 36 individual geographic placements; whole observatory remains in progress.',
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
      name: 'complete-aperture-quadrupod-and-primefocus',
      position: [12, 17, 13],
      lookAt: [0, 6, 0],
    },
    { name: 'rear-reflector-ribs-mount-and-pedestal', position: [15, 3, -13], lookAt: [0, 4.6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-antenna-${reviewLod}`,
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
    'Original deterministic procedural geometry under repository license. OSM numerical points ODbL attribution retained. Primary written mechanical facts only; no photographs, plans or figures adopted. Height, pose, support detail, casing and finish estimates explicit.',
};
