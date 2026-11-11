/** The lawn façade and mapped wings of Old Government House in Auckland. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const palette = {
  wall: rgb('e6e3cb'),
  ochre: rgb('c2a066'),
  white: rgb('eee9d7'),
  roof: rgb('b4bcb8'),
  glass: rgb('3e535a'),
  base: rgb('a49980'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  ochre: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  white: { slot: 'trim', graph: 'concrete_plain', roughness: 0.8, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.12 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
};
const { nativeRing: outer, courtyard, porch, passage, floor, foundationBottom } = plan;
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const block = (o, k, x0, y0, z0, x1, y1, z1, tint = palette[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], tint);
const bar = (o, k, a, b, w, d) => beam(o, k, a, b, w, d, palette[k]);
const area = (r) =>
  r.reduce((s, [x, z], i) => s + x * r[(i + 1) % r.length][1] - z * r[(i + 1) % r.length][0], 0);
function face(o, k, points, expected) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, palette[k]);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, (p) => [p[0], p[1]], palette[k]);
}
function prism(o, k, ring, y0, y1, holes = []) {
  const boundary = area(ring) > 0 ? ring : [...ring].reverse();
  const interior = holes.map((hole) => (area(hole) < 0 ? hole : [...hole].reverse()));
  for (const loop of [boundary, ...interior]) {
    for (let i = 0; i < loop.length; i++) {
      const [x, z] = loop[i],
        [xx, zz] = loop[(i + 1) % loop.length];
      face(
        o,
        k,
        [
          [x, y0, z],
          [xx, y0, zz],
          [xx, y1, zz],
          [x, y1, z],
        ],
        [zz - z, 0, x - xx],
      );
    }
  }
  for (const [y, ny] of [
    [y0, -1],
    [y1, 1],
  ]) {
    const cap = new MeshBufferBuilder();
    if (
      !cap.addCap(
        k,
        'palette:#ffffff',
        boundary,
        interior,
        () => y,
        [0, ny, 0],
        (p) => p,
        palette[k],
      )
    )
      throw Error('Cannot triangulate Old Government House outline');
    const mesh = cap.finalize();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const triangle = Array.from(mesh.indices.slice(i, i + 3), (j) =>
        Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
      );
      face(o, k, triangle, [0, ny, 0]);
    }
  }
}

// Clip the original outer outline at an architectural division without moving native corners.
function clip(ring, axis, limit, keepLow) {
  const inside = (p) => (keepLow ? p[axis] <= limit : p[axis] >= limit);
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, j) => v + t * (b[j] - v)));
    }
  }
  return result;
}
const main = clip(outer, 0, 26, true);
const annex = clip(outer, 0, 26, false);
const frontPavilion = clip(clip(clip(outer, 0, -15.85, false), 0, 16.3, true), 1, -2.4, true);
function frontAt(x) {
  const hits = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    if ((a[0] <= x && x < b[0]) || (b[0] <= x && x < a[0]))
      hits.push(a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return Math.min(...hits);
}
function hip(o, x0, z0, x1, z1, eave, rise, ridgeAxis = 'x') {
  const a = [x0, eave, z0],
    b = [x1, eave, z0],
    c = [x1, eave, z1],
    d = [x0, eave, z1];
  const dx = x1 - x0,
    dz = z1 - z0;
  const p =
    ridgeAxis === 'x'
      ? [x0 + dx * 0.23, eave + rise, (z0 + z1) / 2]
      : [(x0 + x1) / 2, eave + rise, z0 + dz * 0.23];
  const q =
    ridgeAxis === 'x'
      ? [x1 - dx * 0.23, eave + rise, (z0 + z1) / 2]
      : [(x0 + x1) / 2, eave + rise, z1 - dz * 0.23];
  const slopes =
    ridgeAxis === 'x'
      ? [
          [a, b, q, p],
          [b, c, q],
          [c, d, p, q],
          [d, a, p],
        ]
      : [
          [a, b, p],
          [b, c, q, p],
          [c, d, q],
          [d, a, p, q],
        ];
  for (const points of slopes) face(o, 'roof', points, [0, 1, 0]);
  face(o, 'roof', [d, c, b, a], [0, -1, 0]);
}
function trimBox(o, k, x, y, z, w, h, thick) {
  block(o, k, x - w / 2, y, z - thick, x + w / 2, y + h, z + 0.04);
}
function sash(o, x, y, z, w, h, lod, hood) {
  trimBox(o, 'ochre', x, y - 0.14, z, w + 0.31, h + 0.3, 0.11);
  trimBox(o, 'glass', x, y, z - 0.122, w, h, 0.031);
  trimBox(o, 'white', x, y - 0.18, z, w + 0.52, 0.115, 0.235);
  if (lod > 0) {
    trimBox(o, 'white', x, y, z - 0.16, 0.054, h, 0.04);
    trimBox(o, 'white', x, y + h * 0.5, z - 0.16, w, 0.061, 0.04);
  }
  if (lod > 1) {
    for (const dy of [0.24, 0.76]) trimBox(o, 'white', x, y + h * dy, z - 0.16, w, 0.033, 0.038);
  }
  if (hood === 'triangle') {
    const top = y + h + 0.19;
    face(
      o,
      'ochre',
      [
        [x - w * 0.71, top, z - 0.16],
        [x + w * 0.71, top, z - 0.16],
        [x, top + 0.36, z - 0.16],
      ],
      [0, 0, -1],
    );
    trimBox(o, 'ochre', x, top - 0.045, z, w * 1.42, 0.088, 0.19);
  }
  if (hood === 'arch') {
    segment(o, 'ochre', x, y + h + 0.18, z - 0.165, w * 1.45, 0.34, lod > 1 ? 9 : 5);
  }
}
function segment(o, k, x, base, z, width, rise, n) {
  const r = width / 2;
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [x - Math.cos(t) * r, base + Math.sin(t) * rise, z];
  });
  face(o, k, profile, [0, 0, -1]);
  return profile;
}
function archedSash(o, x, y, z, w, h, lod) {
  const shoulder = y + h - w * 0.48;
  trimBox(o, 'ochre', x, y - 0.1, z, w + 0.22, shoulder - y + 0.11, 0.1);
  segment(o, 'ochre', x, shoulder, z - 0.105, w + 0.22, w * 0.48 + 0.1, 10);
  trimBox(o, 'glass', x, y, z - 0.115, w, shoulder - y, 0.022);
  segment(o, 'glass', x, shoulder, z - 0.14, w, w * 0.48, 10);
  if (lod > 0) {
    trimBox(o, 'white', x, y, z - 0.16, 0.045, h - 0.04, 0.025);
    trimBox(o, 'white', x, y + (shoulder - y) * 0.54, z - 0.16, w, 0.047, 0.025);
  }
}
function rail(o, x0, x1, z, y, lod) {
  block(o, 'ochre', x0, y, z - 0.24, x1, y + 0.13, z + 0.19);
  block(o, 'white', x0, y + 0.73, z - 0.18, x1, y + 0.84, z + 0.14);
  if (lod < 2) {
    block(o, 'white', x0, y + 0.11, z - 0.045, x1, y + 0.74, z + 0.045);
  } else {
    const count = Math.round((x1 - x0) / 0.39);
    for (let i = 1; i < count; i++) {
      const x = x0 + ((x1 - x0) * i) / count;
      const ring = (width) => rect(x - width / 2, z - width / 2, x + width / 2, z + width / 2);
      prism(o, 'white', ring(0.13), y + 0.12, y + 0.29);
      prism(o, 'white', ring(0.18), y + 0.29, y + 0.54);
      prism(o, 'white', ring(0.11), y + 0.54, y + 0.74);
    }
  }
  for (const x of [x0 + 0.21, (x0 + x1) / 2, x1 - 0.21]) {
    block(o, 'ochre', x - 0.18, y, z - 0.19, x + 0.18, y + 0.9, z + 0.19);
    block(o, 'white', x - 0.22, y + 0.89, z - 0.23, x + 0.22, y + 0.98, z + 0.23);
  }
}
function entry(o, lod) {
  const x0 = Math.min(...porch.map((p) => p[0])),
    x1 = Math.max(...porch.map((p) => p[0]));
  const z0 = Math.min(...porch.map((p) => p[1])),
    z1 = Math.max(...porch.map((p) => p[1]));
  prism(o, 'base', porch, foundationBottom, floor);
  for (let i = 0; i < 3; i++)
    block(
      o,
      'base',
      x0 - 0.08,
      floor - (i + 1) * 0.15,
      z0 - (i + 1) * 0.23,
      x1 + 0.08,
      floor - i * 0.15,
      z0 - i * 0.23,
    );
  for (const x of [x0 + 0.48, x1 - 0.48]) {
    block(o, 'ochre', x - 0.12, floor, z0 + 0.38, x + 0.12, floor + 3.72, z0 + 0.62);
    block(o, 'white', x - 0.2, floor + 3.52, z0 + 0.3, x + 0.2, floor + 3.76, z0 + 0.7);
  }
  prism(o, 'white', porch, floor + 3.71, floor + 3.98);
  const peak = floor + 4.42,
    eave = floor + 3.98,
    center = (x0 + x1) / 2;
  face(
    o,
    'wall',
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [center, peak, z0],
    ],
    [0, 0, -1],
  );
  face(
    o,
    'roof',
    [
      [x0, eave, z0],
      [x0, eave, z1],
      [center, peak, z1],
      [center, peak, z0],
    ],
    [0, 1, 0],
  );
  face(
    o,
    'roof',
    [
      [center, peak, z0],
      [center, peak, z1],
      [x1, eave, z1],
      [x1, eave, z0],
    ],
    [0, 1, 0],
  );
  if (lod > 0) {
    bar(o, 'ochre', [x0, eave, z0 - 0.035], [center, peak, z0 - 0.035], 0.115, 0.115);
    bar(o, 'ochre', [center, peak, z0 - 0.035], [x1, eave, z0 - 0.035], 0.115, 0.115);
  }
}

export function buildHouse(o, _frame, lod = 3) {
  const eave = floor + 8.25,
    high = floor + 9.65,
    annexTop = floor + 5.4;
  if (lod === 0) {
    prism(o, 'wall', main, foundationBottom, eave, [courtyard]);
    prism(o, 'wall', annex, foundationBottom, annexTop);
    prism(o, 'wall', frontPavilion, eave - 0.01, high);
    hip(o, -15.53, -13.34, 16, -2.55, high + 0.02, 1.02);
    hip(o, -22.35, -12.46, -15.92, 5.1, eave + 0.015, 1.17, 'z');
    hip(o, 16.4, -12.19, 22.6, -1.9, eave + 0.015, 1, 'z');
    hip(o, -20.9, 8.95, -11.1, 18.85, eave + 0.015, 1.35, 'z');
    hip(o, -10.85, 8.95, 6.85, 18.85, eave + 0.015, 1.35);
    hip(o, 26.12, -5.55, 36.7, 1.67, annexTop + 0.014, 0.93);
    prism(o, 'roof', passage, floor + 3.56, floor + 3.78);
    segment(o, 'ochre', 0.25, high - 0.04, -14.3, 7.3, 1.9, 8);
    for (const [x0, x1, z] of [
      [-15.6, -3.64, -13.58],
      [4.1, 16.02, -13.28],
    ])
      block(o, 'white', x0, high, z - 0.14, x1, high + 0.82, z + 0.13);
    const xs = [-19.75, -17.72, -13.05, -9.35, -5.95, 6.15, 10.28, 14.17, 18.61, 20.83];
    for (const x of xs) {
      const z = frontAt(x) - 0.041;
      for (const [y, h] of [
        [floor + 1.03, 2.35],
        [floor + 5.24, 2.54],
      ])
        face(
          o,
          'glass',
          [
            [x - 0.64, y, z],
            [x + 0.64, y, z],
            [x + 0.64, y + h, z],
            [x - 0.64, y + h, z],
          ],
          [0, 0, -1],
        );
    }
    for (const x of [-1.76, 0.25, 2.25]) segment(o, 'glass', x, floor + 6.54, -14.18, 1, 2.08, 6);
    entry(o, 0);
    return;
  }
  prism(o, 'base', outer, foundationBottom, floor, [courtyard]);
  prism(o, 'wall', main, floor, eave, [courtyard]);
  prism(o, 'wall', annex, floor, annexTop);
  prism(o, 'wall', frontPavilion, eave - 0.01, high);
  hip(o, -15.53, -13.34, 16.0, -2.55, high + 0.02, 1.02);
  hip(o, -22.35, -12.46, -15.92, 5.1, eave + 0.015, 1.17, 'z');
  hip(o, 16.4, -12.19, 22.6, -1.9, eave + 0.015, 1.0, 'z');
  hip(o, -20.9, 8.95, -11.1, 18.85, eave + 0.015, 1.35, 'z');
  hip(o, -10.85, 8.95, 6.85, 18.85, eave + 0.015, 1.35);
  hip(o, 26.12, -5.55, 36.7, 1.67, annexTop + 0.014, 0.93);
  prism(o, 'roof', passage, floor + 3.56, floor + 3.78);
  for (const x of [8.05, 10.24])
    block(o, 'ochre', x - 0.105, floor, 17.9, x + 0.105, floor + 3.56, 18.11);
  entry(o, lod);

  for (const [x0, x1, z] of [
    [-15.86, -3.16, -13.7],
    [3.77, 16.31, -13.39],
    [-3.16, 3.77, -14.13],
  ]) {
    block(o, 'ochre', x0, floor + 4.42, z - 0.17, x1, floor + 4.66, z + 0.09);
    block(o, 'white', x0, floor + 4.66, z - 0.22, x1, floor + 4.8, z + 0.09);
    block(o, 'ochre', x0, high - 0.3, z - 0.24, x1, high - 0.1, z + 0.13);
    block(o, 'white', x0, high - 0.1, z - 0.29, x1, high + 0.045, z + 0.13);
    if (lod > 1)
      for (let x = x0 + 0.32; x < x1 - 0.22; x += 0.47)
        block(o, 'ochre', x - 0.075, high - 0.45, z - 0.17, x + 0.075, high - 0.24, z + 0.055);
  }
  for (const [i, x] of [-13.05, -9.35, -5.95, 6.15, 10.28, 14.17].entries()) {
    const z = frontAt(x);
    sash(o, x, floor + 1.05, z, 1.32, 2.34, lod);
    sash(o, x, floor + 5.35, z, 1.35, 2.62, lod, i === 1 || i === 4 ? 'arch' : 'triangle');
  }
  for (const x of [-19.75, -17.72, 18.61, 20.83]) {
    const z = frontAt(x);
    sash(o, x, floor + 0.91, z, 1.12, 2.25, lod);
    sash(o, x, floor + 5.04, z, 1.14, 2.21, lod);
  }
  for (const [x, w, h] of [
    [-1.76, 0.76, 2.77],
    [0.25, 1.22, 3.39],
    [2.25, 0.76, 2.77],
  ])
    archedSash(o, x, floor + 5.36, -14.13, w, h, lod);
  trimBox(o, 'glass', 0.24, floor + 0.14, -14.13, 1.77, 3.11, 0.05);
  for (const x of [-1.34, 1.82]) trimBox(o, 'ochre', x, floor + 0.18, -14.13, 0.17, 3.12, 0.16);
  rail(o, -2.95, 3.46, -14.25, floor + 4.76, lod);
  rail(o, -15.6, -3.64, -13.58, high + 0.025, lod);
  rail(o, 4.1, 16.02, -13.28, high + 0.025, lod);
  rail(o, -22.06, -16.11, -12.56, floor + 4.52, lod);
  rail(o, 16.54, 22.4, -12.29, floor + 4.52, lod);
  const curve = segment(o, 'wall', 0.25, high - 0.04, -14.3, 7.3, 1.9, lod > 1 ? 18 : 8);
  for (let i = 1; i < curve.length; i++) bar(o, 'ochre', curve[i - 1], curve[i], 0.18, 0.29);
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1],
      b = curve[i];
    face(o, 'roof', [a, b, [b[0], b[1], -13.37], [a[0], a[1], -13.37]], [0, 1, 0]);
  }
  for (const [x, z, y] of [
    [-14.8, -8.4, high],
    [14.7, -7.2, high],
    [-20.8, 1.65, eave],
    [2.3, 11.45, eave],
  ]) {
    block(o, 'white', x - 0.44, y, z - 0.31, x + 0.44, y + 2.05, z + 0.31);
    block(o, 'white', x - 0.59, y + 1.85, z - 0.44, x + 0.59, y + 2.1, z + 0.44);
  }
  if (lod > 1) {
    for (const [x, z] of [
      [-15.8, -13.69],
      [-3.12, -14.11],
      [3.7, -14.1],
      [16.2, -13.38],
    ]) {
      for (let y = floor + 0.39, n = 0; y < high - 0.38; y += 0.44, n++) {
        const w = n % 2 ? 0.35 : 0.5;
        trimBox(o, 'ochre', x, y, z, w, 0.29, 0.1);
      }
    }
    for (const [x, z] of [
      [-17.2, 19.28],
      [-12.6, 19.1],
      [-7.7, 19.2],
      [-2.2, 19.32],
      [3.6, 19.46],
    ]) {
      block(o, 'ochre', x - 0.56, floor + 5.15, z - 0.14, x + 0.56, floor + 7.43, z + 0.08);
      block(o, 'glass', x - 0.45, floor + 5.29, z + 0.09, x + 0.45, floor + 7.28, z + 0.13);
      block(o, 'white', x - 0.55, floor + 6.27, z + 0.13, x + 0.55, floor + 6.34, z + 0.17);
    }
  }
  if (lod === 3) {
    for (const [x, z] of [
      [-13.05, -13.7],
      [-9.35, -13.7],
      [-5.95, -13.7],
      [6.15, -13.39],
      [10.28, -13.39],
      [14.17, -13.39],
    ]) {
      for (const [dx, lean] of [
        [-0.49, -0.1],
        [0, 0],
        [0.49, 0.1],
      ])
        bar(
          o,
          'ochre',
          [x + dx, floor + 3.47, z - 0.14],
          [x + dx + lean, floor + 3.87, z - 0.14],
          0.12,
          0.11,
        );
    }
  }
}

export const houseSkyline = (o, f) => buildHouse(o, f, 0);
export const houseDistrict = (o, f) => buildHouse(o, f, 1);
export const houseStreet = (o, f) => buildHouse(o, f, 2);
export const houseCloseup = (o, f) => buildHouse(o, f, 3);
const camera = [52, 29, -73],
  lookAt = [3, floor + 5, 0];
const dir = 'content/worldgen/source/places/rc/rck/old_government_house_auckland';
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
    'Cream and ochre Old Government House with a curved pediment, balustrades, hipped wings and a northeast entrance portico.',
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
    'plaster_lime',
    'wood_plain',
    'concrete_plain',
    'metal_standing_seam',
    'stone_sandstone',
  ],
  qaCameras: [
    { name: 'lawn-facade-and-entrance', position: [13, 9, -47], lookAt: [0, 5, -12] },
    { name: 'rear-wings-and-open-court', position: [32, 45, 54], lookAt: [4, 4, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: dir + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.09, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.03, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic reconstruction under the repository license. Richard001’s published Qualla photograph is public-domain reference. Map controls are attributed to OpenStreetMap contributors under ODbL.',
};
