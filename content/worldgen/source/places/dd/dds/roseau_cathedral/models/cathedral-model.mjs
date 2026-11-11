/** Roseau Cathedral, showing the tower and spire photographed in December 2008. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { wallRing, tower, foundationBottom, towerSpireBase, towerSpireTop } = plan;
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91, metallic: 0 },
};
const colors = {
  stone: rgb('a39a91'),
  trim: rgb('c2b6a3'),
  roof: rgb('736e69'),
  plaster: rgb('e1d9c9'),
  dark: rgb('4b4541'),
};
const warm = rgb('b8a695'),
  darker = rgb('78736c'),
  brick = rgb('9a6153'),
  door = rgb('69524c');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
function face(out, k, p, wanted, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((s, v, i) => s + v * wanted[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, k, p, n, color);
  else out.addConvexPolygon(k, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function shell(out, k, ring, y0, y1, color = colors[k]) {
  const b = new MeshBufferBuilder();
  poly(b, k, ring, y0, y1, color);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, k, p, normalFor(...p), color);
  }
}
const winding = (ring) =>
  Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [u, v] = ring[(i + 1) % ring.length];
      return sum + x * v - z * u;
    }, 0),
  );
function edge(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [(sign * dz) / len, 0, (-sign * dx) / len];
  return {
    len,
    n,
    p: (u, y, d = 0) => [a[0] + (dx * u) / len + n[0] * d, y, a[1] + (dz * u) / len + n[2] * d],
  };
}
function panel(out, k, s, x0, y0, x1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(x0, y0, d), s.p(x1, y0, d), s.p(x1, y1, d), s.p(x0, y1, d)], s.n, color);
}
function gothic(out, s, u, y, width, height, lod, fill = colors.dark) {
  const n = [4, 6, 8, 11][lod],
    r = width / 2,
    spring = y + height - r * 1.12;
  for (const [k, w, d, low, peak, color] of [
    ['trim', r + 0.19, 0.055, y - 0.14, r * 1.12 + 0.27, warm],
    ['dark', r, 0.081, y, r * 1.12, fill],
  ]) {
    const p = [s.p(u - w, low, d), s.p(u + w, low, d)];
    for (let i = 0; i <= n; i++) {
      const t = 1 - (2 * i) / n;
      p.push(s.p(u + w * t, spring + peak * (1 - Math.pow(Math.abs(t), 1.52)), d));
    }
    face(out, k, p, s.n, color);
  }
}
const midpoint = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
function resize(ring, t) {
  const [x, z] = midpoint(ring);
  return ring.map(([u, v]) => [x + (u - x) * t, z + (v - z) * t]);
}
function gable(out, x0, x1, z0, z1, eave, ridge) {
  const x = (x0 + x1) / 2;
  face(
    out,
    'stone',
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [x, ridge, z0],
    ],
    [0, 0, -1],
  );
  face(
    out,
    'stone',
    [
      [x0, eave, z1],
      [x1, eave, z1],
      [x, ridge, z1],
    ],
    [0, 0, 1],
  );
  for (const u of [x0 - 0.19, x1 + 0.19])
    face(
      out,
      'roof',
      [
        [u, eave, z0 - 0.23],
        [u, eave, z1 + 0.23],
        [x, ridge + 0.04, z1 + 0.23],
        [x, ridge + 0.04, z0 - 0.23],
      ],
      [0, 1, 0],
    );
}
function nave(out, lod) {
  shell(out, 'stone', wallRing, foundationBottom, 10.21);
  for (const [x0, x1, z0, z1, eave, peak] of [
    [-9.65, 17.36, -24.87, 18.55, 13.22, 18.25],
    [-11.65, -5.12, -24.93, 18.47, 10.2, 13.59],
    [13.67, 19.9, -24.89, 18.49, 10.2, 13.69],
    [-23.88, -11.5, -19.43, -11.05, 10.22, 13.35],
  ]) {
    if (eave > 10.22) block(out, 'stone', x0, 10.2, z0, x1, eave, z1);
    gable(out, x0, x1, z0, z1, eave, peak);
  }
  if (!lod) return;
  for (let i = 0; i < wallRing.length; i++) {
    const s = edge(wallRing[i], wallRing[(i + 1) % wallRing.length], winding(wallRing));
    if (s.len < 4.4) continue;
    panel(out, 'trim', s, 0, 0.17, s.len, 0.57, 0.036, brick);
    const n = Math.max(1, Math.round(s.len / 5.4));
    for (let j = 0; j < n; j++) {
      const u = (s.len * (j + 0.5)) / n;
      const p = s.p(u, 0);
      if (p[2] > 18.5 && p[0] > -2.6 && p[0] < 11.25) continue;
      gothic(out, s, u, 4.57, 1.48, 3.24, lod);
      if (lod > 1) {
        panel(out, 'trim', s, u - 0.1, 4.5, u + 0.1, 6.94, 0.112);
        const pilaster = (s.len * (j + 0.12)) / n;
        panel(out, 'trim', s, pilaster - 0.23, 3.09, pilaster + 0.23, 10.17, 0.093, warm);
      }
    }
  }
}
function spire(out, lod) {
  const [x, z] = midpoint(tower);
  const ring = (y, rx, rz) => radialRing(y, rx, rz, 8, [x, z], Math.PI / 8);
  loft(
    out,
    'roof',
    [
      ring(towerSpireBase, 4.17, 3.46),
      ring(towerSpireBase + 1.39, 3.79, 3.1),
      ring(towerSpireTop - 0.39, 0.25, 0.23),
      ring(towerSpireTop, 0.082, 0.08),
    ],
    colors.roof,
  );
  const seams = ring(towerSpireBase + 0.55, 4.07, 3.37);
  if (lod)
    for (const [u, y, v] of seams) {
      const hi = [x + (u - x) * 0.075, towerSpireTop - 0.43, z + (v - z) * 0.075];
      const normal = [u - x, 0, v - z];
      face(
        out,
        'trim',
        [
          [u - 0.039, y, v],
          [u + 0.039, y, v],
          [hi[0] + 0.025, hi[1], hi[2]],
          [hi[0] - 0.025, hi[1], hi[2]],
        ],
        normal,
        warm,
      );
    }
  block(
    out,
    'trim',
    x - 0.048,
    towerSpireTop - 0.03,
    z - 0.047,
    x + 0.048,
    towerSpireTop + 1.08,
    z + 0.047,
  );
  block(
    out,
    'trim',
    x - 0.31,
    towerSpireTop + 0.63,
    z - 0.043,
    x + 0.31,
    towerSpireTop + 0.72,
    z + 0.043,
  );
}
function clock(out, s, u, y, lod) {
  const r = 0.59,
    n = lod === 3 ? 20 : 12;
  const ring = Array.from({ length: n }, (_, i) =>
    s.p(u + r * Math.cos((i * Math.PI * 2) / n), y + r * Math.sin((i * Math.PI * 2) / n), 0.092),
  );
  face(out, 'plaster', ring, s.n);
  panel(out, 'dark', s, u - 0.032, y - 0.06, u + 0.032, y + 0.31, 0.104);
  panel(out, 'dark', s, u - 0.21, y - 0.038, u + 0.035, y + 0.032, 0.106);
}
function bellTower(out, lod) {
  shell(out, 'stone', tower, foundationBottom, 8.12);
  shell(out, 'stone', resize(tower, 0.966), 8.1, 15.05, warm);
  shell(out, 'stone', resize(tower, 0.935), 15.02, towerSpireBase, colors.stone);
  for (const [y, r] of [
    [8.04, 1.014],
    [15.01, 1.01],
    [towerSpireBase - 0.27, 0.994],
  ])
    shell(out, 'trim', resize(tower, r), y - 0.28, y + 0.19, darker);
  if (lod) {
    const sign = winding(tower),
      middle = resize(tower, 0.966),
      upper = resize(tower, 0.935);
    for (const i of [0, 1, 2]) {
      const s = edge(tower[i], tower[(i + 1) % tower.length], sign);
      const m = edge(middle[i], middle[(i + 1) % middle.length], sign);
      const t = edge(upper[i], upper[(i + 1) % upper.length], sign);
      gothic(out, s, s.len / 2, 1.02, i === 1 ? 3.9 : 2.13, 5.69, lod, door);
      const count = 3;
      for (let k = 0; k < count; k++) {
        const u = (m.len * (k + 0.5)) / count;
        gothic(out, m, u, 8.68, i === 1 ? 2.12 : 1.6, 4.77, lod, door);
        if (i === 1 && lod > 1) {
          const [x, , z] = m.p(u, 0, 0.19);
          const rings = [
            [8.73, 0.35],
            [9.28, 0.29],
            [10.1, 0.23],
            [10.44, 0.14],
            [10.68, 0.12],
          ].map(([y, r]) => radialRing(y, r, r, lod === 3 ? 8 : 6, [x, z]));
          loft(out, 'plaster', rings, colors.plaster);
        }
      }
      for (const x of [0.3, 0.7]) {
        gothic(out, t, t.len * x, 16.25, 1.68, 5.62, lod);
        if (lod > 1)
          for (let j = 0; j < 10; j++)
            panel(
              out,
              'trim',
              t,
              t.len * x - 0.73,
              16.52 + j * 0.38,
              t.len * x + 0.73,
              16.61 + j * 0.38,
              0.095,
              darker,
            );
      }
      clock(out, t, t.len / 2, 18.89, lod);
    }
  }
  if (lod)
    for (const [x, z] of resize(tower, 0.93)) {
      block(
        out,
        'stone',
        x - 0.38,
        towerSpireBase - 0.02,
        z - 0.38,
        x + 0.38,
        towerSpireBase + 1.32,
        z + 0.38,
      );
      block(
        out,
        'trim',
        x - 0.25,
        towerSpireBase + 1.27,
        z - 0.24,
        x + 0.25,
        towerSpireBase + 1.77,
        z + 0.24,
      );
    }
  const [cx] = midpoint(tower),
    front = tower[1][1],
    n = lod > 1 ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const a = front + 0.03 + (2.17 * i) / n,
      b = front + 0.03 + (2.17 * (i + 1)) / n;
    block(out, 'trim', cx - 3.5, foundationBottom, a, cx + 3.5, 1.03 - (i * 0.87) / n, b, darker);
  }
  spire(out, lod);
}
function domeTurret(out, lod) {
  const x = -8.87,
    z = 13.66;
  block(out, 'stone', x - 2.0, 9.46, z - 2.02, x + 2.0, 15.13, z + 2.02, warm);
  block(out, 'trim', x - 2.16, 14.91, z - 2.18, x + 2.16, 15.35, z + 2.18, darker);
  const sections = [
    [15.35, 1.75],
    [15.88, 1.58],
    [16.62, 1.1],
    [17.15, 0.13],
  ];
  loft(
    out,
    'plaster',
    sections.map(([y, r]) => radialRing(y, r, r, lod > 1 ? 14 : 8, [x, z])),
    colors.plaster,
  );
  if (lod) {
    const s = edge([x + 2.0, z + 2.024], [x - 2.0, z + 2.024], 1);
    for (const q of [0.35, 0.65]) gothic(out, s, s.len * q, 11.87, 0.68, 2.41, lod);
  }
  block(out, 'trim', x - 0.037, 17.11, z - 0.038, x + 0.037, 17.91, z + 0.038);
}
export function buildCathedral(out, _frame, lod = 3) {
  nave(out, lod);
  bellTower(out, lod);
  domeTurret(out, lod);
}
export const cathedralSkyline = (out, frame) => buildCathedral(out, frame, 0);
export const cathedralDistrict = (out, frame) => buildCathedral(out, frame, 1);
export const cathedralStreet = (out, frame) => buildCathedral(out, frame, 2);
export const cathedralCloseup = (out, frame) => buildCathedral(out, frame, 3);
const camera = [59, 35, 76],
  lookAt = [3, 13, 1];
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'cathedral-model.mjs',
  surfaces,
  build: buildCathedral,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Roseau Cathedral with a tall stone tower, historic spire, pointed openings and weathered masonry ranges.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone_weathered', 'slate', 'plaster_lime'],
  qaCameras: [
    { name: 'historic-tower-and-west-steps', position: [33, 13, 72], lookAt: [4, 14, 23] },
    { name: 'nave-side-range-and-dome', position: [-49, 28, 34], lookAt: [1, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-roseau-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/dd/dds/roseau_cathedral/models/cathedral-model.mjs',
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.24,
    surfaces,
    authoredLevels: {
      district: { export: 'cathedralDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'cathedralStreet', errorMeters: 0.063, surfaces },
      closeup: { export: 'cathedralCloseup', errorMeters: 0.024, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The December 2008 exterior photograph by Nelro is public domain. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
