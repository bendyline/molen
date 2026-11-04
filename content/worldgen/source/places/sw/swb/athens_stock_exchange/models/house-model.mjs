/** Complete named Sofokleous exchange. Primary written facts; all imagery unused. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.72, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.46, metallic: 0.04 },
};
const C = {
    plaster: rgb('e4dfd0'),
    roof: rgb('8e928d'),
    stone: rgb('bbb8ad'),
    trim: rgb('e2dfd3'),
    wood: rgb('63594b'),
    glass: rgb('4c606e'),
  },
  R = P.nativeExchangeRing,
  H = P.building,
  E = P.entrance;
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
let currentLod = 3;
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
function column(o, x, z, lod) {
  const n = [6, 10, 20, 32][lod],
    ring = (r, y) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          flute = lod > 1 && i % 2 === 0 ? 0.965 : 1;
        return [x + r * flute * Math.cos(a), y, z + r * flute * Math.sin(a)];
      });
  box(o, 'trim', x, z, 1.22, 1.22, E.columnBase, E.columnBase + 0.3);
  const rings = [
    ring(0.53, E.columnBase + 0.3),
    ring(0.47, E.columnBase + 0.65),
    ring(0.4, E.columnTop - 0.55),
    ring(0.47, E.columnTop - 0.3),
  ];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const q = [rings[j][i], rings[j][(i + 1) % n], rings[j + 1][(i + 1) % n], rings[j + 1][i]];
      face(o, 'trim', q, [q[0][0] - x, 0, q[0][2] - z]);
    }
  box(o, 'trim', x, z, 1.16, 1.16, E.columnTop - 0.3, E.columnTop);
}
function elevationPrism(o, k, poly, z, depth) {
  face(
    o,
    k,
    poly.map(([x, y]) => [x, y, z]),
    [0, 0, -1],
  );
  face(
    o,
    k,
    poly.map(([x, y]) => [x, y, z + depth]),
    [0, 0, 1],
  );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    face(
      o,
      k,
      [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], b[1], z + depth],
        [a[0], a[1], z + depth],
      ],
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
}
function entrance(o, lod) {
  const x = P.frontCenterX,
    z = P.frontZ - E.projection;
  for (let j = 0; j < E.steps; j++) {
    const depth = E.projection + (E.steps - j) * E.stepTread,
      front = P.frontZ - depth;
    box(
      o,
      'trim',
      x,
      (front + P.frontZ) / 2,
      E.width + 1.6,
      depth,
      0,
      (j + 1) * E.stepRise,
      j === 0,
    );
  }
  for (const dx of E.columnXs) column(o, x + dx, z + 0.65, lod);
  box(o, 'trim', x, z + 0.65, E.width, 1.55, E.columnTop, E.entablatureTop);
  elevationPrism(
    o,
    'trim',
    [
      [x - E.width / 2, E.entablatureTop],
      [x + E.width / 2, E.entablatureTop],
      [x, E.pedimentTop],
    ],
    z - 0.18,
    1.55,
  );
  if (lod > 0) {
    box(
      o,
      'stone',
      x,
      z - 0.22,
      E.width + 0.3,
      0.14,
      E.entablatureTop - 0.15,
      E.entablatureTop + 0.12,
    );
    elevationPrism(
      o,
      'plaster',
      [
        [x - E.width / 2 + 0.8, E.entablatureTop + 0.22],
        [x + E.width / 2 - 0.8, E.entablatureTop + 0.22],
        [x, E.pedimentTop - 0.42],
      ],
      z - 0.2,
      0.04,
    );
  }
  box(o, 'wood', x, P.frontZ - 0.07, 4.2, 0.14, P.floor, P.floor + 4.7);
  if (lod > 0) {
    box(o, 'trim', x, P.frontZ - 0.18, 0.15, 0.16, P.floor, P.floor + 4.7);
    box(o, 'trim', x, P.frontZ - 0.18, 4.4, 0.16, P.floor + 4.7, P.floor + 4.9);
    for (const dx of [-2.3, 2.3])
      box(o, 'trim', x + dx, P.frontZ - 0.15, 0.2, 0.16, P.floor, P.floor + 4.9);
  }
  componentEvidence.push({
    kind: 'whole-monumental-stair-columns-and-simple-pediment',
    marbleSteps: 6,
    columnCountExplicitEstimate: 4,
    allImageryUnused: true,
  });
}
function wallWindows(o, lod) {
  const sign = Math.sign(
    R.reduce((s, p, i) => {
      const q = R[(i + 1) % R.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    if (L < 6) continue;
    const u = [dx / L, dz / L],
      n = [u[1] * sign, -u[0] * sign],
      count = Math.max(1, Math.floor(L / 4.3)),
      pos = (t, y, off) => [a[0] + u[0] * t + n[0] * off, y, a[1] + u[1] * t + n[1] * off],
      panel = (k, t, y, w, h, off) =>
        face(
          o,
          k,
          [
            pos(t - w / 2, y, off),
            pos(t + w / 2, y, off),
            pos(t + w / 2, y + h, off),
            pos(t - w / 2, y + h, off),
          ],
          [n[0], 0, n[1]],
        );
    for (let j = 0; j < count; j++) {
      const t = ((j + 0.5) * L) / count;
      for (const center of H.windowRows) {
        const p = pos(t, center, 0),
          front = i === 7;
        if (front && center < 8.2 && Math.abs(p[0] - P.frontCenterX) < 8.6) continue;
        const w = center < 8.2 ? 1.65 : 1.55,
          h = center < 8.2 ? 1.85 : 2.05;
        panel('glass', t, center - h / 2, w, h, 0.055);
        if (lod > 0) {
          panel('trim', t - w / 2 - 0.1, center - h / 2 - 0.13, 0.2, h + 0.26, 0.095);
          panel('trim', t + w / 2 + 0.1, center - h / 2 - 0.13, 0.2, h + 0.26, 0.095);
          panel('trim', t, center - h / 2 - 0.13, w + 0.4, 0.15, 0.1);
          panel('trim', t, center + h / 2 - 0.02, w + 0.4, 0.15, 0.1);
        }
        if (lod > 1) {
          panel('wood', t, center - h / 2, 0.055, h, 0.12);
          panel('wood', t, center - 0.03, w, 0.06, 0.12);
          const q = pos(t, center - h / 2 - 0.16, 0.17);
          box(
            o,
            'trim',
            q[0],
            q[2],
            Math.abs(u[0]) * (w + 0.5) + Math.abs(n[0]) * 0.22,
            Math.abs(u[1]) * (w + 0.5) + Math.abs(n[1]) * 0.22,
            center - h / 2 - 0.22,
            center - h / 2 - 0.12,
          );
        }
      }
    }
  }
}
function ribbon(o, k, y, h, offset) {
  const area = Math.sign(
    R.reduce((s, p, i) => {
      const q = R[(i + 1) % R.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [((b[1] - a[1]) / L) * area, (-(b[0] - a[0]) / L) * area],
      aa = a.map((v, k) => v + n[k] * offset),
      bb = b.map((v, k) => v + n[k] * offset);
    face(
      o,
      k,
      [
        [aa[0], y, aa[1]],
        [bb[0], y, bb[1]],
        [bb[0], y + h, bb[1]],
        [aa[0], y + h, aa[1]],
      ],
      [n[0], 0, n[1]],
    );
    if (currentLod > 0)
      face(
        o,
        k,
        [
          [aa[0], y + h, aa[1]],
          [bb[0], y + h, bb[1]],
          [b[0], y + h, b[1]],
          [a[0], y + h, a[1]],
        ],
        [0, 1, 0],
      );
  }
}
function parapetInside(o) {
  const sign = Math.sign(
    R.reduce((s, a, i) => {
      const b = R[(i + 1) % R.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  const normals = R.map((a, i) => {
    const b = R[(i + 1) % R.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [((b[1] - a[1]) / l) * sign, (-(b[0] - a[0]) / l) * sign];
  });
  const inner = R.map((a, i) =>
    a.map((v, k) => v - 0.16 * (normals[i][k] + normals[(i + R.length - 1) % R.length][k])),
  );
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length,
      a = R[i],
      b = R[j],
      p = inner[i],
      q = inner[j];
    face(
      o,
      'plaster',
      [
        [p[0], H.roofTop, p[1]],
        [q[0], H.roofTop, q[1]],
        [q[0], H.parapetTop, q[1]],
        [p[0], H.parapetTop, p[1]],
      ],
      [-normals[i][0], 0, -normals[i][1]],
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
export function buildHouse(o, frame, lod = 3) {
  currentLod = lod;
  componentEvidence.length = 0;
  solid(o, 'stone', R, H.foundationBottom, P.floor, true);
  solid(o, 'plaster', R, P.floor, H.roofTop);
  cap(o, 'roof', R, H.roofTop + 0.025);
  ribbon(o, 'stone', P.floor, 0.8, 0.035);
  ribbon(o, 'trim', H.groundAndMezzanineTop - 0.22, 0.44, 0.13);
  ribbon(o, 'trim', H.roofTop - 0.25, 0.55, 0.2);
  ribbon(o, 'plaster', H.roofTop + 0.25, H.parapetTop - H.roofTop - 0.25, 0.02);
  parapetInside(o);
  if (lod > 0) {
    ribbon(o, 'trim', H.parapetTop - 0.13, 0.13, 0.12);
    for (const y of H.upperFloorHeights.slice(1, -1)) ribbon(o, 'trim', y - 0.1, 0.16, 0.045);
  }
  wallWindows(o, lod);
  entrance(o, lod);
  componentEvidence.push({
    kind: 'whole-named-exchange-ninecontrol-envelope',
    nativeControls: 9,
    completeRoof: true,
    allSideRearElevations: true,
    nominalAboveGroundLevels: 6,
    basementsNotExposed: true,
    adjacentIndependentBankExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/sw/swb/athens_stock_exchange',
  camera = [83, 53, -101],
  look = [0, 11, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'sw/swb',
  title: 'Athens Stock Exchange — historic Sofokleous building',
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
    'Complete named former exchange at8Sofokleous in approximate2015post-extension form: original nine-control full building, six-level office/hall/mezzanine interpretation, entire flat roof/parapet, all side/rear walls and monumental marble stair/column/simple-pediment entrance. Original owner/Ministry/OpenHouse written architecture and named native footprint; all imagery unused. Exact heights/floor interpretation/columncount/openings/roof/finish/grade explicitly estimated.',
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
    'plaster_lime',
    'membrane',
    'stone_ashlar',
    'stone_marble',
    'wood_plain',
    'window_punched',
  ],
  qaCameras: [
    { name: 'whole-sofokleous-building-and-monumental-entrance', position: camera, lookAt: look },
    { name: 'whole-rear-and-independent-bank-boundary', position: [-78, 46, 84], lookAt: look },
    {
      name: 'complete-native-envelope-roof-and-parapet',
      position: [66, 104, 48],
      lookAt: [0, 13, 0],
    },
    {
      name: 'marble-stair-estimated-columns-simple-pediment',
      position: [0.55, 10, -48],
      lookAt: [0.55, 5.6, P.frontZ],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-sofokleous-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Primary owner/Ministry/OpenHouse written architectural facts only; every image unused. Original whole named OpenStreetMap building/address data ODbL. No borrowed mesh or image texture. Exact historical sections/roof/columncount/floor interpretation/openings/finish/grade estimated; no survey or current replacement.',
};
