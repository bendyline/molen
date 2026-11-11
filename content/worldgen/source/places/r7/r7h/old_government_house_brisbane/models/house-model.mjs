/** Old Government House at Gardens Point in its early published color appearance. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.15 },
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.06 },
};
const colors = {
  wall: rgb('cbb49f'),
  trim: rgb('e0d2bf'),
  roof: rgb('9b9e96'),
  iron: rgb('71564e'),
  base: rgb('9a8c79'),
  glass: rgb('475251'),
};
const { nativeRing: ring, foundationBottom, mainFloor, upperFloor, eave, backBreak } = plan;
const tintBack = rgb('b1a293');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const vec = ([x, z], y) => [x, y, z];
const block = (o, k, x0, y0, z0, x1, y1, z1, c = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], c);
function face(o, k, points, expected, tint = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, tint);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], tint);
}
function area(points) {
  return points.reduce((sum, [x, z], i) => {
    const [a, b] = points[(i + 1) % points.length];
    return sum + x * b - z * a;
  }, 0);
}
const outwardWinding = Math.sign(area(ring));
function cap(o, k, points, y, ny, tint) {
  const loop = area(points) > 0 ? points : [...points].reverse();
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      loop,
      [],
      () => y,
      [0, ny, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Cannot triangulate Old Government House outline');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const vertices = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, vertices, [0, ny, 0], tint);
  }
}
function side(a, b, sign = -1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(sign * (b[1] - a[1])) / length, 0, (sign * (a[0] - b[0])) / length];
  const p = (u, y, d = 0) => {
    const [x, z] = mix(a, b, u / length);
    return [x + normal[0] * d, y, z + normal[2] * d];
  };
  return { length, normal, p };
}
function panel(o, k, s, left, low, right, high, depth = 0, color = colors[k]) {
  const { normal, p } = s;
  face(
    o,
    k,
    [p(left, low, depth), p(right, low, depth), p(right, high, depth), p(left, high, depth)],
    normal,
    color,
  );
}
function prism(o, k, points, low, high, tint = colors[k], bottom = false) {
  const sign = Math.sign(area(points));
  for (let i = 0; i < points.length; i++) {
    const s = side(points[i], points[(i + 1) % points.length], sign);
    panel(o, k, s, 0, low, s.length, high, 0, tint);
  }
  cap(o, k, points, high, 1, tint);
  if (bottom) cap(o, k, points, low, -1, tint);
}
function clip(points, limit, keepLow) {
  const inside = ([, z]) => (keepLow ? z <= limit : z >= limit);
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length],
      next = inside(a) ? [a] : [];
    if (inside(a) !== inside(b)) next.push(mix(a, b, (limit - a[1]) / (b[1] - a[1])));
    return next;
  });
}
function hip(o, x0, z0, x1, z1, y, rise) {
  const a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  const x = (x0 + x1) / 2;
  const r0 = [x, y + rise, z0 + (z1 - z0) * 0.2],
    r1 = [x, y + rise, z1 - (z1 - z0) * 0.2];
  for (const points of [
    [a, b, r0],
    [b, c, r1, r0],
    [c, d, r1],
    [d, a, r0, r1],
  ])
    face(o, 'roof', points, [0, 1, 0]);
}
function pillar(o, x, z, y0, y1, r, lod, substantial = false) {
  const facets = lod > 1 ? 8 : 4;
  const steps = substantial
    ? [
        [y0, r * 1.24],
        [y0 + 0.25, r * 1.24],
        [y0 + 0.37, r],
        [y1 - 0.21, r],
        [y1, r * 1.2],
      ]
    : [
        [y0, r],
        [y1, r],
      ];
  loft(
    o,
    'trim',
    steps.map(([y, w]) => radialRing(y, w, w, facets, [x, z], Math.PI / 4)),
    colors.trim,
    { cap: false },
  );
}
function sash(o, s, u, bottom, w, h, lod, door = false) {
  panel(o, 'trim', s, u - w / 2 - 0.085, bottom - 0.11, u + w / 2 + 0.085, bottom + h + 0.12, 0.06);
  panel(o, door ? 'iron' : 'glass', s, u - w / 2, bottom, u + w / 2, bottom + h, 0.071);
  if (!lod) return;
  if (lod > 1)
    panel(o, 'trim', s, u - w / 2 - 0.16, bottom - 0.13, u + w / 2 + 0.16, bottom - 0.045, 0.095);
  if (!door && lod > 1) {
    panel(o, 'trim', s, u - 0.027, bottom, u + 0.027, bottom + h, 0.084);
    panel(o, 'trim', s, u - w / 2, bottom + h * 0.5, u + w / 2, bottom + h * 0.5 + 0.044, 0.085);
  }
}
function arcadeBay(o, a, b, clear, lod, first) {
  const s = side(a, b, outwardWinding);
  const { p, normal, length } = s;
  const shoulder = 3.03,
    span = length * 0.91,
    center = length / 2,
    rise = clear ? 0.45 : Math.min(1.36, span * 0.45);
  const steps = [3, 6, 8, 10][lod];
  const arch = Array.from({ length: steps + 1 }, (_, i) => {
    const theta = (Math.PI * i) / steps;
    return [center - (Math.cos(theta) * span) / 2, shoulder + rise * Math.sin(theta)];
  });
  for (let i = 1; i < arch.length; i++) {
    const [[u, y], [v, h]] = arch.slice(i - 1, i + 1);
    face(o, 'wall', [p(u, y), p(v, h), p(v, upperFloor), p(u, upperFloor)], normal);
    if (lod) face(o, 'trim', [p(u, y), p(v, h), p(v, h, -0.27), p(u, y, -0.27)], [0, -1, 0]);
  }
  panel(o, 'wall', s, 0, shoulder, arch[0][0], upperFloor);
  panel(o, 'wall', s, arch.at(-1)[0], shoulder, length, upperFloor);
  for (const t of first ? [0, 1] : [1]) {
    if (!lod) {
      const u = t * length;
      panel(o, 'trim', s, u - 0.125, mainFloor, u + 0.125, shoulder + 0.06);
      panel(o, 'trim', s, u - 0.07, upperFloor + 0.19, u + 0.07, eave);
      continue;
    }
    const [x, , z] = p(t * length, 0, -0.05);
    pillar(o, x, z, mainFloor, shoulder + 0.06, 0.13, lod, lod > 1);
    pillar(o, x, z, upperFloor + 0.19, eave, 0.09, lod);
    if (lod > 1) {
      const [xx, , zz] = p(t * length, 0, -0.35);
      pillar(o, xx, zz, mainFloor, shoulder + 0.06, 0.113, lod);
    }
  }
  panel(o, 'iron', s, 0, upperFloor + 0.84, length, upperFloor + 0.92, -0.03);
  if (lod) {
    const bars = Math.round(length / (lod > 1 ? 0.18 : 0.46));
    for (let i = 1; i < bars; i++) {
      const u = (length * i) / bars;
      panel(o, 'iron', s, u - 0.021, upperFloor + 0.21, u + 0.021, upperFloor + 0.85, -0.033);
    }
  }
}
function arcade(o, start, end, count, lod, clear = false) {
  for (let i = 0; i < count; i++)
    arcadeBay(o, mix(start, end, i / count), mix(start, end, (i + 1) / count), clear, lod, i === 0);
}
function portico(o, lod) {
  const [a, b, c, d] = ring.slice(42, 46);
  const z = (b[1] + c[1]) / 2,
    left = b[0],
    right = c[0],
    center = (left + right) / 2,
    back = (a[1] + d[1]) / 2;
  prism(o, 'wall', [a, b, c, d], 4.47, 4.77, colors.wall, true);
  prism(
    o,
    'trim',
    [
      [left - 0.18, back],
      [left - 0.18, z - 0.18],
      [right + 0.18, z - 0.18],
      [right + 0.18, back],
    ],
    4.77,
    4.94,
  );
  for (let i = 0; i < 4; i++) {
    const x = left + 0.45 + ((right - left - 0.9) * i) / 3;
    pillar(o, x, z + 0.43, mainFloor, 4.48, i === 0 || i === 3 ? 0.37 : 0.25, lod, lod > 0);
  }
  for (const x of [left + 0.51, right - 0.51])
    pillar(o, x, back - 0.21, mainFloor, 4.49, 0.31, lod);
  const width = right - left;
  for (let i = 0; i < 4; i++) {
    const front = z - 0.86 + i * 0.21;
    block(
      o,
      'trim',
      center - width * 0.39,
      foundationBottom,
      front,
      center + width * 0.39,
      0.17 + i * 0.14,
      z + 0.38,
    );
  }
  block(o, 'wall', left - 0.06, mainFloor, back - 0.05, right + 0.06, 8.77, -21.8);
  const wall = side([left - 0.06, back - 0.05], [right + 0.06, back - 0.05], 1);
  for (const fraction of [0.22, 0.5, 0.78])
    sash(o, wall, wall.length * fraction, 5.28, 0.86, 2.43, lod);
  sash(o, wall, wall.length / 2, mainFloor + 0.04, 1.46, 2.71, lod, true);
  for (const fraction of [0.15, 0.85]) sash(o, wall, wall.length * fraction, 1.42, 0.64, 1.75, lod);
  const p = [left - 0.21, 8.77, back - 0.19],
    q = [right + 0.21, 8.77, back - 0.19],
    top = [center, 10.89, back - 0.19];
  face(o, 'wall', [p, q, top], [0, 0, -1]);
  const far = [center, 10.89, -20.5];
  face(o, 'roof', [p, top, far, [left - 0.21, 8.77, -20.5]], [0, 1, 0]);
  face(o, 'roof', [q, [right + 0.21, 8.77, -20.5], far, top], [0, 1, 0]);
  panel(o, 'trim', wall, 0, 8.56, wall.length, 8.78, 0.19);
}
export function buildHouse(o, _frame, lod = 3) {
  const outline = lod
    ? ring
    : [
        0, 3, 7, 9, 12, 15, 21, 23, 26, 28, 29, 30, 32, 35, 38, 40, 41, 42, 43, 44, 45, 46, 51, 54,
        56, 58, 61, 63,
      ].map((i) => ring[i]);
  const front = clip(
      outline.filter((point) => point !== ring[43] && point !== ring[44]),
      backBreak,
      true,
    ),
    back = clip(outline, backBreak, false);
  prism(o, 'base', outline, foundationBottom, mainFloor, colors.base, lod > 0);
  prism(o, 'wall', front, upperFloor - 0.16, upperFloor + 0.13);
  prism(o, 'roof', front, eave, eave + 0.14, colors.roof, lod > 1);
  block(o, 'wall', -12.9, mainFloor, -22.58, 11.63, eave, backBreak + 0.05);
  prism(o, 'wall', back, mainFloor, 7.73, tintBack);
  prism(o, 'roof', back, 7.73, 7.89);
  hip(o, -12.78, -22.4, 11.59, 8.55, eave + 0.05, 2.5);
  hip(o, -12.55, 8.95, 8.29, 21.93, 7.85, 1.51);
  for (const [a, b, n] of [
    [41, 42, 4],
    [45, 46, 4],
    [40, 41, 6],
    [46, 47, 4],
    [50, 51, 1],
    [29, 30, 5],
    [61, 62, 1],
  ]) {
    arcade(o, ring[a], ring[b], lod ? n : Math.min(n, 3), lod);
  }
  for (const [start, end] of [
    [31, 39],
    [52, 60],
  ]) {
    const stride = lod ? 2 : 4;
    for (let i = start; i < end; i += stride)
      arcadeBay(o, ring[i], ring[i + stride], true, lod, i === start);
  }
  for (const [a, b] of [
    [30, 31],
    [39, 40],
    [51, 52],
    [60, 61],
  ]) {
    arcade(o, ring[a], ring[b], 1, lod, true);
  }
  const inner = side([-12.9, -22.58], [11.63, -22.58], 1);
  for (const t of [0.07, 0.16, 0.25, 0.33, 0.67, 0.75, 0.84, 0.93]) {
    sash(o, inner, inner.length * t, 1.39, 0.94, 2.37, lod);
    sash(o, inner, inner.length * t, 5.26, 0.87, 2.28, lod);
  }
  if (lod)
    for (const [a, b] of [
      [
        [-12.9, backBreak],
        [-12.9, -22.58],
      ],
      [
        [11.63, -22.58],
        [11.63, backBreak],
      ],
    ]) {
      const s = side(a, b, 1);
      for (const t of [0.11, 0.23, 0.35, 0.47, 0.59, 0.71, 0.83, 0.94]) {
        sash(o, s, s.length * t, 1.62, 0.87, 2.21, lod);
        sash(o, s, s.length * t, 5.25, 0.78, 2.04, lod);
      }
    }
  if (lod)
    for (let i = 0; i < back.length; i++) {
      const s = side(back[i], back[(i + 1) % back.length], Math.sign(area(back)));
      if (s.length < 3.2) continue;
      const n = Math.round(s.length / 3.17);
      for (let j = 0; j < n; j++) {
        const u = (s.length * (j + 0.5)) / n;
        sash(o, s, u, 2.58, 0.75, 1.63, lod);
        sash(o, s, u, 5.01, 0.74, 1.82, lod);
      }
    }
  portico(o, lod);
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [52, 29, -72],
  lookAt = [0, 6.1, -2];
const modelPath = 'content/worldgen/source/places/r7/r7h/old_government_house_brisbane';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Gardens Point sandstone residence with an open carriage portico, long arched verandas, curved garden pavilions, and a rear service range.',
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
    'stone_sandstone',
    'stone_limestone',
    'metal_standing_seam',
    'metal_painted',
    'stone_basalt_raw',
  ],
  qaCameras: [
    {
      name: 'carriage-portico-and-two-storey-arcades',
      position: [-8, 9, -65],
      lookAt: [0, 5.6, -21],
    },
    {
      name: 'rounded-garden-pavilion-and-rear-range',
      position: [45, 15, 23],
      lookAt: [0, 5.4, -2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.065, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.024, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Figaro’s two published Qualla exterior photographs were dedicated to the public domain. Native map geometry attributed to OpenStreetMap contributors under ODbL.',
};
