/** Capitol Records Building at 1750 Vine Street, Hollywood. */
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
const { podium, foundationBottom, podiumTop, towerRoof, towerRadius, spireTop } = plan;
const tau = 2 * Math.PI;
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  edge: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.09 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.94, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.81, metallic: 0.05 },
  sign: { slot: 'trim', localRef: 'palette:#f1f1f1', roughness: 0.92, metallic: 0 },
};
const colors = {
  wall: rgb('c6c5bf'),
  edge: rgb('e9e9e3'),
  roof: rgb('a6a8a6'),
  dark: rgb('4a555a'),
  sign: rgb('f5f4eb'),
};
const concrete = rgb('d7d6cf'),
  aluminum = rgb('c1c7c6'),
  signBacking = rgb('343b3e'),
  mast = rgb('c9cbc5');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
function face(out, k, p, expected, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
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
const point = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
const outward = (a, b) => [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
function cylinderStrip(out, k, a, b, r0, y0, r1, y1, normal, color = colors[k]) {
  face(
    out,
    k,
    [point(a, r0, y0), point(b, r0, y0), point(b, r1, y1), point(a, r1, y1)],
    normal,
    color,
  );
}
function tower(out, lod) {
  const segments = [16, 24, 32, 44][lod];
  const core = towerRadius - 0.84;
  const deck = podiumTop - 0.21,
    floors = 12,
    step = (towerRoof - deck) / floors;
  const northEast = (t) => Math.sin(t) < -0.26 && Math.cos(t) < 0.72;
  for (let i = 0; i < segments; i++) {
    const a = (tau * i) / segments,
      b = (tau * (i + 1)) / segments,
      m = (a + b) / 2,
      n = outward(a, b);
    const blank = northEast(m);
    cylinderStrip(
      out,
      blank ? 'wall' : 'dark',
      a,
      b,
      core,
      deck - 0.1,
      core,
      towerRoof - 0.23,
      n,
      blank ? colors.wall : colors.dark,
    );
    for (let j = 1; j <= floors; j++) {
      const y = deck + step * j;
      const lip = j === floors ? 0.46 : 0.29;
      cylinderStrip(out, 'edge', a, b, towerRadius, y - lip, towerRadius, y, n);
      if (lod) {
        cylinderStrip(
          out,
          'edge',
          a,
          b,
          core,
          y - 0.49,
          towerRadius,
          y - lip,
          [0, -1, 0],
          aluminum,
        );
        cylinderStrip(out, 'edge', a, b, towerRadius, y, core, y + 0.07, [0, 1, 0]);
      }
      if (lod > 1 && !blank) {
        cylinderStrip(
          out,
          'edge',
          a,
          b,
          core + 0.034,
          y - 1.09,
          core + 0.034,
          y - 0.49,
          n,
          aluminum,
        );
        const divisions = lod === 3 ? 3 : 2;
        const mullion = (b - a) * 0.043;
        for (let q = 0; q < divisions; q++) {
          const t = a + ((q + 0.45) * (b - a)) / divisions;
          cylinderStrip(
            out,
            'edge',
            t - mullion,
            t + mullion,
            core + 0.082,
            y - step + 0.08,
            core + 0.082,
            y - 1.07,
            outward(t, t),
            aluminum,
          );
        }
      } else if (lod > 1 && blank && i % 5 === 1) {
        cylinderStrip(
          out,
          'dark',
          m - 0.027,
          m + 0.027,
          core + 0.063,
          y - 2.43,
          core + 0.063,
          y - 1.1,
          n,
          signBacking,
        );
      }
    }
  }
  const profile = (layers, k, color) => {
    const rings = layers.map(([y, r]) => radialRing(y, r, r, lod > 1 ? 24 : 16));
    loft(out, k, rings, color);
  };
  profile(
    [
      [towerRoof - 0.31, towerRadius - 0.08],
      [towerRoof + 0.04, towerRadius - 0.11],
    ],
    'edge',
    colors.edge,
  );
  profile(
    [
      [towerRoof + 0.015, 9.77],
      [towerRoof + 1.25, 9.77],
    ],
    'wall',
    colors.wall,
  );
  profile(
    [
      [towerRoof + 1.21, 9.99],
      [towerRoof + 1.47, 9.84],
    ],
    'roof',
    colors.roof,
  );
  const [sx, sz] = [0.12, -0.73],
    sides = lod > 1 ? 10 : 6;
  const mastRings = [
    [towerRoof + 0.85, 0.72],
    [towerRoof + 2.29, 0.61],
    [spireTop - 0.16, 0.073],
    [spireTop, 0.056],
  ].map(([y, r]) => radialRing(y, r, r, sides, [sx, sz]));
  loft(out, 'edge', mastRings, mast);
  if (lod) {
    block(out, 'edge', 4.57, towerRoof + 1.24, 1.39, 4.63, towerRoof + 5.86, 1.45, mast);
    for (let i = 0; i < 7; i++) {
      const y = towerRoof + 4.76 + i * 0.143;
      face(
        out,
        'wall',
        [
          [4.64, y, 1.44],
          [6.09, y + 0.04, 1.51],
          [6.09, y + 0.184, 1.51],
          [4.64, y + 0.144, 1.44],
        ],
        [0, 0, 1],
        i % 2 ? rgb('dddcd2') : rgb('a2524b'),
      );
    }
    face(
      out,
      'wall',
      [
        [4.64, towerRoof + 5.26, 1.451],
        [5.24, towerRoof + 5.28, 1.48],
        [5.24, towerRoof + 5.774, 1.48],
        [4.64, towerRoof + 5.754, 1.451],
      ],
      [0, 0, 1],
      rgb('53667a'),
    );
  }
}
const letter = {
  C: [
    [0.92, 0.9, 0.22, 0.9],
    [0.22, 0.9, 0.14, 0.75],
    [0.14, 0.75, 0.14, 0.25],
    [0.14, 0.25, 0.22, 0.1],
    [0.22, 0.1, 0.92, 0.1],
  ],
  A: [
    [0.1, 0.1, 0.49, 0.9],
    [0.49, 0.9, 0.88, 0.1],
    [0.29, 0.43, 0.69, 0.43],
  ],
  P: [
    [0.14, 0.1, 0.14, 0.9],
    [0.14, 0.9, 0.78, 0.9],
    [0.78, 0.9, 0.86, 0.78],
    [0.86, 0.78, 0.86, 0.6],
    [0.86, 0.6, 0.75, 0.5],
    [0.75, 0.5, 0.14, 0.5],
  ],
  I: [[0.5, 0.1, 0.5, 0.9]],
  T: [
    [0.09, 0.9, 0.91, 0.9],
    [0.5, 0.9, 0.5, 0.1],
  ],
  O: [
    [0.2, 0.9, 0.8, 0.9],
    [0.8, 0.9, 0.88, 0.76],
    [0.88, 0.76, 0.88, 0.24],
    [0.88, 0.24, 0.8, 0.1],
    [0.8, 0.1, 0.2, 0.1],
    [0.2, 0.1, 0.12, 0.24],
    [0.12, 0.24, 0.12, 0.76],
    [0.12, 0.76, 0.2, 0.9],
  ],
  L: [
    [0.16, 0.9, 0.16, 0.1],
    [0.16, 0.1, 0.88, 0.1],
  ],
  R: [
    [0.14, 0.1, 0.14, 0.9],
    [0.14, 0.9, 0.78, 0.9],
    [0.78, 0.9, 0.86, 0.78],
    [0.86, 0.78, 0.86, 0.6],
    [0.86, 0.6, 0.74, 0.5],
    [0.74, 0.5, 0.14, 0.5],
    [0.53, 0.5, 0.91, 0.1],
  ],
  E: [
    [0.16, 0.9, 0.16, 0.1],
    [0.16, 0.9, 0.89, 0.9],
    [0.16, 0.51, 0.77, 0.51],
    [0.16, 0.1, 0.9, 0.1],
  ],
  D: [
    [0.14, 0.1, 0.14, 0.9],
    [0.14, 0.9, 0.65, 0.9],
    [0.65, 0.9, 0.87, 0.72],
    [0.87, 0.72, 0.87, 0.28],
    [0.87, 0.28, 0.65, 0.1],
    [0.65, 0.1, 0.14, 0.1],
  ],
  S: [
    [0.88, 0.9, 0.24, 0.9],
    [0.24, 0.9, 0.14, 0.78],
    [0.14, 0.78, 0.14, 0.6],
    [0.14, 0.6, 0.82, 0.45],
    [0.82, 0.45, 0.87, 0.33],
    [0.87, 0.33, 0.87, 0.21],
    [0.87, 0.21, 0.76, 0.1],
    [0.76, 0.1, 0.13, 0.1],
  ],
};
function rooftopSign(out, lod) {
  const label = 'CAPITOL RECORDS',
    span = 2.17,
    radius = 10.43,
    center = 1.48,
    base = towerRoof + 0.48,
    top = base + 1.96;
  const n = lod > 1 ? 24 : 12;
  for (let i = 0; i < n; i++) {
    const a = center - span / 2 + (span * i) / n,
      b = center - span / 2 + (span * (i + 1)) / n;
    cylinderStrip(out, 'dark', a, b, radius, base, radius, top, outward(a, b), signBacking);
  }
  if (!lod) return;
  for (let i = 0; i < label.length; i++) {
    const az = center + span * 0.47 - (span * 0.94 * (i + 0.5)) / label.length;
    const u = (0.94 * span) / label.length;
    for (const [x0, y0, x1, y1] of letter[label[i]] ?? []) {
      const dx = (x1 - x0) * u * radius,
        dy = (y1 - y0) * 1.47,
        len = Math.hypot(dx, dy);
      const dw = (0.079 * dy) / len / (u * radius),
        dh = (0.079 * dx) / len / 1.47;
      const p = (x, y) => point(az + (0.5 - x) * u, radius + 0.067, base + 0.24 + y * 1.47);
      face(
        out,
        'sign',
        [p(x0 - dw, y0 + dh), p(x1 - dw, y1 + dh), p(x1 + dw, y1 - dh), p(x0 + dw, y0 - dh)],
        outward(az, az),
      );
    }
  }
}
function podiumMesh(out, lod) {
  shell(out, 'wall', podium, foundationBottom, podiumTop, concrete);
  if (!lod) return;
  const e = podium[4][1] + 0.035;
  block(out, 'wall', 0.9, podiumTop - 0.46, e - 0.13, 31.7, podiumTop + 0.13, e + 0.09, concrete);
  for (const [a, b] of [
    [2.95, 7.56],
    [8.24, 12.63],
    [13.44, 18.87],
    [20.02, 24.8],
    [26.0, 29.56],
  ]) {
    block(out, 'dark', a, 1.61, e, b, 4.23, e + 0.056, colors.dark);
    if (lod > 1) {
      for (const t of [0.19, 0.41, 0.65, 0.85]) {
        const x = a + (b - a) * t;
        block(out, 'edge', x - 0.033, 1.63, e + 0.056, x + 0.033, 4.21, e + 0.082, aluminum);
      }
    }
  }
  block(out, 'wall', -21.86, podiumTop - 0.12, -19.37, -16.91, podiumTop + 0.69, 11.95, concrete);
  block(
    out,
    'roof',
    -21.72,
    podiumTop + 0.69,
    -19.28,
    -17.01,
    podiumTop + 0.76,
    11.83,
    colors.roof,
  );
}
export function buildTower(out, _frame, lod = 3) {
  podiumMesh(out, lod);
  tower(out, lod);
  rooftopSign(out, lod);
}
export const towerSkyline = (out, frame) => buildTower(out, frame, 0);
export const towerDistrict = (out, frame) => buildTower(out, frame, 1);
export const towerStreet = (out, frame) => buildTower(out, frame, 2);
export const towerCloseup = (out, frame) => buildTower(out, frame, 3);
const camera = [72, 41, 94],
  lookAt = [2, 25, 0];
export const towerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'tower-model.mjs',
  surfaces,
  build: buildTower,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Thirteen-storey cylindrical Capitol Records Building, with pale stacked ledges, rooftop lettering and tapered antenna.',
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
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted', 'membrane'],
  qaCameras: [
    { name: 'vine-street-podium-and-tower', position: [33, 16, 74], lookAt: [5, 25, 1] },
    { name: 'roof-sign-and-aerial', position: [30, 53, 53], lookAt: [1, 46, 0] },
    { name: 'east-tower-and-studio-wing', position: [-64, 43, -72], lookAt: [-1, 21, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-capitol-records-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/9q/9q5/capitol_records_building/models/tower-model.mjs',
    level: 'skyline',
    export: 'towerSkyline',
    errorMeters: 0.28,
    surfaces,
    authoredLevels: {
      district: { export: 'towerDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'towerStreet', errorMeters: 0.068, surfaces },
      closeup: { export: 'towerCloseup', errorMeters: 0.025, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Benoît Prieur’s street photograph is CC0. Jelson25’s aerial photograph is public domain. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
