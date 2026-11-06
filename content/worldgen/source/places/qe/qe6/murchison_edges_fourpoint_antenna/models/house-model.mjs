/** Whole November 2013 fourpoint antenna; original written dimensions, no imagery. */
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
  screen: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.35 },
  panel: { slot: 'wall', graph: 'metal_painted', roughness: 0.7, metallic: 0.5 },
  rim: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.45 },
  balun: { slot: 'door', graph: 'metal_painted', roughness: 0.64, metallic: 0.5 },
  support: { slot: 'foundation', graph: 'metal_painted', roughness: 0.95, metallic: 0 },
  receiver: { slot: 'window', graph: 'metal_painted', roughness: 0.9, metallic: 0.15 },
};
const colors = {
  screen: rgb('939b94'),
  panel: rgb('d0d4ca'),
  rim: rgb('a3aaa1'),
  balun: rgb('aaa07a'),
  support: rgb('c8c7b4'),
  receiver: rgb('56625c'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
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
    throw Error('Invalid equipment cap');
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
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function box(o, k, x, z, w, d, y0, y1) {
  polygon(
    o,
    k,
    [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ],
    y0,
    y1,
  );
}
export function panelRing(index) {
  const halfGap = P.panelGap / 2;
  const halfWidth =
    Math.sqrt(4 * P.panelSide * P.panelSide - P.panelDiagonal * P.panelDiagonal) / 2;
  const r = [
    [0, halfGap],
    [-halfWidth, halfGap + P.panelDiagonal / 2],
    [0, halfGap + P.panelDiagonal],
    [halfWidth, halfGap + P.panelDiagonal / 2],
  ];
  const a = (index * Math.PI) / 2,
    c = Math.cos(a),
    s = Math.sin(a);
  return r.map(([x, z]) => [c * x + s * z, -s * x + c * z]);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  // Field report fixes the full ground-plane size. Sheet construction and seams are estimates.
  polygon(o, 'screen', P.nativeRing, P.screenBottom, P.screenY);
  const panelY = P.screenY + P.panelHeightAboveScreen;
  const thin = [0.012, 0.008, 0.004, P.panelThickness][lod];
  for (let index = 0; index < 4; index++) {
    const ring = panelRing(index);
    polygon(o, 'panel', ring, panelY, panelY + P.panelThickness);
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4];
      beam(
        o,
        'rim',
        [a[0], panelY + P.rimHeight / 2, a[1]],
        [b[0], panelY + P.rimHeight / 2, b[1]],
        thin,
        P.rimHeight,
        colors.rim,
      );
    }
    const mid = [0, 1].map((k) => ring.reduce((s, p) => s + p[k] / 4, 0));
    box(o, 'support', mid[0], mid[1], 0.03, 0.03, P.screenY, panelY);
  }
  // Two-pipe central balun, top capacitor and indications of vertical panel capacitors.
  for (const x of [-0.025, 0.025])
    beam(
      o,
      'balun',
      [x, P.screenY, x < 0 ? -0.016 : 0.016],
      [x, panelY + 0.006, x < 0 ? -0.016 : 0.016],
      [0.03, 0.025, 0.02, 0.014][lod],
      [0.03, 0.025, 0.02, 0.014][lod],
      colors.balun,
    );
  box(o, 'balun', 0, 0, 0.115, 0.115, panelY + P.topCapGap, panelY + P.topCapGap + 0.004);
  box(o, 'receiver', 0, 0, 0.2, 0.22, -0.16, P.screenY - 0.008);
  for (const [x, z] of [
    [0.105, 0.105],
    [-0.105, 0.105],
    [0.105, -0.105],
    [-0.105, -0.105],
  ])
    box(o, 'balun', x, z, 0.018, 0.018, panelY - 0.04, panelY + 0.015);
  if (lod > 0) {
    const seams = [0, 2, 4, 7][lod];
    for (let i = 1; i <= seams; i++) {
      const x = -P.screenWidth / 2 + (i * P.screenWidth) / (seams + 1);
      beam(
        o,
        'rim',
        [x, P.screenY + 0.003, -P.screenDepth / 2],
        [x, P.screenY + 0.003, P.screenDepth / 2],
        0.008,
        0.006,
        colors.rim,
      );
    }
    box(o, 'receiver', 0.045, 0.045, 0.09, 0.08, P.screenY, P.screenY + 0.04);
    beam(
      o,
      'receiver',
      [0, P.screenY + 0.025, 0],
      [0, P.screenY + 0.025, 1.1],
      0.014,
      0.014,
      colors.receiver,
    );
  }
  componentEvidence.push({
    lod,
    wholeInstrument: true,
    wholeGroundplane: [P.screenWidth, P.screenDepth],
    panels: 4,
    horizontalDiamondPanels: true,
    allPanelRims: true,
    twoPipeBalun: true,
    topCap: true,
    capacitorIndications: 4,
    estimatedSupports: 4,
    belowPlaneReceiver: true,
    activePanelBearingDegrees: 7,
    notAskapDish: true,
    notLaterBlade: true,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_edges_fourpoint_antenna',
  camera = [6, 3.6, 6],
  look = [0, 0.27, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
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
    'Entire November2013fourpoint instrument, allfour horizontal diamond panels/rims/centralbalun/topcap/estimated support and capacitor details, underlying receiver and full5.8x5m conducting groundplane. Original written dimensions/facing, no imagery. Groundplane sheet construction, small parts and30m geographic registration explicitly approximate.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.18,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted'],
  qaCameras: [
    { name: 'whole-groundplane-and-fourpoint-panels', position: [6, 3.2, 5], lookAt: look },
    {
      name: 'four-diamond-panels-rims-balun-and-topcap',
      position: [1.7, 1.3, 1.5],
      lookAt: [0, 0.42, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-fourpoint-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.035,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.02, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.008, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: [
    ...P.limitations,
    'Groundplane closed conducting-sheet interpretation/seam layout and material finish are estimates; original2013text fixes extent, not detailed screen construction. No exact photographic or electromagnetic fidelity claimed.',
  ],
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Original ASU2013written/numerical equipment facts and original OSM numerical context with attribution; all source photographs, figures, diagrams and textures unused. No copied source pixels or protected CAD. Small parts, symmetric diamond interpretation, groundplane sheet construction and geographic registration explicitly approximate.',
};
