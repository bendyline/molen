import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const mainOutline = frame.geometry.outline;
const annexes = frame.features.slice(1).map((f) => f.points);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.93 },
  walk: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  bronze: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
  earth: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
};

const facadeGold = rgb('c4a576');
const lowerGold = rgb('bfa172');
const strongGold = rgb('d2b485');
const ochre = rgb('a98564');
const bracketColor = rgb('9a7c58');
const brown = rgb('77614b');
const cream = rgb('cbb08b');
const annexWall = rgb('cfb993');
const gray = rgb('a59e8c');
const lightGray = rgb('b9ab92');
const slate = rgb('787362');
const glass = rgb('748d91');
const darkGlass = rgb('5d7477');
const dirt = rgb('877c59');
const raisedFloor = 3.47;

const tiers = [
  { y0: raisedFloor, y1: 10.37, a: 0.625, b: 0.696, color: lowerGold },
  { y0: 10.37, y1: 14.04, a: 0.734, b: 0.782, color: facadeGold },
  { y0: 14.04, y1: 20.2, a: 0.798, b: 0.889, color: facadeGold },
  { y0: 20.2, y1: 28.59, a: 0.905, b: 1, color: strongGold },
];
const bounds = (r) => [
  Math.min(...r.map((p) => p[0])),
  Math.max(...r.map((p) => p[0])),
  Math.min(...r.map((p) => p[1])),
  Math.max(...r.map((p) => p[1])),
];
const boxRing = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const ringAt = (scale) => outwardRing(mainOutline.map(([x, z]) => [x * scale, z * scale]));
const highZ = Math.max(...mainOutline.map((p) => p[1]));
const ringFaces = (ring) => {
  const points = outwardRing(ring);
  return points.map((a, i) => wallFace(a, points[(i + 1) % points.length]));
};
function block(out, slot, ring, y0, y1, tint, top = false) {
  extrude(out, slot, ring, y0, y1, tint, { top: false });
  if (top) cap(out, slot, ring, y1, tint);
}
function box(out, slot, x0, x1, z0, z1, y0, y1, tint) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}
function panel(out, slot, f, l, r, b, t, d, tint) {
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), tint);
}
function frontPoint(x, y, tier, depth = 0) {
  const scale = tier.a + ((tier.b - tier.a) * (y - tier.y0)) / (tier.y1 - tier.y0);
  return [x, y, highZ * scale + depth];
}
function glazedEntry(out, lod) {
  const w = 10.68;
  for (const tier of tiers.slice(0, 2)) {
    const b = tier.y0 + 0.08,
      t = Math.min(13.44, tier.y1 - 0.025);
    const pt = (x, y, d) => frontPoint(x, y, tier, d);
    quad4(
      out,
      'glass',
      pt(-w / 2, b, 0.074),
      pt(w / 2, b, 0.074),
      pt(w / 2, t, 0.074),
      pt(-w / 2, t, 0.074),
      glass,
    );
    if (!lod) continue;
    const count = lod >= 2 ? 12 : 6;
    for (let j = 0; j <= count; j++) {
      const x = (j / count - 0.5) * w;
      beam(out, 'bronze', pt(x, b, 0.12), pt(x, t, 0.12), 0.054, 0.064, brown);
    }
    for (let j = 0; j < Math.ceil((t - b) / 1.03); j++) {
      const y = b + j * 1.03;
      beam(out, 'bronze', pt(-w / 2, y, 0.12), pt(w / 2, y, 0.12), 0.056, 0.061, brown);
    }
  }
  const tier = tiers[2];
  const pt = (x, y, d) => frontPoint(x, y, tier, d);
  const lower = 15.83,
    upper = 19.61,
    edge = 2.23;
  quad4(
    out,
    'bronze',
    pt(-edge, lower, 0.1),
    pt(edge, lower, 0.1),
    pt(edge, upper, 0.1),
    pt(-edge, upper, 0.1),
    brown,
  );
  if (!lod) return;
  quad4(
    out,
    'glass',
    pt(-edge + 0.42, lower + 0.34, 0.15),
    pt(edge - 0.42, lower + 0.34, 0.15),
    pt(edge - 0.42, upper - 0.34, 0.15),
    pt(-edge + 0.42, upper - 0.34, 0.15),
    darkGlass,
  );
  const center = (lower + upper) / 2;
  for (const x of [-0.93, 0.93])
    beam(out, 'bronze', pt(x, lower, 0.19), pt(x, upper, 0.19), 0.16, 0.14, ochre);
  for (const y of [lower + 0.87, upper - 0.72])
    beam(out, 'bronze', pt(-edge, y, 0.19), pt(edge, y, 0.19), 0.13, 0.14, ochre);
  if (lod < 2) return;
  const n = lod === 3 ? 24 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    beam(
      out,
      'bronze',
      pt(Math.cos(a) * 0.71, center + Math.sin(a) * 0.71, 0.24),
      pt(Math.cos(b) * 0.71, center + Math.sin(b) * 0.71, 0.24),
      0.084,
      0.09,
      strongGold,
    );
  }
}
function bowl(out, lod) {
  const baseRing = ringAt(tiers[0].a);
  block(out, 'walk', ringAt(0.7), -4.04, raisedFloor, gray, true);
  block(out, 'stone', baseRing, raisedFloor - 0.04, raisedFloor + 0.45, ochre);
  for (let row = 0; row < tiers.length; row++) {
    const tier = tiers[row];
    const lo = ringAt(tier.a),
      hi = ringAt(tier.b);
    const px = (i, u, v, scale = 1) => {
      const j = (i + 1) % lo.length;
      const a = lo[i],
        b = lo[j],
        c = hi[i],
        d = hi[j];
      const x = (1 - v) * (a[0] + (b[0] - a[0]) * u) + v * (c[0] + (d[0] - c[0]) * u);
      const z = (1 - v) * (a[1] + (b[1] - a[1]) * u) + v * (c[1] + (d[1] - c[1]) * u);
      return [x * scale, tier.y0 + (tier.y1 - tier.y0) * v, z * scale];
    };
    for (let i = 0; i < lo.length; i++) {
      const detail = lod >= 2;
      const columns = detail ? (lod === 3 ? 38 : 23) : 1;
      const rows = detail ? Math.ceil((tier.y1 - tier.y0) / 1.1) : 1;
      if (detail) {
        const back = (u, v) => px(i, u, v, 0.9989);
        quad4(out, 'stone', back(0, 0), back(1, 0), back(1, 1), back(0, 1), ochre);
      }
      for (let j = 0; j < rows; j++)
        for (let k = 0; k < columns; k++) {
          const eps = detail ? 0.00024 : 0;
          const l = k / columns + eps,
            r = (k + 1) / columns - eps,
            b = j / rows + eps,
            t = (j + 1) / rows - eps;
          const tint = detail && (k + j * 3 + i * 7 + row) % 17 === 4 ? cream : tier.color;
          quad4(out, 'stone', px(i, l, b), px(i, r, b), px(i, r, t), px(i, l, t), tint);
        }
      if (row === tiers.length - 1) continue;
      const next = ringAt(tiers[row + 1].a);
      const j = (i + 1) % lo.length;
      quad4(
        out,
        'roof',
        [hi[i][0], tier.y1, hi[i][1]],
        [hi[j][0], tier.y1, hi[j][1]],
        [next[j][0], tier.y1, next[j][1]],
        [next[i][0], tier.y1, next[i][1]],
        bracketColor,
      );
      const f = wallFace(hi[i], hi[j]);
      if (!lod) continue;
      const count = lod === 1 ? 9 : lod === 2 ? 13 : 17;
      for (let k = 0; k < count; k++) {
        const along = ((k + 0.5) * f.length) / count;
        const [x, y, z] = f.P(along, tier.y1 + 0.018, 0.06);
        const edge = f.P(along, tier.y1 + 0.11, row === 0 ? 0.98 : 0.65);
        tri(out, 'stone', f.P(along, tier.y1 - 1.19, -0.28), [x, y, z], edge, bracketColor);
        if (lod >= 2)
          beam(out, 'bronze', f.P(along, tier.y1 - 0.93, -0.19), edge, 0.16, 0.12, bracketColor);
      }
    }
  }
  const top = ringAt(1);
  cap(out, 'roof', top, 28.59, gray);
  for (const f of ringFaces(top))
    fbox(out, 'stone', f, 0, f.length, 28.48, 28.72, -0.25, 0.15, ochre);
  const skylight = tower(out, 'glass', [0, 0], 10.15, 8, 28.53, 29.25, darkGlass, {
    rotation: Math.PI / 8,
    top: false,
  });
  cap(out, 'glass', skylight, 29.25, glass);
  if (lod >= 2)
    for (const f of ringFaces(skylight)) {
      fbox(out, 'bronze', f, 0, f.length, 29.17, 29.28, -0.11, 0.088, slate);
    }
  const bottom = tiers[0];
  const zed = (x, y) => frontPoint(x, y, bottom, 0.081);
  for (const [l, r] of [
    [-25.2, -5.6],
    [5.6, 25.2],
  ]) {
    quad4(out, 'glass', zed(l, 4.48), zed(r, 4.48), zed(r, 6.45), zed(l, 6.45), darkGlass);
    if (lod > 1) {
      for (let i = 1; i < 7; i++) {
        const x = l + ((r - l) * i) / 7;
        beam(out, 'stone', zed(x, 4.42), zed(x, 6.53), 0.13, 0.14, ochre);
      }
    }
  }
  glazedEntry(out, lod);
}

function annex(out, shape, index, lod) {
  const grade = [2.75, -1.05, 0.49, 0.79][index];
  const eave = grade + 11.15;
  block(out, 'walk', shape, grade - 3.6, grade + 1.41, gray);
  block(out, 'plaster', shape, grade + 1.38, eave, annexWall);
  const [x0, x1, z0, z1] = bounds(shape);
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  const outline = outwardRing(shape);
  const roof = outline.map(([x, z]) => [
    mid[0] + (x - mid[0]) * 1.048,
    mid[1] + (z - mid[1]) * 1.048,
  ]);
  for (let i = 0; i < roof.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % roof.length],
      c = roof[(i + 1) % roof.length],
      d = roof[i];
    quad4(
      out,
      'stone',
      [a[0], eave - 0.22, a[1]],
      [b[0], eave - 0.22, b[1]],
      [c[0], eave + 0.98, c[1]],
      [d[0], eave + 0.98, d[1]],
      ochre,
    );
  }
  cap(out, 'roof', roof, eave + 0.98, slate);
  for (const f of ringFaces(outline)) {
    if (f.length < 3.0) continue;
    const count = lod ? Math.max(1, Math.floor(f.length / 4.5)) : 1;
    const strip = f.length / count;
    for (let i = 0; i < count; i++) {
      const u = i * strip;
      const l = u + strip * 0.17,
        r = u + strip * 0.83;
      panel(out, 'glass', f, l, r, grade + 2.93, grade + 5.42, 0.046, darkGlass);
      if (lod > 1) {
        panel(out, 'bronze', f, l - 0.12, r + 0.12, grade + 5.34, grade + 5.51, 0.074, brown);
        panel(
          out,
          'bronze',
          f,
          (l + r) / 2 - 0.028,
          (l + r) / 2 + 0.028,
          grade + 2.93,
          grade + 5.42,
          0.063,
          brown,
        );
        panel(out, 'glass', f, l, r, grade + 7.16, grade + 8.23, 0.044, glass);
      }
    }
    if (lod > 0)
      fbox(out, 'stone', f, 0, f.length, eave - 0.57, eave - 0.2, -0.075, 0.2, bracketColor);
  }
}
function entrySteps(out, lod) {
  block(out, 'walk', boxRing(-31.2, 31.2, 23.1, 46.4), -2.1, 3.46, gray, true);
  const N = lod >= 2 ? 11 : 5;
  for (let i = 0; i < N; i++) {
    const f = i / N;
    box(
      out,
      'walk',
      -31.2,
      31.2,
      45.84,
      53.65 - f * 7.26,
      -0.35,
      0.11 + (3.36 * i) / (N - 1),
      i % 2 === 0 ? gray : lightGray,
    );
  }
  for (const sign of [-1, 1]) {
    const x = 22.41 * sign;
    box(out, 'walk', x - 1.35, x + 1.35, 43.1, 53.83, -0.7, 3.61, gray);
    if (lod) box(out, 'stone', x - 1.51, x + 1.51, 43.01, 53.94, 3.59, 3.76, cream);
  }
  for (const x of [-56.94, 56.94]) {
    box(out, 'walk', x - 9.1, x + 9.1, 52.6, 69.75, -3.29, 0.44, gray);
  }
}
function courtyard(out, lod) {
  block(out, 'walk', boxRing(-43.2, 43.2, 53.65, 103.06), -3.38, 0.18, lightGray, true);
  const med = boxRing(-23.11, 23.11, 74.1, 96.76);
  block(out, 'walk', med, 0.18, 0.59, gray, true);
  block(out, 'earth', boxRing(-22.55, 22.55, 74.63, 96.17), 0.58, 0.81, dirt, true);
  const face = facade([-14.18, 83.79], [1, 0]);
  fbox(out, 'stone', face, 0, 28.36, 0.73, 3.25, -2.36, 0, ochre);
  fbox(out, 'bronze', face, 1.21, 27.15, 1.06, 2.83, -0.06, 0.04, brown);
  if (lod >= 2) {
    const glyphs = [
      [
        [0.1, 0.24, 0.87, 0.24],
        [0.1, 0.24, 0.1, 0.73],
        [0.49, 0.24, 0.49, 0.89],
        [0.87, 0.24, 0.87, 0.75],
      ],
      [
        [0.1, 0.85, 0.9, 0.85],
        [0.15, 0.2, 0.84, 0.2],
        [0.15, 0.2, 0.15, 0.73],
        [0.84, 0.2, 0.84, 0.73],
        [0.16, 0.73, 0.84, 0.73],
        [0.41, 0.81, 0.41, 0.48],
        [0.61, 0.8, 0.61, 0.43],
        [0.63, 0.43, 0.77, 0.43],
      ],
      [
        [0.17, 0.18, 0.17, 0.9],
        [0.035, 0.64, 0.34, 0.64],
        [0.39, 0.79, 0.91, 0.79],
        [0.64, 0.7, 0.64, 0.91],
        [0.79, 0.9, 0.86, 0.84],
        [0.41, 0.42, 0.41, 0.69],
        [0.41, 0.69, 0.88, 0.69],
        [0.88, 0.69, 0.88, 0.42],
        [0.42, 0.56, 0.88, 0.56],
        [0.42, 0.43, 0.88, 0.43],
        [0.64, 0.42, 0.64, 0.69],
        [0.35, 0.29, 0.93, 0.29],
        [0.79, 0.39, 0.79, 0.11],
        [0.7, 0.11, 0.79, 0.11],
        [0.49, 0.25, 0.58, 0.19],
      ],
      [
        [0.22, 0.17, 0.22, 0.91],
        [0.085, 0.77, 0.035, 0.55],
        [0.1, 0.67, 0.37, 0.67],
        [0.04, 0.44, 0.37, 0.51],
        [0.56, 0.88, 0.42, 0.64],
        [0.49, 0.73, 0.92, 0.73],
        [0.92, 0.73, 0.87, 0.2],
        [0.87, 0.2, 0.75, 0.17],
        [0.66, 0.7, 0.48, 0.42],
        [0.79, 0.7, 0.59, 0.25],
      ],
      [
        [0.1, 0.21, 0.1, 0.82],
        [0.1, 0.82, 0.35, 0.82],
        [0.35, 0.82, 0.25, 0.61],
        [0.25, 0.61, 0.34, 0.53],
        [0.33, 0.53, 0.25, 0.39],
        [0.44, 0.7, 0.93, 0.7],
        [0.55, 0.59, 0.84, 0.59],
        [0.44, 0.43, 0.93, 0.43],
        [0.67, 0.82, 0.67, 0.73],
        [0.59, 0.43, 0.5, 0.25],
        [0.77, 0.43, 0.77, 0.23],
        [0.77, 0.23, 0.93, 0.23],
      ],
    ];
    for (const [i, g] of glyphs.entries())
      for (const [x0, y0, x1, y1] of g) {
        const pos = (x, y) => face.P(5.38 + i * 3.79 + x * 1.88, 1.04 + y * 1.88, 0.075);
        beam(out, 'bronze', pos(x0, y0), pos(x1, y1), 0.055, 0.052, strongGold);
      }
  }
  for (const sign of [-1, 1])
    for (const z of [70.25, 78.06, 85.88]) {
      const x = sign * 31.83;
      box(out, 'walk', x - 1.32, x + 1.32, z - 1.32, z + 1.32, 0.19, 0.42, slate);
      const sides = lod === 0 ? 6 : lod === 1 ? 8 : lod === 2 ? 12 : 18;
      const r = 1.0 + (z - 70.25) * 0.0048;
      const c = [x, z];
      const top = 5.08 + (z - 70.25) * 0.04;
      const profile = [
        [0.4, r, r],
        [0.65, r, r],
        [0.78, r * 0.88, r * 0.88],
        [top - 0.61, r * 0.86, r * 0.86],
        [top - 0.39, r * 0.99, r * 0.99],
        [top, r * 0.99, r * 0.99],
      ];
      lathe(out, 'stone', c, lod ? profile : [profile[0], profile.at(-1)], sides, cream);
      if (lod > 1) {
        lathe(
          out,
          'stone',
          c,
          [
            [1.06, r * 0.895, r * 0.895],
            [1.22, r * 0.92, r * 0.92],
            [1.62, r * 0.92, r * 0.92],
            [1.7, r * 0.89, r * 0.89],
          ],
          sides,
          bracketColor,
          { capTop: false },
        );
        lathe(
          out,
          'stone',
          c,
          [
            [top - 1.15, r * 0.875, r * 0.875],
            [top - 0.99, r * 0.91, r * 0.91],
            [top - 0.77, r * 0.91, r * 0.91],
          ],
          sides,
          bracketColor,
          { capTop: false },
        );
      }
    }
}
function build(out, lod) {
  bowl(out, lod);
  annexes.forEach((shape, index) => annex(out, shape, index, lod));
  entrySteps(out, lod);
  courtyard(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'shanxi-museum-model.mjs';
const camera = [139, 63, 149];
const lookAt = [0, 13, 12];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum-library',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Taiyuan’s Shanxi Museum, with its four-story bronze-vessel silhouette, a recessed glass east entry, four corner pavilions and stone courtyard columns.',
  camera,
  lookAt,
  sunDirection: [-28, 63, 83],
  mediumFiContext: {
    scale: 1.62,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: mainOutline,
    outlines: [mainOutline, ...annexes],
    minimumCoverage: 0.9,
    basis: 'Mapped central exhibition block and its four separate annex buildings.',
  },
  embeddedCanonicalGraphs: ['stone_sandstone', 'plaster_lime', 'stone_ashlar', 'stone_granite'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'flared-main-block-and-four-annexes', position: camera, lookAt },
    { name: 'east-forecourt-and-bronze-plinth', position: [13, 11, 124], lookAt: [0, 12, 36] },
    { name: 'western-pavilions-and-central-roof', position: [-129, 61, -135], lookAt: [0, 12, -9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'shanxi-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.83,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.064, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on CC0 Qualla and photographer originals, native OpenStreetMap geometry under ODbL and open Mapzen terrain.',
};
