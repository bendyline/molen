/** Whole1969 construction appearance; original field/frame/floors/main sections unchanged. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  phase = JSON.parse(fs.readFileSync(new URL('../phase-resolution.json', import.meta.url))),
  D = P.dimensions,
  Y = P.floor.y;
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  recess: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
};
const colors = { concrete: rgb('b6b4a9'), recess: rgb('73766f') };
function triangle(o, k, ps) {
  const p = ps.map((q) => q.map(Math.fround));
  const a = p[1].map((v, i) => v - p[0][i]),
    b = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
    1e-8
  )
    return;
  o.addTriangle(
    k,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    colors[k],
  );
}
function q(o, k, a, b, c, d) {
  triangle(o, k, [a, b, c]);
  triangle(o, k, [a, c, d]);
}
function box(o, k, x, y, z, w, h, d) {
  if (Math.min(w, h, d) <= 0) return;
  const a = x - w / 2,
    b = x + w / 2,
    c = y - h / 2,
    e = y + h / 2,
    f = z - d / 2,
    g = z + d / 2;
  q(o, k, [a, c, f], [a, e, f], [b, e, f], [b, c, f]);
  q(o, k, [a, c, g], [b, c, g], [b, e, g], [a, e, g]);
  q(o, k, [a, c, f], [a, c, g], [a, e, g], [a, e, f]);
  q(o, k, [b, c, f], [b, e, f], [b, e, g], [b, c, g]);
  q(o, k, [a, e, f], [a, e, g], [b, e, g], [b, e, f]);
  q(o, k, [a, c, f], [b, c, f], [b, c, g], [a, c, g]);
}
export const partEvidence = [],
  apertureEvidence = [];
function framedWing(o, { z, nf, nx, nz, lod, innerSign }) {
  const L = D.wingLength,
    W = D.wingDepth,
    bottom = Y + D.podiumHeight,
    H = D.towerStoreysAbovePodium * D.storeyHeightEstimate,
    top = bottom + H;
  // Complete opaque service core; room-depth voids remain outside it under the concrete frame.
  box(o, 'recess', 0, bottom + H / 2, z, L - 1.2, H, 4.8);
  const columns = [];
  for (const s of [-1, 1])
    for (let i = 0; i <= nx; i++) columns.push([-L / 2 + (L * i) / nx, z + (s * W) / 2]);
  for (const s of [-1, 1])
    for (let i = 1; i < nz; i++) columns.push([(s * L) / 2, z - W / 2 + (W * i) / nz]);
  for (const [x, zz] of columns) {
    if (Math.abs(zz - (z + (innerSign * W) / 2)) < 1e-6 && Math.abs(x) < D.connectorWidth / 2)
      continue;
    box(o, 'concrete', x, bottom + H / 2, zz, lod === 0 ? 0.65 : 0.32, H, 0.65);
  }
  for (let j = 0; j <= nf; j++) {
    const y = bottom + (H * j) / nf;
    box(o, 'concrete', 0, y, z, L, 0.22, W);
    for (const s of [-1, 1]) {
      const inner = s === innerSign,
        segments = inner
          ? [
              [-L / 2, -D.connectorWidth / 2],
              [D.connectorWidth / 2, L / 2],
            ]
          : [[-L / 2, L / 2]];
      for (const [a, b] of segments)
        box(o, 'concrete', (a + b) / 2, y + 0.25, z + s * (W / 2 + 0.22), b - a, 0.72, 0.55);
    }
  }
  // Narrow transverse partitions form real deep bay recesses at the two authored near levels.
  if (lod >= 2)
    for (const s of [-1, 1])
      for (let i = 1; i < nx; i++) {
        const x = -L / 2 + (L * i) / nx;
        if (s === innerSign && Math.abs(x) < D.connectorWidth / 2) continue;
        box(o, 'recess', x, bottom + H / 2, z + s * 5.2, 0.13, H, 5.4);
      }
  // Whole top colonnade/cornice is architectural mass, not a cap floating above a generic box.
  box(o, 'concrete', 0, top + 0.42, z, L + 1.4, 0.62, W + 1.3);
  box(o, 'concrete', 0, top + 1.05, z, L + 1.8, 0.23, W + 1.8);
  apertureEvidence.push({
    type: 'deep-framed-wing',
    z,
    outerWidth: W,
    coreWidth: 4.8,
    depth: (W - 4.8) / 2,
    top,
    base: bottom,
    verticalBays: nx,
    representedStoreyBands: nf,
  });
}
function connector(o, lod) {
  const bottom = Y + D.podiumHeight,
    H = D.towerStoreysAbovePodium * D.storeyHeightEstimate,
    nf = [4, 10, 20, 20][lod],
    w = D.connectorWidth,
    L = D.connectorLength;
  box(o, 'recess', 0, bottom + H / 2, 0, w - 2, H, L);
  for (const x of [-w / 2, w / 2])
    for (const z of [-L / 2, 0, L / 2]) box(o, 'concrete', x, bottom + H / 2, z, 0.5, H, 0.6);
  for (let j = 0; j <= nf; j++) box(o, 'concrete', 0, bottom + (H * j) / nf, 0, w + 0.35, 0.3, L);
  box(o, 'concrete', 0, bottom + H + 0.4, 0, w + 1, 0.6, L + 1.2);
}
function podium(o, lod) {
  const w = D.podiumWidth,
    d = D.podiumDepth,
    h = D.podiumHeight,
    base = Y - D.basementDepthEstimate;
  // Whole physical podium, with a real recessed south-side main opening rather than a dark decal.
  const entrance = 16,
    eh = 3.8,
    depth = 4;
  box(o, 'concrete', 0, (base + Y + h) / 2, -depth / 2, w, Y + h - base, d - depth);
  for (const s of [-1, 1])
    box(
      o,
      'concrete',
      (s * (w + entrance)) / 4,
      (base + Y + h) / 2,
      d / 2 - depth / 2,
      (w - entrance) / 2,
      Y + h - base,
      depth,
    );
  box(o, 'concrete', 0, Y + eh + (h - eh) / 2, d / 2 - depth / 2, entrance, h - eh, depth);
  box(o, 'recess', 0, Y + eh / 2, d / 2 - depth + 0.05, entrance, eh, 0.1);
  box(o, 'concrete', 0, (base + Y) / 2, d / 2 - depth / 2, entrance, Y - base, depth);
  box(o, 'concrete', 0, Y - 0.1, d / 2 - depth / 2, entrance, 0.2, depth);
  box(o, 'concrete', 0, Y + h + 0.1, 0, w + 0.8, 0.25, d + 0.8);
  if (lod > 0)
    for (const y of [2, 4])
      for (const side of [-1, 1]) {
        const spans =
          side === 1 && y < eh
            ? [
                [-w / 2, -entrance / 2],
                [entrance / 2, w / 2],
              ]
            : [[-w / 2, w / 2]];
        for (const [a, b] of spans)
          box(o, 'concrete', (a + b) / 2, Y + y, side * (d / 2 + 0.08), b - a, 0.14, 0.22);
      }
  if (lod >= 2) {
    for (const s of [-1, 1])
      for (let i = 0; i < 16; i++) {
        const x = -46 + (92 * (i + 0.5)) / 16;
        if (s === 1 && Math.abs(x) < entrance / 2 + 1) continue;
        box(o, 'recess', x, Y + 4.65, s * (d / 2 + 0.12), 2.5, 0.48, 0.12);
      }
  }
  apertureEvidence.push({
    type: 'whole-podium-real-entry',
    width: entrance,
    height: eh,
    depth,
    floor: Y,
    center: [0, Y + eh / 2, d / 2],
  });
}
function crown(o, lod) {
  const top = Y + D.podiumHeight + D.towerStoreysAbovePodium * D.storeyHeightEstimate;
  box(o, 'concrete', 0, top + 2.4, 0, 17, 4.8, 16);
  box(o, 'concrete', 0, top + 4.95, 0, 19, 0.3, 18);
  box(o, 'concrete', 0, top + 5.3, 0, 20, 0.22, 19);
  if (lod >= 2)
    for (const s of [-1, 1])
      for (let i = 0; i < 5; i++)
        box(o, 'recess', -6.4 + i * 3.2, top + 2.7, s * 8.02, 1.8, 1.1, 0.1);
}
export function buildCaseros(target, _frame, lod = 3) {
  partEvidence.length = 0;
  apertureEvidence.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (id, fn) => {
      const n = count;
      fn();
      partEvidence.push({ id, triangles: count - n });
    };
  const nf = [4, 10, 20, 20][lod],
    nx = [2, 6, 12, 20][lod],
    nz = [1, 2, 3, 5][lod];
  part('whole-two-level-podium-and-below-grade-structural-volume', () => podium(o, lod));
  part('complete-north-concrete-tower', () =>
    framedWing(o, { z: -20, nf, nx, nz, lod, innerSign: 1 }),
  );
  part('complete-south-concrete-tower', () =>
    framedWing(o, { z: 20, nf, nx, nz, lod, innerSign: -1 }),
  );
  part('entire-connecting-H-core', () => connector(o, lod));
  part('whole-rooftop-crown-and-plant-volume', () => crown(o, lod));
}
export const caserosSkyline = (o) => buildCaseros(o, null, 0),
  caserosDistrict = (o) => buildCaseros(o, null, 1),
  caserosStreet = (o) => buildCaseros(o, null, 2),
  caserosCloseup = (o) => buildCaseros(o, null, 3);
const look = [0, Y + 31, 0];
export const caserosModel = {
  id: 'caseros_prison',
  key: 'caseros_prison',
  cell: '69/69y',
  title: 'Caseros Prison (construction1969)',
  wikidataId: 'Q5048422',
  category: 'civic-institutional',
  recipe: 'caseros-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCaseros,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: phase.scope,
  appearance: {
    kind: 'historical',
    representedDate: phase.representedDate,
    validFrom: phase.validFrom,
    validUntil: phase.validUntil,
    currentWorldEligible: false,
  },
  camera: [140, Y + 110, 150],
  lookAt: look,
  portableGroundY: Y - 6.5,
  mediumFiContext: {
    scale: 1,
    groundY: Y - 6.5,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 3000,
  },
  embeddedCanonicalGraphs: ['concrete_plain'],
  qaCameras: [
    { name: 'whole-h-both-towers-podium', position: [125, Y + 85, 130], lookAt: look },
    { name: 'whole-rear-tower-and-connector', position: [-120, Y + 90, -130], lookAt: look },
    {
      name: 'deep-concrete-framing-and-horizontal-bands',
      position: [38, Y + 40, 68],
      lookAt: [13, Y + 38, 27],
    },
    { name: 'through-open-h-court', position: [53, Y + 40, 0], lookAt: [0, Y + 35, 0] },
    { name: 'podium-recessed-entry', position: [17, Y + 7, 63], lookAt: [0, Y + 3, 38] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-h-${reviewLod}`,
    position: [140, Y + 110, 150],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/69/69y/caseros_prison/models/caseros-model.mjs',
    level: 'skyline',
    export: 'caserosSkyline',
    errorMeters: 5,
    surfaces,
    authoredLevels: {
      district: { export: 'caserosDistrict', errorMeters: 2.5, surfaces },
      street: { export: 'caserosStreet', errorMeters: 0.7, surfaces },
      closeup: { export: 'caserosCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [phase.basis, P.sectionBasis, ...phase.limitations],
};
