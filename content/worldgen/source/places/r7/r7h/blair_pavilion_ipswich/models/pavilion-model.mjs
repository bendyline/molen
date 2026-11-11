/** Blair Pavilion at the former Ipswich Mental Hospital site. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
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
const { mapOutline, wallOutline, foundationBottom, porchLevel, brickTop, eave, ridge } = plan;
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.91, metallic: 0.07 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.1 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89, metallic: 0 },
};
const colors = {
  brick: rgb('a47762'),
  plaster: rgb('e6ddc5'),
  metal: rgb('98574e'),
  trim: rgb('c6bfac'),
  iron: rgb('d0cbc0'),
  dark: rgb('64645b'),
};
const brown = rgb('6d594c'),
  red = rgb('8c534b'),
  warm = rgb('e1d3b9'),
  window = rgb('74776b');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
function face(out, k, p, expected, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
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
function panel(out, k, s, u0, y0, u1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(u0, y0, d), s.p(u1, y0, d), s.p(u1, y1, d), s.p(u0, y1, d)], s.n, color);
}
function hip(out, x0, x1, z0, z1, y, top, edgeLength) {
  const z = (z0 + z1) / 2,
    a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  const u = [x0 + edgeLength, top, z],
    v = [x1 - edgeLength, top, z];
  for (const p of [
    [a, b, v, u],
    [d, c, v, u],
    [a, d, u],
    [b, c, v],
  ])
    face(out, 'metal', p, [0, 1, 0]);
}
function ventilator(out, x, z, y, lod) {
  const sides = lod > 1 ? 8 : 6;
  const rings = (levels) =>
    levels.map(([h, r]) => radialRing(y + h, r, r, sides, [x, z], Math.PI / 8));
  loft(
    out,
    'metal',
    rings([
      [0, 0.62],
      [0.56, 0.39],
    ]),
    red,
  );
  loft(
    out,
    'trim',
    rings([
      [0.55, 0.44],
      [1.12, 0.44],
    ]),
    warm,
  );
  if (lod > 1) {
    const a = rings([[0, 0.435]])[0];
    for (let j = 0; j < a.length; j++) {
      const b = a[(j + 1) % a.length],
        u = a[j],
        x0 = u[0] * 0.19 + b[0] * 0.81,
        z0 = u[2] * 0.19 + b[2] * 0.81;
      const x1 = u[0] * 0.81 + b[0] * 0.19,
        z1 = u[2] * 0.81 + b[2] * 0.19;
      face(
        out,
        'dark',
        [
          [x0, y + 0.68, z0],
          [x1, y + 0.68, z1],
          [x1, y + 1.01, z1],
          [x0, y + 1.01, z0],
        ],
        [x0 - x, 0, z0 - z],
        brown,
      );
    }
  }
  loft(
    out,
    'metal',
    rings([
      [1.09, 0.56],
      [1.36, 0.39],
      [1.89, 0.06],
    ]),
    red,
  );
}
function pavilion(out, lod) {
  shell(out, 'brick', wallOutline, foundationBottom, brickTop);
  shell(out, 'plaster', wallOutline, brickTop, eave);
  const roofs = [
    [-28.23, -8.4, -5.77, 4.28, eave, ridge, 3.92],
    [-12.9, 8.15, -7.25, 5.0, eave - 0.045, ridge - 0.23, 3.88],
    [4.85, 28.84, -8.86, 4.23, eave, ridge + 0.19, 4.21],
  ];
  for (const r of roofs) hip(out, ...r);
  for (const [x, z, y] of [
    [-22, -0.74, ridge],
    [-13.0, -0.74, ridge],
    [-2.46, -1.1, ridge - 0.23],
    [10.31, -2.3, ridge + 0.19],
    [22.33, -2.3, ridge + 0.19],
  ])
    ventilator(out, x, z, y, lod);
  if (!lod) return;
  const sign = winding(wallOutline);
  for (let i = 0; i < wallOutline.length; i++) {
    const s = edge(wallOutline[i], wallOutline[(i + 1) % wallOutline.length], sign);
    if (s.len < 4.2) continue;
    panel(out, 'trim', s, 0, brickTop - 0.18, s.len, brickTop + 0.035, 0.04, warm);
    const n = Math.max(1, Math.round(s.len / 2.9));
    for (let j = 0; j < n; j++) {
      const u = (s.len * (j + 0.5)) / n;
      panel(out, 'trim', s, u - 0.61, 5.13, u + 0.61, 7.56, 0.042, warm);
      panel(out, 'dark', s, u - 0.47, 5.31, u + 0.47, 7.41, 0.066, window);
      if (lod > 1) {
        const bars = lod === 3 ? 6 : 3;
        for (let b = 0; b < bars; b++) {
          const p = u - 0.4 + (0.8 * b) / (bars - 1);
          panel(out, 'iron', s, p - 0.016, 5.31, p + 0.016, 7.41, 0.08);
        }
        panel(out, 'trim', s, u - 0.62, 5.08, u + 0.62, 5.2, 0.086, warm);
      }
      if (lod > 1 && j % 2 === 0)
        panel(out, 'dark', s, u - 0.43, 0.99, u + 0.43, 2.77, 0.066, brown);
    }
  }
}
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
function grade(x, z) {
  const i = Math.round((x - terrain.origin[0]) / terrain.stepMeters);
  const j = Math.round((z - terrain.origin[1]) / terrain.stepMeters);
  return Math.min(
    porchLevel - 0.12,
    terrain.heightsMeters[j][i] - terrain.modelDatumElevationMeters - 0.17,
  );
}
function veranda(out, lod) {
  const sign = winding(mapOutline);
  for (let i = 0; i < 7; i++) {
    const a = mapOutline[i],
      b = mapOutline[i + 1],
      s = edge(a, b, sign);
    if (s.len < 2.0) continue;
    const inset = ([x, z], y) => [x, y, z - 2.24];
    const outer = ([x, z], y) => [x, y, z + 0.18];
    face(out, 'metal', [inset(a, 3.85), inset(b, 3.85), outer(b, 2.74), outer(a, 2.74)], [0, 1, 0]);
    face(
      out,
      'trim',
      [inset(a, porchLevel), inset(b, porchLevel), outer(b, porchLevel), outer(a, porchLevel)],
      [0, 1, 0],
    );
    face(
      out,
      'trim',
      [
        outer(a, grade(a[0], a[1] + 0.18)),
        outer(b, grade(b[0], b[1] + 0.18)),
        outer(b, porchLevel),
        outer(a, porchLevel),
      ],
      s.n,
    );
    panel(out, 'iron', s, 0, 2.69, s.len, 2.79, 0.16, warm);
    const n = Math.max(2, Math.round(s.len / (lod ? 2.95 : 5.0)));
    for (let j = 0; j < n; j++) {
      const [x, , z] = s.p((s.len * (j + 0.14)) / n, 0, 0.14);
      block(out, 'iron', x - 0.057, porchLevel, z - 0.057, x + 0.057, 2.72, z + 0.057);
      if (lod > 1)
        block(
          out,
          'trim',
          x - 0.1,
          porchLevel - 0.23,
          z - 0.1,
          x + 0.1,
          porchLevel + 0.11,
          z + 0.1,
        );
    }
  }
}
function stair(out, lod) {
  const end = -28.02,
    start = -33.78,
    z0 = -3.77,
    z1 = -2.51;
  const lower = grade(start, (z0 + z1) / 2) + 0.19,
    high = brickTop - 0.11;
  const n = lod > 1 ? 23 : 11;
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n;
    const y = lower + ((i + 1) * (high - lower)) / n;
    block(out, 'iron', a, y - 0.077, z0, b + 0.05, y, z1);
  }
  for (const z of [z0, z1]) {
    beam(out, 'iron', [start, lower + 0.84, z], [end, high + 0.84, z], 0.053, 0.054, colors.iron);
    beam(out, 'iron', [start, lower - 0.07, z], [end, high - 0.07, z], 0.07, 0.13, colors.iron);
    if (lod > 1)
      for (const t of [0.09, 0.4, 0.7, 0.98]) {
        const x = start + (end - start) * t,
          y = lower + (high - lower) * t;
        block(out, 'iron', x - 0.023, y, z - 0.025, x + 0.023, y + 0.84, z + 0.025);
      }
  }
}
export function buildPavilion(out, _frame, lod = 3) {
  pavilion(out, lod);
  veranda(out, lod);
  if (lod) stair(out, lod);
}
export const pavilionSkyline = (out, frame) => buildPavilion(out, frame, 0);
export const pavilionDistrict = (out, frame) => buildPavilion(out, frame, 1);
export const pavilionStreet = (out, frame) => buildPavilion(out, frame, 2);
export const pavilionCloseup = (out, frame) => buildPavilion(out, frame, 3);
const camera = [-65, 24, 56],
  lookAt = [0, 6, 0];
export const pavilionModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe: 'pavilion-model.mjs',
  surfaces,
  build: buildPavilion,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Federation-era Blair Pavilion with its long veranda, brick base, cream walls and red roofs with five ventilators.',
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
  embeddedCanonicalGraphs: [
    'brick',
    'plaster_lime',
    'metal_corrugated',
    'concrete_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'east-stair-veranda-and-ventilators', position: [-39, 12, 37], lookAt: [-6, 5, 0] },
    { name: 'roof-joins-and-rear-range', position: [55, 24, -41], lookAt: [0, 5, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-blair-pavilion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/r7/r7h/blair_pavilion_ipswich/models/pavilion-model.mjs',
    level: 'skyline',
    export: 'pavilionSkyline',
    errorMeters: 0.24,
    surfaces,
    authoredLevels: {
      district: { export: 'pavilionDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'pavilionStreet', errorMeters: 0.063, surfaces },
      closeup: { export: 'pavilionCloseup', errorMeters: 0.024, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The two exterior photographs by Shiftchange are CC0. The cited UniSQ map and OSM controls supply approximate geographic alignment.',
};
