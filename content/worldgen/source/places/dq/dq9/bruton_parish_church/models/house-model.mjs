/** Bruton Parish Church from the mapped cruciform plan and its documented 2007 appearance. */
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
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'wood_painted_shingle', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.85, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.08 },
};
const colors = {
  brick: rgb('a6765d'),
  roof: rgb('605b52'),
  wood: rgb('ded7b9'),
  stone: rgb('b3a48b'),
  glass: rgb('455150'),
};
const towerTint = rgb('84594f'),
  dark = rgb('655c49');
const {
  nativeRing: ring,
  foundationBottom,
  foundationTop,
  eave,
  ridge,
  towerBrickTop,
  spireTop,
} = plan;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const vec = ([x, z], y) => [x, y, z];
const block = (o, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], color);
function face(o, k, points, expected, color = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, color);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function area(points) {
  return points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
}
const sign = Math.sign(area(ring));
function wall(a, b, winding = sign) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(winding * (b[1] - a[1])) / width, 0, (winding * (a[0] - b[0])) / width];
  const at = (u, y, offset = 0) => {
    const [x, z] = mix(a, b, u / width);
    return [x + normal[0] * offset, y, z + normal[2] * offset];
  };
  return { width, at, normal };
}
function panel(o, k, s, left, low, right, high, offset = 0.04, color = colors[k]) {
  const { at, normal } = s;
  face(
    o,
    k,
    [
      at(left, low, offset),
      at(right, low, offset),
      at(right, high, offset),
      at(left, high, offset),
    ],
    normal,
    color,
  );
}
function cap(o, k, outline, y, normalY, color = colors[k]) {
  const builder = new MeshBufferBuilder();
  const loop = area(outline) > 0 ? outline : [...outline].reverse();
  if (
    !builder.addCap(
      k,
      'palette:#ffffff',
      loop,
      [],
      () => y,
      [0, normalY, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Cannot cap Bruton Parish footprint');
  const mesh = builder.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, points, [0, normalY, 0], color);
  }
}
function arch(o, k, s, center, bottom, width, height, offset, steps, color = colors[k]) {
  const r = width / 2,
    shoulder = bottom + height - r;
  const profile = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    return s.at(center + r * Math.cos(t), shoulder + r * Math.sin(t), offset);
  });
  face(
    o,
    k,
    [s.at(center - r, bottom, offset), s.at(center + r, bottom, offset), ...profile],
    s.normal,
    color,
  );
}
function window(o, s, center, bottom, width, height, lod, door = false) {
  const steps = [4, 6, 8, 12][lod];
  arch(o, 'stone', s, center, bottom - 0.095, width + 0.19, height + 0.19, 0.05, steps);
  arch(
    o,
    door ? 'wood' : 'glass',
    s,
    center,
    bottom,
    width,
    height,
    0.067,
    steps,
    door ? rgb('948c71') : colors.glass,
  );
  if (!lod) return;
  if (door) {
    panel(
      o,
      'wood',
      s,
      center - 0.029,
      bottom,
      center + 0.029,
      bottom + height - 0.47,
      0.079,
      dark,
    );
    panel(
      o,
      'wood',
      s,
      center - width * 0.47,
      bottom + height * 0.52,
      center + width * 0.47,
      bottom + height * 0.52 + 0.045,
      0.081,
      dark,
    );
    return;
  }
  panel(
    o,
    'stone',
    s,
    center - width / 2 - 0.11,
    bottom - 0.12,
    center + width / 2 + 0.11,
    bottom - 0.035,
    0.11,
  );
  for (let col = 1; col < (lod > 1 ? 5 : 3); col++) {
    const x = center - width / 2 + (width * col) / (lod > 1 ? 5 : 3);
    panel(o, 'wood', s, x - 0.022, bottom, x + 0.022, bottom + height - width * 0.42, 0.077);
  }
  for (let row = 1; row < (lod > 1 ? 6 : 3); row++) {
    const y = bottom + (height * 0.85 * row) / (lod > 1 ? 6 : 3);
    panel(o, 'wood', s, center - width / 2, y - 0.021, center + width / 2, y + 0.021, 0.078);
  }
}
function wheelWindow(o, s, u, y, lod) {
  const steps = lod > 1 ? 24 : 12;
  for (const [k, r, off] of [
    ['brick', 1.21, 0.041],
    ['stone', 1.1, 0.06],
    ['glass', 0.99, 0.072],
  ]) {
    const poly = Array.from({ length: steps }, (_, i) => {
      const t = (i * 2 * Math.PI) / steps;
      return s.at(u + r * Math.cos(t), y + r * Math.sin(t), off);
    });
    face(o, k, poly, s.normal, k === 'brick' ? towerTint : colors[k]);
  }
  if (lod)
    for (const offset of [-0.62, -0.31, 0, 0.31, 0.62]) {
      const half = Math.sqrt(0.96 * 0.96 - offset * offset);
      panel(o, 'wood', s, u + offset - 0.022, y - half, u + offset + 0.022, y + half, 0.082);
      panel(o, 'wood', s, u - half, y + offset - 0.022, u + half, y + offset + 0.022, 0.084);
    }
}
function roof(o, footprint, peakAxis, top) {
  const [a, b, c, d] = footprint;
  const y = eave - 0.06;
  const [p, q] =
    peakAxis === 'x' ? [mix(a, d, 0.5), mix(b, c, 0.5)] : [mix(a, b, 0.5), mix(d, c, 0.5)];
  const [aa, bb, cc, dd] = footprint.map((v) => vec(v, y));
  const r0 = vec(p, top),
    r1 = vec(q, top);
  const slopes =
    peakAxis === 'x'
      ? [
          [aa, bb, r1, r0],
          [dd, cc, r1, r0],
        ]
      : [
          [aa, dd, r1, r0],
          [bb, cc, r1, r0],
        ];
  for (const slope of slopes) face(o, 'roof', slope, [0, 1, 0]);
  const gables =
    peakAxis === 'x'
      ? [
          [aa, dd, r0, [-1, 0, 0]],
          [bb, cc, r1, [1, 0, 0]],
        ]
      : [
          [aa, bb, r0, [0, 0, -1]],
          [dd, cc, r1, [0, 0, 1]],
        ];
  for (const [left, right, peak, normal] of gables) face(o, 'brick', [left, right, peak], normal);
}
function steeple(o, lod) {
  const tower = ring.slice(10, 15);
  for (let i = 0; i < tower.length; i++) {
    const s = wall(tower[i], tower[(i + 1) % tower.length], Math.sign(area(tower)));
    panel(o, 'brick', s, 0, eave, s.width, towerBrickTop, 0, towerTint);
  }
  cap(o, 'brick', tower, towerBrickTop, 1, towerTint);
  const x = -15.55,
    z = -0.11;
  block(
    o,
    'wood',
    x - 3.3,
    towerBrickTop - 0.23,
    z - 3.69,
    x + 3.29,
    towerBrickTop + 0.08,
    z + 3.69,
  );
  const levels = [
    [
      'roof',
      [
        [14.18, 3.15],
        [14.46, 2.92],
      ],
    ],
    [
      'wood',
      [
        [14.46, 2.92],
        [19.03, 2.71],
        [19.22, 2.83],
      ],
    ],
    [
      'roof',
      [
        [19.22, 2.83],
        [19.68, 2.36],
        [19.82, 2.27],
      ],
    ],
    [
      'wood',
      [
        [19.82, 2.27],
        [23.81, 2.18],
        [24.02, 2.34],
      ],
    ],
    [
      'roof',
      [
        [24.02, 2.34],
        [24.23, 2.12],
        [spireTop - 0.27, 0.12],
      ],
    ],
  ];
  const phase = Math.PI / 8;
  for (const [k, profile] of levels) {
    loft(
      o,
      k,
      profile.map(([y, r]) => radialRing(y, r, r, 8, [x, z], phase)),
      colors[k],
    );
  }
  loft(
    o,
    'wood',
    [
      radialRing(spireTop - 0.27, 0.113, 0.113, 8, [x, z], phase),
      radialRing(spireTop, 0.035, 0.035, 8, [x, z], phase),
    ],
    colors.wood,
  );
  for (const [y, r, h] of [
    [15.45, 2.79, 2.07],
    [20.45, 2.28, 2.54],
  ]) {
    const polygon = radialRing(y, r, r, 8, [x, z], phase).map(([xx, , zz]) => [xx, zz]);
    for (let i = 0; i < 8; i++) {
      const s = wall(polygon[i], polygon[(i + 1) % 8], Math.sign(area(polygon)));
      const u = s.width / 2;
      panel(o, 'stone', s, u - 0.54, y - 0.12, u + 0.54, y + h + 0.12, 0.018);
      panel(
        o,
        y > 20 ? 'wood' : 'glass',
        s,
        u - 0.41,
        y,
        u + 0.41,
        y + h,
        0.037,
        y > 20 ? dark : colors.glass,
      );
      if (lod > 1)
        for (let row = 1; row < 9; row++) {
          const yy = y + (h * row) / 9;
          panel(o, 'wood', s, u - 0.43, yy, u + 0.43, yy + 0.049, 0.051);
        }
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  for (let i = 0; i < ring.length; i++) {
    const s = wall(ring[i], ring[(i + 1) % ring.length]);
    const tower = i >= 10 && i <= 13;
    panel(o, 'stone', s, 0, foundationBottom, s.width, foundationTop, 0);
    panel(o, 'brick', s, 0, foundationTop, s.width, eave, 0, tower ? towerTint : colors.brick);
    if (!tower) {
      panel(o, 'wood', s, 0, eave - 0.16, s.width, eave + 0.045, 0.04);
      if (lod > 1 && s.width > 4)
        for (let u = 0.27; u < s.width - 0.16; u += 0.43) {
          panel(o, 'wood', s, u - 0.055, eave - 0.24, u + 0.055, eave - 0.06, 0.081);
        }
    }
  }
  if (lod) cap(o, 'stone', ring, foundationBottom, -1);
  roof(
    o,
    [
      [-12.57, -6.01],
      [18.83, -6.01],
      [18.83, 5.12],
      [-12.57, 5.22],
    ],
    'x',
    ridge,
  );
  roof(
    o,
    [
      [-1.81, -9.96],
      [6.8, -9.96],
      [7.04, 9.25],
      [-1.68, 9.25],
    ],
    'z',
    ridge + 0.15,
  );
  for (const i of [1, 3, 8, 15]) {
    const s = wall(ring[i], ring[i + 1]);
    for (const t of [0.21, 0.5, 0.79]) window(o, s, s.width * t, 2.15, 1.27, 3.74, lod);
  }
  const east = wall(ring[2], ring[3]);
  window(o, east, east.width * 0.5, 2.65, 2.01, 4.64, lod);
  const north = wall(ring[17], ring[0]),
    south = wall(ring[5], ring[7]);
  for (const s of [south, north]) {
    window(o, s, s.width * 0.5, foundationTop + 0.04, 1.78, 3.03, lod, true);
    wheelWindow(o, s, s.width * 0.5, 6.02, lod);
  }
  for (const [a, b] of [
    [ring[10], ring[11]],
    [ring[13], ring[14]],
    [ring[11], ring[13]],
  ]) {
    const s = wall(a, b);
    for (const y of [1.81, 6.0, 10.32]) window(o, s, s.width * 0.5, y, 0.96, 2.32, lod);
  }
  const [cx, z] = ring[6];
  for (let i = 0; i < 5; i++) {
    const run = 1.68 - 0.31 * i;
    block(o, 'stone', cx - 1.27, foundationBottom, z - 0.05, cx + 1.27, 0.18 + 0.118 * i, z + run);
  }
  steeple(o, lod);
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [-43, 33, 51],
  lookAt = [0, 8, 0];
const modelPath = 'content/worldgen/source/places/dq/dq9/bruton_parish_church';
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
    'Colonial brick church with a cross-shaped plan, round-headed windows, steep shingle roofs and a two-stage octagonal steeple above the western tower.',
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
    'brick_flemish',
    'wood_painted_shingle',
    'wood_painted_lap',
    'stone_limestone',
  ],
  qaCameras: [
    { name: 'south-transept-and-west-steeple', position: [-3, 9, 52], lookAt: [-2.8, 13.3, 4.3] },
    { name: 'north-crossing-and-chancel', position: [30, 23, -44], lookAt: [1, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-church-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.16,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.052, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.022, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The published Qualla photo by Bmrbarre is explicitly dedicated to the public domain. Map geometry attributed to OpenStreetMap contributors under ODbL.',
};
