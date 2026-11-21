import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const terrain = floorSampler(read('terrain-grid.json'));
const color = palette({
  stone: 'a39b7b',
  flint: '88836d',
  lightStone: 'b5ad90',
  oliveStone: '88866d',
  deepWall: 'a49d85',
  hardwood: '7b6246',
  freshWood: '9e8560',
  deck: '998165',
  steel: '64625a',
  roof: '7d7160',
  roofDark: '60584e',
  roofSlat: '8a7c69',
  chalk: 'b8b3a2',
  sienna: '9d6d57',
  slate: '726d5a',
  light: 'c6c0ae',
});
const local = (slot, value, roughness = 0.88) => ({
  slot,
  localRef: 'palette:' + value,
  roughness,
});
const surfaces = {
  ruin: surface('wall', 'stone_limestone_raw', 0.94),
  post: surface('trim', 'wood_plain', 0.92),
  deck: local('foundation', '#fffdfa', 0.9),
  roof: surface('roof', 'wood_painted_shingle', 0.91),
  rail: local('trim', '#fdfdff', 0.76),
  tessera: local('foundation', '#ffffff', 0.91),
};
const up = [0, 1, 0];
const tile = (out, [x0, z0, x1, z1], y, tint) =>
  face(
    out,
    'tessera',
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    up,
    tint,
  );

function rubble(out, a, b, w, height, level, id, topPlane) {
  const v = edge(a, b, 1);
  const count =
    level === 0
      ? 1
      : Math.max(1, Math.ceil(v.length / (level === 1 ? 11 : level === 2 ? 4.0 : 2.7)));
  for (let i = 0; i < count; i++) {
    const u = (i * v.length) / count,
      s = ((i + 1) * v.length) / count;
    const p0 = v.p(u, 0),
      p1 = v.p(s, 0);
    const floor0 = topPlane === undefined ? terrain([p0[0], p0[2]]) - 0.24 : topPlane - 0.54;
    const floor1 = topPlane === undefined ? terrain([p1[0], p1[2]]) - 0.24 : topPlane - 0.54;
    const variance = level === 0 ? 0 : (((id + i * 13) % 19) / 19 - 0.5) * 0.12;
    const y0 = topPlane ?? floor0 + 0.24 + height + variance;
    const y1 = topPlane ?? floor1 + 0.24 + height - variance;
    const half = w / 2;
    for (const sign of [-1, 1]) {
      const t = sign * half;
      face(
        out,
        'ruin',
        [v.p(u, floor0, t), v.p(s, floor1, t), v.p(s, y1, t), v.p(u, y0, t)],
        v.normal.map((c) => c * sign),
        color.stone,
      );
      if (level >= 2) {
        const length = s - u;
        const n = Math.max(1, Math.ceil(length / (level === 2 ? 0.79 : 0.49)));
        const bump = 0.038 * sign;
        for (let j = 0; j < n; j++) {
          const x = mix(u, s, j / n),
            z = mix(u, s, (j + 0.83) / n),
            yy = mix(y0, y1, j / n);
          const top = yy - 0.13 - (j % 3) * 0.027;
          const bottom = top - 0.12;
          face(
            out,
            'ruin',
            [
              v.p(x, bottom, t + bump),
              v.p(z, bottom + 0.014, t + bump),
              v.p(z, top, t + bump),
              v.p(x, top + 0.01, t + bump),
            ],
            v.normal.map((c) => c * sign),
            [color.flint, color.lightStone, color.oliveStone][(j + i + id) % 3],
          );
        }
      }
    }
    const tint = (i + id) % 5 < 2 ? color.oliveStone : color.lightStone;
    face(
      out,
      'ruin',
      [v.p(u, y0, -half), v.p(s, y1, -half), v.p(s, y1, half), v.p(u, y0, half)],
      up,
      tint,
    );
    if (i === 0)
      face(
        out,
        'ruin',
        [v.p(u, floor0, -half), v.p(u, floor0, half), v.p(u, y0, half), v.p(u, y0, -half)],
        [a[0] - b[0], 0, a[1] - b[1]],
        color.stone,
      );
    if (i === count - 1)
      face(
        out,
        'ruin',
        [v.p(s, floor1, half), v.p(s, floor1, -half), v.p(s, y1, -half), v.p(s, y1, half)],
        [b[0] - a[0], 0, b[1] - a[1]],
        color.stone,
      );
  }
}

function ruins(out, level) {
  for (const wall of d.walls) {
    const width = 0.48 + (wall.id % 5) * 0.078;
    const height = 0.34 + (wall.id % 11) * 0.052;
    for (const [a, b] of pairs(wall.points)) {
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.09) continue;
      rubble(out, a, b, width, height, level, wall.id);
    }
  }
}

function sweep(out, center, rx, rz, y, start, end, segments, tint, width = 0) {
  const [x, z] = center;
  const point = (r, i) => {
    const t = mix(start, end, i / segments);
    return [x + (rx - r) * Math.cos(t), y, z + (rz - r) * Math.sin(t)];
  };
  for (let i = 0; i < segments; i++) {
    const a = point(0, i),
      b = point(0, i + 1);
    const polygon = width ? [a, b, point(width, i + 1), point(width, i)] : [[x, y, z], a, b];
    face(out, 'tessera', polygon, up, tint);
  }
}

function tessellatedRoom(out, level) {
  const [cx, cz] = d.pavementCenter,
    [length, width] = d.reportedRoom;
  const x0 = cx - length / 2 + 1.78,
    x1 = cx + length / 2,
    z0 = cz - width / 2 + 0.33,
    z1 = cz + width / 2 - 0.33;
  const y = d.shelterDeck - 0.48;
  const p = level === 0 ? 6 : level === 1 ? 10 : 16;
  block(out, 'ruin', x0, y - 0.4, z0, x1 - x0, 0.394, z1 - z0, color.deepWall);
  tile(out, [x0, z0, x1, z1], y, color.chalk);
  const conch = [
    [x0, cz, Math.PI / 2, Math.PI * 1.5],
    [-36.1, z0, Math.PI, Math.PI * 2],
    [-36.1, z1, 0, Math.PI],
  ];
  for (const [x, z, from, to] of conch) {
    const rx = from === Math.PI / 2 ? 1.78 : 2.55,
      rz = from === Math.PI / 2 ? 2.91 : 0.6;
    sweep(out, [x, z], rx, rz, y + 0.004, from, to, p, color.chalk);
    if (level >= 1) {
      for (let i = 0; i < p; i++) {
        const [a, b] = [mix(from, to, i / p), mix(from, to, (i + 1) / p)];
        sweep(
          out,
          [x, z],
          rx - 0.12,
          rz - 0.12,
          y + 0.01,
          a,
          b,
          1,
          i % 2 ? color.sienna : color.slate,
        );
      }
    }
    const ring = Array.from({ length: p + 1 }, (_, i) => {
      const a = mix(from, to, i / p);
      return [x + Math.cos(a) * (rx + 0.14), z + Math.sin(a) * (rz + 0.14)];
    });
    if (level >= 1) for (const [a, b] of pairs(ring)) rubble(out, a, b, 0.47, 0.27, 0, 1, y + 0.33);
  }
  if (level === 0) return;
  for (const z of [z0, z1]) rubble(out, [-33.15, z], [x1, z], 0.37, 0.29, level, 11, y + 0.32);
  rubble(out, [x1, z0], [x1, z1], 0.37, 0.29, level, 17, y + 0.32);
  for (const z of [z0 + 0.2, z1 - 0.2]) {
    tile(out, [x0 + 0.21, z - 0.065, x1 - 0.21, z + 0.065], y + 0.015, color.slate);
    tile(out, [x0 + 0.28, z - 0.21, x1 - 0.28, z - 0.13], y + 0.015, color.sienna);
  }
  for (const x of [x0 + 0.18, x1 - 0.18])
    tile(out, [x - 0.07, z0 + 0.22, x + 0.07, z1 - 0.22], y + 0.015, color.sienna);
  const main = [-36.0, cz],
    r = 2.4;
  sweep(out, main, r, r, y + 0.018, 0, Math.PI * 2, p * 2, color.slate, 0.12);
  sweep(out, main, 0.82, 0.82, y + 0.02, 0, Math.PI * 2, p, color.sienna, 0.12);
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * i) / 2;
    sweep(
      out,
      main,
      2.22,
      2.22,
      y + 0.024,
      a + 0.075,
      a + 1.47,
      5,
      i % 2 ? color.light : color.chalk,
      1.27,
    );
    const ca = [main[0] + 1.62 * Math.cos(a + 0.77), main[1] + 1.62 * Math.sin(a + 0.77)];
    sweep(out, ca, 0.35, 0.35, y + 0.026, a, a + Math.PI * 1.4, 5, color.slate);
  }
  for (const x of [-31.49, -29.34])
    for (const z of [cz - 1.52, cz + 1.52]) {
      const radius = 0.67;
      sweep(out, [x, z], radius, radius, y + 0.018, 0, Math.PI * 2, p, color.sienna, 0.09);
      for (let i = 0; i < 8; i++)
        sweep(
          out,
          [x, z],
          radius - 0.17,
          radius - 0.17,
          y + 0.022,
          (i * Math.PI) / 4,
          ((i + 0.5) * Math.PI) / 4,
          1,
          i % 2 ? color.slate : color.sienna,
        );
    }
  if (level >= 2) {
    const n = level === 2 ? 30 : 58;
    for (let i = 0; i < n; i++) {
      const a = mix(x0 + 0.32, x1 - 0.44, i / n);
      for (const z of [z0 + 0.48, z1 - 0.46])
        tile(out, [a, z, a + 0.11, z + 0.108], y + 0.031, i % 2 ? color.sienna : color.slate);
    }
  }
}

function canopy(out, level) {
  const left = -43.48,
    right = -25.35,
    front = -27.2,
    back = -40.11,
    mid = -33.66;
  const eaves = 3.1,
    ridge = 5.46,
    floor = d.shelterDeck;
  for (const [z, dir] of [
    [front, 1],
    [back, -1],
  ]) {
    const a = [left, eaves, z],
      b = [right, eaves, z],
      c = [right, ridge, mid],
      d = [left, ridge, mid];
    face(out, 'roof', [a, b, c, d], up, color.roof);
    face(out, 'deck', [a, d, c, b], [0, -1, 0], color.hardwood);
    beam(
      out,
      'post',
      [left, eaves - 0.09, z],
      [right, eaves - 0.09, z],
      0.24,
      0.26,
      color.hardwood,
    );
    if (level >= 1) {
      for (const x of [left + 0.2, left + 4.2, left + 8.8, left + 13.15, right - 0.19])
        beam(
          out,
          'post',
          [x, eaves - 0.12, z],
          [x, ridge - 0.16, mid],
          0.15,
          0.19,
          color.freshWood,
        );
    }
    if (level >= 2) {
      const n = level === 2 ? 8 : 15;
      for (let i = 1; i < n; i++) {
        const t = i / n,
          yy = mix(eaves, ridge, t) + 0.028,
          zz = mix(z, mid, t);
        beam(
          out,
          'roof',
          [left + 0.02, yy, zz],
          [right - 0.02, yy, zz],
          0.027,
          0.033,
          i % 3 ? color.roofDark : color.roofSlat,
        );
      }
    }
  }
  for (const x of [left, right]) {
    beam(out, 'post', [x, eaves, front], [x, ridge, mid], 0.2, 0.21, color.hardwood);
    beam(out, 'post', [x, ridge, mid], [x, eaves, back], 0.2, 0.21, color.hardwood);
  }
  beam(out, 'roof', [left, ridge, mid], [right, ridge, mid], 0.23, 0.22, color.roofDark);
  for (const [x0, z0, x1, z1] of [
    [-43.18, -29.51, -25.67, -27.54],
    [-43.18, -39.51, -25.67, -38.3],
    [-43.18, -38.3, -40.83, -29.51],
    [-27.38, -38.3, -25.67, -29.51],
  ]) {
    block(out, 'deck', x0, floor - 0.2, z0, x1 - x0, 0.2, z1 - z0, color.deck);
  }
  const posts = level === 0 ? [-42.68, -34.48, -26.11] : [-42.68, -38.36, -34.48, -30.22, -26.1];
  for (const z of [-28.05, -39.04])
    for (const x of posts) {
      const base = Math.min(terrain([x, z]) - 0.19, floor - 0.45);
      block(out, 'ruin', x - 0.16, base, z - 0.16, 0.32, floor - 0.09 - base, 0.32, color.deepWall);
      block(
        out,
        'post',
        x - 0.12,
        floor - 0.12,
        z - 0.12,
        0.24,
        eaves - floor + 0.05,
        0.24,
        color.hardwood,
      );
      if (level >= 2) {
        const inward = x < -34.5 ? 1 : -1,
          near = z < -34.5 ? 1 : -1;
        beam(
          out,
          'post',
          [x, eaves - 0.68, z],
          [x + inward * 0.78, eaves - 0.11, z],
          0.095,
          0.108,
          color.freshWood,
        );
        beam(
          out,
          'post',
          [x, eaves - 0.68, z],
          [x, eaves - 0.11, z + near * 0.77],
          0.17,
          0.095,
          color.freshWood,
        );
      }
    }
  if (level >= 1) {
    railing(out, [-42.69, -29.54], [-25.91, -29.54], 7, level, [-37.9, -35.8]);
    railing(out, [-42.7, -38.23], [-25.92, -38.23], 7, level);
    railing(out, [-40.92, -38.23], [-40.92, -29.55], 4, level);
    railing(out, [-27.42, -38.23], [-27.42, -29.55], 4, level);
  }
}

function railing(out, a, b, count, level, gap) {
  const w = edge(a, b);
  const y = d.shelterDeck;
  for (let i = 0; i < count; i++) {
    const u = (w.length * i) / count,
      v = (w.length * (i + 1)) / count;
    const px = w.p((u + v) / 2, y)[0];
    if (gap && px > gap[0] && px < gap[1]) continue;
    beam(out, 'post', w.p(u, y + 1.02), w.p(v, y + 1.02), 0.11, 0.09, color.hardwood);
    beam(out, 'post', w.p(u, y), w.p(u, y + 1.07), 0.095, 0.1, color.hardwood);
    if (level >= 2) {
      beam(
        out,
        'rail',
        w.p(u + 0.09, y + 0.13),
        w.p(v - 0.09, y + 0.95),
        0.037,
        0.042,
        color.steel,
      );
      beam(
        out,
        'rail',
        w.p(u + 0.09, y + 0.95),
        w.p(v - 0.09, y + 0.13),
        0.037,
        0.042,
        color.steel,
      );
    }
  }
}

function build(out, level) {
  ruins(out, level);
  canopy(out, level);
  tessellatedRoom(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'littlecote-roman-villa-model.mjs';
const camera = [111, 80, 154],
  lookAt = [-12, 1, -2];
export const littlecoteRomanVillaAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original Environment Agency 1 metre bare earth sampled throughout the named villa enclosure.',
  brief:
    'Littlecote’s named archaeological enclosure, surviving rubble wall lines and open timber conservation canopy with the Orpheus pavement.',
  camera,
  lookAt,
  sunDirection: [-36, 76, 101],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.shelter,
    minimumCoverage: 0.92,
    basis: 'Mapped footprint of the standing roof and its visitor deck.',
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'wood_plain', 'wood_painted_shingle'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'raised-timber-shelter-and-mosaic',
      position: [-27.5, 2.8, -22.0],
      lookAt: [-34.4, 1.5, -33.5],
    },
    {
      name: 'orpheus-mosaic-from-open-south-rail',
      position: [-34.3, 1.63, -29.0],
      lookAt: [-35.6, 0.12, -35.2],
    },
    { name: 'outer-villa-remains', position: [29, 44, 53], lookAt: [-11, 0.5, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'littlecote-roman-villa-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.04,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.5, street: 0.18, closeup: 0.05 }).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. Environment Agency terrain under OGL 3.0.',
};
