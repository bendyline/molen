/** Whole independent process basin; all outer controls retained, vertical section estimated. */
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
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  shell: { slot: 'wall', graph: 'metal_painted', roughness: 0.91, metallic: 0.1 },
  rim: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  liner: { slot: 'wall', graph: 'metal_painted', roughness: 0.94, metallic: 0.1 },
  contents: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.2 },
};
const colors = {
  foundation: rgb('92968c'),
  shell: rgb('929e98'),
  rim: rgb('b4b7a7'),
  liner: rgb('5c706b'),
  contents: rgb('344c4e'),
  steel: rgb('86958d'),
};
export const componentEvidence = [];
export const innerRing = P.nativeRing.map(([x, z]) => {
  const r = Math.hypot(x, z),
    s = (r - P.rimThickness) / r;
  return [x * s, z * s];
});
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
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
    throw Error('Invalid process basin cap');
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
function wall(o, k, r, y0, y1, inward = false) {
  const sg =
    Math.sign(
      r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ) * (inward ? -1 : 1);
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
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
}
function annulus(o, k, outer, inner, y, up) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    face(
      o,
      k,
      [
        [outer[i][0], y, outer[i][1]],
        [outer[j][0], y, outer[j][1]],
        [inner[j][0], y, inner[j][1]],
        [inner[i][0], y, inner[i][1]],
      ],
      [0, up, 0],
    );
  }
}
function hub(o, lod) {
  const count = [8, 12, 16, 24][lod],
    ring = Array.from({ length: count }, (_, i) => [
      Math.cos((i * 2 * Math.PI) / count) * 0.95,
      Math.sin((i * 2 * Math.PI) / count) * 0.95,
    ]);
  wall(o, 'steel', ring, P.contentsY, P.bridgeDeckY + 0.45);
  cap(o, 'steel', ring, P.bridgeDeckY + 0.45, 1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    I = innerRing;
  cap(o, 'foundation', R, P.foundationBottom, -1);
  wall(o, 'foundation', R, P.foundationBottom, P.floor);
  cap(o, 'foundation', R, P.floor, 1);
  wall(o, 'shell', R, P.floor, P.rimTop);
  wall(o, 'liner', I, P.floor, P.rimTop, true);
  annulus(o, 'rim', R, I, P.rimTop, 1);
  cap(o, 'contents', I, P.contentsY, 1);
  const x0 = Math.min(...I.map((p) => p[0])) + 0.6,
    x1 = Math.max(...I.map((p) => p[0])) - 0.6,
    y = P.bridgeDeckY;
  beam(o, 'steel', [x0, y - 0.12, 0], [x1, y - 0.12, 0], 1.35, 0.24, colors.steel);
  hub(o, lod);
  for (const z of [-0.62, 0.62])
    beam(
      o,
      'steel',
      [x0, y + 1.05, z],
      [x1, y + 1.05, z],
      lod > 1 ? 0.055 : 0.09,
      lod > 1 ? 0.055 : 0.09,
      colors.steel,
    );
  let posts = 0,
    rimPosts = 0;
  if (lod > 0) {
    const bays = Math.ceil((x1 - x0) / (lod === 1 ? 6 : 3));
    for (const z of [-0.62, 0.62]) {
      beam(o, 'steel', [x0, y + 0.53, z], [x1, y + 0.53, z], 0.045, 0.045, colors.steel);
      beam(o, 'steel', [x0, y - 0.3, z], [x1, y - 0.3, z], 0.16, 0.18, colors.steel);
      for (let j = 0; j <= bays; j++) {
        const x = x0 + ((x1 - x0) * j) / bays;
        beam(o, 'steel', [x, y, z], [x, y + 1.05, z], 0.055, 0.055, colors.steel);
        posts++;
      }
    }
    for (const p of R) {
      const r = Math.hypot(...p),
        x = p[0] / r,
        z = p[1] / r;
      beam(
        o,
        'steel',
        [p[0] + x * 0.012, P.floor + 0.08, p[1] + z * 0.012],
        [p[0] + x * 0.012, P.rimTop - 0.05, p[1] + z * 0.012],
        0.032,
        0.035,
        colors.steel,
      );
    }
  }
  if (lod > 1) {
    for (let i = 0; i < R.length; i++) {
      const a = R[i],
        b = R[(i + 1) % R.length],
        q = I[i],
        r = I[(i + 1) % I.length],
        p = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2],
        t = [(b[0] + r[0]) / 2, (b[1] + r[1]) / 2];
      beam(
        o,
        'steel',
        [p[0], P.rimTop, p[1]],
        [p[0], P.rimTop + 1.05, p[1]],
        0.055,
        0.055,
        colors.steel,
      );
      rimPosts++;
      for (const h of [0.53, 1.05])
        beam(
          o,
          'steel',
          [p[0], P.rimTop + h, p[1]],
          [t[0], P.rimTop + h, t[1]],
          0.045,
          0.045,
          colors.steel,
        );
    }
    const n = Math.ceil((x1 - x0) / 4);
    for (let j = 0; j < n; j++) {
      const a = x0 + ((x1 - x0) * j) / n,
        b = x0 + ((x1 - x0) * (j + 1)) / n;
      for (const z of [-0.62, 0.62])
        beam(o, 'steel', [a, y - 0.35, z], [b, y - 0.12, z], 0.055, 0.055, colors.steel);
    }
    if (lod === 3) {
      for (let x = x0 + 0.6; x < x1; x += 1.5)
        beam(o, 'steel', [x, y + 0.008, -0.52], [x, y + 0.008, 0.52], 0.025, 0.025, colors.steel);
      for (const p of R) {
        const r = Math.hypot(...p),
          s = (r - 0.12) / r;
        beam(
          o,
          'rim',
          [p[0] * s, P.rimTop + 0.015, p[1] * s],
          [p[0] * s, P.rimTop + 0.045, p[1] * s],
          0.12,
          0.12,
          colors.rim,
        );
      }
    }
  }
  componentEvidence.push({
    lod,
    wholeIndependentBasin: true,
    nativeControls: R.length,
    foundation: true,
    continuousOuterShell: true,
    continuousInnerLiner: true,
    openRim: true,
    recessedProcessSurface: true,
    noCoverRoof: true,
    centralSpan: true,
    centralHub: true,
    estimatedBridgePosts: posts,
    estimatedRimPosts: rimPosts,
    openFactoryYardsPreserved: true,
    notWholeFactoryProxy: true,
    heightMeasured: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r4/r49/olympic_dam_central_southwest_process_basin',
  span = Math.max(
    ...[0, 1].map(
      (k) =>
        Math.max(...P.nativeRing.map((p) => p[k])) - Math.min(...P.nativeRing.map((p) => p[k])),
    ),
  ),
  camera = [span * 1.1, span * 0.65, span],
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
  portableGroundY: -1.35,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-open-rim-shell-and-recessed-process-surface', position: camera, lookAt: look },
    {
      name: 'opposite-complete-basin-maintenance-span-and-hub',
      position: [-camera[0], camera[1] * 0.9, -camera[2]],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-open-process-basin-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Full original numerical outer outline © OpenStreetMap contributors, ODbL-1.0. Already-cleared published NASA JSC ISS038-E-29810 federal public-domain original supplies broad central circular process-surface appearance. No photographic texture. Height, precise process function, materials, maintenance equipment and ground contact are explicit estimates; exact2014continuity unverified.',
};
