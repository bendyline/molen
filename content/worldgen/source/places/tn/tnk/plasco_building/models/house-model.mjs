/** Whole original Plasco tower, written engineering facts, no imagery. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.12 },
  ceramic: { slot: 'door', graph: 'tile_glazed', roughness: 0.48, metallic: 0.02 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.44, metallic: 0.06 },
};
const C = {
    plaster: rgb('b9b9ae'),
    roof: rgb('8f938e'),
    stone: rgb('999c96'),
    trim: rgb('b6c0b7'),
    ceramic: rgb('b6c9bd'),
    glass: rgb('40565f'),
  },
  R = P.nativeTowerRing,
  H = P.building;
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const componentEvidence = [];
function face(o, k, q, n) {
  q = q.map((p) => p.map(Math.fround));
  for (let i = 1; i < q.length - 1; i++) {
    let t = [q[0], q[i], q[i + 1]],
      v = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (Math.hypot(...v) < 1e-8) continue;
    if (n && dot(v, n) < 0) t = [t[0], t[2], t[1]];
    o.addTriangle(
      k,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((p) => [p[0] + p[2], p[1]]),
      C[k],
    );
  }
}
function cap(o, k, r, y, up = 1) {
  const t = new MeshBufferBuilder();
  if (
    !t.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => 0,
      [0, up, 0],
      (p) => p,
      C[k],
    )
  )
    throw Error('Whole exchange cap failed');
  const m = t.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) => [
        m.positions[j * 3],
        y,
        m.positions[j * 3 + 2],
      ]),
      [0, up, 0],
    );
}
function solid(o, k, r, lo, hi, bottom = false) {
  const a = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [p[0], lo, p[1]],
        [q[0], lo, q[1]],
        [q[0], hi, q[1]],
        [p[0], hi, p[1]],
      ],
      [(q[1] - p[1]) * a, 0, -(q[0] - p[0]) * a],
    );
  }
  cap(o, k, r, hi);
  if (bottom) cap(o, k, r, lo, -1);
}
const rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  box = (o, k, x, z, w, d, lo, hi, bottom = false) => solid(o, k, rect(x, z, w, d), lo, hi, bottom);
function edge(i) {
  const a = R[i],
    b = R[(i + 1) % R.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    sign = Math.sign(
      R.reduce((s, p, j) => {
        const q = R[(j + 1) % R.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
  return { a, L, u, n: [u[1] * sign, -u[0] * sign] };
}
function panel(o, k, poly, e, offset, depth, lod) {
  const pos = (p, d) => [
    e.a[0] + e.u[0] * p[0] + e.n[0] * d,
    p[1],
    e.a[1] + e.u[1] * p[0] + e.n[1] * d,
  ];
  face(
    o,
    k,
    poly.map((p) => pos(p, offset + depth)),
    [e.n[0], 0, e.n[1]],
  );
  if (lod < 2 || depth === 0) return;
  face(
    o,
    k,
    poly.map((p) => pos(p, offset)),
    [-e.n[0], 0, -e.n[1]],
  );
  const sign = Math.sign(
    poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dt = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      o,
      k,
      [pos(a, offset), pos(b, offset), pos(b, offset + depth), pos(a, offset + depth)],
      [dy * e.u[0] * sign, -dt * sign, dy * e.u[1] * sign],
    );
  }
}
const rectangle = (a, b, lo, hi) => [
  [a, lo],
  [b, lo],
  [b, hi],
  [a, hi],
];
function diagonal(o, e, a, b, width, lod) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy),
    v = [((-dy / L) * width) / 2, ((dx / L) * width) / 2],
    q = [
      a.map((x, i) => x + v[i]),
      b.map((x, i) => x + v[i]),
      b.map((x, i) => x - v[i]),
      a.map((x, i) => x - v[i]),
    ];
  panel(o, 'trim', q, e, H.braceProjection, 0.1, lod);
}
function steelElevation(o, i, lod) {
  const e = edge(i),
    n = H.screenBays[lod];
  for (let j = 0; j < 15; j++) {
    const lo = H.floorBoundaries[j],
      hi = H.floorBoundaries[j + 1];
    panel(o, 'glass', rectangle(0.12, e.L - 0.12, lo + 0.7, hi - 0.08), e, 0.035, 0, lod);
    panel(o, 'ceramic', rectangle(0, e.L, lo, lo + H.ceramicBandHeight), e, 0.07, 0.035, lod);
    for (let k = 0; k < n; k++) {
      const a = (k * e.L) / n + 0.08,
        b = ((k + 1) * e.L) / n - 0.08;
      diagonal(o, e, [a, lo + 0.75], [b, hi - 0.1], H.braceWidth, lod);
      diagonal(o, e, [a, hi - 0.1], [b, lo + 0.75], H.braceWidth, lod);
    }
  }
  for (let k = 0; k <= n; k++) {
    const t = (k * e.L) / n;
    panel(
      o,
      'trim',
      rectangle(Math.max(0, t - 0.09), Math.min(e.L, t + 0.09), P.floor, H.roofTop),
      e,
      H.braceProjection,
      0.12,
      lod,
    );
  }
  for (const y of H.floorBoundaries.slice(1))
    panel(o, 'trim', rectangle(0, e.L, y - 0.09, y + 0.09), e, H.braceProjection, 0.12, lod);
  componentEvidence.push({
    kind: 'whole-north-or-south-steel-ceramic-glass-elevation',
    edge: i,
    fullStoreys: 15,
    estimatedBays: n,
    exactBracePatternClaimed: false,
  });
}
function cementElevation(o, i, lod) {
  const e = edge(i),
    n = H.sideWindowBays[lod];
  for (let j = 0; j < 15; j++) {
    const lo = H.floorBoundaries[j],
      hi = H.floorBoundaries[j + 1],
      cy = (lo + hi) / 2 + 0.2;
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) * e.L) / n,
        w = Math.min(2.1, (e.L / n) * 0.6),
        h = 2.25;
      panel(o, 'glass', rectangle(t - w / 2, t + w / 2, cy - h / 2, cy + h / 2), e, 0.04, 0, lod);
      if (lod > 0) {
        for (const a of [t - w / 2 - 0.08, t + w / 2])
          panel(
            o,
            'trim',
            rectangle(a, a + 0.08, cy - h / 2 - 0.08, cy + h / 2 + 0.08),
            e,
            0.08,
            0.04,
            lod,
          );
        for (const y of [cy - h / 2 - 0.08, cy + h / 2])
          panel(
            o,
            'trim',
            rectangle(t - w / 2 - 0.08, t + w / 2 + 0.08, y, y + 0.08),
            e,
            0.08,
            0.04,
            lod,
          );
      }
    }
  }
  if (lod > 0)
    for (const y of H.floorBoundaries.slice(1))
      panel(o, 'plaster', rectangle(0, e.L, y - 0.1, y + 0.1), e, 0.04, 0.02, lod);
  componentEvidence.push({
    kind: 'whole-cement-side-elevation',
    edge: i,
    fullStoreys: 15,
    windowCensusEstimated: true,
  });
}
function parapet(o, lod) {
  for (let i = 0; i < 4; i++) {
    const e = edge(i);
    panel(o, 'plaster', rectangle(0, e.L, H.roofTop, H.parapetTop), e, 0, 0.14, lod);
    const a = e.a,
      b = R[(i + 1) % R.length],
      p = a.map((v, k) => v - e.n[k] * 0.25),
      q = b.map((v, k) => v - e.n[k] * 0.25);
    face(
      o,
      'plaster',
      [
        [p[0], H.roofTop, p[1]],
        [q[0], H.roofTop, q[1]],
        [q[0], H.parapetTop, q[1]],
        [p[0], H.parapetTop, p[1]],
      ],
      [-e.n[0], 0, -e.n[1]],
    );
    face(
      o,
      'trim',
      [
        [a[0], H.parapetTop, a[1]],
        [b[0], H.parapetTop, b[1]],
        [q[0], H.parapetTop, q[1]],
        [p[0], H.parapetTop, p[1]],
      ],
      [0, 1, 0],
    );
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  solid(o, 'stone', R, H.foundationBottom, P.floor, true);
  solid(o, 'plaster', R, P.floor, H.roofTop);
  cap(o, 'roof', R, H.roofTop + 0.025);
  for (const i of [0, 2]) steelElevation(o, i, lod);
  for (const i of [1, 3]) cementElevation(o, i, lod);
  parapet(o, lod);
  // Closed intact south entrance; the independent mall is outside this tower asset.
  const e = edge(2);
  panel(
    o,
    'glass',
    rectangle(e.L / 2 - 2.4, e.L / 2 + 2.4, P.floor, P.floor + 3.2),
    e,
    0.41,
    0.02,
    lod,
  );
  for (const t of [e.L / 2 - 2.48, e.L / 2, e.L / 2 + 2.4])
    panel(o, 'trim', rectangle(t, t + 0.08, P.floor, P.floor + 3.3), e, 0.46, 0.05, lod);
  box(o, 'trim', P.frontCenterX, P.frontZ - 0.55, 6, 1.1, 3.35, 3.55);
  componentEvidence.push({
    kind: 'whole-original-fourcontrol-independent-tower',
    nativeControls: 4,
    aboveGroundStoreys: 15,
    basements: 1,
    completeRoofParapetAndAllElevations: true,
    separateMallAndReplacementExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tn/tnk/plasco_building',
  camera = [88, 70, -112],
  look = [0, 27, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'tn/tnk',
  title: 'Plasco Building — original tower, Tehran',
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
    'Whole independent original1962Plasco tower in intact2016phase: original2016four-corner mapped building,15above-groundlevels/oneunexposedbasement, fullroof/parapet, cement east/west walls and open steel-brace/ceramic/glazed north/south elevations, closed south entrance/shopfront. Primary written engineering facts, no imagery. Exact height/plan discrepancy, brace/window census, sections/finish/grade are explicit estimates; independent northern mall and2021replacement excluded.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: H.foundationBottom - 0.03,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'membrane',
    'concrete_boardformed',
    'metal_painted',
    'tile_glazed',
    'window_punched',
  ],
  qaCameras: [
    {
      name: 'whole-original-tower-south-entrance-and-steel-elevation',
      position: camera,
      lookAt: look,
    },
    { name: 'whole-north-brace-face-and-cement-side', position: [-88, 65, 102], lookAt: look },
    {
      name: 'complete-original-footprint-roof-and-parapet',
      position: [63, 116, 56],
      lookAt: [0, 34, 0],
    },
    {
      name: 'open-steel-braces-ceramic-bands-and-glazing',
      position: [1, 31, -38],
      lookAt: [1, 30, P.frontZ],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-original-plasco-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Primary engineering research written architectural facts only; every photograph/figure/diagram unused. Original2016OpenStreetMap numerical whole tower data ODbL; no borrowed mesh or image texture. Exact sections/brace and window pattern/roof/finish/grade estimated; no surveyed contact or currentreplacement.',
};
