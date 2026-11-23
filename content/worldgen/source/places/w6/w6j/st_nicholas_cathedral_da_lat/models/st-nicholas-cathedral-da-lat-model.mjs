import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, towerTop } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
};
const plaster = rgb('c39c6d');
const cream = rgb('dfccaa');
const basalt = rgb('5b574e');
const terra = rgb('a16a52');
const zinc = rgb('899ca1');
const glass = rgb('444a47');
const vent = rgb('575650');
const gold = rgb('a78c54');
const front = (x, z) => facade([x, z], [-1, 0]);
const east = (x, z) => facade([x, z], [0, -1]);
const west = (x, z) => facade([x, z], [0, 1]);

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function arch(out, F, u, y, w, h, lod, { color = glass, d = 0.037, kind = 'round' } = {}) {
  opening(out, F, u, y, w, h, {
    frameSlot: 'trim',
    glassSlot: 'glass',
    frame: cream,
    glass: color,
    d,
    frameDepth: 0.14,
    frameWidth: lod > 1 ? 0.15 : 0,
    sill: lod > 1,
    head: kind,
    mullions: lod === 3 && color === glass ? 1 : 0,
    transoms: lod === 3 && color === glass ? 1 : 0,
  });
}
function stringer(out, F, lo, hi, y, depth = 0.15) {
  fbox(out, 'trim', F, lo, hi, y - 0.17, y, 0, depth, cream);
}
function pilaster(out, F, u, bottom, top, width, lod) {
  fbox(out, 'trim', F, u - width / 2, u + width / 2, bottom, top, 0.025, 0.19, cream);
  if (lod > 1) {
    fbox(
      out,
      'trim',
      F,
      u - width * 0.69,
      u + width * 0.69,
      top - 0.32,
      top + 0.05,
      0.02,
      0.29,
      cream,
    );
    fbox(
      out,
      'trim',
      F,
      u - width * 0.64,
      u + width * 0.64,
      bottom,
      bottom + 0.27,
      0.02,
      0.25,
      cream,
    );
  }
}

function roofPitch(out, F, lo, hi, y, xDepth, ridge) {
  quad4(
    out,
    'tile',
    F.P(lo, y, 0),
    F.P(hi, y, 0),
    F.P(hi, ridge, xDepth),
    F.P(lo, ridge, xDepth),
    terra,
  );
}

function nave(out, lod) {
  block(out, 'wall', -5.56, 5.72, -22.86, 11.18, floor, 17.34, plaster);
  gableRoof(out, 'tile', [0.08, -23.05], [0.08, 12.24], 11.28, 17.34, 22.27, terra, {
    overhang: 0.37,
    endSlot: 'wall',
    endColor: plaster,
  });
  for (const [outside, inside, spacing] of [
    [east(8.12, -10.12), east(5.72, -10.12), 1],
    [west(-7.85, -10.12), west(-5.56, -10.12), -1],
  ]) {
    fbox(out, 'wall', outside, -12.44, 12.44, floor, 9.13, -3.34, 0, plaster);
    fbox(out, 'base', outside, -12.44, 12.44, floor, 1.6, 0, 0.16, basalt);
    roofPitch(out, outside, -12.53, 12.53, 9.15, -3.34, 11.65);
    for (const F of [outside, inside])
      stringer(out, F, -12.43, 12.43, F === outside ? 8.92 : 17.16);
    for (let i = 0; i < 6; i++) {
      const u = spacing * (-10.58 + i * 4.17);
      if (lod === 0 && i % 2 === 0) continue;
      arch(out, outside, u, 2.36, 1.55, 5.35, lod);
      if (lod < 2) arch(out, inside, u, 12.46, 1.48, 3.42, lod);
      else
        for (const offset of [-0.57, 0.57]) arch(out, inside, u + offset, 12.46, 0.79, 3.41, lod);
      if (lod > 0) {
        pilaster(out, outside, u + spacing * 1.93, 1.64, 8.83, 0.3, lod);
        pilaster(out, inside, u + spacing * 1.95, 11.3, 16.85, 0.29, lod);
      }
    }
  }
  for (const sign of [-1, 1]) {
    const [lo, hi] = sign < 0 ? [-15.72, -5.42] : [5.5, 15.8];
    const edge = sign < 0 ? lo : hi;
    block(out, 'wall', lo, hi, 3.79, 10.77, floor, 13.4, plaster);
    gableRoof(out, 'tile', [lo, 7.2], [hi, 7.2], 6.94, 13.4, 16.76, terra, {
      overhang: 0.27,
      endSlot: 'wall',
      endColor: plaster,
    });
    const F = sign < 0 ? west(edge, 7.2) : east(edge, 7.2);
    if (lod > 0) stringer(out, F, -3.45, 3.47, 13.42);
    arch(out, F, 0, 3.28, 2.65, 7.85, lod);
    if (lod > 0) for (const u of [-2.89, 2.89]) pilaster(out, F, u, 2.4, 12.71, 0.48, lod);
  }
}

function sanctuary(out, lod) {
  const contour = outwardRing([
    [-12.52, 10.7],
    [12.69, 10.6],
    [12.79, 19.41],
    [4.437, 27.202],
    [-3.779, 27.354],
    [-12.529, 19.909],
  ]);
  extrude(out, 'wall', contour, floor, 11.5, plaster, { top: false });
  extrude(out, 'base', contour, floor, 1.58, basalt, { top: false });
  const crest = [0.18, 15.78, 17.89];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    const F = wallFace(a, b);
    tri(out, 'tile', F.P(-0.12, 11.56, 0.26), F.P(F.length + 0.12, 11.56, 0.26), crest, terra);
    stringer(out, F, 0, F.length, 11.43, 0.23);
    if (F.normal[1] < -0.8) continue;
    arch(out, F, F.length / 2, 2.9, F.length > 8 ? 2.45 : 2.16, 7.12, lod);
    if (lod > 0)
      for (const u of [0.36, F.length - 0.35]) pilaster(out, F, u, 1.65, 11.14, 0.37, lod);
  }
  const drum = outwardRing([
    [-5.5, 10.41],
    [5.7, 10.41],
    [5.7, 18.21],
    [2.86, 22.4],
    [-2.75, 22.4],
    [-5.5, 18.21],
  ]);
  extrude(out, 'wall', drum, 11.15, 17.12, plaster, { top: false });
  for (let i = 0; i < drum.length; i++) {
    const a = drum[i],
      b = drum[(i + 1) % drum.length];
    const F = wallFace(a, b);
    tri(out, 'tile', F.P(0, 17.16, 0.15), F.P(F.length, 17.16, 0.15), [0.12, 21.19, 14.95], terra);
    if (i !== drum.length - 1) arch(out, F, F.length / 2, 13.63, 1.1, 2.69, lod);
  }
}

function turret(out, x, z, lod) {
  const n = lod < 2 ? 8 : 12,
    y = 22.24,
    radius = 1.91;
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n);
  const ring = outwardRing(angles.map((a) => [x + Math.cos(a) * radius, z + Math.sin(a) * radius]));
  extrude(out, 'wall', ring, floor, y, plaster, { top: false });
  const levels = [
    [0, radius + 0.17],
    [1.18, radius * 0.8],
    [2.56, radius * 0.48],
    [4.21, 0.08],
  ];
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    const point = (p, [height, r]) => [
      x + ((p[0] - x) * r) / radius,
      y + height,
      z + ((p[1] - z) * r) / radius,
    ];
    for (let j = 0; j < levels.length - 1; j++) {
      const l = levels[j],
        h = levels[j + 1];
      quad4(out, 'metal', point(a, l), point(b, l), point(b, h), point(a, h), zinc);
    }
    const F = wallFace(a, b);
    if (lod > 0 && i % 2 === 0) {
      arch(out, F, F.length / 2, 18.18, 0.48, 2.38, lod);
      stringer(out, F, 0, F.length, 21.77, 0.18);
    }
  }
}

function tower(out, lod) {
  const x = -0.29,
    z = -26.35,
    r = 4.09,
    ledge = 34.92;
  block(out, 'wall', x - r, x + r, z - 3.78, z + 3.78, floor, ledge, plaster);
  const fs = [
    [front(x, z - 3.78), r],
    [east(x + r, z), 3.78],
    [facade([x, z + 3.78], [1, 0]), r],
    [west(x - r, z), 3.78],
  ];
  for (let side = 0; side < fs.length; side++) {
    const [F, halfw] = fs[side];
    for (const y of lod > 0 ? [7.8, 26.72, 33.99, 34.72] : [26.72, 34.72])
      stringer(out, F, -halfw - 0.14, halfw + 0.14, y, y > 33 ? 0.46 : 0.2);
    if (side === 0) {
      arch(out, F, 0, 0.69, 3.17, 5.91, lod, { color: vent });
      if (lod > 0) {
        fbox(out, 'trim', F, -1.83, 1.83, 6.74, 7.05, 0.03, 0.24, cream);
        for (const s of [-1, 1]) {
          fbox(out, 'trim', F, -0.25, 0.25, 22.14, 25.61, 0.035, 0.14, cream);
          beam(out, 'trim', F.P(0, 24.02, 0.149), F.P(s * 1.39, 24.02, 0.149), 0.27, 0.15, cream);
          beam(
            out,
            'trim',
            F.P(s * 1.24, 22.5, 0.15),
            F.P(-s * 1.24, 25.4, 0.15),
            0.114,
            0.115,
            cream,
          );
        }
      }
    }
    for (const u of [-1.57, 0, 1.57]) {
      arch(out, F, u, 28.08, 1.04, 4.92, lod, { color: vent });
      if (lod > 1)
        for (let k = 0; k < 6; k++) {
          const y = 28.38 + k * 0.59;
          fbox(out, 'trim', F, u - 0.51, u + 0.51, y, y + 0.12, 0.045, 0.125, cream);
        }
    }
    if (lod > 0) {
      for (const u of [-0.72, 0.72]) arch(out, F, u, 8.78, 0.64, 12.23, lod, { kind: 'flat' });
      for (const u of [-halfw + 0.35, halfw - 0.35]) pilaster(out, F, u, 6.89, 34.47, 0.43, lod);
    }
  }
  const corners = [
    [x - r - 0.2, z + 4.0],
    [x + r + 0.2, z + 4.0],
    [x + r + 0.2, z - 4.0],
    [x - r - 0.2, z - 4.0],
  ];
  const center = [x, towerTop - 1.73, z];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    const ab = [a[0], ledge, a[1]],
      bb = [b[0], ledge, b[1]];
    const knee = (p) => [x + (p[0] - x) * 0.73, ledge + 2.08, z + (p[1] - z) * 0.73];
    quad4(out, 'metal', ab, bb, knee(b), knee(a), zinc);
    tri(out, 'metal', knee(a), knee(b), center, zinc);
    if (lod > 0) {
      const F = wallFace(a, b);
      const h = ledge + 3.34;
      const n = F.length / 2;
      tri(
        out,
        'metal',
        F.P(n - 0.71, h - 0.79, -0.89),
        F.P(n + 0.71, h - 0.79, -0.89),
        F.P(n, h + 0.95, -0.89),
        zinc,
      );
      arch(out, F, n, h - 0.37, 0.38, 0.57, lod, { color: gold, d: -0.87 });
    }
  }
  beam(out, 'metal', center, [x, towerTop - 0.49, z], 0.114, 0.114, zinc);
  beam(
    out,
    'metal',
    [x - 0.45, towerTop - 0.83, z],
    [x + 0.45, towerTop - 0.83, z],
    0.087,
    0.089,
    zinc,
  );
  if (lod > 1) {
    const p = [x, towerTop - 0.15, z];
    tri(out, 'metal', [x - 0.4, towerTop - 0.29, z], [x + 0.26, towerTop - 0.34, z], p, zinc);
    tri(out, 'metal', p, [x + 0.26, towerTop - 0.34, z], [x - 0.4, towerTop - 0.29, z], zinc);
    beam(out, 'metal', [x + 0.2, towerTop - 0.21, z], [x + 0.35, towerTop, z], 0.077, 0.079, zinc);
  }
  for (let i = 0; i < 3; i++) {
    const depth = 1.38 - i * 0.33;
    block(
      out,
      'base',
      x - 2.03,
      x + 2.03,
      z - 3.79 - depth,
      z - 3.69,
      -0.46,
      0.16 + i * 0.14,
      basalt,
    );
  }
}

function build(out, lod) {
  extrude(out, 'base', frame.geometry.outline, foundation, floor + 0.02, basalt, { top: false });
  nave(out, lod);
  sanctuary(out, lod);
  turret(out, -6.16, -21.05, lod);
  turret(out, 6.25, -21.05, lod);
  tower(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'st-nicholas-cathedral-da-lat-model.mjs';
const camera = [84, 40, -89];
const lookAt = [0, 17, -3];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The ochre-and-cream St. Nicholas Cathedral of Da Lat, with the 47 metre bell tower, conical stair turrets, and stepped tile roofs.',
  camera,
  lookAt,
  sunDirection: [31, 48, -28],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The identified footprint of the cathedral and bell tower.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'entrance-tower-and-rooster', position: camera, lookAt },
    { name: 'east-aisle-and-clerestory', position: [66, 16, -10], lookAt: [5, 16, -6] },
    { name: 'rounded-sanctuary-and-transept', position: [-51, 28, 59], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'da-lat-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
