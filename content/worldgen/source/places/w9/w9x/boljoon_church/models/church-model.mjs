/** Patrocinio de Maria, November 2021. Exterior from the mapped plan and museum text. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  poly as meshPolygon,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const outline = read('map-frame').geometry.polygons[0];
const { nave, convent, belfry, foundationBottom, threshold } = plan.section;

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.11 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    stone: 'd4c8b0',
    trim: 'e0d5bd',
    metal: '80584d',
    tile: 'a56850',
    timber: '6d5344',
    siding: '8d7761',
    dark: '454035',
    plinth: 'b9ad94',
    sill: 'cec2a7',
  }).map(([key, value]) => [key, rgb(value)]),
);
const B = (out, slot, x, y, z, w, h, d, color = palette[slot]) =>
  box(out, slot, x, y, z, w, h, d, color);
function block(out, slot, [x0, x1, z0, z1], y0, y1, color = palette[slot]) {
  B(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
}
function face(out, slot, points, direction, color = palette[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, v, i) => dot + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function poly(out, slot, ring, bottom, top, color) {
  const builder = new MeshBufferBuilder();
  meshPolygon(builder, slot, ring, bottom, top, color);
  const { indices, normals, positions } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, slot, points, normal, color);
  }
}
function pitchedRoof(out, slot, bounds, eaves, rise, hip = 0, breakSlope) {
  const [left, right, back, front] = bounds;
  const mid = (left + right) / 2;
  const y = eaves + rise;
  if (breakSlope) {
    const { lowerRun, lowerRise } = breakSlope;
    for (const [outer, inner] of [
      [left, left + lowerRun],
      [right, right - lowerRun],
    ]) {
      face(
        out,
        slot,
        [
          [outer, eaves, back],
          [outer, eaves, front],
          [inner, eaves + lowerRise, front],
          [inner, eaves + lowerRise, back],
        ],
        [0, 1, 0],
      );
      face(
        out,
        slot,
        [
          [inner, eaves + lowerRise, back],
          [inner, eaves + lowerRise, front],
          [mid, y, front],
          [mid, y, back],
        ],
        [0, 1, 0],
      );
    }
    for (const [z, sign] of [
      [back, -1],
      [front, 1],
    ]) {
      const profile = [
        [left, eaves],
        [left + lowerRun, eaves + lowerRise],
        [mid, y],
        [right - lowerRun, eaves + lowerRise],
        [right, eaves],
      ];
      for (let i = 0; i < profile.length - 1; i++) {
        const [a, b] = [profile[i], profile[i + 1]];
        if (a[1] === eaves)
          face(
            out,
            'stone',
            [
              [a[0], eaves, z],
              [b[0], eaves, z],
              [...b, z],
            ],
            [0, 0, sign],
          );
        else if (b[1] === eaves)
          face(
            out,
            'stone',
            [
              [a[0], eaves, z],
              [b[0], eaves, z],
              [...a, z],
            ],
            [0, 0, sign],
          );
        else
          face(
            out,
            'stone',
            [
              [a[0], eaves, z],
              [b[0], eaves, z],
              [...b, z],
              [...a, z],
            ],
            [0, 0, sign],
          );
      }
    }
    return;
  }
  const ridgeBack = [mid, y, back + hip];
  const ridgeFront = [mid, y, front - hip];
  for (const edge of [left, right])
    face(out, slot, [[edge, eaves, back], [edge, eaves, front], ridgeFront, ridgeBack], [0, 1, 0]);
  for (const [z, sign, peak] of [
    [back, -1, ridgeBack],
    [front, 1, ridgeFront],
  ])
    face(
      out,
      hip ? slot : 'stone',
      [[left, eaves, z], [right, eaves, z], peak],
      hip ? [0, 1, 0] : [0, 0, sign],
    );
}
function frontFace(out, slot, z, x0, x1, y0, y1, color = palette[slot]) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
    color,
  );
}
function archProfile(x, spring, r, rise, steps) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = Math.PI * (1 - index / steps);
    return [x + Math.cos(angle) * r, spring + Math.sin(angle) * rise];
  });
}
function archInset(out, x, bottom, spring, radius, z, depth, top, steps) {
  const profile = archProfile(x, spring, radius, radius, steps);
  frontFace(out, 'timber', z - depth, x - radius, x + radius, bottom, spring, palette.dark);
  for (let i = 0; i < steps; i++) {
    const [a, b] = [profile[i], profile[i + 1]];
    face(
      out,
      'timber',
      [
        [x, spring, z - depth],
        [...a, z - depth],
        [...b, z - depth],
      ],
      [0, 0, 1],
      palette.dark,
    );
    face(
      out,
      'stone',
      [
        [...a, z],
        [...b, z],
        [...b, z - depth],
        [...a, z - depth],
      ],
      [0, -1, 0],
    );
    face(
      out,
      'stone',
      [
        [...a, z],
        [...b, z],
        [b[0], top, z],
        [a[0], top, z],
      ],
      [0, 0, 1],
    );
  }
  const trim = archProfile(x, spring, radius + 0.3, radius + 0.3, steps);
  for (let i = 0; i < steps; i++)
    face(
      out,
      'trim',
      [
        [...profile[i], z + 0.035],
        [...profile[i + 1], z + 0.035],
        [...trim[i + 1], z + 0.035],
        [...trim[i], z + 0.035],
      ],
      [0, 0, 1],
    );
  for (const side of [-1, 1]) {
    const edge = x + side * radius;
    const [a, b] = [edge, edge + side * 0.3].sort((u, v) => u - v);
    frontFace(out, 'trim', z + 0.035, a, b, bottom, spring);
    face(
      out,
      'stone',
      [
        [edge, bottom, z],
        [edge, spring, z],
        [edge, spring, z - depth],
        [edge, bottom, z - depth],
      ],
      [-side, 0, 0],
    );
  }
}
function shrine(out, x, y, z, lod) {
  const shape = [
    [-0.8, 0],
    [0.8, 0],
    [0.8, 1.05],
    [1.0, 1.33],
    [0.86, 1.65],
    [0.6, 1.77],
    [0.37, 1.74],
    [0.39, 2.0],
    [0.26, 2.25],
    [0, 2.36],
    [-0.26, 2.25],
    [-0.39, 2.0],
    [-0.37, 1.74],
    [-0.6, 1.77],
    [-0.86, 1.65],
    [-1.0, 1.33],
    [-0.8, 1.05],
  ];
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    const place = ([dx, dy], scale, layer) => [
      x + dx * scale,
      y + 1.05 + (dy - 1.05) * scale,
      layer,
    ];
    face(
      out,
      'timber',
      [[x, y + 1.05, z + 0.025], place(a, 1, z + 0.025), place(b, 1, z + 0.025)],
      [0, 0, 1],
      palette.dark,
    );
    face(
      out,
      'trim',
      [
        place(a, 1, z + 0.055),
        place(b, 1, z + 0.055),
        place(b, 1.19, z + 0.055),
        place(a, 1.19, z + 0.055),
      ],
      [0, 0, 1],
    );
  }
  B(out, 'trim', x, y - 0.18, z + 0.12, 2.36, 0.22, 0.5);
  if (lod < 2) return;
  poly(
    out,
    'trim',
    [
      [x - 0.3, z + 0.07],
      [x + 0.3, z + 0.07],
      [x + 0.23, z + 0.31],
      [x - 0.23, z + 0.31],
    ],
    y + 0.03,
    y + 1.28,
    palette.trim,
  );
  B(out, 'trim', x, y + 1.28, z + 0.22, 0.32, 0.33, 0.33);
}
function church(out, lod) {
  const [x0, x1, z0, z1] = nave.bounds;
  const mid = (x0 + x1) / 2;
  const eaves = nave.eaves;
  const roof = [x0 - 0.62, x1 + 0.62, z0 - 0.45, z1 - 0.22];
  const lowerRun = nave.lowerSlopeRun;
  const lowerRise = lowerRun * Math.tan((nave.lowerSlopeDegrees * Math.PI) / 180);
  const upperRun = (roof[1] - roof[0]) / 2 - lowerRun;
  const rise = lowerRise + upperRun * Math.tan((nave.upperSlopeDegrees * Math.PI) / 180);
  block(out, 'stone', [x0, x1, z0, z1 - 0.85], threshold, eaves);
  block(out, 'stone', [x1 - 0.07, 25.5, z0, -12.43], threshold, eaves - 3.0);
  pitchedRoof(out, 'metal', [x1 - 0.18, 25.78, z0 - 0.22, -12.24], eaves - 3.0, 1.55, 1.85);
  pitchedRoof(out, 'metal', roof, eaves, rise, 0, { lowerRun, lowerRise });
  const [lowerBand, upperBand] = [threshold + 5.3, eaves + 0.03];
  const radius = 1.57;
  block(out, 'stone', [x0, mid - radius, z1 - 0.85, z1], threshold, eaves);
  block(out, 'stone', [mid + radius, x1, z1 - 0.85, z1], threshold, eaves);
  frontFace(out, 'stone', z1, mid - radius, mid + radius, lowerBand, eaves);
  archInset(
    out,
    mid,
    threshold,
    threshold + 2.75,
    radius,
    z1,
    0.69,
    lowerBand,
    [8, 12, 16, 24][lod],
  );
  if (lod === 3) {
    for (let i = -4; i <= 4; i++) {
      const x = mid + i * 0.31;
      frontFace(
        out,
        'timber',
        z1 - 0.66,
        x - 0.012,
        x + 0.012,
        threshold,
        threshold + 2.73,
        palette.timber,
      );
    }
    B(
      out,
      'metal',
      mid,
      eaves + rise - 0.03,
      (roof[2] + roof[3]) / 2,
      0.26,
      0.12,
      roof[3] - roof[2],
    );
  }
  const gable = [
    [x0 - 0.16, eaves, z1],
    [x1 + 0.16, eaves, z1],
    [mid, eaves + rise + 0.48, z1],
  ];
  face(out, 'stone', gable, [0, 0, 1]);
  for (const x of [x0 - 0.2, x1 + 0.2])
    beam(
      out,
      'trim',
      [x, eaves + 0.16, z1 + 0.15],
      [mid, eaves + rise + 0.62, z1 + 0.15],
      0.33,
      0.44,
      palette.trim,
    );
  for (const y of [threshold + 0.2, lowerBand, upperBand])
    B(out, 'trim', mid, y, z1 + 0.04, x1 - x0 + 0.55, y === lowerBand ? 0.37 : 0.31, 0.48);
  for (const x of [x0 + 0.55, mid - 4.38, mid + 4.38, x1 - 0.55]) {
    for (const [y, top, width] of [
      [threshold + 0.5, lowerBand, 0.84],
      [lowerBand + 0.39, eaves, 0.72],
    ]) {
      B(out, 'trim', x, y, z1 + 0.07, width, top - y, 0.51);
      if (lod)
        for (const h of [y, top - 0.22]) B(out, 'trim', x, h, z1 + 0.14, width + 0.32, 0.25, 0.61);
    }
  }
  if (lod) shrine(out, mid, lowerBand + 0.98, z1, lod);
  else
    frontFace(
      out,
      'timber',
      z1 + 0.05,
      mid - 0.72,
      mid + 0.72,
      lowerBand + 1.0,
      lowerBand + 3.1,
      palette.dark,
    );
  const emblem = eaves + rise * 0.32;
  if (lod >= 2) {
    // Simplified Augustinian emblem on the documented apex field.
    B(out, 'trim', mid, emblem - 0.21, z1 + 0.09, 1.18, 0.19, 0.27, palette.sill);
    face(
      out,
      'trim',
      [
        [mid - 0.53, emblem, z1 + 0.28],
        [mid, emblem - 0.4, z1 + 0.28],
        [mid + 0.53, emblem, z1 + 0.28],
        [mid, emblem + 0.34, z1 + 0.28],
      ],
      [0, 0, 1],
      palette.sill,
    );
  }
  B(out, 'trim', mid, eaves + rise + 0.43, z1 + 0.07, 0.19, 1.51, 0.24);
  B(out, 'trim', mid, eaves + rise + 1.41, z1 + 0.07, 0.88, 0.18, 0.24);
  for (const z of [-6.6, 4.1, 15.7, 25.8]) {
    // Upper shoulder is narrower than the lower pier.
    B(out, 'stone', x1 + 0.32, -1.96, z, 1.28, eaves * 0.53 + 1.96, 2.45, palette.sill);
    poly(
      out,
      'stone',
      [
        [x1 - 0.3, z - 0.83],
        [x1 + 0.57, z - 0.83],
        [x1 + 0.57, z + 0.83],
        [x1 - 0.3, z + 0.83],
      ],
      eaves * 0.53,
      eaves * 0.77,
      palette.sill,
    );
  }
  if (lod >= 1)
    for (const z of [-2.0, 9.8, 20.7]) {
      B(out, 'trim', x1 + 0.05, 5.76, z, 0.27, 2.58, 1.47);
      B(out, 'timber', x1 + 0.22, 5.99, z, 0.16, 2.1, 1.1, palette.dark);
      if (lod >= 2) B(out, 'timber', x1 + 0.32, 5.99, z, 0.09, 2.1, 0.11);
    }
  for (let i = 0; i < 3; i++)
    B(
      out,
      'trim',
      mid,
      -0.45,
      z1 + 0.31 + i * 0.27,
      4.28,
      threshold + 0.39 - i * 0.15,
      0.72,
      palette.sill,
    );
}
function conventRanges(out, lod) {
  const [side, cross] = convent.bounds;
  for (const [bounds, hip] of [
    [side, 4.8],
    [cross, 3.9],
  ]) {
    block(out, 'stone', bounds, threshold, convent.floor);
    block(out, 'timber', bounds, convent.floor, convent.eaves, palette.siding);
    pitchedRoof(
      out,
      'tile',
      [bounds[0] - 0.43, bounds[1] + 0.43, bounds[2] - 0.42, bounds[3] + 0.42],
      convent.eaves,
      convent.roofRise,
      hip,
    );
  }
  const [x0, , , z1] = side;
  B(
    out,
    'trim',
    (x0 + cross[1]) / 2,
    convent.floor - 0.16,
    z1 + 0.05,
    cross[1] - x0,
    0.23,
    0.27,
    palette.sill,
  );
  if (!lod) return;
  for (const x of [-27.2, -23.5, -19.7, -13.7, -9.8, -5.4, -1.0, 2.75]) {
    B(out, 'trim', x, convent.floor + 0.63, z1 + 0.015, 2.02, 1.96, 0.14);
    B(out, 'timber', x, convent.floor + 0.78, z1 + 0.13, 1.7, 1.64, 0.12, palette.dark);
    if (lod >= 2)
      for (const dx of [-0.42, 0, 0.42])
        B(out, 'timber', x + dx, convent.floor + 0.78, z1 + 0.22, 0.08, 1.64, 0.09);
  }
  for (const z of [-10.2, -2.4, 5.6, 13.8, 21.8, 29.0]) {
    B(out, 'trim', x0 - 0.04, convent.floor + 0.67, z, 0.19, 1.88, 1.84);
    B(out, 'timber', x0 - 0.18, convent.floor + 0.82, z, 0.16, 1.58, 1.54, palette.dark);
  }
  if (lod >= 2)
    for (let y = convent.floor + 0.33; y < convent.eaves - 0.21; y += 0.27) {
      B(
        out,
        'timber',
        (x0 + cross[1]) / 2,
        y,
        z1 + 0.016,
        cross[1] - x0,
        0.038,
        0.065,
        palette.timber,
      );
      B(
        out,
        'timber',
        x0 - 0.016,
        y,
        (side[2] + z1) / 2,
        0.065,
        0.038,
        z1 - side[2],
        palette.timber,
      );
    }
}
function bellTower(out, lod) {
  const {
    center: [x, z],
    width: w,
    depth: d,
    base,
    lowerTop,
    upperFloor,
    roofEaves,
    roofTop,
  } = belfry;
  const hw = w / 2,
    hd = d / 2;
  const tower = [x - hw, x + hw, z - hd, z + hd];
  block(out, 'stone', tower, base, lowerTop);
  block(out, 'stone', [x - hw, x + hw, z - hd, z + hd], lowerTop, upperFloor);
  for (const y of [lowerTop - 0.24, upperFloor - 0.24])
    B(out, 'trim', x, y, z, w + 0.42, 0.3, d + 0.42, palette.sill);
  for (const dx of [-1, 1])
    for (const dz of [-1, 1])
      B(
        out,
        'stone',
        x + dx * (hw - 0.59),
        upperFloor,
        z + dz * (hd - 0.59),
        1.18,
        roofEaves - upperFloor,
        1.18,
      );
  B(out, 'stone', x, roofEaves - 0.46, z, w, 0.46, d);
  pitchedRoof(
    out,
    'tile',
    [x - hw - 0.54, x + hw + 0.54, z - hd - 0.54, z + hd + 0.54],
    roofEaves,
    roofTop - roofEaves,
    Math.min(hw, hd) * 0.78,
  );
  B(out, 'timber', x, roofEaves - 0.8, z, w - 1.63, 0.23, 0.29);
  if (lod) {
    const ring = (radius) =>
      Array.from({ length: 8 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 8;
        return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
      });
    poly(out, 'timber', ring(0.39), roofEaves - 1.3, roofEaves - 0.71, palette.dark);
    poly(out, 'timber', ring(0.64), roofEaves - 1.51, roofEaves - 1.29, palette.dark);
  }
  if (lod)
    for (const sign of [-1, 1]) {
      B(out, 'timber', x, upperFloor + 0.45, z + sign * hd, w - 2.15, 0.2, 0.19);
      B(out, 'timber', x + sign * hw, upperFloor + 0.45, z, 0.19, 0.2, d - 2.15);
    }
}
function build(out, _frame, lod = 3) {
  poly(out, 'stone', outline, foundationBottom, threshold, palette.plinth);
  church(out, lod);
  conventRanges(out, lod);
  bellTower(out, lod);
}
export const churchSkyline = (out) => build(out, undefined, 0);
export const churchDistrict = (out) => build(out, undefined, 1);
export const churchStreet = (out) => build(out, undefined, 2);
export const churchCloseup = (out) => build(out, undefined, 3);

const recipe = 'church-model.mjs';
const camera = [67, 29, 78];
const lookAt = [0, 8.6, 0];
export const churchModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Boljoon coral-stone church, pedimented east entrance, buttressed nave, tiled convent and north belfry.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Named original mapped church and attached convent.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_raw',
    'metal_corrugated',
    'tile_ceramic',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'east-facade-and-belfry', position: [13, 10, 71], lookAt: [9, 8.2, 31] },
    { name: 'coral-buttresses-and-roof-break', position: [60, 16, -4], lookAt: [17, 9.0, 1] },
    { name: 'tiled-convent-and-rear-nave', position: [-64, 24, -39], lookAt: [-6, 7.2, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-boljoon-church-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'churchSkyline',
    errorMeters: 0.38,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'churchDistrict', 0.18],
        ['street', 'churchStreet', 0.082],
        ['closeup', 'churchCloseup', 0.028],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap contributors supply the mapped envelope under ODbL. Architectural facts are from National Museum text and numeric records.',
};
