import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  opening,
  rgb,
  roundArch,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  face,
  floorSampler,
  pairs,
  rect,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { features, points } = read('native-map/tower-hill-native-memorial-parts');
const grade = floorSampler(read('terrain-grid'));
const limestone = rgb('bdb39c');
const light = rgb('cec4ad');
const mortar = rgb('aaa18c');
const shadow = rgb('969082');
const roofStone = rgb('aa9e86');
const bronze = rgb('4e463c');
const bronzePale = rgb('777059');
const dark = rgb('4e4d46');
const wood = rgb('8c7b64');
const green = rgb('8e9b61');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'stone_limestone', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  lawn: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.86, metallic: 0.35 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
};
const wall = features.retainingWall.points;
const courtEdge = [10, 13, 17, 21, 25, 29, 32, 35, 39].map((index) => wall[index]);
const lawnOutline = [
  [-7.7, 10.35],
  [-7.85, 1.5],
  [-7.08, -2.5],
  [-5.4, -5.63],
  [-3, -7.62],
  [0, -8.45],
  [3, -7.68],
  [5.48, -5.7],
  [7.12, -2.55],
  [7.8, 1.42],
  [7.76, 10.35],
];
const pavingOutline = [
  [-9.9, 13.38],
  [-9.82, 1.85],
  [-10.16, -1.1],
  [-9.08, -4.27],
  [-8.16, -5.85],
  [-6.47, -7.96],
  [-4.2, -9.26],
  [-1.02, -10.1],
  [0.92, -9.89],
  [4.07, -9.24],
  [6.58, -8.13],
  [8.1, -6.02],
  [9.1, -4.28],
  [9.84, -1.2],
  [9.7, 13.33],
];
const cutout = pavingOutline.map(([x, z]) => [x * 0.982, z * 0.983]);
const courtFloor = -0.426;
const galleryFloor = 1.09;
const pavilionCenter = 0.35;

function block(out, slot, x0, x1, y0, y1, z0, z1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function layeredDrum(out, slot, x, z, profile, count, color, capEnds = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, count, [x, z])),
    color,
    { cap: capEnds },
  );
}
function archHead(out, F, u, spring, radius, thick, depth, segments, color) {
  const inner = roundArch(radius, segments);
  const outer = roundArch(radius + thick, segments);
  for (let i = 1; i < inner.length; i++) {
    const [a, b] = [inner[i - 1], inner[i]],
      [c, d] = [outer[i - 1], outer[i]];
    const P = ([x, y], offset) => F.P(u + x, spring + y, offset);
    face(out, 'stone', [P(a, 0), P(b, 0), P(d, 0), P(c, 0)], [F.normal[0], 0, F.normal[1]], color);
    const radial = (a[0] + b[0]) / 2;
    const recess = [-radial * F.along[0], -(a[1] + b[1]) / 2, -radial * F.along[1]];
    face(out, 'stone', [P(a, -depth), P(a, 0), P(b, 0), P(b, -depth)], recess, mortar);
  }
}

function buildPavilion(out, level) {
  const left = -9.8,
    right = 10.5,
    north = 27.67,
    south = 34.96,
    centerZ = (north + south) / 2;
  const postY = 4.92;
  block(out, 'paving', left, right, -0.15, 0.55, north, south, mortar);
  block(
    out,
    'stone',
    left + 0.32,
    right - 0.32,
    0.52,
    galleryFloor,
    north + 0.15,
    south - 0.15,
    limestone,
  );
  const stepCount = level === 0 ? 2 : 5;
  for (const sign of [-1, 1]) {
    const outer = sign === -1 ? left : right;
    for (let i = 0; i < stepCount; i++) {
      const inner = outer - sign * 0.42;
      const edge = outer + sign * ((i * 1.32) / stepCount - 0.16);
      const y = galleryFloor - (i * 0.74) / stepCount;
      block(
        out,
        'stone',
        Math.min(inner, edge),
        Math.max(inner, edge),
        0.22,
        y,
        centerZ - 1.54,
        centerZ + 1.54,
        light,
      );
    }
  }
  const sides = [north + 0.3, south - 0.3];
  const pierCenters = [left + 0.72, -2.82, 3.52, right - 0.72];
  for (const z of sides) {
    for (const [i, x] of pierCenters.entries()) {
      const width = i === 0 || i === 3 ? 1.14 : 0.78;
      block(
        out,
        'stone',
        x - width / 2,
        x + width / 2,
        galleryFloor,
        postY,
        z - 0.33,
        z + 0.33,
        limestone,
      );
      if (level >= 2) {
        const side = z < centerZ ? -1 : 1;
        const wallFace = facade([x, z + side * 0.331], [side, 0]);
        opening(out, wallFace, 0, galleryFloor + 0.6, width * 0.58, 2.34, {
          head: 'round',
          glassSlot: 'bronze',
          frameSlot: 'stone',
          glass: shadow,
          frame: mortar,
          frameWidth: 0.081,
          frameDepth: 0.055,
          sill: false,
          d: 0.006,
        });
        for (const [a, b] of pairs([1.28, 2.12, 2.98, 3.86, 4.74])) {
          const inner = facade([x, z - side * 0.335], [-side, 0]);
          fbox(
            out,
            'bronze',
            inner,
            -width * 0.42,
            width * 0.42,
            a,
            b - 0.06,
            0.002,
            0.025,
            bronze,
          );
        }
      }
    }
    for (const x of [-6.97, -4.72, -1.02, 1.7, 5.42, 7.66]) {
      const profile =
        level <= 1
          ? [
              [galleryFloor, 0.28],
              [postY, 0.25],
            ]
          : [
              [galleryFloor, 0.34],
              [galleryFloor + 0.19, 0.34],
              [galleryFloor + 0.22, 0.28],
              [postY - 0.35, 0.22],
              [postY - 0.22, 0.24],
              [postY - 0.12, 0.32],
              [postY, 0.32],
            ];
      layeredDrum(
        out,
        'stone',
        x,
        z,
        profile,
        level === 0 ? 5 : level === 1 ? 8 : level === 2 ? 10 : 14,
        limestone,
        false,
      );
    }
    const sign = z < centerZ ? -1 : 1;
    const cornice =
      level === 0
        ? [[postY, 0.88, 0.27, light]]
        : [
            [postY, 0.14, 0.27, light],
            [postY + 0.14, 0.32, 0.18, limestone],
            [postY + 0.46, 0.15, 0.37, light],
            [postY + 0.61, 0.27, 0.24, roofStone],
          ];
    for (const [lower, h, projection, color] of cornice) {
      const f = facade([0, z], [sign, 0]);
      fbox(
        out,
        'stone',
        f,
        sign === 1 ? left - 0.18 : -right - 0.18,
        sign === 1 ? right + 0.18 : -left + 0.18,
        lower,
        lower + h,
        -0.32,
        projection,
        color,
      );
    }
    if (level >= 2) {
      const n = z < centerZ ? -1 : 1;
      for (let x = left + 0.6; x < right; x += 0.78)
        fbox(
          out,
          'stone',
          facade([x, z], [n, 0]),
          -0.073,
          0.073,
          postY + 0.15,
          postY + 0.43,
          0.181,
          0.206,
          mortar,
        );
    }
  }
  const endDepth = 0.64;
  for (const [x, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    const F = facade([x, centerZ], [0, -sign]);
    const radius = 1.57,
      spring = 3.28,
      uEdge = 3.68;
    for (const [u0, u1] of [
      [-uEdge, -radius],
      [radius, uEdge],
    ])
      fbox(out, 'stone', F, u0, u1, galleryFloor, 5.54, -endDepth, 0, limestone);
    archHead(out, F, 0, spring, radius, 0.24, endDepth, level === 0 ? 5 : 14, light);
    const curve = roundArch(radius + 0.22, level === 0 ? 5 : 14);
    for (let i = 1; i < curve.length; i++) {
      const [a, b] = [curve[i - 1], curve[i]];
      face(
        out,
        'stone',
        [
          F.P(a[0], spring + a[1], -0.007),
          F.P(b[0], spring + b[1], -0.007),
          F.P(b[0], 5.55, -0.007),
          F.P(a[0], 5.55, -0.007),
        ],
        [sign, 0, 0],
        limestone,
      );
    }
    face(
      out,
      'roof',
      [F.P(-3.7, 5.54, 0), F.P(3.7, 5.54, 0), F.P(0, 6.63, 0)],
      [sign, 0, 0],
      roofStone,
    );
    for (const side of [-1, 1])
      beam(out, 'stone', F.P(side * 3.88, 5.57, 0.055), F.P(0, 6.73, 0.055), 0.23, 0.22, light);
    if (level >= 2) {
      for (let u = -1.4; u <= 1.44; u += 0.16)
        fbox(out, 'bronze', F, u, u + 0.029, galleryFloor, 2.67, -0.53, -0.5, dark);
      for (const y of [1.3, 2.59])
        fbox(out, 'bronze', F, -1.43, 1.43, y, y + 0.056, -0.55, -0.473, dark);
    }
  }
  for (const eave of [north - 0.16, south + 0.16]) {
    face(
      out,
      'roof',
      [
        [left - 0.14, 5.57, eave],
        [right + 0.14, 5.57, eave],
        [right + 0.14, 6.63, centerZ],
        [left - 0.14, 6.63, centerZ],
      ],
      up,
      roofStone,
    );
  }
  for (const [w, z, y0, y1] of [
    [8.1, 2.85, 5.44, 6.6],
    [6.31, 2.49, 6.57, 7.12],
    [5.18, 2.21, 7.1, 7.53],
  ])
    block(
      out,
      'roof',
      pavilionCenter - w / 2,
      pavilionCenter + w / 2,
      y0,
      y1,
      centerZ - z,
      centerZ + z,
      limestone,
    );
  layeredDrum(
    out,
    'roof',
    pavilionCenter,
    centerZ,
    [
      [7.51, 2.06],
      [7.87, 2.06],
      [7.99, 2.14],
      [8.1, 2.04],
      [8.16, 1.65],
    ],
    level === 0 ? 12 : 24,
    roofStone,
  );
  if (level >= 2) {
    for (let x = left + 0.84, i = 0; x < right - 0.9; x += 0.54, i++)
      for (let z = north + 0.83, j = 0; z < south - 0.7; z += 0.54, j++)
        face(
          out,
          'paving',
          [
            [x, galleryFloor + 0.015, z],
            [x + 0.539, galleryFloor + 0.015, z],
            [x + 0.539, galleryFloor + 0.015, z + 0.539],
            [x, galleryFloor + 0.015, z + 0.539],
          ],
          up,
          (i + j) % 2 ? light : dark,
        );
  }
}

function gardenWall(out, level) {
  const path =
    level === 0
      ? [wall[0], wall[6], ...courtEdge, wall[43], ...features.westApproachWall.points.slice(1)]
      : [...wall, ...features.westApproachWall.points.slice(1)];
  for (const [index, [a, b]] of pairs(path).entries()) {
    const F = facade(b, [a[0] - b[0], a[1] - b[1]]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const approach = a[1] > 14.9 && b[1] > 14.9;
    const yBase = approach ? Math.min(grade(a), grade(b)) - 0.23 : courtFloor - 0.19;
    const yTop = approach
      ? Math.min(1.64, Math.max(grade(a), grade(b)) + 0.48)
      : courtFloor + 2.438;
    if (level === 0) {
      const { P, normal } = F;
      const inside = [normal[0], 0, normal[1]];
      const outside = inside.map((n) => -n);
      face(
        out,
        'stone',
        [P(0, yBase, 0.12), P(len, yBase, 0.12), P(len, yTop, 0.12), P(0, yTop, 0.12)],
        inside,
        limestone,
      );
      face(
        out,
        'stone',
        [P(0, yBase, -0.44), P(len, yBase, -0.44), P(len, yTop, -0.44), P(0, yTop, -0.44)],
        outside,
        limestone,
      );
      face(
        out,
        'stone',
        [P(0, yTop, -0.44), P(len, yTop, -0.44), P(len, yTop, 0.12), P(0, yTop, 0.12)],
        up,
        light,
      );
    } else {
      fbox(out, 'stone', F, -0.025, len + 0.025, yBase, yTop - 0.16, -0.44, 0.12, limestone);
      fbox(out, 'stone', F, -0.025, len + 0.025, yTop - 0.16, yTop, -0.5, 0.18, light);
    }
    if (approach) continue;
    const panelStart = courtFloor + 0.23,
      panelTop = yTop - 0.25;
    const courseCount = level <= 1 ? 1 : Math.ceil(len / 0.72);
    const panel = (u, v, low, high, offset, color) =>
      face(
        out,
        'bronze',
        [F.P(u, low, offset), F.P(v, low, offset), F.P(v, high, offset), F.P(u, high, offset)],
        [F.normal[0], 0, F.normal[1]],
        color,
      );
    for (let j = 0; j < courseCount; j++) {
      const u = (j * len) / courseCount + 0.025,
        v = ((j + 1) * len) / courseCount - 0.025;
      if (v <= u) continue;
      const shade = (index + j) % 4 === 0 ? bronzePale : bronze;
      panel(u, v, panelStart, panelTop, 0.124, shade);
      if (level >= 2 && v - u > 0.15)
        for (let y = panelStart + 0.19; y < panelTop - 0.07; y += level === 2 ? 0.32 : 0.138)
          panel(u + 0.059, v - 0.059, y, y + 0.014, 0.131, bronzePale);
    }
  }
}
function stair(out, x0, x1, z0, z1, low, high, count) {
  for (let i = 0; i < count; i++) {
    const y = low + ((high - low) * (i + 1)) / count;
    block(
      out,
      'stone',
      x0,
      x1,
      low - 0.3,
      y,
      z0 + ((z1 - z0) * i) / count,
      z1,
      i === count - 1 ? light : limestone,
    );
  }
}
function bench(out, x, z) {
  const f = facade([x, z], [1, 0]);
  for (const s of [-1, 1]) {
    fbox(out, 'wood', f, s * 0.82 - 0.045, s * 0.82 + 0.045, 0.36, 0.94, -0.29, 0.26, wood);
    beam(
      out,
      'wood',
      [x + s * 0.82, 0.53, z - 0.2],
      [x + s * 0.82, 1.37, z - 0.25],
      0.086,
      0.065,
      wood,
    );
  }
  for (const dd of [-0.21, -0.08, 0.05, 0.18])
    fbox(out, 'wood', f, -0.9, 0.9, 0.79, 0.84, dd, dd + 0.105, wood);
  for (const y of [0.99, 1.14, 1.29])
    fbox(out, 'wood', f, -0.88, 0.88, y, y + 0.106, -0.3, -0.25, wood);
}
function buildGarden(out, level) {
  cap(out, 'paving', pavingOutline, courtFloor, mortar);
  cap(out, 'lawn', lawnOutline, courtFloor + 0.012, green);
  cap(out, 'paving', rect(-9.94, 14.25, 9.86, 26.94), 0.47, mortar);
  gardenWall(out, level);
  if (level >= 1)
    for (const s of [-1, 1]) {
      const l = s === -1 ? -9.89 : 7.42,
        r = s === -1 ? -7.57 : 9.79;
      stair(out, l, r, 11.51, 15.41, courtFloor, 0.474, 7);
      bench(out, s * 4.3, 14.69);
    }
  else
    for (const [l, r] of [
      [-9.88, -7.51],
      [7.49, 9.86],
    ])
      stair(out, l, r, 11.51, 15.41, courtFloor, 0.474, 3);
  block(out, 'stone', -6.35, 6.24, 0.28, 1.36, 13.43, 14.11, limestone);
  block(out, 'stone', -6.48, 6.37, 1.36, 1.51, 13.31, 14.22, light);
  block(out, 'stone', -2.49, 2.43, 0.46, 1.63, 13.67, 14.27, limestone);
  block(out, 'stone', -2.55, 2.52, 1.63, 1.76, 13.6, 14.31, light);
  block(out, 'stone', -2.03, 1.98, 0.43, 0.64, 19.6, 21.69, limestone);
  block(out, 'stone', -1.64, 1.57, 0.64, 0.86, 19.83, 21.47, light);
  block(out, 'stone', -1.42, 1.36, 0.86, 1.55, 20.02, 21.31, limestone);
  block(out, 'stone', -1.49, 1.43, 1.55, 1.67, 19.97, 21.38, light);
  for (const [key, post] of [
    ['westPlinth', 'westPylon'],
    ['eastPlinth', 'eastPylon'],
  ]) {
    const [x, z] = points[key].point,
      outline = features[post].points.slice(0, -1);
    const xs = outline.map(([x]) => x),
      zs = outline.map(([, z]) => z);
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs) - 0.17;
    block(out, 'stone', x0 - 0.1, x1 + 0.1, 0.35, 0.55, z0 - 0.11, z1 + 0.13, shadow);
    block(out, 'stone', x0, x1, 0.55, 4.55, z0, z1, limestone);
    block(out, 'stone', x0 - 0.028, x1 + 0.028, 4.55, 4.69, z0 - 0.03, z1 + 0.03, light);
    block(out, 'stone', x - 0.36, x + 0.36, 0.5, 0.94, z - 0.22, z + 0.32, limestone);
    if (level >= 1) {
      for (const y of [1.15, 1.69, 2.23, 2.77, 3.31, 3.85, 4.38])
        block(out, 'stone', x0 + 0.02, x1 - 0.02, y, y + 0.019, z1, z1 + 0.012, mortar);
      // Broad relief mass on the surviving plinth, with an original simplified silhouette.
      loft(
        out,
        'stone',
        [
          [0.94, 0.3, 0.23],
          [1.71, 0.29, 0.22],
          [2.17, 0.35, 0.23],
          [2.56, 0.18, 0.15],
          [2.76, 0.14, 0.14],
          [2.89, 0.114, 0.118],
        ].map(([y, xr, zr]) => radialRing(y, xr, zr, level === 1 ? 6 : 8, [x, z + 0.1])),
        light,
      );
    }
  }
  layeredDrum(
    out,
    'stone',
    0,
    0,
    [
      [courtFloor, 0.98],
      [courtFloor + 0.07, 0.98],
      [courtFloor + 0.09, 0.91],
    ],
    level === 0 ? 6 : 24,
    light,
  );
  layeredDrum(
    out,
    'bronze',
    0,
    0,
    [
      [courtFloor + 0.08, 0.87],
      [courtFloor + 0.112, 0.87],
    ],
    level === 0 ? 6 : 24,
    bronze,
  );
  if (level >= 1)
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16,
        s = Math.sin(a),
        c = Math.cos(a),
        r = i % 2 ? 0.55 : 0.71,
        y = courtFloor + 0.119;
      face(
        out,
        'bronze',
        [
          [s * 0.11 + c * 0.022, y, c * 0.11 - s * 0.022],
          [s * r, y, c * r],
          [s * 0.11 - c * 0.022, y, c * 0.11 + s * 0.022],
        ],
        up,
        bronzePale,
      );
    }
}
function build(out, level) {
  buildPavilion(out, level);
  buildGarden(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'tower-hill-memorial-model.mjs';
const camera = [35, 24, 55],
  lookAt = [0, 2.5, 13];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'memorial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Lutyens’s Portland stone Merchant Navy pavilion and Maufe’s adjoining sunken bronze memorial garden at Tower Hill.',
  camera,
  lookAt,
  sunDirection: [-31, 48, 47],
  mediumFiContext: {
    scale: 2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: cutout,
    minHeight: -0.53,
    basis:
      'Restricted to the documented depression within the north memorial’s surveyed inner retaining wall.',
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'pavilion-and-sunken-court', position: camera, lookAt },
    { name: 'curved-bronze-garden-and-pylons', position: [13, 11, -15], lookAt: [0, 1, 6] },
    { name: 'portland-stone-doric-pavilion', position: [16, 7, 42], lookAt: [1.5, 3.79, 31] },
    {
      name: 'paired-pylons-and-stone-of-remembrance',
      position: [10.2, 3.7, 21.2],
      lookAt: [0.7, 1.9, 13.8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tower-hill-memorial-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.46,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.047, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry from exact public-domain photography, ODbL mapped construction and Environment Agency open lidar.',
};
