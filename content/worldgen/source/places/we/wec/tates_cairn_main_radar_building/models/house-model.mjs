/** Full official building body with an explicitly estimated protective radar enclosure. */
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
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  dome: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.7, metallic: 0.5 },
  panel: { slot: 'trim', graph: 'metal_painted', roughness: 0.95, metallic: 0.05 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('deddd3'),
  roof: rgb('c4c7bd'),
  dome: rgb('eeeeea'),
  steel: rgb('939e99'),
  panel: rgb('3f514e'),
  foundation: rgb('a3a497'),
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
    throw Error('Invalid original radar-building cap');
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
function prism(o, k, r, y0, y1, top = k) {
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
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
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, top, r, y1, 1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    [cx, cz] = P.radomeCentre;
  prism(o, 'foundation', R, P.foundationBottom, P.floor);
  prism(o, 'wall', R, P.floor, P.eave, 'roof');
  const n = [12, 18, 28, 40][lod],
    bands = [6, 8, 12, 18][lod],
    collar = Array.from({ length: n }, (_, i) => [
      cx + P.collarRadius * Math.cos((i * 2 * Math.PI) / n),
      cz + P.collarRadius * Math.sin((i * 2 * Math.PI) / n),
    ]);
  prism(o, 'dome', collar, P.eave, P.radomeBottom);
  const at = (j, i) => {
    const lat = P.radomeCutLatitude + ((Math.PI / 2 - P.radomeCutLatitude) * j) / bands,
      phi = (i * 2 * Math.PI) / n,
      co = Math.cos(lat);
    return [
      cx + P.radomeRadius * co * Math.cos(phi),
      P.radomeCentreY + P.radomeRadius * Math.sin(lat),
      cz + P.radomeRadius * co * Math.sin(phi),
    ];
  };
  let domeTriangles = 0,
    seams = 0;
  for (let j = 0; j < bands; j++)
    for (let i = 0; i < n; i++) {
      const a = at(j, i),
        b = at(j, i + 1),
        c = at(j + 1, i + 1),
        d = at(j + 1, i),
        up = (p) => [p[0] - cx, p[1] - P.radomeCentreY, p[2] - cz];
      if (j === bands - 1) {
        face(o, 'dome', [a, b, [cx, P.radomeTop, cz]], up(a));
        domeTriangles++;
      } else {
        face(o, 'dome', [a, b, c], up(a));
        face(o, 'dome', [a, c, d], up(a));
        domeTriangles += 2;
      }
      if (lod === 3 && j > 0 && j < bands - 1 && j % 3 === 0) {
        beam(o, 'steel', a, b, 0.018, 0.018, colors.steel);
        if (i % 2 === 0) beam(o, 'steel', a, c, 0.018, 0.018, colors.steel);
        seams++;
      }
    }
  cap(
    o,
    'dome',
    Array.from({ length: n }, (_, i) => {
      const p = at(0, i);
      return [p[0], p[2]];
    }),
    P.radomeBottom,
    -1,
  );
  let parapetEdges = 0;
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    beam(
      o,
      'wall',
      [a[0], P.eave + 0.14, a[1]],
      [b[0], P.eave + 0.14, b[1]],
      0.18,
      0.28,
      colors.wall,
    );
    parapetEdges++;
  }
  let entryPanels = 0,
    ladderRungs = 0;
  const edges = R.map((a, i) => {
      const b = R[(i + 1) % R.length];
      return { a, b, L: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    }).sort((a, b) => b.L - a.L),
    { a, b, L } = edges[0],
    sg = Math.sign(
      R.reduce((s, p, i) => {
        const q = R[(i + 1) % R.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ),
    normal = [((b[1] - a[1]) / L) * sg, (-(b[0] - a[0]) / L) * sg],
    point = (t, y, offset = 0.04) => [
      a[0] + (b[0] - a[0]) * t + normal[0] * offset,
      y,
      a[1] + (b[1] - a[1]) * t + normal[1] * offset,
    ];
  if (lod > 0) {
    const w = 1 / L,
      t = 0.35;
    face(
      o,
      'panel',
      [
        point(t - w, P.floor + 0.1),
        point(t + w, P.floor + 0.1),
        point(t + w, P.floor + 2.25),
        point(t - w, P.floor + 2.25),
      ],
      [normal[0], 0, normal[1]],
    );
    entryPanels++;
  }
  if (lod > 1) {
    for (const t of [0.35 - 1 / L, 0.35 + 1 / L])
      beam(
        o,
        'steel',
        point(t, P.floor + 0.1),
        point(t, P.floor + 2.3),
        0.055,
        0.055,
        colors.steel,
      );
    beam(
      o,
      'steel',
      point(0.35 - 1 / L, P.floor + 2.3),
      point(0.35 + 1 / L, P.floor + 2.3),
      0.055,
      0.055,
      colors.steel,
    );
    for (const t of [0.73 - 0.32 / L, 0.73 + 0.32 / L])
      beam(
        o,
        'steel',
        point(t, P.floor + 0.2, 0.18),
        point(t, P.eave + 0.8, 0.18),
        0.055,
        0.055,
        colors.steel,
      );
    const count = lod === 2 ? 12 : 16;
    for (let j = 0; j <= count; j++) {
      const y = P.floor + 0.2 + ((P.eave + 0.6 - P.floor) * j) / count;
      beam(
        o,
        'steel',
        point(0.73 - 0.32 / L, y, 0.18),
        point(0.73 + 0.32 / L, y, 0.18),
        0.04,
        0.04,
        colors.steel,
      );
      ladderRungs++;
    }
  }
  componentEvidence.push({
    lod,
    wholeOriginalMainRadarBuilding: true,
    originalControls: 11,
    officialGeneralizedBodyHeight: P.officialRelativeHeight,
    wholeAttachedFootprintRetained: true,
    completeOpaqueEstimatedRadome: true,
    radomeSizeMeasured: false,
    radomePositionVerified: false,
    documentedAntennaNotRelabeledAsDome: true,
    altitudeNotUsedAsBuildingHeight: true,
    parapetEdges,
    domeTriangles,
    estimatedPanelSeams: seams,
    entryPanels,
    ladderRungs,
    separateServiceBuildingsExcluded: true,
    notStationFenceOrPeakProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/we/wec/tates_cairn_main_radar_building',
  camera = [34, 23, 40],
  look = [1, 4, 0];
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
  portableGroundY: -0.75,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'concrete_plain',
    'metal_painted',
    'metal_stainless_beadblasted',
  ],
  qaCameras: [
    {
      name: 'whole-radar-building-original-attached-body-and-estimated-cover',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-whole-radar-building-all-original-footprint-arms',
      position: [-37, 22, -35],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-radar-building-and-original-enclosure-estimate-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.025, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Hong Kong Lands Department CSDI original numerical building outline and generalized body-height facts, with attribution. HKO written instrument facts only. Every image unused. Protective enclosure shape/size/position, roof profile, materials, access, phase continuity and vertical registration are explicit original estimates.',
};
